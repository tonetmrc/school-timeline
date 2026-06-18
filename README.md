# School Launch Planner

Interactive Gantt + table view for managing school website launch timelines.

## Features
- Gantt chart with all project phases (DE → review → staging → final validation → sign-off → [translation] → check → go live)
- Auto-scheduling engine respecting team holidays (Jun 1–2), weekends, no go-live on Fridays
- Conflict detection: warns when >3 schools go live on the same day
- Add / edit / delete schools with translation flag
- Persistent storage via Supabase (falls back to localStorage)
- Filter by confirmed / pending

---

## Deploy to Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create school-timeline --public --push
```

### 2. Deploy on Vercel
1. Go to https://vercel.com/new
2. Import your GitHub repo
3. Framework: **Vite** (auto-detected)
4. Add environment variables (see below)
5. Click **Deploy**

---

## Supabase Setup (optional but recommended)

1. Create a free project at https://supabase.com
2. Go to **SQL Editor** and run the contents of `SUPABASE_SETUP.sql`
3. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key

### Environment Variables
Add these in Vercel (Settings → Environment Variables):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Without these, the app runs in **localStorage mode** (data persists per browser, not shared).

---

## Local Development

```bash
npm install
cp .env.example .env.local   # add your Supabase keys
npm run dev
```

Open http://localhost:5173
