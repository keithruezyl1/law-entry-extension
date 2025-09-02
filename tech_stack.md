# Civilify Law Entry App - Technology Stack

## Frontend Technologies

### Core Framework
- **React**: 19.1.1 - Latest React version with concurrent features
- **TypeScript**: 4.9.5 - Type-safe JavaScript development
- **React Router**: 6.22.0 - Client-side routing with nested routes
- **React Hook Form**: 7.62.0 - Performant forms with minimal re-renders
- **Zod**: 3.23.8 - TypeScript-first schema validation

### State Management
- **React Context API**: Built-in state management for authentication
- **useState/useEffect**: React hooks for local component state
- **Custom Hooks**: `useLocalStorage`, `useAuth` for reusable logic

### UI Components & Styling
- **Tailwind CSS**: 4.1.12 - Utility-first CSS framework
- **Radix UI**: 1.0.0 - Unstyled, accessible UI primitives
- **Custom Components**: Built-in components for forms, modals, and data display
- **Responsive Design**: Mobile-first approach with breakpoint system

### Form Handling
- **React Hook Form**: 7.62.0 - High-performance form library
- **Zod Integration**: Schema validation with React Hook Form
- **Multi-step Wizard**: 5-step dynamic form system
- **Field Validation**: Real-time validation with error messages

### Data Fetching
- **Fetch API**: Native browser API for HTTP requests
- **JWT Authentication**: Bearer token authentication
- **Error Handling**: Comprehensive error handling and user feedback
- **Loading States**: Skeleton loaders and progress indicators

## Backend Technologies

### Runtime & Framework
- **Node.js**: 18.x+ - JavaScript runtime environment
- **Express.js**: 4.19.2 - Fast, unopinionated web framework
- **ES Modules**: Native ES6 import/export syntax
- **Async/Await**: Modern asynchronous programming patterns

### Database & ORM
- **PostgreSQL**: 15+ - Advanced open-source relational database
- **pgvector**: Latest - Vector similarity search extension
- **node-postgres**: 8.11.3 - PostgreSQL client for Node.js
- **Connection Pooling**: Efficient database connection management

### Authentication & Security
- **JWT (jsonwebtoken)**: 9.0.2 - JSON Web Token implementation
- **bcrypt**: 5.1.1 - Password hashing (planned upgrade)
- **CORS**: 2.8.5 - Cross-origin resource sharing
- **Environment Variables**: Secure configuration management

### Data Validation
- **Zod**: 3.23.8 - TypeScript-first schema validation
- **Input Sanitization**: Request body validation and sanitization
- **Type Safety**: Runtime type checking for API endpoints

## Database Architecture

