# 🏦 Advanced Banking Application

A modern, secure banking application featuring multi-layered authentication, behavioral analytics, and ML-powered fraud detection. Built with FastAPI backend and React TypeScript frontend.

## 🌟 Key Features

### 🔐 Advanced Security
- **FIDO2/WebAuthn Authentication**: Biometric and hardware security key support
- **Seed Key Recovery**: BIP39 mnemonic-based account restoration
- **Multi-Factor Authentication**: Phone number verification with Twilio OTP
- **Device Verification**: Comprehensive device fingerprinting and validation

### 🤖 AI/ML-Powered Security
- **Behavioral Analytics**: Real-time keystroke dynamics and mouse pattern analysis
- **Fraud Detection**: Deep learning models for transaction anomaly detection
- **Adaptive Learning**: User-specific behavioral models that improve over time
- **Anomaly Detection**: Real-time identification of suspicious user behavior

### 🏦 Banking Features
- **Secure Transactions**: End-to-end encrypted transaction processing
- **Account Management**: Multiple account types and comprehensive management
- **Transaction History**: Detailed transaction logs with fraud scoring
- **Location Tracking**: Geographic verification for enhanced security

## 🏗️ Architecture

### Backend (FastAPI)
```
bank-app-backend/
├── app/
│   ├── api/api_v1/endpoints/    # REST API endpoints
│   ├── core/                    # Configuration and security
│   ├── db/models/              # SQLAlchemy database models
│   ├── schemas/                # Pydantic data validation schemas
│   ├── services/               # Business logic layer
│   └── ml_models/              # Trained ML models and artifacts
├── main.py                     # FastAPI application entry point
├── requirements.txt            # Python dependencies
└── docker-compose.yml          # Container orchestration
```

### Frontend (React + TypeScript)
```
bank-app-frontend/
├── src/
│   ├── components/             # Reusable UI components
│   ├── pages/                  # Application pages/routes
│   ├── context/                # React context providers
│   ├── services/               # API communication layer
│   ├── providers/              # Global state providers
│   └── utils/                  # Utility functions and helpers
├── package.json                # Node.js dependencies
└── vite.config.ts              # Vite build configuration
```

## 🚀 Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL database
- Twilio account (for SMS verification)

### Backend Setup

1. **Clone and navigate to backend:**
   ```bash
   cd bank-app-backend
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Required environment variables:**
   ```bash
   PROJECT_NAME="Advanced Banking App"
   DATABASE_URL="postgresql://user:password@localhost/bankdb"
   BACKEND_CORS_ORIGINS="http://localhost:5173"
   RP_ID="localhost"
   RP_NAME="Advanced Banking App"
   ORIGIN="http://localhost:5173"
   TWILIO_ACCOUNT_SID="your_twilio_sid"
   TWILIO_AUTH_TOKEN="your_twilio_token"
   TWILIO_VERIFY_SERVICE_SID="your_verify_service_sid"
   TWILIO_PHONE_NUMBER="your_twilio_phone"
   PRIVATE_KEY="your_encryption_key"
   JWT_SECRET="your_jwt_secret"
   ```

5. **Run the backend:**
   ```bash
   python main.py
   ```

   The API will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend:**
   ```bash
   cd bank-app-frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Configure environment:**
   ```bash
   cp .env.local.example .env.local
   # Edit with your backend URL
   ```

4. **Start development server:**
   ```bash
   npm run dev
   # or
   bun dev
   ```

   The application will be available at `http://localhost:5173`

## 🔧 Technology Stack

### Backend
- **Framework**: FastAPI (Python 3.12)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: FIDO2/WebAuthn, JWT tokens
- **ML/AI**: PyTorch, scikit-learn, pandas
- **Security**: Cryptography, eth-account
- **Communication**: Twilio (SMS/OTP)
- **Validation**: Pydantic

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Components**: Radix UI + shadcn/ui
- **Styling**: Tailwind CSS
- **State Management**: React Context + Providers
- **Routing**: React Router DOM
- **Cryptography**: Noble crypto libraries
- **Charts**: Recharts

## 🔒 Security Features

