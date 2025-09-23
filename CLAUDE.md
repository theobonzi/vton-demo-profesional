# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Full Application (Recommended)
```bash
# Start all services with Docker Compose
docker-compose up --build

# Or use the provided start script
./start.sh

# Stop all services
docker-compose down
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev        # Start development server on port 3000
npm run build      # Build for production
npm run lint       # Run ESLint
npm run preview    # Preview production build
```

### Backend Development
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload  # Start development server on port 8000
```

## Architecture Overview

### Project Structure
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: FastAPI + Python 3.12 with Pydantic schemas
- **Database**: Supabase (PostgreSQL)
- **State Management**: Zustand stores
- **UI Components**: Radix UI primitives
- **Authentication**: Supabase Auth with JWT tokens

### Key Directories

#### Frontend (`/frontend/src/`)
- `components/` - Reusable UI components (Header, ProductCard, ui/)
- `pages/` - Application pages (Login, Register, ProductSelection, etc.)
- `store/` - Zustand state management (useAuthStore, useProductStore, useTryOnStore)
- `services/` - API service layers (authService, productService, tryOnService)
- `lib/` - Utilities and Supabase client configuration
- `types/` - TypeScript type definitions

#### Backend (`/backend/app/`)
- `api/` - FastAPI route handlers (auth.py, products.py, tryon.py)
- `schemas/` - Pydantic models for request/response validation
- `services/` - Business logic (fashn_service, gemini_service, supabase_service, email_service)
- `config.py` - Application configuration and environment variables

### Authentication Flow
- Frontend uses Supabase Auth for signup/login
- JWT tokens stored in localStorage and sent as Bearer tokens
- Backend validates tokens but doesn't handle auth directly
- User state managed through `useAuthStore` Zustand store

### API Structure
- Base URL: `http://localhost:8000/api/v1/`
- Routes: `/auth`, `/products`, `/tryon`
- All endpoints documented at `http://localhost:8000/docs`

### Environment Configuration
- Root `.env` file for Docker Compose variables (FASHN_API_KEY, GEMINI_API_KEY, SECRET_KEY)
- Frontend requires `frontend/.env` with Supabase configuration
- Backend uses Pydantic Settings for configuration management

### Virtual Try-On Workflow
1. Product selection from catalog (with optional brand filtering)
2. Image capture/upload for user photo
3. AI processing through Fashn API
4. Results display with interaction features (like, download, share)
5. Optional email summary functionality

### Key Technologies
- **Frontend**: Vite proxy for API calls, React Router for navigation, Sonner for toasts
- **Backend**: FastAPI with automatic OpenAPI docs, CORS middleware, global exception handling
- **External APIs**: Fashn (virtual try-on), Gemini (AI processing), Supabase (database/auth)

### Service URLs
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Health Check: http://localhost:8000/health