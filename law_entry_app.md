# Civilify Law Entry App - Complete Documentation

## Overview

The **Civilify Law Entry App** is a React-based web application designed as the primary gateway for adding entries into the Civilify Knowledge Base (KB). It provides a comprehensive, dynamic form system for creating and managing legal knowledge base entries with support for multiple legal document types. The app features a complete authentication system, routing system, and modern UI design.

## Key Features

- **Authentication System**: Real username/password authentication with individual team passwords
- **Database Integration**: PostgreSQL with pgvector extension for vector search
- **Team Management**: 5 team members (P1-P5) with individual daily quotas
- **Routing System**: Clean URL structure with React Router
- **Multi-Step Form Wizard**: 5-step dynamic form for entry creation
- **Entry Management**: Create, edit, delete, search, and filter entries
- **Dashboard**: Team progress tracking and entry overview
- **Responsive Design**: Mobile-friendly interface
- **Shared Plan Management**: Import and share plans across all team members with database-backed synchronization

### Recent Enhancements (Last updated 5/9/25 5PM)

- **Creation Success Toast (2s)**: After creating an entry, the app redirects to the dashboard and shows a success toast for a full 2 seconds. The timer starts after navigation completes to ensure consistent duration.
- **Safer Deletions with Reference Cleanup**: Before deleting an entry, the app now checks for inbound internal citations (`legal_bases`/`related_sections`) and warns the user with a list of affected entries. Upon confirmation, those dangling references are automatically removed from the citing entries.
- **Rights Advisory – Expanded Scopes + Other**: The `rights_scope` now includes a comprehensive set of options (arrest, search, detention, counsel, GBV, minors, privacy, traffic stop, protective orders, fair trial, freedom of expression, legal aid access, complaint filing, labor rights, consumer rights, housing/land rights, health/education) and supports a free-text "Other" entry.
- **Duplicate Matches Toast (create flow)**: While composing entries, the form surfaces a non-blocking toast for potential near-duplicate matches with quick visibility into titles/citations; a CTA is available for viewing all matches when applicable.
- **Improved Relations Editing**: `LegalBasisPicker` supports internal linking with enriched context (titles and first URLs fetched where available) and defaults types sensibly.
- **Navigation Robustness**: The success state for the creation toast is handled via session storage, ensuring reliable feedback across redirects and browser histories.

## Technology Stack

- **Frontend**: React 19.1.1, TypeScript 4.9.5, React Hook Form 7.62.0, Zod 3.23.8, custom UI components (Select, Toast)
- **Backend**: Node.js, Express.js, PostgreSQL with pgvector
- **Authentication**: JWT tokens with individual team passwords
- **Database**: Render (PostgreSQL) with DBeaver for management
- **Styling**: Tailwind CSS 4.1.12, Radix UI components
- **Deployment**: Vercel (frontend), Render (backend)

## Authentication System

### Team Members & Passwords
The app uses individual passwords for each team member

### Authentication Flow
1. **Login**: User enters username and password
2. **Validation**: Backend checks username against database and validates password
3. **JWT Token**: Successful login generates JWT token for session management
4. **Protected Routes**: All app routes require valid JWT token
5. **Auto-logout**: Token expires after 24 hours

### Database Schema
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

