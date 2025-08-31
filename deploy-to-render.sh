#!/bin/bash

# Deploy to Render Script
# This script helps you deploy the law-entry-app backend to Render

echo "🚀 Law Entry App - Render Deployment Helper"
echo "=========================================="

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git first."
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "server" ]; then
    echo "❌ Please run this script from the law-entry-app root directory"
    exit 1
fi

echo "✅ Project structure looks good!"

echo ""
echo "📋 Deployment Checklist:"
echo "1. ✅ Ensure your code is pushed to GitHub"
echo "2. 🔑 Get your OpenAI API key ready"
echo "3. 🌐 Have your Vercel frontend URL ready"
echo "4. 💳 Create a Render account (if you haven't already)"

echo ""
read -p "Are you ready to proceed? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "🔧 Manual Deployment Steps:"
echo "=========================="
echo ""
echo "1. Go to https://dashboard.render.com"
echo "2. Click 'New' → 'Web Service'"
echo "3. Connect your GitHub repository"
echo "4. Configure the service:"
echo "   - Name: law-entry-api"
echo "   - Root Directory: server"
echo "   - Environment: Node"
echo "   - Build Command: npm install"
echo "   - Start Command: npm start"
echo ""
echo "5. Set Environment Variables:"
echo "   - NODE_ENV=production"
echo "   - PORT=10000"
echo "   - CORS_ORIGIN=https://your-vercel-domain.vercel.app"
echo "   - PGSSL=true"
echo "   - OPENAI_API_KEY=your_openai_api_key"
echo "   - OPENAI_EMBEDDING_MODEL=text-embedding-3-large"
echo "   - API_KEY=your_secure_api_key"
echo ""
echo "6. Create PostgreSQL Database:"
echo "   - Go to 'Databases' in Render"
echo "   - Create new PostgreSQL database"
echo "   - Name: law-entry-db"
echo "   - Copy the connection string"
echo "   - Add DATABASE_URL environment variable"
echo ""
echo "7. Deploy and test!"
echo ""

echo "🎯 After deployment, update your Vercel frontend:"
echo "1. Go to your Vercel dashboard"
echo "2. Add environment variable:"
echo "   REACT_APP_VECTOR_API_URL=https://your-render-service.onrender.com"
echo "3. Redeploy the frontend"
echo ""

echo "📚 For detailed instructions, see DEPLOYMENT.md"
echo ""

echo "🔗 Useful URLs after deployment:"
echo "- Backend Health Check: https://your-service.onrender.com/health"
echo "- Render Dashboard: https://dashboard.render.com"
echo "- Vercel Dashboard: https://vercel.com/dashboard"
echo ""

echo "✅ Deployment guide complete!"
echo "Good luck with your deployment! 🚀"
