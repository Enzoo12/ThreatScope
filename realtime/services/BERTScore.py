import torch
import torch.nn as nn
from transformers import AutoTokenizer, AutoModel
import numpy as np

class BertAutoencoderWithAttention(nn.Module):
    def __init__(self, embedding_dim=768, hidden_dim=384):
        super(BertAutoencoderWithAttention, self).__init__()

        # Encoder
        self.encoder = nn.Sequential(
            nn.Linear(embedding_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU()
        )

        # Attention Layer
        self.attention = nn.Linear(hidden_dim // 2, 1)

        # Decoder
        self.decoder = nn.Sequential(
            nn.Linear(hidden_dim // 2, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, embedding_dim)
        )

    def forward(self, x):
        encoded = self.encoder(x)

        # Attention Mechanism
        attention_weights = torch.softmax(self.attention(encoded), dim=0)
        attended_encoding = attention_weights * encoded

        # Decoder
        reconstructed = self.decoder(attended_encoding)
        return reconstructed, attention_weights


# ✅ Load BERT Tokenizer & Model
MODEL_NAME = "bert-base-uncased"
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
bert_model = AutoModel.from_pretrained(MODEL_NAME, output_hidden_states=True).to(device).eval()

# ✅ Load Trained Autoencoder Model
autoencoder = BertAutoencoderWithAttention().to(device)  # Use your defined model class
autoencoder.load_state_dict(torch.load(r"models\bert_autoencoder_best.pth", map_location=device))
autoencoder.eval()

def get_bert_embeddings(email_text):
    """Generate BERT token embeddings for an email text."""
    tokens = tokenizer(email_text, padding="max_length", truncation=True, max_length=154, return_tensors="pt")
    tokens = {key: val.to(device) for key, val in tokens.items()}

    with torch.no_grad():
        outputs = bert_model(**tokens)

    # Extract Layer 8 token-wise embeddings (Each token gets a 768D vector)
    hidden_states = outputs.hidden_states[8].squeeze(0)  # Shape: [154, 768]
    return hidden_states, tokens["input_ids"].squeeze(0)  # Return embeddings & token IDs

def analyze_email(email_text, top_n=2):
    """Find top anomalous words based on attention scores & compute email reconstruction error."""
    embeddings, token_ids = get_bert_embeddings(email_text)

    with torch.no_grad():
        reconstructed, attention_weights = autoencoder(embeddings)  # Forward pass

    # ✅ Compute token-wise attention scores
    attention_scores = attention_weights.squeeze().cpu().numpy()

    # ✅ Get the top N most attended (anomalous) tokens
    top_indices = np.argsort(attention_scores)[-top_n:][::-1].copy()  # Copy to avoid negative stride error
    anomalous_words = tokenizer.convert_ids_to_tokens(token_ids[top_indices])

    # ✅ Compute total reconstruction error (MSE loss per token, averaged over email)
    reconstruction_errors = torch.mean((reconstructed - embeddings) ** 2, dim=1).cpu().numpy()
    total_reconstruction_error = np.mean(reconstruction_errors)  # Average error over all tokens

    return total_reconstruction_error
    