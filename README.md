# 🏥 Rural Telemedicine Access

<div align="center">

<img src="https://readme-typing-svg.herokuapp.com?font=Orbitron&size=40&duration=3000&pause=1000&color=00D4FF&center=true&vCenter=true&width=800&lines=🏥+RURAL+TELEMEDICINE+ACCESS;Bridging+Healthcare+Gaps;AI-Powered+%7C+Realtime+%7C+Secure" alt="Typing SVG" />

<br/>

[![Django](https://img.shields.io/badge/Django-5.2-092E20?style=for-the-badge&logo=django&logoColor=white)](https://djangoproject.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![WebRTC](https://img.shields.io/badge/WebRTC-Realtime_Video-FF6B35?style=for-the-badge&logo=webrtc&logoColor=white)](https://webrtc.org)
[![Redis](https://img.shields.io/badge/Redis-Celery_Tasks-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Ollama](https://img.shields.io/badge/Ollama-Local_AI-7C3AED?style=for-the-badge&logo=llama&logoColor=white)](https://ollama.com)

<br/>

> **🚀 A comprehensive full-stack telemedicine platform connecting patients, doctors, and pharmacists in rural areas through secure real-time WebRTC consultations, local AI-powered medical assistants, and smart prescription/order management.**

</div>

---

## 📖 Table of Contents
- [📸 Platform Overview](#-platform-overview)
- [✨ Key Features](#-key-features)
- [👥 Role-Based Capabilities](#-role-based-capabilities)
- [🛠️ Tech Stack](#️-tech-stack)
- [🏗️ Project Architecture](#️-project-architecture)
- [🚀 Local Setup & Installation](#-local-setup--installation)
- [🌐 Core API Endpoints](#-core-api-endpoints)
- [🔒 Security & E2E Encryption](#-security--e2e-encryption)
- [📶 Offline & PWA Capabilities](#-offline--pwa-capabilities)

---

## 📸 Platform Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    RURAL TELEMEDICINE ACCESS                    │
│                                                                 │
│   👤 Patient          🩺 Doctor             💊 Pharmacist       │
│   ───────────         ───────────           ──────────────      │
│   • Book Visits       • Video Consultation  • Verify Rx         │
│   • AI Chatbot        • Write Digital Rx    • Manage Inventory  │
│   • Order Medicines   • Manage Schedule     • Dispatch Orders   │
│   • Track Vitals      • View Analytics      • AI Drug Entry     │
└────────┬───────────────────┬──────────────────────┬─────────────┘
         │                   │                      │
         └─────────────► 🗄️ SQLite Database ◄────────┘
                             ▲
                             │ (Celery Beat Reminders)
                             │
                      ⏰ Redis Broker
```

---

## ✨ Key Features

### 🎥 Real-Time Video Consultations & Doctor Copilot
* **WebRTC Peer-to-Peer Calls**: High-quality, low-latency video and audio calling directly in the browser.
* **WebSocket Signaling**: Powered by Django Channels and Daphne for reliable signaling and instant chat messages during calls.
* **Doctor Copilot**: Real-time transcription, language detection, and medical suggestion system powered by the AI backend during live consultations.
* **Dynamic Prescriptions**: Doctors can generate prescriptions immediately upon call termination.

### 🤖 AI Medical Assistant & Chatbot
* **Local LLM Execution**: Powered by Ollama using local LLMs (e.g., Llama 3) to protect patient privacy and operate offline.
* **Retrieval-Augmented Generation (RAG)**: Enhanced context matching via a local FAISS vector store.
* **Voice Interaction**: Built-in Web Speech API for voice-to-text input and Text-to-Speech (TTS) response playback.
* **Context Preservation**: Sidebars caching conversation history for continuous patient guidance.
* **AI Image Analyzer**: Pharmacists and doctors can upload packaging photos to automatically extract drug details.

### 📋 Digital Prescription Management
* **PDF Exporter**: Single-click PDF downloads of prescriptions utilizing `jsPDF` and `html2canvas`.
* **OCR Scanner**: Built-in Tesseract.js module allowing patients to upload physical prescription photos and extract textual information.
* **Pharmacist Validation**: Two-step verification preventing fulfillment of unauthorized or expired prescriptions.

### 💊 E-Pharmacy & Order Flow
* **Medicine Catalog**: Interactive search and detailed views for drugs, including dosages, pricing, and batch details.
* **Shopping Cart**: Fully functional checkout flow linking patients directly with nearby registered pharmacies.
* **Order Status Pipeline**: End-to-end tracking: `Pending` ➔ `Confirmed` ➔ `Shipped` ➔ `Delivered`.

### ⏰ Medicine Reminders & Offline Sync
* **Celery & Redis**: Background task execution preventing main thread blockage.
* **Periodic Schedules**: `django-celery-beat` triggers automated daily email alerts reminding patients to take their medications.
* **Offline Scheduler**: Native PWA scheduler tracking medication times locally when disconnected from the internet.

---

## 👥 Role-Based Capabilities

### 🧑‍⚕️ Patient Portal
* **Appointment Booking**: Select doctors by specialty, date, and available time slots.
* **Personal Health Record (PHR)**: Log vitals (heart rate, blood pressure, temperature) and view trends over time.
* **Nearby Medical Stores**: Geo-location mapping to find nearby pharmacy branches.
* **Language Customization**: Persistent language selectors with storage settings across sessions.

### 👨‍⚕️ Doctor Portal
* **Schedule Editor**: Define custom working days, fees, and active hourly slots.
* **Patient History Access**: Review previous prescriptions, symptom logs, and vitals before a call.
* **Income & Consultation Analytics**: Visualized revenue charts and feedback statistics.
* **Real-time AI Copilot**: Inline AI diagnostics and drug recommendations during video calls.

### 💊 Pharmacist Portal
* **Inventory Control**: Add products, track expiry dates, manage batch numbers, and update stock.
* **AI Medication Input**: Autofill details (name, generic name, usage) using AI-based parsing of package details.
* **OTP Verification**: Secure login workflows validating pharmacist identities.

---

## 🛠️ Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19, Tailwind CSS, Material UI (MUI) | Component-driven UI and responsive layout |
| **Backend** | Django 5.2, Django REST Framework (DRF) | Core API, REST endpoints, and authentication |
| **WebSockets** | Django Channels 4.0, Daphne | Real-time signaling and messaging |
| **AI/ML Engine** | Ollama (Llama 3/3.2), FAISS, Tesseract.js | Local medical assistant, vector index, and OCR |
| **Task Queue** | Celery 5.6, Redis 5.0, Django Celery Beat | Async email reminders and background schedules |
| **Database** | SQLite (Local Dev) / PostgreSQL (Production ready) | Relational database persistent storage |
| **Caching/Offline** | IndexedDB, Service Workers | Local client database and progressive web app layers |
| **Security** | Web Crypto API (AES-GCM, PBKDF2), SimpleJWT | Client-side E2E encryption and JWT-based session auth |

---

## 🏗️ Project Architecture

```
medical-chatbot-django-react/
│
├── 🖥️ backend/                         # Django Application
│   ├── api/
│   │   ├── models.py                   # User Profiles, Appointments, Medicines, Prescriptions
│   │   ├── views.py                    # REST APIs and business logic
│   │   ├── consumers.py                # WebSocket Consumers for chat/video signaling
│   │   ├── tasks.py                    # Background Celery email reminders
│   │   ├── helpers.py                  # Ollama client and RAG search helpers
│   │   ├── ocr_utils.py                # Tesseract OCR extraction logic
│   │   └── urls.py                     # API routing
│   │
│   ├── medical_backend/
│   │   ├── settings.py                 # Core configurations (SQLite fallback, Cors, SimpleJWT)
│   │   ├── celery.py                   # Celery app bootstrapper
│   │   └── asgi.py                     # ASGI server routing for HTTP & WebSockets
│   │
│   ├── manage.py
│   ├── start.sh                        # Daphne & Celery startup runner script
│   └── requirements.txt                # Consolidated backend dependencies
│
└── 🎨 frontend/                        # React Application
    ├── src/
    │   ├── components/
    │   │   ├── video/                  # WebRTC Video Consultation components
    │   │   ├── chat/                   # AI chatbot UI & voice assistant
    │   │   ├── prescriptions/          # Prescription views and PDF generator
    │   │   ├── auth/                   # Registration, login, and Role-Based Access controls
    │   │   ├── health/                 # Health tracking widgets and vitals charts
    │   │   └── common/                 # Reusable layout elements and LanguageSelector
    │   │
    │   ├── services/
    │   │   ├── api.js                  # Axios client configuration for REST calls
    │   │   ├── e2eEncryption.js        # Web Crypto API AES-GCM helper
    │   │   ├── indexedDB.js            # Offline database client (reminders, logs)
    │   │   └── pwaService.js           # SW bridge, background sync, push notifications
    │   │
    │   ├── index.css                   # Global stylesheets & Tailwind configurations
    │   └── main.jsx                    # React entrypoint
    │
    ├── package.json
    └── tailwind.config.js              # CSS utility engine configurations
```

---

## 🚀 Local Setup & Installation

### Prerequisites
* **Python 3.11+**
* **Node.js 18+**
* **Redis Server** (listening on `localhost:6379`)
* **Ollama CLI** (Ensure you pull a model: `ollama pull llama3`)

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/abhishekmnair81/TELEMEDICINE-ACCESS.git
cd TELEMEDICINE-ACCESS
```

### 2️⃣ Backend Configuration
Navigate to the `backend` folder, set up a virtual environment, and install dependencies:
```bash
cd backend

# Create & activate virtual environment
python -m venv venv
venv\Scripts\activate           # On Windows
# source venv/bin/activate      # On Linux/macOS

# Install unified requirements
pip install -r requirements.txt

# Run migrations and setup local SQLite database
python manage.py migrate

# Create your admin account
python manage.py createsuperuser

# Start the local development server (Daphne/Channels support)
python manage.py runserver
```
The backend server runs locally on **http://127.0.0.1:8000**

### 3️⃣ Background Workers (Celery & Redis)
Ensure your local Redis server is active, then launch Celery in separate terminals:
```bash
# Terminal 1: Run Celery Worker
venv\Scripts\activate
celery -A medical_backend worker --loglevel=info

# Terminal 2: Run Celery Beat Scheduler
venv\Scripts\activate
celery -A medical_backend beat --loglevel=info
```

### 4️⃣ Frontend Configuration
Navigate to the `frontend` directory, install packages, and boot the dev server:
```bash
cd ../frontend

# Install dependencies
npm install

# Start React app
npm start
```
The interface is now live at **http://localhost:3000**

---

## 🌐 Core API Endpoints

| Category | Endpoint | Method | Description |
| :--- | :--- | :--- | :--- |
| **Authentication** | `/api/auth/register/` | `POST` | Registers a CustomUser (Patient/Doctor/Pharmacist) |
| | `/api/auth/login/<str:user_type>/` | `POST` | Exchanges credentials for JWT access/refresh tokens |
| | `/api/auth/send-otp-login/` | `POST` | Dispatches passwordless OTP authentication code |
| | `/api/auth/verify-otp-login/` | `POST` | Verifies OTP code and authenticates the session |
| **Appointments** | `/api/appointments/` | `GET/POST` | Fetch or request doctor consultations |
| **Prescriptions** | `/api/prescriptions/` | `GET/POST` | Retrieve or generate patient prescriptions |
| | `/api/prescriptions/scan/` | `POST` | Parses physical prescription cards using Tesseract OCR |
| **Medicines** | `/api/medicines/` | `GET/POST` | Search catalog or upload inventory batch |
| | `/api/medicines/analyze-image/` | `POST` | Uses AI to classify & parse medicine package details |
| **Orders** | `/api/orders/` | `GET/POST` | Order medicines, view cart checkout, track shipment |
| **Chatbot** | `/api/chatbot/` | `POST` | Triggers LLM diagnosis check using Ollama RAG |
| **Med Reminders** | `/api/medication-reminders/sync-logs/` | `POST` | Reconciles cached offline logs with backend server |
| | `/api/medication-reminders/adherence-prediction/` | `GET` | Generates adherence metrics and prediction models |
| **Consultation** | `/api/video-consultations/process-copilot-audio/` | `POST` | Processes doctor live audio stream for inline copilot |

---

## 🔒 Security & E2E Encryption
* **End-to-End Chat Encryption (E2EE)**: Messages exchanged within video consultation rooms are encrypted locally in the patient's and doctor's browsers using the Web Crypto API (`AES-GCM-256`). Room-specific decryption keys are derived on the fly using `PBKDF2` with a robust salt and 100,000 iterations.
* **Role-Based Access Control (RBAC)**: Custom routing middleware validates roles (Patient, Doctor, Pharmacist) before mounting specific portal interfaces.
* **Token Auth (SimpleJWT)**: Secure stateless API calls using JSON Web Tokens with automated blacklist handling.
* **CORS & CSRF Isolation**: Configured to restrict requests solely to allowed origins (e.g., frontend running on port 3000).
* **Local AI Execution**: LLM chats execute locally on-site via Ollama, preventing medical query leakage outside the local environment.

---

## 📶 Offline & PWA Capabilities
* **PWA Installability**: Progressive Web App layout that runs standalone on mobile devices and desktops.
* **IndexedDB Store (`MediReminderDB`)**: Handles offline caching for:
  - Active medication reminders (`reminders` store).
  - Patient intake/missed confirmation logs (`logs` store).
  - Periodic background check schedules.
* **Background Sync**: Uses PWA service worker background sync registration (`sync-medication-logs`). When connection drops, confirmation logs queue up and automatically synchronize when internet access is restored.
* **Push Notifications**: Generates custom desktop and mobile browser notifications for medication reminders. Supports quick-action buttons directly from the notification shade (Mark as Taken, Snooze, Skip) that function even when offline.
* **Premium Hologram Loader**: A custom-designed, 3D Y-axis spinning green heartbeat loader with a glowing radial gradient background that acts as a fallback pre-hydration screen in `index.html` and a loading screen across application portals.

---

## 👨‍💻 Author

<div align="center">

**Abhishek M Nair**

[![GitHub](https://img.shields.io/badge/GitHub-abhishekmnair81-181717?style=for-the-badge&logo=github)](https://github.com/abhishekmnair81)

*Built with ❤️ to make healthcare accessible to everyone*

</div>
