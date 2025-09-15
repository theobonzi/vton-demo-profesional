# Backend Documentation

## Overview

The backend is a FastAPI application that provides RESTful APIs for the virtual try-on demo. It handles product management, user authentication, and virtual try-on processing.

## Architecture

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entry point
│   ├── config.py            # Configuration settings
│   ├── api/                 # API endpoints
│   │   ├── __init__.py
│   │   ├── auth.py          # Authentication endpoints
│   │   ├── products.py      # Product management endpoints
│   │   └── tryon.py         # Virtual try-on endpoints
│   ├── schemas/             # Pydantic models
│   │   ├── __init__.py
│   │   ├── product.py       # Product data models
│   │   ├── tryon.py         # Try-on data models
│   │   └── user.py          # User data models
│   ├── services/            # Business logic
│   │   ├── __init__.py
│   │   ├── fashn_service.py # Fashn API integration
│   │   ├── gemini_service.py # Gemini API integration
│   │   ├── supabase_service.py # Supabase integration
│   │   └── tryon_service.py # Try-on processing logic
│   └── utils/               # Utility functions
├── requirements.txt         # Python dependencies
├── Dockerfile              # Docker configuration
└── seed_data.py            # Database seeding script
```

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SUPABASE_URL` | Supabase project URL | Yes | - |
| `SUPABASE_KEY` | Supabase API key | Yes | - |
| `FASHN_API_KEY` | Fashn API key for virtual try-on | Yes | - |
| `GEMINI_API_KEY` | Google Gemini API key | Yes | - |
| `SECRET_KEY` | JWT secret key | Yes | - |
| `ALGORITHM` | JWT algorithm | No | HS256 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiration time | No | 30 |
| `FRONTEND_URL` | Frontend URL for CORS | No | http://localhost:3000 |
| `DEFAULT_BRAND` | Default brand filter | No | None |
| `DEBUG` | Debug mode | No | True |

### Configuration File

The configuration is managed in `app/config.py`:

```python
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Supabase Configuration
    supabase_url: str
    supabase_key: str
    
    # API Keys
    fashn_api_key: str
    gemini_api_key: str
    
    # JWT Configuration
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # CORS Configuration
    frontend_url: str = "http://localhost:3000"
    
    # App Configuration
    app_name: str = "VTON Demo Professional"
    app_version: str = "1.0.0"
    debug: bool = True
    
    # Default Brand Filter
    default_brand: Optional[str] = None
    
    class Config:
        env_file = ".env"

settings = Settings()
```

## API Endpoints

### Authentication (`/api/v1/auth`)

#### POST `/login`
Authenticate user and return JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "user",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### POST `/register`
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password",
  "username": "user"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "user",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Products (`/api/v1/products`)

#### GET `/`
Get products with optional filtering.

**Query Parameters:**
- `brand` (optional): Filter by brand name
- `category` (optional): Filter by category
- `gender` (optional): Filter by gender (men/women/unisex)
- `limit` (optional): Number of products to return (default: 20, max: 100)
- `skip` (optional): Number of products to skip (default: 0)