### Multi-Layer Authentication
1. **Phone Verification**: SMS OTP via Twilio
2. **FIDO2 Registration**: Biometric or hardware security keys
3. **Seed Key Generation**: BIP39 mnemonic phrases for recovery
4. **Device Fingerprinting**: Hardware and software characteristics

### Behavioral Analytics
- **Keystroke Dynamics**: Timing patterns between keystrokes
- **Mouse Trajectory Analysis**: Movement patterns and click behavior
- **Typing Speed Monitoring**: Words per minute analysis
- **Error Pattern Recognition**: Correction frequency and patterns

### ML-Powered Fraud Detection
- **Autoencoder Models**: Anomaly detection in transaction patterns
- **Classification Models**: Binary fraud prediction
- **User-Specific Models**: Personalized behavioral baselines
- **Real-time Scoring**: Immediate fraud risk assessment

## 📊 API Endpoints

### Authentication
- `POST /api/v1/register/fido-start` - Start FIDO2 registration
- `POST /api/v1/register/fido-seedkey` - Complete FIDO2 + seed key registration
- `POST /api/v1/login/fido-start` - Initiate FIDO2 login
- `POST /api/v1/login/fido-finish` - Complete FIDO2 login

### Analytics & ML
- `POST /api/v1/analytics/behavior` - Submit behavioral data
- `POST /api/v1/ml-analytics/verify-behavior` - ML anomaly detection
- `POST /api/v1/ml-analytics/train-model` - Train user-specific models

### Transactions
- `POST /api/v1/transactions/create` - Create new transaction
- `GET /api/v1/transactions/history` - Transaction history
- `POST /api/v1/transactions/verify` - Fraud detection

### Recovery
- `POST /api/v1/restore/phone-start` - Start account recovery
- `POST /api/v1/restore/fido-seedkey` - Complete recovery with seed phrase

## 🧪 Development

### Running Tests
```bash
# Backend tests
cd bank-app-backend
python -m pytest

# Frontend tests
cd bank-app-frontend
npm test
```

### Code Quality
```bash
# Backend linting
flake8 app/
black app/

# Frontend linting
npm run lint
```

### Database Migrations
```bash
# Create migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head
```

## 🐳 Docker Deployment

### Build and run with Docker Compose:
```bash
docker-compose up --build
```

### Environment-specific builds:
```bash
# Development
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose -f docker-compose.prod.yml up
```

## 🔍 ML Model Training

### Behavioral Analytics Models
```bash
# Train user-specific behavioral models
curl -X POST "http://localhost:8000/api/v1/ml-analytics/train-model" \
  -H "Content-Type: application/json" \
  -d '{"customer_unique_id": "user-uuid", "force_retrain": false}'
```

### Fraud Detection Models
The system includes pre-trained models for:
- **Autoencoder**: `app/ml_models/autoencoder_best.pth`
- **Classifier**: `app/ml_models/classifier_best.pth`
- **Feature Scalers**: `app/ml_models/scaler_*.pkl`

## 📱 Mobile Support

The application is fully responsive and supports:
- **Progressive Web App (PWA)** capabilities
- **Touch-based biometric authentication**
- **Mobile-optimized UI components**
- **Adaptive layouts** for various screen sizes

## 🔧 Configuration

### Security Settings
- **FIDO2 Configuration**: Relying Party ID and origin validation
- **Encryption Keys**: AES-GCM for sensitive data encryption
- **JWT Settings**: Token expiration and signing algorithms
- **Rate Limiting**: API endpoint protection

### ML Configuration
- **Model Paths**: Configurable model storage locations
- **Training Thresholds**: Minimum data requirements for training
- **Anomaly Sensitivity**: Adjustable confidence thresholds
- **Retraining Schedule**: Automatic model updates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🆘 Support

For support and questions:
- **Issues**: GitHub Issues tracker
- **Documentation**: `/docs` folder
- **API Docs**: `http://localhost:8000/docs` (when running)

## 🔮 Future Enhancements

- **Multi-currency support**
- **Advanced ML model interpretability**
- **Real-time fraud alerts**
- **API rate limiting and throttling**
- **Advanced analytics dashboard**
- **Mobile native applications**

---

**Built with ❤️ for secure, intelligent banking**
