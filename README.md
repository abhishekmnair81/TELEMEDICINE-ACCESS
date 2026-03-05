<div align="center">

<img src="https://readme-typing-svg.herokuapp.com?font=Orbitron&size=40&duration=3000&pause=1000&color=00D4FF&center=true&vCenter=true&width=800&lines=🏥+TELEMEDICINE+ACCESS;Bridging+Healthcare+Gaps;AI-Powered+%7C+Realtime+%7C+Secure" alt="Typing SVG" />

<br/>

[![Django](https://img.shields.io/badge/Django-5.2-092E20?style=for-the-badge&logo=django&logoColor=white)](https://djangoproject.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![WebRTC](https://img.shields.io/badge/WebRTC-Realtime_Video-FF6B35?style=for-the-badge&logo=webrtc&logoColor=white)](https://webrtc.org)
[![Redis](https://img.shields.io/badge/Redis-Celery_Tasks-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Ollama](https://img.shields.io/badge/Ollama-Local_AI-7C3AED?style=for-the-badge&logo=llama&logoColor=white)](https://ollama.com)

<br/>

> **🚀 A full-stack telemedicine platform connecting patients, doctors, and pharmacists through real-time video consultations, AI-powered diagnostics, and smart prescription management.**

<br/>

[![GitHub stars](https://img.shields.io/github/stars/abhishekmnair81/TELEMEDICINE-ACCESS?style=social)](https://github.com/abhishekmnair81/TELEMEDICINE-ACCESS/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/abhishekmnair81/TELEMEDICINE-ACCESS?style=social)](https://github.com/abhishekmnair81/TELEMEDICINE-ACCESS/network)

</div>

---

## 📸 Platform Overview

```
╔══════════════════════════════════════════════════════════════════╗
║                    TELEMEDICINE ACCESS                           ║
║                                                                  ║
║   👤 Patient      🩺 Doctor         💊 Pharmacist               ║
║   ──────────      ────────────       ────────────                ║
║   Book Visits  →  Video Consult  →  Fill Prescriptions          ║
║   AI Chatbot      Write Rx          Manage Inventory             ║
║   Order Meds      Manage Schedule   Process Orders               ║
║   Track Health    View Analytics    Track Deliveries             ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## ✨ Key Features

<table>
<tr>
<td width="50%">

### 🎥 Real-Time Video Consultations
- **WebRTC peer-to-peer** video calling
- **Django Channels** WebSocket signaling
- Live chat during consultation
- Prescription generation post-call
- Room-based session management

### 🤖 AI Medical Chatbot
- Powered by **Ollama** (local LLM)
- Context-aware medical Q&A
- Indexed knowledge base with FAISS
- Voice input via **Web Speech API**
- Conversation history & sidebar

### 📋 Smart Prescription Management
- Digital prescription creation by doctors
- **OCR scanning** via Tesseract.js
- PDF export with `jsPDF` + `html2canvas`
- Pharmacist prescription verification
- Medicine reminder scheduling

</td>
<td width="50%">

### 💊 Online Pharmacy & Orders
- Full-featured **medicine catalog**
- Shopping cart & checkout flow
- Order tracking (Pending → Delivered)
- Nearby **medical stores** locator
- Inventory batch tracking

### ⏰ Medicine Reminder System
- **Celery + Redis** async task queue
- `django-celery-beat` periodic scheduling
- Email reminders for prescriptions
- Automated follow-up notifications

### 🏥 Role-Based Dashboards
- **Patient**: Health records, appointments, orders
- **Doctor**: Schedule, consultations, analytics
- **Pharmacist**: Inventory, orders, product management
- **Admin**: Full platform oversight via Django Admin

</td>
</tr>
</table>

---

## 🛠️ Tech Stack

<table>
<tr>
<th>Layer</th>
<th>Technology</th>
<th>Purpose</th>
</tr>
<tr>
<td>🎨 <strong>Frontend</strong></td>
<td>React 19, React Router v7, MUI v7</td>
<td>UI components & routing</td>
</tr>
<tr>
<td>⚙️ <strong>Backend</strong></td>
<td>Django 5.2, Django REST Framework</td>
<td>REST API & business logic</td>
</tr>
<tr>
<td>🔌 <strong>Real-time</strong></td>
<td>Django Channels, WebSockets, WebRTC</td>
<td>Video calls & live chat</td>
</tr>
<tr>
<td>🤖 <strong>AI/ML</strong></td>
<td>Ollama (local LLM), FAISS, OCR</td>
<td>Medical chatbot & document scanning</td>
</tr>
<tr>
<td>📊 <strong>Charts</strong></td>
<td>Chart.js, react-chartjs-2</td>
<td>Health analytics & dashboards</td>
</tr>
<tr>
<td>⏱️ <strong>Task Queue</strong></td>
<td>Celery, Redis, django-celery-beat</td>
<td>Email reminders & async tasks</td>
</tr>
<tr>
<td>🔐 <strong>Auth</strong></td>
<td>JWT (SimpleJWT), Role-based access</td>
<td>Secure authentication</td>
</tr>
<tr>
<td>📄 <strong>Documents</strong></td>
<td>jsPDF, html2canvas, Tesseract.js</td>
<td>PDF generation & OCR scanning</td>
</tr>
<tr>
<td>📦 <strong>Database</strong></td>
<td>SQLite (dev) / PostgreSQL (prod)</td>
<td>Data persistence</td>
</tr>
<tr>
<td>🌐 <strong>Server</strong></td>
<td>Daphne (ASGI)</td>
<td>ASGI server for async support</td>
</tr>
</table>

---

## 🏗️ Project Architecture

```
medical-chatbot-django-react/
│
├── 🖥️  backend/                    # Django REST API
│   ├── api/
│   │   ├── models.py              # CustomUser, Doctor, Pharmacist,
│   │   │                          #   Medicine, Orders, Prescriptions...
│   │   ├── views.py               # 300KB+ of REST API endpoints
│   │   ├── consumers.py           # WebSocket consumers (video + chat)
│   │   ├── serializers.py         # DRF serializers
│   │   ├── tasks.py               # Celery async tasks (email reminders)
│   │   ├── helpers.py             # AI chatbot & Ollama integration
│   │   ├── ocr_utils.py           # Prescription OCR utilities
│   │   └── urls.py                # API URL routing
│   │
│   ├── medical_backend/
│   │   ├── settings.py            # Django settings
│   │   ├── celery.py              # Celery app configuration
│   │   └── asgi.py                # ASGI config with Channels routing
│   │
│   └── store_index_ollama.py      # FAISS vector store builder
│
└── 🎨  frontend/                   # React Application
    └── src/
        ├── components/
        │   ├── Dashboard.jsx       # Main landing dashboard
        │   ├── PatientDashboard    # Patient portal
        │   ├── DoctorDashboard     # Doctor portal
        │   ├── PharmacistDashboard # Pharmacist portal
        │   ├── video/              # WebRTC video components
        │   ├── chat/               # AI chatbot components
        │   ├── prescriptions/      # Prescription management
        │   ├── auth/               # Login & registration
        │   ├── appointments/       # Appointment booking
        │   ├── health/             # Health tracking
        │   └── PharmacyBrowse      # Online pharmacy
        └── services/               # API service layer
```

---

## 👥 User Roles & Capabilities

### 🧑‍⚕️ Patient Portal
| Feature | Details |
|---------|---------|
| 📅 Appointment Booking | Choose doctor, date, time slot & describe symptoms |
| 🎥 Video Consultation | Join real-time video call with assigned doctor |
| 💬 AI Chatbot | 24/7 AI-powered medical Q&A with voice support |
| 📋 My Prescriptions | View, download PDF, and scan prescriptions via OCR |
| 💊 Medicine Orders | Browse pharmacy, add to cart, track delivery |
| 🗺️ Nearby Stores | Find nearest medical stores by location |
| 📊 Health Dashboard | Track vitals, medical history, allergies, and more |
| ⏰ Medicine Reminders | Automated email reminders for scheduled medications |

### 👨‍⚕️ Doctor Portal
| Feature | Details |
|---------|---------|
| 📆 Schedule Management | Set available days, time slots, and consultation fees |
| 🎥 Video Consultations | Host patient video sessions with chat |
| 📝 Digital Prescriptions | Write & generate prescriptions post-consultation |
| 📊 Analytics Dashboard | View total consultations, revenue, ratings |
| 👥 Patient Management | View patient history and appointment details |
| ⭐ Ratings & Reviews | Patient feedback with rating distribution |

### 💊 Pharmacist Portal
| Feature | Details |
|---------|---------|
| 🏪 Inventory Management | Add medicines, set MRP, stock, expiry & batch info |
| 📦 Order Processing | Confirm → Process → Dispatch → Deliver orders |
| 🔍 Prescription Verification | Validate patient prescriptions before dispensing |
| 🤖 AI Medicine Addition | Add medicines using AI-extracted product details |
| 📊 Sales Analytics | Revenue tracking and order statistics |
| 🏬 Store Profile | Manage pharmacy details, delivery radius & hours |

---

## 🚀 Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Redis Server
- Ollama (for AI chatbot)
- Git

---

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/abhishekmnair81/TELEMEDICINE-ACCESS.git
cd TELEMEDICINE-ACCESS
```

---

### 2️⃣ Backend Setup

```bash
# Navigate to backend
cd backend

# Create & activate virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

# Install dependencies
pip install -r requirements_celery.txt

# Setup environment variables
cp .env.example .env           # Edit .env with your settings

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start Django server
python manage.py runserver
```

**Backend `.env` variables:**
```env
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
REDIS_URL=redis://localhost:6379/0
```

---

### 3️⃣ Celery Worker (Medicine Reminders)

```bash
# In a new terminal (from backend/)
celery -A medical_backend worker --loglevel=info

# Start beat scheduler for periodic tasks
celery -A medical_backend beat --loglevel=info
```

---

### 4️⃣ Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

Frontend will be live at **http://localhost:3000**

---

### 5️⃣ Ollama AI Setup (Optional)

```bash
# Install Ollama from https://ollama.com
# Pull a medical-capable model
ollama pull llama3.2

# Build the FAISS knowledge index
cd backend
python store_index_ollama.py
```

---

## 🌐 API Endpoints Overview

| Module | Base Route | Description |
|--------|-----------|-------------|
| 🔐 Auth | `/api/auth/` | Register, login, JWT refresh |
| 👤 Users | `/api/users/` | Profile management |
| 🩺 Doctors | `/api/doctors/` | Doctor listing, availability, ratings |
| 📅 Appointments | `/api/appointments/` | Booking & status management |
| 🎥 Consultations | `/api/consultations/` | Video session management |
| 📋 Prescriptions | `/api/prescriptions/` | Create, view, update prescriptions |
| 💊 Medicines | `/api/medicines/` | Product catalog & search |
| 🛒 Orders | `/api/orders/` | Order placement & tracking |
| 💬 Chat | `ws://` | WebSocket for real-time messaging |
| 🤖 AI | `/api/chatbot/` | Ollama AI medical assistant |

---

## 📊 Data Models

```
CustomUser (Patient / Doctor / Pharmacist / Admin)
    │
    ├── DoctorProfile ──── Appointments ──── EnhancedPrescription
    │       │                                       │
    │   availability                           medications (JSON)
    │   specialization                         vital_signs (JSON)
    │   consultation_fee
    │
    ├── PharmacistProfile ──── MedicineOrder ──── OrderItems (JSON)
    │
    ├── Medicine ──── InventoryBatch ──── Supplier
    │
    └── MedicalProduct ──── InventoryBatch
```

---

## 🔐 Security Features

- ✅ **JWT Authentication** with access & refresh tokens
- ✅ **Role-Based Access Control** (Patient / Doctor / Pharmacist / Admin)
- ✅ **CORS** configured via `django-cors-headers`
- ✅ **Password hashing** with Django's PBKDF2 algorithm
- ✅ **Protected Routes** on both frontend and backend
- ✅ **OTP Verification** for pharmacist accounts
- ✅ **Prescription validation** before pharmacy fulfillment

---

## 📂 Environment Files

Make sure to configure the following before running:

| File | Description |
|------|-------------|
| `backend/.env` | Django secret key, email SMTP, Redis URL |
| `frontend/.env` | React API base URL, WebSocket URL |

---

## 🤝 Contributing

1. **Fork** the repository
2. Create a feature branch: `git checkout -b feature/AmazingFeature`
3. Commit your changes: `git commit -m 'Add AmazingFeature'`
4. Push to the branch: `git push origin feature/AmazingFeature`
5. Open a **Pull Request**

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

<div align="center">

**Abhishek M Nair**

[![GitHub](https://img.shields.io/badge/GitHub-abhishekmnair81-181717?style=for-the-badge&logo=github)](https://github.com/abhishekmnair81)

*Built with ❤️ to make healthcare accessible to everyone*

</div>

---

<div align="center">

⭐ **If this project helped you, please give it a star!** ⭐

</div>