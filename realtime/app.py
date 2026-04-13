import sys
# Fix Windows cp1252 encoding so emoji prints (🔄 ✅ ⚠️) in service modules don't crash
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import json
from flask import Flask, render_template, request, jsonify
from services.real_time_scoring import process_real_time_scoring
from services.kafka_consumer import start_kafka_consumer
import os
import pandas as pd
import ast
import io
from socketio_instance import socketio

app = Flask(__name__)  
socketio.init_app(app)

# Start Kafka Consumer when Flask starts
start_kafka_consumer()

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

stream_flags = {}
_processing_lock = False

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on("upload_csv")
def handle_csv_upload(data):
    global _processing_lock
    if _processing_lock:
        error = "Already processing a CSV. Please wait for the current job to finish."
        socketio.emit("csv_error", {"error": error})
        return {"ok": False, "error": error}

    file_content = (data or {}).get("fileContent")
    if not file_content:
        socketio.emit("csv_error", {"error": "Missing file content"})
        return {"ok": False, "error": "Missing file content"}

    file_name = os.path.join(UPLOAD_FOLDER, "uploaded.csv")
    if os.path.exists(file_name):
        os.remove(file_name)

    with open(file_name, "w", encoding="utf-8") as f:
        f.write(file_content)

    df = pd.read_csv(file_name)
    required_columns = {"user", "date", "activity_encoded"}
    if not required_columns.issubset(df.columns):
        error = "CSV must contain user, date, and activity_encoded"
        socketio.emit("csv_error", {"error": error})
        return {"ok": False, "error": error}

    df = df.dropna(subset=["user", "date", "activity_encoded"])
    if df.empty:
        error = "CSV has no valid rows to process"
        socketio.emit("csv_error", {"error": error})
        return {"ok": False, "error": error}

    rows = df.to_dict(orient="records")
    socketio.emit(
        "csv_success",
        {"message": f"CSV uploaded. Processing {len(rows)} rows ({df['user'].nunique()} users)..."},
    )

    _processing_lock = True
    socketio.start_background_task(process_csv_rows, rows)
    return {"ok": True, "rows": len(rows), "users": int(df["user"].nunique())}


def parse_activity_sequence(activity_raw):
    if isinstance(activity_raw, list):
        return [float(x) for x in activity_raw]
    try:
        parsed = ast.literal_eval(str(activity_raw))
        return [float(x) for x in parsed] if isinstance(parsed, (list, tuple)) else []
    except Exception:
        return []


def process_csv_rows(rows):
    global _processing_lock
    try:
        for row in rows:
            user = str(row.get("user", ""))
            date_val = pd.to_datetime(row.get("date"), errors="coerce")
            date = date_val.strftime("%d/%m/%Y") if pd.notna(date_val) else str(row.get("date", ""))

            activity_sequence = parse_activity_sequence(row.get("activity_encoded"))
            if not activity_sequence:
                continue

            try:
                process_real_time_scoring(user, date, activity_sequence, emit_done=False)
            except Exception as e:
                socketio.emit("producer_log", {"message": f"[{user}] Processing error: {e}"})

        socketio.emit("prediction_done")
    finally:
        _processing_lock = False


@socketio.on("start_stream")
def handle_start_stream(data):
    sid = request.sid
    stream_flags[sid] = False
    file_content = (data or {}).get("fileContent")
    step_delay_ms = (data or {}).get("stepDelayMs", 500)
    loop = bool((data or {}).get("loop", True))

    try:
        step_delay_ms = int(step_delay_ms)
    except Exception:
        step_delay_ms = 500

    if step_delay_ms < 10:
        step_delay_ms = 10
    if step_delay_ms > 5000:
        step_delay_ms = 5000

    if not file_content:
        socketio.emit("stream_error", {"error": "Missing file content"}, to=sid)
        return {"ok": False, "error": "Missing file content"}

    try:
        df = pd.read_csv(io.StringIO(file_content))
    except Exception as e:
        socketio.emit("stream_error", {"error": f"Failed to read CSV: {e}"}, to=sid)
        return {"ok": False, "error": f"Failed to read CSV: {e}"}

    required_columns = {"user", "date", "activity_encoded"}
    if not required_columns.issubset(df.columns):
        error = "CSV must contain user, date, and activity_encoded"
        socketio.emit("stream_error", {"error": error}, to=sid)
        return {"ok": False, "error": error}

    df = df.dropna(subset=["user", "date", "activity_encoded"])
    if df.empty:
        error = "CSV has no valid rows to stream"
        socketio.emit("stream_error", {"error": error}, to=sid)
        return {"ok": False, "error": error}

    stream_flags[sid] = True
    rows = df.to_dict(orient="records")
    socketio.emit(
        "stream_started",
        {"message": f"Streaming {len(rows)} rows ({df['user'].nunique()} users) every {step_delay_ms}ms"},
        to=sid,
    )
    socketio.start_background_task(stream_csv_rows, sid, rows, step_delay_ms / 1000.0, loop)
    return {"ok": True}