**Response:**
```json
[
  {
    "id": 1,
    "name": "Premium T-Shirt",
    "price": 89.99,
    "image_url": "https://example.com/image.jpg",
    "api_image_url": "https://api.example.com/image.jpg",
    "brand": "LEMAIRE",
    "category": "Tops",
    "gender": "unisex",
    "description": "High-quality cotton t-shirt",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

#### GET `/brands`
Get available brands.

**Response:**
```json
[
  {
    "id": 1,
    "name": "LEMAIRE",
    "product_count": 15
  },
  {
    "id": 2,
    "name": "Nike",
    "product_count": 23
  }
]
```

#### GET `/{product_id}`
Get a specific product by ID.

**Response:**
```json
{
  "id": 1,
  "name": "Premium T-Shirt",
  "price": 89.99,
  "image_url": "https://example.com/image.jpg",
  "api_image_url": "https://api.example.com/image.jpg",
  "brand": "LEMAIRE",
  "category": "Tops",
  "gender": "unisex",
  "description": "High-quality cotton t-shirt",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Virtual Try-On (`/api/v1/tryon`)

#### POST `/`
Create a new virtual try-on session.

**Request:**
```json
{
  "person_image_url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
  "product_ids": [1, 2, 3],
  "products_info": [
    {
      "id": 1,
      "name": "Premium T-Shirt",
      "price": "89.99 €",
      "image_url": "https://example.com/image.jpg"
    }
  ],
  "session_id": "session_1234567890"
}
```

**Response:**
```json
{
  "session_id": "session_1234567890",
  "status": "processing",
  "message": "Virtual try-on processing started for 3 product(s)..."
}
```

#### GET `/{session_id}/status/`
Get virtual try-on session status.

**Response:**
```json
{
  "session_id": "session_1234567890",
  "status": "completed",
  "results": {
    "product_1": {
      "product_id": 1,
      "product_name": "Premium T-Shirt",
      "result_image": "https://example.com/result.jpg",
      "status": "success"
    }
  },
  "message": "Virtual try-on completed successfully - 1 result(s)"
}
```

#### POST `/upload`
Upload a person image for virtual try-on.

**Request:** Multipart form data with image file

**Response:**
```json
{
  "message": "Image uploaded successfully",
  "file_path": "person-images/uuid.jpg",
  "url": "https://supabase.com/storage/..."
}
```

## Data Models

### Product Schema

```python
class Product(BaseModel):
    id: int
    name: str
    price: float
    image_url: str
    api_image_url: Optional[str] = None
    brand: str
    category: str
    gender: str
    description: Optional[str] = None
    created_at: datetime
```

### Try-On Schema

```python
class ProductInfo(BaseModel):
    id: int
    name: str
    price: str
    image_url: str

class TryOnRequest(BaseModel):
    person_image_url: str
    product_ids: List[int]
    products_info: Optional[List[ProductInfo]] = None
    session_id: Optional[str] = None

class TryOnResult(BaseModel):
    product_id: int
    product_name: str
    result_image: Optional[str] = None
    error: Optional[str] = None
    status: str  # 'success' | 'failed'

class TryOnResponse(BaseModel):
    session_id: str
    status: str  # 'pending' | 'processing' | 'completed' | 'failed'
    message: str
    results: Optional[Dict[str, TryOnResult]] = None
    error_message: Optional[str] = None
```

## Services

### SupabaseService

Handles all database operations and file storage.

**Key Methods:**
- `get_items()`: Retrieve products with filtering
- `get_item_by_id()`: Get specific product
- `upload_file()`: Upload files to Supabase storage
- `convert_to_product()`: Convert database records to Product models

### TryOnService

Manages virtual try-on processing logic.

**Key Methods:**
- `process_try_on()`: Initialize try-on session
- `get_try_on_status()`: Check session status
- `simulate_try_on_processing()`: Background processing simulation

### FashnService

Integrates with Fashn API for virtual try-on processing.

**Key Methods:**
- `process_virtual_tryon()`: Send request to Fashn API
- `get_tryon_status()`: Check Fashn processing status

### GeminiService

Integrates with Google Gemini API for AI features.

**Key Methods:**
- `generate_description()`: Generate product descriptions
- `analyze_image()`: Analyze uploaded images

## Error Handling

The API uses HTTP status codes and structured error responses:

```json
{
  "detail": "Error message",
  "status_code": 400,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Common Status Codes:**
- `200`: Success
- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `422`: Validation Error
- `500`: Internal Server Error

## Security

### Authentication
- JWT tokens for API authentication
- Password hashing with bcrypt
- Token expiration handling

### CORS
- Configured for frontend domain
- Preflight request handling

### Input Validation
- Pydantic models for request validation
- File type validation for uploads
- SQL injection prevention through ORM

## Development

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Docker Development

```bash
# Build and run with Docker Compose
docker-compose up --build backend
```

### Testing

```bash
# Run tests (when implemented)
pytest tests/
```

## Deployment

### Production Considerations

1. **Environment Variables**: Set all required environment variables
2. **Database**: Configure production Supabase instance
3. **API Keys**: Use production API keys
4. **Security**: Enable HTTPS and proper CORS
5. **Monitoring**: Set up logging and monitoring
6. **Scaling**: Configure load balancing if needed

### Docker Production

```bash
# Build production image
docker build -t vton-backend .

# Run production container
docker run -d -p 8000:8000 --env-file .env vton-backend
```

## API Documentation

Interactive API documentation is available at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Troubleshooting

### Common Issues

1. **Database Connection**: Check Supabase credentials
2. **API Keys**: Verify Fashn and Gemini API keys
3. **CORS Errors**: Check frontend URL configuration
4. **File Upload**: Verify Supabase storage configuration

### Logs

Check application logs for debugging:
```bash
docker-compose logs backend
```
