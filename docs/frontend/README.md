# Frontend Documentation

## Overview

The frontend is a React application built with TypeScript, providing a modern and responsive user interface for the virtual try-on demo. It features a clean, minimalist design with smooth animations and intuitive user interactions.

## Architecture

```
frontend/
├── public/                  # Static assets
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # Base UI components (shadcn/ui)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── ...
│   │   └── ProductCard.tsx # Product display component
│   ├── hooks/              # Custom React hooks
│   │   └── use-toast.ts    # Toast notification hook
│   ├── lib/                # Utility libraries
│   │   └── utils.ts        # Common utility functions
│   ├── pages/              # Application pages
│   │   ├── ProductSelection.tsx
│   │   ├── SelfieCapture.tsx
│   │   ├── LoadingScreen.tsx
│   │   ├── VirtualFitting.tsx
│   │   └── NotFound.tsx
│   ├── services/           # API services
│   │   ├── api.ts          # Axios configuration
│   │   ├── authService.ts  # Authentication service
│   │   ├── productService.ts # Product management service
│   │   └── tryOnService.ts # Virtual try-on service
│   ├── store/              # State management (Zustand)
│   │   ├── useAuthStore.ts
│   │   ├── useProductStore.ts
│   │   └── useTryOnStore.ts
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts
│   ├── App.tsx             # Main application component
│   ├── main.tsx            # Application entry point
│   └── index.css            # Global styles
├── components.json         # shadcn/ui configuration
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite configuration
└── Dockerfile              # Docker configuration
```

## Technology Stack

### Core Technologies
- **React 18**: Modern React with hooks and concurrent features
- **TypeScript**: Type-safe JavaScript development
- **Vite**: Fast build tool and development server
- **React Router DOM**: Client-side routing

### UI Framework
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: High-quality, accessible UI components
- **Lucide React**: Beautiful icon library

### State Management
- **Zustand**: Lightweight state management
- **React Context**: Component-level state sharing

### HTTP Client
- **Axios**: Promise-based HTTP client with interceptors

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | No | http://localhost:8000 |
| `VITE_DEFAULT_BRAND` | Default brand filter | No | None |

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
})
```

## Application Flow

### 1. Product Selection (`/`)
- Display product catalog with filtering options
- Allow users to select multiple products
- Show selected products count and continue button

### 2. Selfie Capture (`/selfie-capture`)
- Split-screen layout: image capture on left, selected products on right
- Camera access for live photo capture
- File upload option for existing images
- Image preview and retake functionality

### 3. Loading Screen (`/loading`)
- Animated progress circle
- Status updates during processing
- Automatic navigation to results

### 4. Virtual Fitting (`/virtual-fitting`)
- Display virtual try-on results in 4-column grid
- Interactive buttons (like, download, share)
- Fullscreen image modal
- Session summary

## Components

### ProductCard
Displays individual product information with selection functionality.

**Props:**
```typescript
interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: string;
    image: string;
  };
  isSelected: boolean;
  onSelect: (id: string) => void;
}
```

**Features:**
- Product image display
- Selection state management
- Hover animations
- Responsive design

### UI Components (shadcn/ui)

#### Button
Versatile button component with multiple variants.

**Variants:**
- `default`: Primary button
- `destructive`: Danger actions
- `outline`: Secondary actions
- `secondary`: Subtle actions
- `ghost`: Minimal styling
- `link`: Link-like appearance

**Sizes:**
- `default`: Standard size
- `sm`: Small size
- `lg`: Large size
- `icon`: Icon-only button

#### Card
Container component for grouping related content.

**Sub-components:**
- `Card`: Main container
- `CardHeader`: Header section
- `CardTitle`: Title text
- `CardDescription`: Description text
- `CardContent`: Main content
- `CardFooter`: Footer section

#### Tabs
Tabbed interface for organizing content.

**Sub-components:**
- `Tabs`: Main container
- `TabsList`: Tab navigation
- `TabsTrigger`: Individual tab
- `TabsContent`: Tab content

## State Management

### Zustand Stores

#### useAuthStore
Manages user authentication state.

```typescript
interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  saveAuthData: (token: string, user: User) => void;
}
```

#### useProductStore
Manages product data and filtering.

```typescript
interface ProductState {
  products: Product[];
  brands: Brand[];
  loading: boolean;
  error: string | null;
  filters: {
    brand?: string;
    gender?: 'men' | 'women' | 'unisex';
  };
  fetchProducts: () => Promise<void>;
  fetchBrands: () => Promise<void>;
  setFilters: (filters: Partial<Filters>) => void;
}
```

#### useTryOnStore
Manages virtual try-on session state.

```typescript
interface TryOnState {
  sessionId: string | null;
  status: 'idle' | 'processing' | 'completed' | 'error';
  results: TryOnResult[];
  createTryOn: (request: TryOnRequest) => Promise<void>;
  getStatus: (sessionId: string) => Promise<void>;
}
```

## Services

### API Service (`api.ts`)
Centralized HTTP client configuration with Axios.

**Features:**
- Base URL configuration
- Request/response interceptors
- Error handling
- Authentication token management

```typescript
// API configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 10000,
});

