# Supabase Setup Guide for CivilifyKB

## 1. Complete Project Creation

In your Supabase dashboard, complete the project creation with:
- **Project name**: `civilifyKB`
- **Database Password**: Use the generated strong password
- **Region**: Southeast Asia (Singapore)
- **Security**: Data API + Connection String
- **Postgres Type**: Postgres (Default)

## 2. Get Connection Details

After project creation:

1. Go to **Settings** → **Database** in your Supabase dashboard
2. Copy the **Connection string** (URI format)
3. Note your **Database password**

## 3. Environment Configuration

Create a `.env` file in `law-entry-app/server/` with:

```env
# Server
PORT=4000
CORS_ORIGIN=http://localhost:3000

# Supabase Database
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
PGSSL=true

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
```

**Replace:**
- `[YOUR-PASSWORD]` with your actual database password
- `[YOUR-PROJECT-REF]` with your project reference ID
- `sk-...` with your actual OpenAI API key

## 4. Enable pgvector Extension

In your Supabase dashboard:

1. Go to **SQL Editor**
2. Run this command to enable the vector extension:
```sql
create extension if not exists vector;
```

## 5. Initialize Database Schema

Run the database setup script:

```bash
cd law-entry-app/server
npm run setup-db
```

This will create:
- `kb_entries` table with vector embeddings support
- Proper indexes for KNN search
- Tags indexing for filtering

## 6. Test Connection

Start your server to test the connection:

```bash
cd law-entry-app/server
npm start
```

## 7. Frontend Integration (Optional)

If you want to use Supabase client in your frontend:

1. Install Supabase client:
```bash
cd law-entry-app
npm install @supabase/supabase-js
```

2. Add to your frontend environment:
```env
REACT_APP_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
REACT_APP_SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
```

## 8. Security Considerations

- Keep your database password secure
- Use environment variables for all sensitive data
- Consider using Supabase Row Level Security (RLS) for production
- Enable SSL for all database connections

## 9. Troubleshooting

**Connection Issues:**
- Verify your DATABASE_URL format
- Ensure PGSSL=true for Supabase
- Check your project reference ID

**pgvector Issues:**
- Ensure you're on a paid plan (pgvector requires it)
- Contact Supabase support if extension fails to enable

**Schema Issues:**
- Run setup-db script with proper error handling
- Check SQL files in `server/sql/` directory
