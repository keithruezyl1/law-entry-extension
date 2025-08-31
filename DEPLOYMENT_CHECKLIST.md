# Deployment Checklist

## Pre-Deployment

- [ ] Code is pushed to GitHub repository
- [ ] All tests pass locally
- [ ] Environment variables are documented
- [ ] Database schema is ready
- [ ] OpenAI API key is obtained

## Backend Deployment (Render)

### Database Setup
- [ ] Create Render account
- [ ] Create PostgreSQL database
- [ ] Copy database connection string
- [ ] Verify pgvector extension is available

### API Service Setup
- [ ] Create Web Service in Render
- [ ] Set root directory to `law-entry-app/server`
- [ ] Configure build command: `npm install`
- [ ] Configure start command: `npm start`
- [ ] Set environment variables:
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=10000`
  - [ ] `CORS_ORIGIN=https://your-frontend-domain.vercel.app`
  - [ ] `DATABASE_URL=<your-postgres-url>`
  - [ ] `PGSSL=true`
  - [ ] `OPENAI_API_KEY=<your-key>`
  - [ ] `OPENAI_EMBEDDING_MODEL=text-embedding-3-large`
- [ ] Deploy service
- [ ] Test health endpoint: `https://your-api.onrender.com/health`
- [ ] Copy API URL for frontend configuration

## Frontend Deployment (Vercel)

### Project Setup
- [ ] Create Vercel account
- [ ] Import GitHub repository
- [ ] Set root directory to `law-entry-app`
- [ ] Configure framework preset: Create React App
- [ ] Set build command: `npm run build`
- [ ] Set output directory: `build`

### Environment Variables
- [ ] Add `REACT_APP_VECTOR_API_URL=https://your-backend-url.onrender.com`
- [ ] Deploy frontend
- [ ] Copy frontend URL

## Post-Deployment

### Configuration Updates
- [ ] Update backend CORS_ORIGIN with actual frontend URL
- [ ] Redeploy backend service
- [ ] Test frontend-backend communication

### Testing
- [ ] Test login functionality
- [ ] Test entry creation
- [ ] Test duplicate detection features
- [ ] Test import/export functionality
- [ ] Test search functionality
- [ ] Verify database connections

### Monitoring
- [ ] Check Render service logs
- [ ] Check Vercel deployment logs
- [ ] Monitor database connections
- [ ] Test API endpoints

## URLs to Save

- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://your-api.onrender.com`
- **Database**: Internal URL from Render dashboard

## Troubleshooting Commands

```bash
# Check backend health
curl https://your-api.onrender.com/health

# Test database connection (from backend logs)
# Look for "Connected to database" and "Database setup completed"

# Check frontend build
# Look for successful build in Vercel logs
```

## Security Checklist

- [ ] Environment variables are not in Git
- [ ] CORS is properly configured
- [ ] Database uses SSL
- [ ] API keys are secure
- [ ] No sensitive data in logs

