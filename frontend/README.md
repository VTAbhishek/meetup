# TrustReviews — Customer React App

A Trustpilot-style customer interface (React + Vite + Tailwind) that talks to the
PHP/MySQL backend in this project.

## Project layout
```
Company/
├── frontend/   ← this React app
└── backend/    ← PHP JSON API + config + tools + database.sql
    ├── api/        (login.php, companies.php, reviews.php, …)
    ├── config/     (db.php)
    ├── tools/      (seed.php)
    └── database.sql
```

## Prerequisites
1. **XAMPP**: start **Apache** and **MySQL**.
2. The `company` database must be imported (`backend/database.sql`) and seeded
   (`php backend/tools/seed.php` from the project root).

## Run in development
```bash
cd frontend
npm install        # first time only
npm run dev        # opens http://localhost:5173
```
The app calls the PHP API at `http://localhost/Company/backend/api` (configurable in
`.env` via `VITE_API_BASE`). CORS is already enabled on the API for the dev server.

## Build for production
```bash
npm run build      # outputs to frontend/dist
```
To serve the build from XAMPP, copy `dist/` somewhere under `htdocs` and set
`VITE_API_BASE` to the matching absolute API URL before building.

## Demo accounts
- Customer login: `carolyne` / `password123` (or any seeded demo user)
- Or register a brand-new account in the app.

## Pages
| Route | Description |
|-------|-------------|
| `/` | Home — hero search, categories, top companies, recent reviews |
| `/search?q=` | Search results |
| `/review/:slug` | Company profile — trust score, breakdown, filter/sort, reviews |
| `/write-review` | Write a review (pick company, star rating, text) |
| `/categories` · `/category/:name` | Category hub + ranked companies |
| `/login` · `/register` | Customer auth (blue/white/green theme) |
| `/dashboard` | My reviews (edit / delete) — protected |
| `/settings` | Account settings — protected |
