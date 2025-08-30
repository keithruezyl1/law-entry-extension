# Deployment Guide

This guide covers deploying the Law Entry App to Vercel (frontend) and Render (backend).

## Architecture

- **Frontend**: React app deployed on Vercel
- **Backend**: Node.js API deployed on Render
- **Database**: PostgreSQL with pgvector extension on Render

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Render Account**: Sign up at [render.com](https://render.com)
3. **OpenAI API Key**: Get from [platform.openai.com](https://platform.openai.com)
4. **GitHub Repository**: Push your code to GitHub

## Step 1: Deploy Backend to Render

### 1.1 Create Render Account and Connect GitHub

1. Go to [render.com](https://render.com) and sign up
2. Connect your GitHub account
3. Import your repository

### 1.2 Create PostgreSQL Database

1. In Render dashboard, click "New +" → "PostgreSQL"
2. Configure:
   - **Name**: `law-entry-db`
   - **Database**: `law_entry_db`
   - **User**: `law_entry_user`
   - **Plan**: Starter (Free)
3. Click "Create Database"
4. Copy the **Internal Database URL** (you'll need this later)

### 1.3 Deploy Web Service

1. In Render dashboard, click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure the service:
   - **Name**: `law-entry-api`
   - **Root Directory**: `law-entry-app/server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Starter (Free)

### 1.4 Configure Environment Variables

In the Render service dashboard, go to "Environment" tab and add:

```
NODE_ENV=production
PORT=10000
CORS_ORIGIN=https://your-frontend-domain.vercel.app
DATABASE_URL=<your-postgres-internal-url>
PGSSL=true
OPENAI_API_KEY=<your-openai-api-key>
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
```

**Important**: Replace `your-frontend-domain.vercel.app` with your actual Vercel domain after deploying the frontend.

### 1.5 Deploy

1. Click "Create Web Service"
2. Wait for deployment to complete
3. Copy the service URL (e.g., `https://law-entry-api.onrender.com`)

## Step 2: Deploy Frontend to Vercel

### 2.1 Create Vercel Account and Connect GitHub

1. Go to [vercel.com](https://vercel.com) and sign up
2. Connect your GitHub account
3. Import your repository

### 2.2 Configure Project

1. Set the **Root Directory** to `law-entry-app`
2. Framework Preset: `Create React App`
3. Build Command: `npm run build`
4. Output Directory: `build`

### 2.3 Configure Environment Variables

In the Vercel project settings, add:

```
REACT_APP_VECTOR_API_URL=https://your-backend-url.onrender.com
```

Replace `your-backend-url.onrender.com` with your actual Render service URL.

### 2.4 Deploy

1. Click "Deploy"
2. Wait for deployment to complete
3. Copy your Vercel domain (e.g., `https://law-entry-app.vercel.app`)

## Step 3: Update CORS Configuration

After both deployments are complete:

1. Go back to your Render service
2. Update the `CORS_ORIGIN` environment variable with your actual Vercel domain
3. Redeploy the service

## Step 4: Test the Application

1. Visit your Vercel frontend URL
2. Test the login (any username/password works in demo mode)
3. Test creating entries
4. Test the duplicate detection features

## Environment Variables Reference

### Backend (Render)

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `10000` |
| `CORS_ORIGIN` | Allowed frontend domain | `https://law-entry-app.vercel.app` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:port/db` |
| `PGSSL` | Enable SSL for database | `true` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `OPENAI_EMBEDDING_MODEL` | Embedding model | `text-embedding-3-large` |

### Frontend (Vercel)

| Variable | Description | Example |
|----------|-------------|---------|
| `REACT_APP_VECTOR_API_URL` | Backend API URL | `https://law-entry-api.onrender.com` |

## Troubleshooting

### Common Issues

1. **CORS Errors**: Make sure `CORS_ORIGIN` matches your exact Vercel domain
2. **Database Connection**: Verify `DATABASE_URL` and `PGSSL` settings
3. **pgvector Extension**: Render PostgreSQL supports pgvector by default
4. **Build Failures**: Check that all dependencies are in `package.json`

### Logs

- **Render**: View logs in the service dashboard
- **Vercel**: View logs in the deployment dashboard

### Support

- **Render**: [docs.render.com](https://docs.render.com)
- **Vercel**: [vercel.com/docs](https://vercel.com/docs)
- **pgvector**: [github.com/pgvector/pgvector](https://github.com/pgvector/pgvector)

## Cost Estimation

### Free Tier (Recommended for testing)

- **Vercel**: Free (Hobby plan)
- **Render**: Free (Web service + PostgreSQL)
- **OpenAI**: Pay per use (~$0.0001 per 1K tokens)

### Production Scaling

- **Vercel**: Pro plan ($20/month)
- **Render**: Paid plans for better performance
- **Database**: Consider managed PostgreSQL services for production

## Security Notes

1. **Environment Variables**: Never commit API keys to Git
2. **CORS**: Restrict to specific domains in production
3. **Database**: Use strong passwords and SSL connections
4. **API Keys**: Rotate OpenAI API keys regularly