### Core Tables
```sql
-- Users table for authentication
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  person_id VARCHAR(10) NOT NULL, -- P1, P2, P3, P4, P5
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge base entries
CREATE TABLE kb_entries (
  id SERIAL PRIMARY KEY,
  entry_id VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  canonical_citation TEXT,
  summary TEXT,
  text TEXT,
  tags TEXT[],
  jurisdiction VARCHAR(10),
  law_family VARCHAR(50),
  effective_date DATE,
  amendment_date DATE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shared plans (NEW: Database-backed)
CREATE TABLE shared_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  day1_date DATE NOT NULL,
  plan_data JSONB NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Vector embeddings for semantic search
CREATE TABLE vector_entries (
  id SERIAL PRIMARY KEY,
  entry_id VARCHAR(255) UNIQUE NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimensions
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Database Functions
```sql
-- Get active plan function
CREATE OR REPLACE FUNCTION get_active_plan()
RETURNS TABLE(
  id INTEGER,
  name TEXT,
  day1_date DATE,
  plan_data JSONB,
  created_by INTEGER,
  created_by_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    sp.id,
    sp.name,
    sp.day1_date,
    sp.plan_data,
    sp.created_by,
    u.name as created_by_name,
    sp.created_at
  FROM shared_plans sp
  LEFT JOIN users u ON sp.created_by = u.id
  WHERE sp.is_active = true
  ORDER BY sp.created_at DESC
  LIMIT 1;
$$;

-- Deactivate all plans function
CREATE OR REPLACE FUNCTION deactivate_all_plans()
RETURNS VOID
LANGUAGE SQL
AS $$
  UPDATE shared_plans SET is_active = false;
$$;

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_kb_entries(
  query_embedding vector(3072),
  match_count int DEFAULT 10
)
RETURNS TABLE(
  entry_id text,
  title text,
  type text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.entry_id,
    e.title,
    e.type,
    1 - (e.embedding <=> query_embedding) as similarity
  FROM vector_entries e
  WHERE e.embedding IS NOT NULL
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### Indexes & Performance
```sql
-- Primary key indexes (automatic)
-- Unique constraint indexes (automatic)

-- Performance indexes
CREATE INDEX IF NOT EXISTS kb_entries_type_idx ON kb_entries(type);
CREATE INDEX IF NOT EXISTS kb_entries_created_by_idx ON kb_entries(created_by);
CREATE INDEX IF NOT EXISTS kb_entries_created_at_idx ON kb_entries(created_at);
CREATE INDEX IF NOT EXISTS shared_plans_active_idx ON shared_plans(is_active);
CREATE INDEX IF NOT EXISTS vector_entries_embedding_idx ON vector_entries USING ivfflat (embedding vector_cosine_ops);
```

## API Architecture

### RESTful Endpoints
```typescript
// Authentication
POST   /api/auth/login          // User login
GET    /api/auth/me             // Get current user
GET    /api/auth/team-members   // Get all team members
GET    /api/auth/quota/:userId  // Get user's daily quota
GET    /api/auth/team-progress  // Get team progress

// Knowledge Base
GET    /api/kb/entries          // List all entries
POST   /api/kb/entries          // Create new entry
PUT    /api/kb/entries/:id      // Update entry
DELETE /api/kb/entries/:id      // Delete entry
GET    /api/kb/entries/search   // Search entries

// Plan Management (NEW: Database-backed)
GET    /api/plans/active        // Get current active plan
POST   /api/plans/import        // Import new plan
DELETE /api/plans/active        // Remove current plan
GET    /api/plans/history       // Get plan history

// Vector Search
POST   /api/vector/upsert       // Add/update embeddings
DELETE /api/vector/:entryId     // Remove embeddings
POST   /api/vector/search       // Semantic search
```

### Request/Response Schemas
```typescript
// Plan Import Request
interface ImportPlanRequest {
  name: string;
  day1_date: string; // ISO date string
  plan_data: any[];  // Excel plan data
}

// Plan Response
interface SharedPlan {
  id: number;
  name: string;
  day1_date: string;
  plan_data: any[];
  created_by: number;
  created_by_name: string;
  created_at: string;
}

// Entry Response
interface KBEntry {
  id: number;
  entry_id: string;
  type: string;
  title: string;
  canonical_citation?: string;
  summary?: string;
  text?: string;
  tags?: string[];
  jurisdiction?: string;
  law_family?: string;
  effective_date?: string;
  amendment_date?: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}
```

## Development Tools & Configuration

### Build Tools
- **Create React App**: 5.0.1 - React application scaffolding
- **CRACO**: 7.1.0 - Create React App Configuration Override
- **PostCSS**: 8.4.35 - CSS transformation tool
- **Tailwind CSS**: 4.1.12 - Utility-first CSS framework

### Development Dependencies
```json
{
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0",
  "@typescript-eslint/eslint-plugin": "^6.0.0",
  "@typescript-eslint/parser": "^6.0.0",
  "eslint": "^8.0.0",
  "eslint-plugin-react": "^7.33.0",
  "eslint-plugin-react-hooks": "^4.6.0",
  "prettier": "^3.0.0"
}
```

### Code Quality
- **ESLint**: 8.0.0 - JavaScript/TypeScript linting
- **Prettier**: 3.0.0 - Code formatting
- **TypeScript**: 4.9.5 - Static type checking
- **React Strict Mode**: Enabled for development

## Deployment & Infrastructure

### Frontend Deployment (Vercel)
- **Platform**: Vercel - Zero-config deployment
- **Build Command**: `npm run build`
- **Output Directory**: `build/`
- **Environment Variables**: `REACT_APP_API_BASE`
- **Auto-deploy**: On git push to main branch
- **CDN**: Global edge network for fast loading

### Backend Deployment (Render)
- **Platform**: Render - Cloud application platform
- **Service Type**: Web Service
- **Runtime**: Node.js 18.x
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment Variables**: Database and JWT configuration

### Database (Supabase)
- **Platform**: Supabase - Open source Firebase alternative
- **Database**: PostgreSQL 15+ with pgvector extension
- **Connection**: SSL-enabled PostgreSQL connection
- **Management**: DBeaver for database administration
- **Backup**: Automated daily backups
- **Monitoring**: Built-in performance monitoring

## Environment Configuration

### Frontend Environment Variables
```bash
# .env file in law-entry-app directory
REACT_APP_API_BASE=https://your-backend-url.com
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

### Backend Environment Variables
```bash
# .env file in server directory
DATABASE_URL=postgresql://postgres:password@host:5432/postgres
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=4000
NODE_ENV=production
PGSSL=true
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

### Database Connection Configuration
```javascript
// Database connection with SSL
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Connection pool configuration
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});
```

## Security Features

### Authentication & Authorization
- **JWT Tokens**: Secure session management
- **Token Expiration**: 24-hour token lifetime
- **Route Protection**: All routes require valid authentication
- **User Roles**: Role-based access control (planned)

### Data Security
- **HTTPS Only**: All communications encrypted
- **SQL Injection Prevention**: Parameterized queries
- **Input Validation**: Zod schema validation
- **CORS Configuration**: Restricted cross-origin requests

### Database Security
- **SSL Connections**: Encrypted database connections
- **Row Level Security**: PostgreSQL RLS policies
- **Connection Pooling**: Limited concurrent connections
- **Environment Variables**: Secure configuration storage

## Performance Optimizations

### Frontend Performance
- **Code Splitting**: React.lazy for route-based splitting
- **Bundle Optimization**: Tree shaking and minification
- **Image Optimization**: WebP format support
- **Caching**: Browser caching strategies

### Backend Performance
- **Connection Pooling**: Efficient database connections
- **Query Optimization**: Indexed database queries
- **Response Caching**: HTTP caching headers
- **Compression**: Gzip response compression

### Database Performance
- **Indexes**: Strategic database indexing
- **Query Optimization**: Efficient SQL queries
- **Connection Management**: Pooled connections
- **Vector Search**: pgvector for fast similarity search

## Monitoring & Logging

### Application Monitoring
- **Vercel Analytics**: Frontend performance metrics
- **Render Logs**: Backend application logs
- **Error Tracking**: Comprehensive error logging
- **Performance Metrics**: Response time monitoring

### Database Monitoring
- **Supabase Dashboard**: Database performance metrics
- **Query Performance**: Slow query identification
- **Connection Monitoring**: Connection pool health
- **Storage Usage**: Database size and growth tracking

## Testing & Quality Assurance

### Testing Strategy
- **Unit Testing**: Component and function testing
- **Integration Testing**: API endpoint testing
- **End-to-End Testing**: User workflow testing
- **Performance Testing**: Load and stress testing

### Code Quality Tools
- **TypeScript**: Static type checking
- **ESLint**: Code quality and style enforcement
- **Prettier**: Code formatting consistency
- **Git Hooks**: Pre-commit quality checks

## Future Technology Roadmap

### Planned Upgrades
- **React 19**: Latest React features and performance improvements
- **TypeScript 5.0**: Enhanced type system capabilities
- **Password Hashing**: bcrypt implementation for security
- **Redis Caching**: Session and data caching layer
- **GraphQL**: Alternative to REST API (optional)

### Scalability Improvements
- **Microservices**: Service decomposition for scalability
- **Load Balancing**: Multiple backend instances
- **Database Sharding**: Horizontal database scaling
- **CDN Integration**: Global content delivery
- **Monitoring**: Advanced observability tools

---

This technology stack provides a robust, scalable foundation for the Civilify Law Entry App with modern web technologies, secure authentication, and efficient data management.