// Request interceptor for authentication
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Authentication Service (`authService.ts`)
Handles user authentication operations.

**Methods:**
- `login(credentials)`: Authenticate user
- `register(userData)`: Register new user
- `logout()`: Clear authentication data
- `saveAuthData(token, user)`: Store auth data

### Product Service (`productService.ts`)
Manages product-related API calls.

**Methods:**
- `getProducts(filters)`: Fetch products with filtering
- `getBrands()`: Fetch available brands
- `getProduct(id)`: Fetch specific product

### Try-On Service (`tryOnService.ts`)
Handles virtual try-on operations.

**Methods:**
- `createTryOn(request)`: Start virtual try-on session
- `getTryOnStatus(sessionId)`: Check session status
- `waitForTryOnCompletion(sessionId)`: Wait for completion

## Styling

### Tailwind CSS Configuration

The application uses Tailwind CSS with custom configuration:

```javascript
// tailwind.config.js
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: "hsl(var(--primary))",
        // ... other custom colors
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### Design System

#### Color Palette
- **Primary**: Brand color for main actions
- **Secondary**: Supporting color for secondary actions
- **Background**: Main background color
- **Foreground**: Text and content color
- **Muted**: Subtle text and borders
- **Border**: Element borders and dividers

#### Typography
- **Font Family**: System fonts with fallbacks
- **Font Weights**: Light (300), Regular (400), Medium (500)
- **Font Sizes**: Responsive scale from xs to 4xl

#### Spacing
- **Consistent Scale**: 4px base unit (0.25rem)
- **Responsive**: Mobile-first approach
- **Component Spacing**: Consistent padding and margins

#### Animations
- **Transitions**: Smooth 300ms transitions
- **Hover Effects**: Subtle scale and color changes
- **Loading States**: Spinner and progress animations

## Responsive Design

### Breakpoints
- **Mobile**: < 640px (sm)
- **Tablet**: 640px - 1024px (md)
- **Desktop**: > 1024px (lg)

### Grid System
- **Mobile**: Single column layout
- **Tablet**: 2-column grid
- **Desktop**: 4-column grid for product results

### Component Adaptations
- **Navigation**: Collapsible on mobile
- **Product Grid**: Responsive column count
- **Forms**: Stacked layout on mobile
- **Images**: Aspect ratio maintained across devices

## Performance Optimization

### Code Splitting
- Route-based code splitting with React.lazy()
- Component-level lazy loading
- Dynamic imports for heavy components

### Image Optimization
- Responsive images with proper sizing
- Lazy loading for off-screen images
- WebP format support where available

### Bundle Optimization
- Tree shaking for unused code
- Minification and compression
- Vendor chunk separation

## Development

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Docker Development

```bash
# Build and run with Docker Compose
docker-compose up --build frontend
```

### Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build
- `npm run lint`: Run ESLint
- `npm run type-check`: Run TypeScript compiler

## Testing

### Testing Strategy
- **Unit Tests**: Component and utility function testing
- **Integration Tests**: API service testing
- **E2E Tests**: User flow testing

### Testing Tools
- **Vitest**: Fast unit testing framework
- **React Testing Library**: Component testing utilities
- **Playwright**: End-to-end testing

## Deployment

### Production Build

```bash
# Create production build
npm run build

# Serve static files
npm run preview
```

### Docker Production

```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Environment Configuration

```bash
# Production environment variables
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_DEFAULT_BRAND=LEMAIRE
```

## Troubleshooting

### Common Issues

1. **Build Errors**: Check TypeScript types and imports
2. **API Connection**: Verify backend URL and CORS settings
3. **Authentication**: Check token storage and expiration
4. **Styling Issues**: Verify Tailwind CSS configuration

### Debug Tools

- **React Developer Tools**: Component inspection
- **Redux DevTools**: State management debugging
- **Network Tab**: API request monitoring
- **Console**: Error logging and debugging

### Performance Monitoring

- **Bundle Analyzer**: Analyze bundle size
- **Lighthouse**: Performance auditing
- **Core Web Vitals**: User experience metrics

## Best Practices

### Code Organization
- **Component Structure**: Single responsibility principle
- **File Naming**: Consistent naming conventions
- **Import Organization**: Grouped and sorted imports
- **Type Safety**: Comprehensive TypeScript usage

### Performance
- **Memoization**: Use React.memo and useMemo appropriately
- **Lazy Loading**: Implement for heavy components
- **Image Optimization**: Proper sizing and formats
- **Bundle Size**: Monitor and optimize bundle size

### Accessibility
- **Semantic HTML**: Proper HTML structure
- **ARIA Labels**: Screen reader support
- **Keyboard Navigation**: Full keyboard accessibility
- **Color Contrast**: WCAG compliance

### Security
- **Input Validation**: Client-side validation
- **XSS Prevention**: Sanitize user inputs
- **HTTPS**: Secure communication
- **Token Management**: Secure token storage
