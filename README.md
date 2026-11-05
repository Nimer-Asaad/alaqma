# مخزون الجملة (Wholesale Inventory)

A private, mobile-first Arabic (RTL) web app for photographing supplier products on an iPhone and recording their prices fast.

- **Purchase price** (جملة الجملة) = the supplier's bulk price you pay.
- **Wholesale sale price** (جملة) and **retail sale price** (مفرق) = your two selling prices.
- Profit and margin for both are calculated automatically (live in the form, and stored as generated columns in Postgres).
- Currency: ILS (₪).

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Auth + RLS) · Cloudinary · Vercel.

## Features

- Admin login (Supabase Auth, email + password). Only users in the `admins` table can access data.
- Add a product: camera or gallery photo, name, three prices, optional quantity. After saving, the form clears so you can enter the next product immediately.
- Photos are resized on the phone (max 1600px JPEG) before upload, then uploaded **server-side** to Cloudinary. The Cloudinary secret never reaches the browser.
- Catalog with instant Arabic-aware search (ignores diacritics, أ/إ/ا, ة/ه, ى/ي), sorting by newest, name, or profit.
- Edit and delete (deleting also removes the image from Cloudinary).
- CSV export (UTF-8 with BOM so Arabic opens correctly in Excel).
- Installable to the iPhone home screen (Share → Add to Home Screen).

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, paste [`supabase/schema.sql`](supabase/schema.sql), and run it.
3. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up" (this is a private app).
4. **Authentication → Users → Add user → Create new user**: enter your email and a strong password, and tick "Auto Confirm User".
5. Make that user an admin (SQL Editor):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```
6. **Project Settings → API**: copy the Project URL and the `anon` public key.

## 2. Cloudinary setup

1. Create an account at [cloudinary.com](https://cloudinary.com).
2. From **Dashboard → API Keys**, copy the cloud name, API key and API secret.

## 3. Run locally

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run dev
```

Open http://localhost:3000. To test on your iPhone on the same Wi-Fi, run `npm run dev -- -H 0.0.0.0` and open `http://<your-pc-ip>:3000` (the camera button needs HTTPS on some iOS versions; the deployed Vercel URL always works).

Checks:

```bash
npm run typecheck
npm run build
```

## 4. Push to GitHub

```bash
git init
git add .
git commit -m "Initial wholesale inventory app"
git branch -M main
git remote add origin https://github.com/Nimer-Asaad/Alaq-Mobile-accessories.git
git push -u origin main
```

`.env.local` is git-ignored. Never commit real keys.

## 5. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repository. Framework preset: **Next.js** (auto-detected).
2. Under **Environment Variables**, add every variable from `.env.example` with your real values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `CLOUDINARY_FOLDER` (optional, defaults to `alaq-products`)
3. Click **Deploy**. Every push to `main` redeploys automatically.
4. In Supabase, **Authentication → URL Configuration**: set **Site URL** to your Vercel URL.
5. On your iPhone, open the Vercel URL in Safari → Share → **Add to Home Screen**.

## Security model

- **RLS** is enabled on every table. Product rows can only be read or written by signed-in users listed in `public.admins` (checked by the `is_admin()` function). The anon key alone can read nothing.
- Public sign-ups are disabled in Supabase, and the login action rejects non-admin accounts.
- `proxy.ts` refreshes the session and redirects signed-out visitors to `/login`; every server action and the CSV route re-check admin status server-side.
- Image uploads go through a server action: type and size (≤ 4 MB) are validated before uploading with the server-only Cloudinary secret.
- The CSV export escapes cells that could be interpreted as spreadsheet formulas.
- Pages are marked `noindex`.

## Project structure

```
app/
  actions.ts              Server actions: login, logout, create/update/delete product
  page.tsx                Catalog
  login/                  Login page
  products/new/           Add product
  products/[id]/edit/     Edit / delete product
  api/export/route.ts     CSV export
components/               Catalog, product form, header, delete button
lib/
  supabase/               Server & browser Supabase clients, admin check
  cloudinary.ts           Server-only upload/delete
  compress-image.ts       In-browser photo resizing
  format.ts               ILS formatting, profit calculation
  search.ts               Arabic search normalization
proxy.ts                  Session refresh + auth redirect
supabase/schema.sql       Database schema, RLS policies
```