-- KB entries with user tracking
CREATE TABLE kb_entries (
  id SERIAL PRIMARY KEY,
  entry_id VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  -- ... other fields ...
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Database Setup with DBeaver

### Prerequisites
- **DBeaver**: Download and install from https://dbeaver.io/
- **Render PostgreSQL**: Provision a PostgreSQL instance on Render and copy its connection details

### Connection Setup in DBeaver
1. **Open DBeaver** and create new connection
2. **Select PostgreSQL** as database type
3. **Enter connection details from Render** (from your Render PostgreSQL service page):
   - Host: `[your-render-db-host]`
   - Port: `5432`
   - Database: `[your-db-name]`
   - Username: `[your-db-user]`
   - Password: `[your-db-password]`
   - SSL: Enabled (Required by Render)
4. **Test connection** and save

### Database Management
- **Tables**: View and edit `users`, `kb_entries`, `shared_plans`
- **SQL Editor**: Run custom queries and migrations
- **Data Export**: Export data for backup or analysis
- **Schema Management**: Modify table structures as needed

### Key Tables Overview
- **`users`**: Team member authentication and profile data
- **`kb_entries`**: All knowledge base entries with creator tracking
- **`shared_plans`**: Imported Excel plans shared across team (NEW: Database-backed)
- **`vector_entries`**: Vector embeddings for semantic search

## Team Progress & Daily Quotas

### Progress Tracking
- **Daily Quotas**: Each team member has specific daily entry requirements
- **Progress Cards**: Dashboard shows real-time progress for each team member
- **Database-Driven**: Team member names and progress fetched from database
- **Shared View**: All team members see everyone's progress

### Daily Quota System
- **P1 (Arda)**: Focus on RPC + Cebu Ordinances
- **P2 (Delos Cientos)**: Rules of Court + DOJ (procedure-heavy)
- **P3 (Paden)**: PNP SOPs + Incident Checklists
- **P4 (Sendrijas)**: Traffic/LTO lane
- **P5 (Tagarao)**: Rights + Constitution + Policy

### Progress Calculation
- **Daily Counts**: Track entries by type per person per day
- **Carryover Logic**: Unfinished quotas carry over to next day
- **Completion Status**: Visual indicators (green/orange/red) for completion

## Shared Plan Management (UPDATED)

### Plan Features
- **Shared Access**: Everyone sees the same imported plan
- **Cross-Device Sync**: Plans automatically sync across all devices and users
- **Progress Tracking**: Real-time updates across all users
- **Plan History**: Track multiple plans over time
- **Active Plan**: Only one plan active at a time
- **Persistent Storage**: Plans survive browser refreshes and device changes

### Plan Data Structure
```sql
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

-- Function to get the current active plan
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

-- Function to deactivate all plans (when importing new one)
CREATE OR REPLACE FUNCTION deactivate_all_plans()
RETURNS VOID
LANGUAGE SQL
AS $$
  UPDATE shared_plans SET is_active = false;
$$;
```

### Plan Synchronization (NEW)
- **Automatic Loading**: Plans are automatically loaded from database on app startup
- **Real-time Updates**: All users see plan changes immediately
- **No Local Storage**: Plans are no longer stored in browser localStorage
- **Cross-Device Access**: Import a plan on one device, see it on all others

## Backend API Endpoints

### Authentication Endpoints
- `POST /api/auth/login` - User login with username/password
- `GET /api/auth/me` - Get current user information
- `GET /api/auth/team-members` - Get all team members
- `GET /api/auth/quota/:userId` - Get user's daily quota
- `GET /api/auth/team-progress` - Get team progress for date

### Entry Management Endpoints
- `GET /api/kb/entries` - List all entries with creator info
- `POST /api/kb/entries` - Create new entry (with creator tracking)
- `PUT /api/kb/entries/:id` - Update existing entry
- `DELETE /api/kb/entries/:id` - Delete entry
- `GET /api/kb/entries/search` - Search entries with filters

Note: Client deletion flow performs a preflight scan for inbound internal references and, on confirmation, cleans up dangling references in citing entries.

### Plan Management Endpoints (UPDATED)
- `GET /api/plans/active` - Get current active plan from database
- `POST /api/plans/import` - Import new plan to database
- `DELETE /api/plans/active` - Remove current plan from database
- `GET /api/plans/history` - Get plan history from database

### Vector Search Endpoints
- `POST /api/vector/upsert` - Add/update vector embeddings
- `DELETE /api/vector/:entryId` - Remove vector embeddings
- `POST /api/vector/search` - Semantic search

## Environment Configuration

### Frontend Environment Variables
```bash
# .env file in law-entry-app directory
REACT_APP_API_BASE=https://your-backend-url.com
```

### Backend Environment Variables
```bash
# .env file in server directory
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
JWT_SECRET=your-jwt-secret-key
PORT=4000
NODE_ENV=production
PGSSL=true
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

## Deployment Setup

### Frontend (Vercel)
1. **Connect Repository**: Link GitHub repository to Vercel
2. **Build Settings**: 
   - Build Command: `npm run build`
   - Output Directory: `build`
   - Install Command: `npm install`
3. **Environment Variables**: Set `REACT_APP_API_BASE` to backend URL
4. **Deploy**: Automatic deployment on git push

### Backend (Render)
1. **Create Service**: New Web Service from GitHub repository
2. **Build Settings**:
   - Build Command: `npm install`
   - Start Command: `npm start`
3. **Environment Variables**: Set `DATABASE_URL`, `JWT_SECRET`, `PGSSL`, `CORS_ORIGIN`
4. **Database**: Use a Render PostgreSQL instance. Copy the external connection string and set it as `DATABASE_URL` (include `sslmode=require`).

### Database (Render PostgreSQL)
1. **Provision DB**: Create a PostgreSQL instance on Render
2. **Migrations**: Run SQL scripts from `server/sql/` in DBeaver or psql
3. **Connection**: Use Render’s connection string in backend `DATABASE_URL`
4. **SSL**: Ensure SSL is required (`sslmode=require`)

## Development Workflow

### Local Development
```bash
# Frontend
cd law-entry-app
npm install
npm start

# Backend
cd server
npm install
npm start

# Database (Docker)
docker-compose up -d
```

### Database Migrations
```bash
# Run migrations
cd server
npm run migrate

# Or manually in DBeaver
-- Run SQL files in order:
-- 001_init.sql
-- 002_match_fn.sql
-- 003_migrate_add_created_by.sql
-- 004_shared_plans.sql (NEW: Required for plan management)
-- 005_simple_passwords.sql
```

### Testing Authentication
1. **Start Backend**: Ensure server is running on port 4000
2. **Start Frontend**: React app on port 3000
3. **Login Test**: Use any team member credentials
4. **Verify**: Check that user info appears in dashboard

## Troubleshooting

### Common Issues
- **Build Failures**: Check for unused imports and variables
- **Database Connection**: Verify DATABASE_URL in backend .env
- **Authentication Errors**: Check JWT_SECRET and token expiration
- **CORS Issues**: Ensure backend allows frontend domain
- **Plan Not Loading**: Verify shared_plans table exists and has data

### Database Issues
- **Connection Refused**: Verify Render DB connection string and SSL requirement
- **Missing Tables**: Run migration scripts in DBeaver (especially 004_shared_plans.sql)
- **Permission Errors**: Verify database user permissions on Render DB
- **Plan Import Fails**: Check if `shared_plans` table structure is correct

### Deployment Issues
- **Environment Variables**: Ensure all required vars are set
- **Build Errors**: Check for TypeScript/ESLint errors
- **API Errors**: Verify backend URL in frontend config
- **Plan Sync Issues**: Verify database connection and table structure

## Security Considerations

### Authentication Security
- **Individual Passwords**: Each team member has unique password
- **JWT Tokens**: Secure session management with expiration
- **Password Storage**: Simple comparison for small team (not hashed)
- **Route Protection**: All routes require valid authentication

### Database Security
- **Connection Security**: Use SSL connections to your managed PostgreSQL (Render)
- **Row Level Security**: Configure RLS policies for data access
- **API Security**: JWT validation on all protected endpoints
- **Environment Variables**: Secure storage of sensitive config

## Monitoring & Maintenance

### Database Monitoring
- **DBeaver**: Regular connection testing and data verification
- **Render Dashboard**: Monitor database usage and connection status
- **Backup Strategy**: Regular exports of critical data
- **Plan Data**: Monitor shared_plans table for data integrity

### Application Monitoring
- **Vercel Analytics**: Frontend performance and error tracking
- **Render Logs**: Backend application logs and error monitoring
- **User Feedback**: Monitor authentication and usability issues
- **Plan Synchronization**: Monitor cross-device plan sync success

## Future Enhancements

### Planned Features
- **Password Hashing**: Implement bcrypt for password security
- **User Management**: Admin interface for user management
- **Advanced Search**: Enhanced semantic search capabilities
- **Mobile App**: React Native version for mobile access
- **API Documentation**: Swagger/OpenAPI documentation
- **Plan Versioning**: Track changes to imported plans over time

### Scalability Improvements
- **Caching**: Redis for session and data caching
- **Load Balancing**: Multiple backend instances
- **Database Optimization**: Query optimization and indexing
- **CDN**: Content delivery network for static assets

---

## Quick Start Guide

### For New Team Members
1. **Get Credentials**: Receive username and password from admin
2. **Access App**: Navigate to deployed app URL
3. **Login**: Use provided credentials
4. **Import Plan**: If not already done, import the Excel plan (NEW: Will sync to all devices)
5. **Start Working**: Begin creating entries according to daily quotas

### For Administrators
1. **Database Setup**: Ensure Render PostgreSQL is configured
2. **User Management**: Add/update team members in `users` table
3. **Plan Management**: Import and manage shared plans (NEW: Database-backed)
4. **Monitoring**: Regular check of system health and usage
5. **Plan Synchronization**: Verify plans are syncing across all team devices

### For Developers
1. **Local Setup**: Follow development workflow above
2. **Database Access**: Use DBeaver for database management
3. **Testing**: Test all authentication flows and features
4. **Deployment**: Follow deployment setup for production
5. **Plan Testing**: Test plan import and cross-device synchronization

---

This documentation provides comprehensive information for all users of the Civilify Law Entry App, from team members to administrators and developers. For additional support or questions, please refer to the development team or consult the inline code documentation.
