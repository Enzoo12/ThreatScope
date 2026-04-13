from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
from dailybasis import get_anomaly_scores,  preprocess_csv  

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])


UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'csv'}

# Ensure upload folder exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        print("No file part in request")
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        print("No selected file")
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)

        # DEBUG: Print file path before saving
        print(f"Saving file to: {filepath}")

        file.save(filepath)

        # Check if file exists after saving
        if os.path.exists(filepath):
            print("File successfully saved!")
        else:
            print("File saving failed!")

        return jsonify({'message': 'File uploaded successfully', 'filename': filename})
    
    print("Invalid file format")
    return jsonify({'error': 'Invalid file format'}), 400

@app.route('/get_user_dates', methods=['GET'])
def get_user_dates():
    all_users = {}
    
    latest_file = get_latest_file()
    if not latest_file:
        return jsonify({'users': {}})

    df = pd.read_csv(latest_file)
    if "day" not in df.columns and "date" in df.columns:
        df["day"] = df["date"]

    if 'user' in df.columns and 'day' in df.columns:
        for _, row in df.iterrows():
            user = row['user']
            date = row['day']
            
            if user not in all_users:
                all_users[user] = set()
            all_users[user].add(date)
    
    # Convert set to list for JSON serialization
    all_users = {user: list(dates) for user, dates in all_users.items()}
    return jsonify({'users': all_users})


def get_latest_file():
    """Fetches the latest uploaded file from the uploads folder."""
    files = [os.path.join(UPLOAD_FOLDER, f) for f in os.listdir(UPLOAD_FOLDER) if f.endswith('.csv')]
    if not files:
        return None
    return max(files, key=os.path.getctime)  # Get the most recently modified file


@app.route('/predict', methods=['POST'])
def predict():
    """Loads the latest uploaded CSV, processes it, and returns anomaly scores."""
    latest_file = get_latest_file()
    if not latest_file:
        return jsonify({"error": "No uploaded files found"}), 400
    
    df, X = preprocess_csv(latest_file)

    if "date" in df.columns and "day" not in df.columns:
        df["day"] = df["date"]

    scores = get_anomaly_scores(df, X, baseline_exclude_path=latest_file)
    
    return jsonify({"anomaly_data": scores})

if __name__ == '__main__':
    app.run(debug=True, port=5001)