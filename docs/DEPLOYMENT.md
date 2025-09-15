# Deployment Guide

## Overview

This guide covers deployment strategies for the Virtual Try-On Demo application, including development, staging, and production environments.

## Prerequisites

### System Requirements

- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+
- **Node.js**: Version 18+ (for local development)
- **Python**: Version 3.12+ (for local development)

### Required Services

- **Supabase Account**: Database and storage
- **Fashn API Key**: Virtual try-on processing
- **Gemini API Key**: AI features
- **Domain Name**: For production deployment (optional)

## Environment Setup

### 1. Environment Variables

Create a `.env` file in the project root:

```env
# Database Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# API Keys
FASHN_API_KEY=your-fashn-api-key
GEMINI_API_KEY=your-gemini-api-key

# JWT Configuration
SECRET_KEY=your-super-secret-jwt-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS Configuration
FRONTEND_URL=http://localhost:3000

# Application Configuration
APP_NAME=VTON Demo Professional
APP_VERSION=1.0.0
DEBUG=true

# Brand Filtering (Optional)
DEFAULT_BRAND=LEMAIRE
```

### 2. Supabase Setup

1. **Create Supabase Project**:
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note the project URL and anon key

2. **Database Schema**:
   ```sql
   -- Create products table
   CREATE TABLE products (
     id SERIAL PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     price DECIMAL(10,2) NOT NULL,
     image_url TEXT NOT NULL,
     api_image_url TEXT,
     brand VARCHAR(100) NOT NULL,
     category VARCHAR(100) NOT NULL,
     gender VARCHAR(20) NOT NULL,
     description TEXT,
     created_at TIMESTAMP DEFAULT NOW()
   );

   -- Create users table
   CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     email VARCHAR(255) UNIQUE NOT NULL,
     username VARCHAR(100) UNIQUE NOT NULL,
     hashed_password TEXT NOT NULL,
     is_active BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMP DEFAULT NOW()
   );

   -- Create brands table
   CREATE TABLE brands (
     id SERIAL PRIMARY KEY,
     name VARCHAR(100) UNIQUE NOT NULL,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

3. **Storage Buckets**:
   - Create `tryon-inputs` bucket for uploaded images
   - Set appropriate permissions for public access

## Deployment Options

### Option 1: Docker Compose (Recommended)

#### Development Environment

```bash
# Clone repository
git clone <repository-url>
cd vton-demo-professional

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start services
docker-compose up --build
```

#### Production Environment

1. **Create production docker-compose file**:

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    build: ./backend
    environment:
      DATABASE_URL: ${DATABASE_URL}
      FASHN_API_KEY: ${FASHN_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      SECRET_KEY: ${SECRET_KEY}
      FRONTEND_URL: ${FRONTEND_URL}
      DEFAULT_BRAND: ${DEFAULT_BRAND}
      DEBUG: false
    ports:
      - "8000:8000"
    restart: unless-stopped

  frontend:
    build: 
      context: ./frontend
      dockerfile: Dockerfile.prod
    environment:
      VITE_API_BASE_URL: ${VITE_API_BASE_URL}
      VITE_DEFAULT_BRAND: ${VITE_DEFAULT_BRAND}
    ports:
      - "3000:80"
    restart: unless-stopped
    depends_on:
      - backend
```

2. **Deploy**:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Option 2: Cloud Platform Deployment

#### Heroku

1. **Create Heroku apps**:
```bash
# Backend
heroku create vton-backend
heroku addons:create heroku-postgresql:hobby-dev

# Frontend
heroku create vton-frontend
```

2. **Configure environment variables**:
```bash
heroku config:set FASHN_API_KEY=your-key --app vton-backend
heroku config:set GEMINI_API_KEY=your-key --app vton-backend
heroku config:set SECRET_KEY=your-secret --app vton-backend
```

3. **Deploy**:
```bash
# Backend
git subtree push --prefix backend heroku-backend main

# Frontend
git subtree push --prefix frontend heroku-frontend main
```

#### AWS

1. **EC2 Instance Setup**:
```bash
# Install Docker
sudo apt update
sudo apt install docker.io docker-compose

# Clone and deploy
git clone <repository-url>
cd vton-demo-professional
docker-compose up -d
```

