<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Brandog

Brand protection console with a public marketing site and authenticated `/app` workspace.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Add Supabase env vars in `.env.local` for authenticated mode:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Optional for server-managed SerpApi Lens requests:
   - `SERPAPI_API_KEY`
4. Run the app:
   `npm run dev`

## Routes

- Public site: `/`
- Auth page: `/auth`
- Product console: `/app`
