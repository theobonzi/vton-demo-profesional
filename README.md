# Virtual Try-On Demo Professional

A modern virtual try-on application built with React, FastAPI, and Docker. This demo showcases a complete virtual fitting experience with product selection, image capture, and AI-powered virtual try-on results.

## 🚀 Features

- **Product Selection**: Browse and select clothing items with brand filtering
- **Image Capture**: Upload or capture selfie photos for virtual try-on
- **Virtual Fitting**: AI-powered virtual try-on with realistic results
- **Interactive Results**: Like, download, and share virtual fitting results
- **Responsive Design**: Modern UI that works on all devices
- **Brand Filtering**: Filter products by specific brands via environment variables

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Zustand** for state management
- **React Router** for navigation
- **Lucide React** for icons

### Backend
- **FastAPI** with Python 3.12
- **Pydantic** for data validation
- **Supabase** for database and storage
- **Docker** for containerization

### Infrastructure
- **Docker Compose** for orchestration
- **PostgreSQL** database
- **Supabase** for data storage and management

## 📦 Installation

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.12+ (for local development)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vton-demo-professional
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   FASHN_API_KEY=your_fashn_api_key
   GEMINI_API_KEY=your_gemini_api_key
   SECRET_KEY=your_secret_key
   DEFAULT_BRAND=LEMAIRE  # Optional: filter by specific brand
   ```

3. **Start the application**
   ```bash
   docker-compose up --build
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## 🎯 Usage

### Basic Workflow

1. **Product Selection**: Choose clothing items from the catalog
2. **Image Capture**: Upload or take a selfie photo
3. **Virtual Try-On**: Wait for AI processing
4. **View Results**: See virtual fitting results with product images
5. **Interact**: Like, download, or share your favorite looks

### Brand Filtering

Set the `DEFAULT_BRAND` environment variable to filter products by a specific brand:

```bash
# Filter by LEMAIRE brand
DEFAULT_BRAND=LEMAIRE docker-compose up --build

# Show all brands
DEFAULT_BRAND= docker-compose up --build
```

## 🏗️ Project Structure

```
vton-demo-professional/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/           # Application pages
│   │   ├── services/        # API services
│   │   ├── store/           # State management
│   │   └── types/           # TypeScript type definitions
│   └── Dockerfile
├── backend/                  # FastAPI backend application
│   ├── app/
│   │   ├── api/             # API endpoints
│   │   ├── schemas/         # Pydantic models
│   │   ├── services/        # Business logic
│   │   └── config.py        # Configuration
│   └── Dockerfile
├── docker-compose.yml        # Docker orchestration
└── README.md
```

## 🔧 Development

### Frontend Development

```bash
cd frontend
npm install
# Required for authentication
npm install @supabase/supabase-js
npm run dev
```

### Backend Development

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `FASHN_API_KEY` | Fashn API key for virtual try-on | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `SECRET_KEY` | JWT secret key | Yes |
| `DEFAULT_BRAND` | Default brand filter (optional) | No |
| `SMTP_HOST` | SMTP server host | Optional |
| `SMTP_PORT` | SMTP server port | Optional |
| `SMTP_USER` | SMTP username | Optional |
| `SMTP_PASSWORD` | SMTP password | Optional |
| `SMTP_FROM` | From email address | Optional |
| `SMTP_USE_TLS` | Enable STARTTLS (default: True) | Optional |
| `SMTP_USE_SSL` | Use SSL instead of TLS (default: False) | Optional |

### Frontend Env (Vite)

Create `frontend/.env` from `frontend/.env.example`:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_DEFAULT_BRAND=LEMAIRE # optional
```

### Email Summary Setup

To enable emailing session summaries, configure SMTP in `backend/.env`:

```
SMTP_HOST=smtp.mailprovider.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
SMTP_FROM=no-reply@yourdomain.com
SMTP_USE_TLS=True
SMTP_USE_SSL=False
```

Then restart the backend. A new button appears on the Virtual Fitting page to send a summary to any email address (pre-filled if logged in).

## 📱 API Endpoints

### Products
- `GET /api/v1/products` - Get products with optional filtering
- `GET /api/v1/products/brands` - Get available brands

### Virtual Try-On
- `POST /api/v1/tryon/` - Create virtual try-on session
- `GET /api/v1/tryon/{session_id}/status/` - Get try-on status
- `POST /api/v1/tryon/send-summary` - Send email summary of a try-on session

### Authentication

Authentication is handled directly on the frontend with Supabase Auth.

- Login/Signup via Supabase using `@supabase/supabase-js`
- Session token is stored in `localStorage` as `token`
- The Axios client attaches the Bearer token for API calls

Routes added:
- `/login` – user login page
- `/register` – user signup page

## 🎨 UI Components

The application features a modern, minimalist design with:

- **Clean Typography**: Light font weights and proper spacing
- **Responsive Grid**: Adaptive layouts for all screen sizes
- **Interactive Elements**: Hover effects and smooth transitions
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Dark/Light Theme**: Automatic theme detection

## �� Deployment

### Production Build

```bash
# Build frontend
cd frontend
npm run build

# Build backend
cd backend
pip install -r requirements.txt
```

### Docker Production

```bash
docker-compose -f docker-compose.prod.yml up --build
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern web technologies
- Powered by AI virtual try-on technology
- Designed for professional demonstration purposes

---

**Note**: This is a demonstration application. For production use, ensure proper security measures, error handling, and performance optimization.
