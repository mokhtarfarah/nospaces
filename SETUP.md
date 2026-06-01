# Day 1 Setup Checklist

## 1. Install Node.js (if not done)
```bash
# In Terminal.app:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node
```

## 2. Install dependencies
```bash
cd /Users/farahmokhtar/nospaces
npm install
```

## 3. Create a Supabase project
1. Go to https://supabase.com → New project
2. Copy your **Project URL** and **anon public key** from Settings → API
3. Run `supabase/schema.sql` in the SQL editor (Database → SQL Editor → New query)

## 4. Enable Google OAuth in Supabase
1. Supabase → Authentication → Providers → Google → Enable
2. Create a Google OAuth app:
   - Go to https://console.cloud.google.com → APIs & Services → Credentials
   - Create OAuth 2.0 Client ID (Web application)
   - Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
3. Paste the Client ID and Secret back into Supabase

## 5. Add environment variables
```bash
cp .env.example .env.local
# Edit .env.local with your values:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 6. Add allowed email addresses
Edit `src/hooks/useAuth.tsx` and add both Google email addresses to `ALLOWED_EMAILS`:
```ts
const ALLOWED_EMAILS: string[] = [
  'farah@gmail.com',
  'husband@gmail.com',
]
```
Leave the array empty during development to allow any Google login.

## 7. Run locally
```bash
npm run dev
# Open http://localhost:5173
```

## 8. Deploy to Vercel
```bash
npm install -g vercel
vercel
# Follow prompts — it auto-detects Vite
```
Then add environment variables in Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Also add your Vercel domain to Supabase → Authentication → URL Configuration → Redirect URLs.
