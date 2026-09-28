# Alobaidi Group Painting — Cloudflare-only CMS

This version uses Cloudflare for the entire backend:

- **Cloudflare D1** — all CMS text/data
- **Cloudflare R2** — hero video, About image, gallery media, and marquee logos
- **Built-in server-side admin login** — no external auth service
- **Next.js** — website and admin dashboard

## Data cleanup behavior

The project is designed so old data does not keep stacking up:

- Home and Business Settings use one permanent D1 row each. Saving text updates that row instead of creating revisions.
- Services, reviews, and FAQs update their existing row when edited.
- Replacing the hero video or About image saves the new R2 file first, updates D1, and then deletes the previous R2 file.
- Deleting gallery media or marquee logos also removes the R2 object.
- The bottom of the admin dashboard has **Check Old Data** and **Delete Old Data**. It scans R2 and removes unreferenced files older than one hour while protecting every file currently used by the website.

## Setup

See `CLOUDFLARE_SETUP.md` for the full setup steps.

Quick version:

1. Create a Cloudflare D1 database.
2. Create a Cloudflare API token with D1 Read + D1 Write for that database.
3. Create an R2 bucket and R2 S3 API credentials.
4. Copy `.env.example` to `.env.local` and fill in the values.
5. Run `npm run d1:setup`.
6. Generate the admin password hash with `npm run auth:hash -- "your password"` and put the result in `ADMIN_PASSWORD_HASH`.
7. Run `npm run dev`.
8. Add the same environment variables to your production host before deploying.
# walobaidi
