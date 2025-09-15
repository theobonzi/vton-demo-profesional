# API Documentation

## Overview

This document provides comprehensive documentation for the Virtual Try-On Demo API. The API is built with FastAPI and provides RESTful endpoints for product management, user authentication, and virtual try-on processing.

## Base URL

- **Development**: `http://localhost:8000`
- **Production**: `https://api.yourdomain.com`

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "data": <response_data>,
  "message": "Success message",
  "status": "success"
}
```

### Error Response
```json
{
  "detail": "Error message",
  "status_code": 400,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Endpoints

### Authentication

#### POST `/api/v1/auth/login`

Authenticate user and return JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
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

**Status Codes:**
- `200`: Success
- `401`: Invalid credentials
- `422`: Validation error

#### POST `/api/v1/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "username": "newuser"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 2,
    "email": "user@example.com",
    "username": "newuser",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Status Codes:**
- `201`: Success
- `400`: User already exists
- `422`: Validation error

### Products

#### GET `/api/v1/products`

Get products with optional filtering.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `brand` | string | No | Filter by brand name |
| `category` | string | No | Filter by category |
| `gender` | string | No | Filter by gender (men/women/unisex) |
| `limit` | integer | No | Number of products to return (default: 20, max: 100) |
| `skip` | integer | No | Number of products to skip (default: 0) |

**Example Request:**
```
GET /api/v1/products?brand=LEMAIRE&gender=unisex&limit=10
```

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

**Status Codes:**
- `200`: Success
- `422`: Validation error

#### GET `/api/v1/products/brands`

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

**Status Codes:**
- `200`: Success

#### GET `/api/v1/products/{product_id}`

Get a specific product by ID.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product_id` | integer | Yes | Product ID |

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

**Status Codes:**
- `200`: Success
- `404`: Product not found

### Virtual Try-On

#### POST `/api/v1/tryon/`

Create a new virtual try-on session.

**Request Body:**
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

**Request Body Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `person_image_url` | string | Yes | Base64 encoded image or URL |
| `product_ids` | array | Yes | Array of product IDs to try on |
| `products_info` | array | No | Product information for better results |
| `session_id` | string | No | Custom session ID (auto-generated if not provided) |

**Response:**
```json
{
  "session_id": "session_1234567890",
  "status": "processing",
  "message": "Virtual try-on processing started for 3 product(s)..."
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid request
- `422`: Validation error

#### GET `/api/v1/tryon/{session_id}/status/`

Get virtual try-on session status.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `session_id` | string | Yes | Session ID |

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
    },
    "product_2": {
      "product_id": 2,
      "product_name": "Designer Jeans",
      "result_image": "https://example.com/result2.jpg",
      "status": "success"
    }
  },
  "message": "Virtual try-on completed successfully - 2 result(s)"
}
```

**Status Codes:**
- `200`: Success
- `404`: Session not found

**Status Values:**
- `pending`: Session created, waiting to start
- `processing`: Currently processing
- `completed`: Processing finished successfully
- `failed`: Processing failed

#### POST `/api/v1/tryon/upload`

Upload a person image for virtual try-on.

**Request:** Multipart form data

**Form Data:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | Image file (JPEG, PNG, WebP) |

**Response:**
```json
{
  "message": "Image uploaded successfully",
  "file_path": "person-images/uuid.jpg",
  "url": "https://supabase.com/storage/v1/object/public/tryon-inputs/person-images/uuid.jpg"
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid file type
- `413`: File too large
- `500`: Upload failed

## Data Models

### Product

```typescript
interface Product {
  id: number;
  name: string;
  price: number;
  image_url: string;
  api_image_url?: string;
  brand: string;
  category: string;
  gender: string;
  description?: string;
  created_at: string; // ISO 8601 datetime
}
```

### Brand

```typescript
interface Brand {
  id: number;
  name: string;
  product_count: number;
}
```

### Try-On Request

```typescript
interface TryOnRequest {
  person_image_url: string;
  product_ids: number[];
  products_info?: ProductInfo[];
  session_id?: string;
}

interface ProductInfo {
  id: number;
  name: string;
  price: string;
  image_url: string;
}
```

### Try-On Result

```typescript
interface TryOnResult {
  product_id: number;
  product_name: string;
  result_image?: string;
  error?: string;
  status: 'success' | 'failed';
}
```

### Try-On Response

```typescript
interface TryOnResponse {
  session_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
  results?: Record<string, TryOnResult>;
  error_message?: string;
}
```

### User

```typescript
interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  created_at: string; // ISO 8601 datetime
}
```

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | OK - Request successful |
| `201` | Created - Resource created successfully |
| `400` | Bad Request - Invalid request data |
| `401` | Unauthorized - Authentication required |
| `403` | Forbidden - Access denied |
| `404` | Not Found - Resource not found |
| `422` | Unprocessable Entity - Validation error |
| `500` | Internal Server Error - Server error |

### Error Response Format

```json
{
  "detail": "Error message",
  "status_code": 400,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Common Error Messages

- `"User not found"`: Invalid user credentials
- `"Product not found"`: Invalid product ID
- `"Session not found"`: Invalid session ID
- `"Invalid file type"`: Unsupported file format
- `"File too large"`: File exceeds size limit
- `"Validation error"`: Request data validation failed

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Authentication endpoints**: 5 requests per minute per IP
- **Product endpoints**: 100 requests per minute per IP
- **Try-on endpoints**: 10 requests per minute per user

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## CORS Configuration

The API supports Cross-Origin Resource Sharing (CORS) for the following origins:

- `http://localhost:3000` (Development)
- `https://yourdomain.com` (Production)

## Webhooks

### Try-On Completion Webhook

When a virtual try-on session completes, a webhook can be sent to a configured URL:

**Webhook Payload:**
```json
{
  "event": "tryon.completed",
  "session_id": "session_1234567890",
  "status": "completed",
  "results_count": 2,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
// Initialize API client
const api = axios.create({
  baseURL: 'https://api.yourdomain.com',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Get products
const products = await api.get('/api/v1/products', {
  params: { brand: 'LEMAIRE', limit: 10 }
});

// Create try-on session
const tryOn = await api.post('/api/v1/tryon/', {
  person_image_url: 'data:image/jpeg;base64,...',
  product_ids: [1, 2, 3],
  products_info: [
    {
      id: 1,
      name: 'Premium T-Shirt',
      price: '89.99 €',
      image_url: 'https://example.com/image.jpg'
    }
  ]
});

// Check status
const status = await api.get(`/api/v1/tryon/${tryOn.session_id}/status/`);
```

### Python

```python
import requests

# Initialize API client
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

# Get products
response = requests.get(
    'https://api.yourdomain.com/api/v1/products',
    headers=headers,
    params={'brand': 'LEMAIRE', 'limit': 10}
)
products = response.json()

# Create try-on session
try_on_data = {
    'person_image_url': 'data:image/jpeg;base64,...',
    'product_ids': [1, 2, 3],
    'products_info': [
        {
            'id': 1,
            'name': 'Premium T-Shirt',
            'price': '89.99 €',
            'image_url': 'https://example.com/image.jpg'
        }
    ]
}

response = requests.post(
    'https://api.yourdomain.com/api/v1/tryon/',
    headers=headers,
    json=try_on_data
)
try_on = response.json()

# Check status
status_response = requests.get(
    f'https://api.yourdomain.com/api/v1/tryon/{try_on["session_id"]}/status/',
    headers=headers
)
status = status_response.json()
```

## Testing

### Interactive Documentation

- **Swagger UI**: `https://api.yourdomain.com/docs`
- **ReDoc**: `https://api.yourdomain.com/redoc`

### Postman Collection

A Postman collection is available for testing all endpoints:

1. Import the collection from `/docs/postman-collection.json`
2. Set environment variables:
   - `base_url`: API base URL
   - `auth_token`: JWT token
3. Run the collection tests

### cURL Examples

```bash
# Login
curl -X POST "https://api.yourdomain.com/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'

# Get products
curl -X GET "https://api.yourdomain.com/api/v1/products?brand=LEMAIRE" \
  -H "Authorization: Bearer <token>"

# Create try-on
curl -X POST "https://api.yourdomain.com/api/v1/tryon/" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "person_image_url": "data:image/jpeg;base64,...",
    "product_ids": [1, 2, 3]
  }'
```

## Support

For API support and questions:

- **Documentation**: Check this documentation first
- **Issues**: Report bugs and feature requests
- **Contact**: api-support@yourdomain.com
