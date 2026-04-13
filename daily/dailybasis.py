import pandas as pd
import numpy as np
import tensorflow as tf
import ast
import os
import json

# Load model
MODEL_PATH = r"model\best_lstm_autoencoder2.h5"
model = tf.keras.models.load_model(MODEL_PATH)

MAX_SEQ_LENGTH = 74
WINDOW_STRIDE = 10


def _parse_activity_sequence(value):
    if isinstance(value, list):
        return value
    try:
        parsed = ast.literal_eval(str(value))
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def _to_fixed_length(seq):
    if not isinstance(seq, list):
        seq = []
    seq = seq[:MAX_SEQ_LENGTH]
    if len(seq) < MAX_SEQ_LENGTH:
        seq = seq + [99] * (MAX_SEQ_LENGTH - len(seq))
    return seq


def _compute_mse(X):
    X = X.reshape((-1, MAX_SEQ_LENGTH, 1))
    reconstructions = model.predict(X, verbose=0)
    return np.mean(np.square(X - reconstructions), axis=(1, 2))


def _window_starts(seq_len):
    if seq_len <= MAX_SEQ_LENGTH:
        return [0]
    last_start = seq_len - MAX_SEQ_LENGTH
    starts = list(range(0, last_start + 1, WINDOW_STRIDE))
    if starts[-1] != last_start:
        starts.append(last_start)
    return starts


def _compute_windowed_mse_stats(sequences):
    windows = []
    window_to_row = []
    window_counts = np.zeros(len(sequences), dtype=int)

    for row_idx, seq in enumerate(sequences):
        starts = _window_starts(len(seq))
        window_counts[row_idx] = len(starts)
        for s in starts:
            window = _to_fixed_length(seq[s : s + MAX_SEQ_LENGTH])
            windows.append(window)
            window_to_row.append(row_idx)

    if not windows:
        empty = np.array([], dtype=float)
        return empty, empty, np.zeros(len(sequences), dtype=int)

    X = np.array(windows, dtype=float)
    mse_windows = _compute_mse(X)

    row_max = np.full(len(sequences), -np.inf, dtype=float)
    row_sum = np.zeros(len(sequences), dtype=float)

    for w_idx, row_idx in enumerate(window_to_row):
        val = float(mse_windows[w_idx])
        if val > row_max[row_idx]:
            row_max[row_idx] = val
        row_sum[row_idx] += val

    row_mean = row_sum / np.maximum(window_counts, 1)
    return row_max, row_mean, window_counts


_BASELINE_CACHE = {"key": None, "sorted": None, "meta": None}


def _iter_upload_csv_paths(exclude_path=None):
    uploads_dir = "uploads"
    if not os.path.isdir(uploads_dir):
        return []
    exclude_norm = os.path.abspath(exclude_path) if exclude_path else None
    paths = []
    for name in os.listdir(uploads_dir):
        if not name.lower().endswith(".csv"):
            continue
        full = os.path.abspath(os.path.join(uploads_dir, name))
        if exclude_norm and full == exclude_norm:
            continue
        paths.append(full)
    return sorted(paths)


def _baseline_cache_key(paths):
    parts = []
    for p in paths:
        try:
            stat = os.stat(p)
            parts.append((p, int(stat.st_mtime), int(stat.st_size)))
        except OSError:
            continue
    return tuple(parts)


def _get_baseline_sorted_mse(*, exclude_path=None):
    paths = _iter_upload_csv_paths(exclude_path=exclude_path)
    key = _baseline_cache_key(paths)
    if _BASELINE_CACHE["key"] == key:
        return _BASELINE_CACHE["sorted"], _BASELINE_CACHE["meta"]

    all_sequences = []
    for path in paths:
        try:
            df = pd.read_csv(path)
        except Exception:
            continue
        if "activity_encoded" not in df.columns:
            continue
        values = df["activity_encoded"].tolist()
        for v in values:
            seq = _parse_activity_sequence(v)
            all_sequences.append(seq)

    if not all_sequences:
        _BASELINE_CACHE["key"] = key
        _BASELINE_CACHE["sorted"] = None
        _BASELINE_CACHE["meta"] = {"files": 0, "rows": 0}
        return None, _BASELINE_CACHE["meta"]

    row_max, _row_mean, window_counts = _compute_windowed_mse_stats(all_sequences)
    finite = row_max[np.isfinite(row_max)]
    if finite.size == 0:
        _BASELINE_CACHE["key"] = key
        _BASELINE_CACHE["sorted"] = None
        _BASELINE_CACHE["meta"] = {"files": len(paths), "rows": len(all_sequences), "windows": int(window_counts.sum())}
        return None, _BASELINE_CACHE["meta"]

    sorted_mse = np.sort(finite)
    _BASELINE_CACHE["key"] = key
    _BASELINE_CACHE["sorted"] = sorted_mse
    _BASELINE_CACHE["meta"] = {"files": len(paths), "rows": int(sorted_mse.size), "windows": int(window_counts.sum())}
    return sorted_mse, _BASELINE_CACHE["meta"]


def _mse_to_percentile_score(mse_values, *, baseline_sorted):
    if baseline_sorted is None or baseline_sorted.size == 0:
        return None
    idx = np.searchsorted(baseline_sorted, mse_values, side="right")
    percentile = (idx / baseline_sorted.size) * 100.0
    score = np.ceil(percentile)
    return np.clip(score, 1, 100)

_KB_CACHE = {"path": None, "data": None}


def _get_kb():
    base_dir = os.path.dirname(__file__)
    path = os.path.abspath(os.path.join(base_dir, "..", "RealtimeBackend", "storage", "anomalous_knowledge_base.json"))
    if _KB_CACHE["path"] == path and _KB_CACHE["data"] is not None:
        return _KB_CACHE["data"]
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        data = None
    _KB_CACHE["path"] = path
    _KB_CACHE["data"] = data
    return data