@socketio.on("stop_stream")
def handle_stop_stream(data=None):
    sid = request.sid
    stream_flags[sid] = False
    socketio.emit("stream_stopped", {"message": "Stream stopped"}, to=sid)
    return {"ok": True}


def stream_csv_rows(sid, rows, step_delay, loop):
    while stream_flags.get(sid):
        for row in rows:
            if not stream_flags.get(sid):
                break

            user = str(row.get("user", ""))
            date_val = pd.to_datetime(row.get("date"), errors="coerce")
            date = date_val.strftime("%d/%m/%Y") if pd.notna(date_val) else str(row.get("date", ""))

            activity_sequence = parse_activity_sequence(row.get("activity_encoded"))
            if not activity_sequence:
                continue

            try:
                process_real_time_scoring(
                    user,
                    date,
                    activity_sequence,
                    emit_done=False,
                    step_delay=step_delay,
                    stop_check=lambda: stream_flags.get(sid, False),
                )
            except Exception as e:
                socketio.emit("producer_log", {"message": f"[{user}] Stream error: {e}"}, to=sid)

        if not loop:
            break

    stream_flags[sid] = False
    socketio.emit("stream_finished", {"message": "Stream finished"}, to=sid)


@socketio.on('process_email_data')
def handle_process_email():
    default_file = os.path.join(UPLOAD_FOLDER, "uploaded.csv")
    if os.path.exists(default_file):
        file_path = default_file
    else:
        files = [f for f in os.listdir(UPLOAD_FOLDER) if f.endswith(".csv")]
        if not files:
            socketio.emit("email_processing_update", {"status": "No CSV file found."})
            return
        latest_file = max(files, key=lambda f: os.path.getmtime(os.path.join(UPLOAD_FOLDER, f)))
        file_path = os.path.join(UPLOAD_FOLDER, latest_file)

    socketio.start_background_task(process_email_data, file_path)


def process_email_data(file_name):
    from services.BERTScore import analyze_email
    from services.Knowledgebase import get_knowledge_base_score
    from services.Similarity import find_similar_emails

    df = pd.read_csv(file_name)
    
    if 'cleaned_content_x' not in df.columns:
        socketio.emit("email_processing_update", {"status": "Error: cleaned_content_x column not found in CSV."})
        return
    
    emails_data = []
    total_emails = len(df['cleaned_content_x'].dropna())
    for index, email_text in enumerate(df['cleaned_content_x'].dropna()):
        socketio.emit("email_processing_update", {"status": f"Processing email {index + 1}/{total_emails}..."})

        try:
            reconstruction_error = float(analyze_email(email_text))
            similar_emails_raw = find_similar_emails(email_text)
            anomalous_words, anomaly_score = get_knowledge_base_score(email_text)
        except Exception as e:
            socketio.emit("email_processing_update", {"status": f"Email processing failed: {e}"})
            continue

        highlighted_email = highlight_anomalous_words(email_text, anomalous_words)

        similar_emails = [
            {"rank": i + 1, "similarity_score": float(score), "email": email}
            for i, (email, score) in enumerate(similar_emails_raw)
        ]
        
        email_result = {
            "email_text": highlighted_email,
            "reconstruction_error": reconstruction_error,
            "similar_emails": similar_emails,
            "anomaly_score": float(anomaly_score)
        }
        emails_data.append(email_result)
    
    socketio.emit('email_analysis', json.dumps(emails_data, indent=2))
    socketio.emit("email_processing_update", {"status": "Processing complete!"})


def highlight_anomalous_words(email_text, anomalous_words):
    for word in anomalous_words:
        email_text = email_text.replace(word, f"<strong>{word}</strong>")
    return email_text





if __name__ == "__main__":  
    socketio.run(app, host="0.0.0.0", port=5000, allow_unsafe_werkzeug=True)  