2. **Load Balancer Configuration**:
```yaml
# nginx.conf
upstream backend {
    server localhost:8000;
}

upstream frontend {
    server localhost:3000;
}

server {
    listen 80;
    server_name yourdomain.com;

    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### DigitalOcean

1. **Droplet Setup**:
```bash
# Create droplet with Docker pre-installed
# SSH into droplet
git clone <repository-url>
cd vton-demo-professional
docker-compose up -d
```

2. **Domain Configuration**:
- Point domain to droplet IP
- Configure SSL with Let's Encrypt

### Option 3: Kubernetes

#### Kubernetes Manifests

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vton-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vton-backend
  template:
    metadata:
      labels:
        app: vton-backend
    spec:
      containers:
      - name: backend
        image: vton-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: vton-secrets
              key: database-url
        - name: FASHN_API_KEY
          valueFrom:
            secretKeyRef:
              name: vton-secrets
              key: fashn-api-key
---
apiVersion: v1
kind: Service
metadata:
  name: vton-backend-service
spec:
  selector:
    app: vton-backend
  ports:
  - port: 8000
    targetPort: 8000
  type: LoadBalancer
```

## SSL/TLS Configuration

### Let's Encrypt with Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Docker SSL

```yaml
# docker-compose.ssl.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend

  backend:
    # ... backend configuration

  frontend:
    # ... frontend configuration
```

## Monitoring and Logging

### Application Monitoring

1. **Health Checks**:
```python
# backend/app/api/health.py
@router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}
```

2. **Logging Configuration**:
```python
# backend/app/config.py
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("app.log"),
        logging.StreamHandler()
    ]
)
```

### Docker Logging

```bash
# View logs
docker-compose logs -f

# Log rotation
docker-compose up -d --log-driver json-file --log-opt max-size=10m --log-opt max-file=3
```

## Performance Optimization

### Backend Optimization

1. **Database Connection Pooling**:
```python
# backend/app/config.py
DATABASE_POOL_SIZE = 20
DATABASE_MAX_OVERFLOW = 30
```

2. **Caching**:
```python
# Redis caching
import redis
redis_client = redis.Redis(host='localhost', port=6379, db=0)
```

3. **Static File Serving**:
```python
# Serve static files efficiently
from fastapi.staticfiles import StaticFiles
app.mount("/static", StaticFiles(directory="static"), name="static")
```

### Frontend Optimization

1. **Build Optimization**:
```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@radix-ui/react-dialog']
        }
      }
    }
  }
})
```

2. **CDN Configuration**:
```html
<!-- Use CDN for common libraries -->
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
```

## Security Considerations

### Production Security

1. **Environment Variables**:
```bash
# Use secure secret management
export SECRET_KEY=$(openssl rand -base64 32)
export DATABASE_URL="postgresql://user:password@host:port/db"
```

2. **Firewall Configuration**:
```bash
# UFW firewall rules
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

3. **Docker Security**:
```dockerfile
# Use non-root user
RUN adduser --disabled-password --gecos '' appuser
USER appuser
```

### API Security

1. **Rate Limiting**:
```python
# backend/app/middleware/rate_limit.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post("/api/v1/tryon/")
@limiter.limit("10/minute")
async def create_try_on(request: Request, ...):
    # ... endpoint logic
```

2. **Input Validation**:
```python
# Validate file uploads
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def validate_file(file):
    if file.size > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large")
    if not file.filename.lower().endswith(tuple(ALLOWED_EXTENSIONS)):
        raise HTTPException(400, "Invalid file type")
```

## Backup and Recovery

### Database Backup

```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_$DATE.sql
aws s3 cp backup_$DATE.sql s3://your-backup-bucket/
```

### Application Backup

```bash
# Backup application data
tar -czf app_backup_$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=venv \
  --exclude=.git \
  .
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**:
```bash
# Check port usage
sudo netstat -tulpn | grep :8000
sudo netstat -tulpn | grep :3000
```

2. **Docker Issues**:
```bash
# Clean up Docker
docker system prune -a
docker volume prune
```

3. **Permission Issues**:
```bash
# Fix file permissions
sudo chown -R $USER:$USER .
chmod +x start.sh
```

### Debug Commands

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs backend
docker-compose logs frontend

# Restart services
docker-compose restart

# Rebuild and restart
docker-compose up --build --force-recreate
```

## Maintenance

### Regular Maintenance Tasks

1. **Update Dependencies**:
```bash
# Backend
pip list --outdated
pip install --upgrade package-name

# Frontend
npm outdated
npm update
```

2. **Security Updates**:
```bash
# Update system packages
sudo apt update && sudo apt upgrade

# Update Docker images
docker-compose pull
docker-compose up -d
```

3. **Database Maintenance**:
```sql
-- Analyze and vacuum database
ANALYZE;
VACUUM;
```

### Monitoring Scripts

```bash
#!/bin/bash
# health_check.sh
curl -f http://localhost:8000/health || exit 1
curl -f http://localhost:3000 || exit 1
echo "All services healthy"
```

## Support

For deployment support:

- **Documentation**: Check this guide and API documentation
- **Issues**: Report deployment issues
- **Contact**: devops@yourdomain.com