def _kb_text_score(text):
    if not isinstance(text, str) or not text.strip():
        return 0.0
    kb = _get_kb()
    if not kb:
        return 0.0

    text_l = text.lower()
    words = text_l.split()
    matched_scores = []

    word_scores = kb.get("words", {})
    for w in words:
        if w in word_scores:
            matched_scores.append(float(word_scores[w]))

    for grams_key in ("bigrams", "trigrams", "tetragrams"):
        grams = kb.get(grams_key, {})
        for phrase, score in grams.items():
            if phrase in text_l:
                matched_scores.append(float(score))

    return float(np.mean(matched_scores)) if matched_scores else 0.0


_TEXT_BASELINE_CACHE = {"key": None, "sorted": None, "meta": None}


def _get_baseline_sorted_text_scores(*, exclude_path=None):
    paths = _iter_upload_csv_paths(exclude_path=exclude_path)
    key = ("text",) + _baseline_cache_key(paths)
    if _TEXT_BASELINE_CACHE["key"] == key:
        return _TEXT_BASELINE_CACHE["sorted"], _TEXT_BASELINE_CACHE["meta"]

    scores = []
    for path in paths:
        try:
            df = pd.read_csv(path)
        except Exception:
            continue
        if "cleaned_content_x" not in df.columns:
            continue
        for t in df["cleaned_content_x"].dropna().astype(str).tolist():
            scores.append(_kb_text_score(t))

    if not scores:
        _TEXT_BASELINE_CACHE["key"] = key
        _TEXT_BASELINE_CACHE["sorted"] = None
        _TEXT_BASELINE_CACHE["meta"] = {"files": len(paths), "rows": 0}
        return None, _TEXT_BASELINE_CACHE["meta"]

    arr = np.array(scores, dtype=float)
    finite = arr[np.isfinite(arr)]
    if finite.size == 0:
        _TEXT_BASELINE_CACHE["key"] = key
        _TEXT_BASELINE_CACHE["sorted"] = None
        _TEXT_BASELINE_CACHE["meta"] = {"files": len(paths), "rows": len(scores)}
        return None, _TEXT_BASELINE_CACHE["meta"]

    sorted_scores = np.sort(finite)
    _TEXT_BASELINE_CACHE["key"] = key
    _TEXT_BASELINE_CACHE["sorted"] = sorted_scores
    _TEXT_BASELINE_CACHE["meta"] = {"files": len(paths), "rows": int(sorted_scores.size)}
    return sorted_scores, _TEXT_BASELINE_CACHE["meta"]


def preprocess_csv(file_path):
    df = pd.read_csv(file_path)

    # convert string → list
    df["activity_encoded"] = df["activity_encoded"].apply(_parse_activity_sequence)

    fixed_sequences = []

    for seq in df['activity_encoded']:
        fixed_sequences.append(_to_fixed_length(seq))

    X = np.array(fixed_sequences, dtype=float)

    return df, X


def get_anomaly_scores(df, X, *, baseline_exclude_path=None):
    sequences = df["activity_encoded"].tolist() if "activity_encoded" in df.columns else []
    row_max, row_mean, window_counts = _compute_windowed_mse_stats(sequences)
    df["raw_mse"] = row_max
    df["raw_mse_mean"] = row_mean
    df["window_count"] = window_counts

    baseline_sorted, _baseline_meta = _get_baseline_sorted_mse(exclude_path=baseline_exclude_path)
    percentile_scores = _mse_to_percentile_score(row_max, baseline_sorted=baseline_sorted)
    if percentile_scores is not None:
        df["activity_score"] = percentile_scores
    else:
        min_score = np.min(row_max)
        max_score = np.max(row_max)
        if max_score == min_score:
            df["activity_score"] = np.ones_like(row_max) * 50
        else:
            df["activity_score"] = ((row_max - min_score) / (max_score - min_score)) * 99 + 1

    if "cleaned_content_x" in df.columns:
        text_scores = df["cleaned_content_x"].fillna("").astype(str).apply(_kb_text_score).astype(float).to_numpy()
        df["text_score_raw"] = text_scores

        text_baseline_sorted, _text_meta = _get_baseline_sorted_text_scores(exclude_path=baseline_exclude_path)
        text_percentile = _mse_to_percentile_score(text_scores, baseline_sorted=text_baseline_sorted)
        if text_percentile is None:
            finite = text_scores[np.isfinite(text_scores)]
            if finite.size > 0 and float(np.max(finite) - np.min(finite)) > 0:
                rng = float(np.max(finite) - np.min(finite))
                text_percentile = ((text_scores - float(np.min(finite))) / rng) * 99 + 1
            else:
                text_percentile = np.ones_like(text_scores) * 1

        df["text_score"] = np.clip(np.ceil(text_percentile), 1, 100)
        combined = (0.85 * df["activity_score"].to_numpy(dtype=float)) + (0.15 * df["text_score"].to_numpy(dtype=float))
        df["anomaly_score"] = np.clip(np.rint(combined), 1, 100)
    else:
        df["anomaly_score"] = df["activity_score"]

    # ✅ FIX missing 'day'
    if 'day' not in df.columns and 'date' in df.columns:
        df['day'] = df['date']

    output_cols = ["user", "day", "anomaly_score", "raw_mse", "raw_mse_mean", "window_count"]
    if "text_score_raw" in df.columns:
        output_cols += ["activity_score", "text_score", "text_score_raw"]
    return df[output_cols].to_dict(orient="records")
