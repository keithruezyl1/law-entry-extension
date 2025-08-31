# Deployment Guide - Render Backend

## Overview
This guide will help you deploy the law-entry-app backend to Render and connect it to your Vercel frontend.

## Prerequisites
- Render account (free tier available)
- OpenAI API key
- Your frontend already deployed on Vercel

## Step 1: Deploy Backend to Render

### Option A: Using Render Dashboard (Recommended)

1. **Go to Render Dashboard**
   - Visit https://dashboard.render.com
   - Sign in to your account

2. **Create New Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Select the `law-entry-app` repository

3. **Configure the Service**
   - **Name**: `law-entry-api`
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or Starter for production)

4. **Set Environment Variables**
   Add these environment variables in Render:
   ```
   NODE_ENV=production
   PORT=10000
   CORS_ORIGIN=https://law-entry-app.vercel.app
   PGSSL=true
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_EMBEDDING_MODEL=text-embedding-3-large
   API_KEY=your_secure_api_key_here
   ```

5. **Create Database**
   - Go to "Databases" in Render
   - Create a new PostgreSQL database
   - Name: `law-entry-db`
   - Plan: Free (or Starter for production)
   - Copy the connection string

6. **Update Database URL**
   - In your web service environment variables
   - Set `DATABASE_URL` to the PostgreSQL connection string from step 5

### Option B: Using render.yaml (Advanced)

1. **Push to GitHub**
   - Ensure your `render.yaml` is in the repository
   - Push to GitHub

2. **Deploy via Blueprint**
   - In Render dashboard, click "New" → "Blueprint"
   - Connect your repository
   - Render will automatically create services based on `render.yaml`

## Step 2: Update Frontend Configuration

1. **Get your Render backend URL**
   - After deployment, your backend will be available at: `https://law-entry-api.onrender.com`

2. **Update Vercel Environment Variables**
   - Go to your Vercel dashboard
   - Navigate to your project settings
   - Add environment variable:
     ```
     REACT_APP_VECTOR_API_URL=https://law-entry-api.onrender.com
     ```

3. **Redeploy Frontend**
   - Trigger a new deployment in Vercel
   - Or push a new commit to trigger automatic deployment

## Step 3: Test the Deployment

1. **Test Backend Health**
   - Visit: `https://law-entry-api.onrender.com/health`
   - Should return: `{"ok": true}`

2. **Test Frontend Connection**
   - Visit your Vercel frontend
   - Try creating a new entry
   - Check browser console for any API errors

## Step 4: Database Setup

1. **Run Database Setup**
   - In Render dashboard, go to your web service
   - Open the shell/console
   - Run: `npm run setup-db`

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure `CORS_ORIGIN` matches your exact Vercel URL
   - Check for trailing slashes

2. **Database Connection Issues**
   - Verify `DATABASE_URL` is correct
   - Ensure `PGSSL=true` is set

3. **API Key Issues**
   - Verify `OPENAI_API_KEY` is set correctly
   - Check `API_KEY` if using authentication

4. **Build Failures**
   - Check Render logs for npm install errors
   - Verify Node.js version compatibility

### Useful Commands

```bash
# Check backend logs in Render
# Go to your web service → Logs

# Test database connection
npm run setup-db

# Check environment variables
echo $DATABASE_URL
echo $OPENAI_API_KEY
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment mode | Yes |
| `PORT` | Server port | Yes |
| `CORS_ORIGIN` | Frontend URL for CORS | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `PGSSL` | Enable SSL for database | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `OPENAI_EMBEDDING_MODEL` | Embedding model name | Yes |
| `API_KEY` | Backend authentication key | Optional |

## Cost Considerations

- **Free Tier**: Limited to 750 hours/month
- **Starter Plan**: $7/month for unlimited usage
- **Database**: Free tier available, $7/month for starter

## Security Notes

1. **API Keys**: Never commit API keys to Git
2. **CORS**: Restrict CORS to your specific domain
3. **Database**: Use SSL connections
4. **Authentication**: Consider implementing API key authentication

## Next Steps

After successful deployment:
1. Set up monitoring and logging
2. Configure custom domain (optional)
3. Set up automatic backups for database
4. Implement rate limiting
5. Add health checks and monitoring

