# Deployment Checklist - Render Backend

## Pre-Deployment Checklist ✅

- [ ] **GitHub Repository**: Code is pushed to GitHub
- [ ] **Render Account**: Created account at render.com
- [ ] **OpenAI API Key**: Have your API key ready
- [ ] **Vercel Frontend**: Frontend is already deployed
- [ ] **Vercel URL**: Know your frontend URL (e.g., https://law-entry-app.vercel.app)

## Render Backend Deployment Steps

### 1. Create Web Service
- [ ] Go to https://dashboard.render.com
- [ ] Click "New" → "Web Service"
- [ ] Connect GitHub repository
- [ ] Select `law-entry-app` repository

### 2. Configure Service
- [ ] **Name**: `law-entry-api`
- [ ] **Root Directory**: `server`
- [ ] **Environment**: `Node`
- [ ] **Build Command**: `npm install`
- [ ] **Start Command**: `npm start`
- [ ] **Plan**: Free (or Starter)

### 3. Environment Variables
- [ ] `NODE_ENV=production`
- [ ] `PORT=10000`
- [ ] `CORS_ORIGIN=https://your-vercel-domain.vercel.app`
- [ ] `PGSSL=true`
- [ ] `OPENAI_API_KEY=your_openai_api_key`
- [ ] `OPENAI_EMBEDDING_MODEL=text-embedding-3-large`
- [ ] `API_KEY=your_secure_api_key` (optional)

### 4. Create Database
- [ ] Go to "Databases" in Render
- [ ] Create new PostgreSQL database
- [ ] **Name**: `law-entry-db`
- [ ] **Plan**: Free (or Starter)
- [ ] Copy connection string
- [ ] Add `DATABASE_URL` environment variable

### 5. Deploy
- [ ] Click "Create Web Service"
- [ ] Wait for deployment to complete
- [ ] Copy the service URL (e.g., `https://law-entry-api.onrender.com`)

## Frontend Configuration

### 6. Update Vercel
- [ ] Go to Vercel dashboard
- [ ] Navigate to project settings
- [ ] Add environment variable: `REACT_APP_VECTOR_API_URL=https://your-render-service.onrender.com`
- [ ] Redeploy frontend

## Testing

### 7. Test Backend
- [ ] Visit: `https://your-service.onrender.com/health`
- [ ] Should return: `{"ok": true}`

### 8. Test Frontend
- [ ] Visit your Vercel frontend
- [ ] Try creating a new entry
- [ ] Check browser console for errors

### 9. Database Setup
- [ ] In Render dashboard, open web service shell
- [ ] Run: `npm run setup-db`

## Troubleshooting

### Common Issues
- [ ] **CORS Errors**: Check `CORS_ORIGIN` matches exact Vercel URL
- [ ] **Database Connection**: Verify `DATABASE_URL` and `PGSSL=true`
- [ ] **API Key Issues**: Check `OPENAI_API_KEY` is set correctly
- [ ] **Build Failures**: Check Render logs for npm install errors

## Post-Deployment

### 10. Monitoring
- [ ] Set up health checks
- [ ] Monitor logs in Render dashboard
- [ ] Test all features work correctly

### 11. Security
- [ ] Verify API keys are not exposed
- [ ] Check CORS is properly configured
- [ ] Test authentication if implemented

## URLs to Save

- **Backend URL**: `https://your-service.onrender.com`
- **Frontend URL**: `https://your-vercel-domain.vercel.app`
- **Render Dashboard**: https://dashboard.render.com
- **Vercel Dashboard**: https://vercel.com/dashboard

## Cost Tracking

- **Free Tier**: 750 hours/month
- **Starter Plan**: $7/month (unlimited)
- **Database**: Free tier available

---

**Status**: ⏳ Ready to deploy
**Last Updated**: [Date]
**Notes**: [Any issues or notes]

