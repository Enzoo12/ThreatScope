# 🚀 Welcome to the Insider Threat Detection Dashboard (Local Setup Guide)

This project is structured into **three separate branches** to streamline development and deployment:

1. **Frontend**  
2. **Backend for Real-time Detection**
3. **Backend for Daily Basis Detection**

---

## 📦 Prerequisites

Before getting started, make sure the following tools are installed on your machine:

1. **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (Sign in with your account)
2. **[Visual Studio Code](https://code.visualstudio.com/)** (We'll use this to create a virtual environment)
3. **[Node.js](https://nodejs.org/en/)** (Version 18+ recommended)
4. **npm** (Usually comes with Node.js)
5. **Git** (Version control system)

---

## 🛠️ Setup Instructions

### Step 1: Project Structure

1. Create a folder named `root`.
2. Open the folder in **VS Code**.
3. Clone all three repositories into this folder:

```bash
git clone --branch Real+DailyFrontend https://github.com/Keshav-CUJ/Insider-Threat-detection.git frontend
git clone --branch RealtimeBackend https://github.com/Keshav-CUJ/Insider-Threat-detection.git RealtimeBackend
git clone --branch DailyBasisBackend https://github.com/Keshav-CUJ/Insider-Threat-detection.git DailyBasisBackend
```

---

### Step 2: Set Up Virtual Environment

In the terminal (PowerShell), ensure you’re in the `root` folder and run:

```powershell
python3.9 -m venv Newvenv
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\Newvenv\Scripts\Activate.ps1
```

---

### Step 3: Install Python Dependencies

Move the `requirements.txt` file from the `frontend` (kept for avoiding embiguity) directory to the root folder. Then, run:

```bash
pip install -r requirements.txt
```

---

### Step 4: Setup Frontend

```bash
cd frontend
npm install
```

---

### Step 5: Run All Services

#### Start the **Daily Basis Backend**:

```bash
cd ../DailyBasisBackend
python app.py
# Runs on http://localhost:5001
```

> Open a **new terminal** for each of the following steps.

#### Start the **Real-time Backend with Kafka**:

```bash
cd ../RealtimeBackend
docker-compose up
# Kafka logs will start appearing
```

#### Run the **Real-time Backend Flask app**:

```bash
cd RealtimeBackend
python app.py
# Runs on http://localhost:5000
```

#### Start the **Frontend**:

```bash
cd ../frontend
npm start
```

Once it compiles successfully, it will automatically open the dashboard in your browser at:

```
http://localhost:3000
```

If not, manually visit the link.

---

## 📤 Uploading CSV Files

- **Real-time Dashboard**: Upload CSV from `RealtimeBackend/uploads`
- **Daily Basis Dashboard**: Upload CSV from `RealtimeBackend/uploads` (yes, same directory)

---

## 🎥 Video Tutorial

<a href="https://youtu.be/0EE-MvzcNZk" target="_blank">
  <img src="pictures/flat,1000x1000,075,f.u1.jpg" alt="Watch the video" width="400"/>
</a>

---