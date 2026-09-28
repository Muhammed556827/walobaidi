# Cloudflare-only setup

## 1. Create the D1 database

In Cloudflare, create a D1 database such as `alobaidi-cms`.

Copy its database ID.

Create an API token that has permission to read and write D1 for your account. Keep this token server-side only.

Add these values to `.env.local`:

```env
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_D1_DATABASE_ID=your_d1_database_id
CLOUDFLARE_D1_API_TOKEN=your_server_only_d1_token
```

Then initialize all tables and the two singleton rows:

```bash
npm run d1:setup
```

The schema is in `cloudflare/d1-schema.sql`.

## 2. Create the R2 media bucket

Create an R2 bucket named `alobaidi-media` or another name you prefer.

Create R2 S3 API credentials with read/write access to that bucket.

Set up a public R2 custom domain, for example:

```text
media.alobaidipainting.com
```

Then add:

```env
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret
R2_BUCKET_NAME=alobaidi-media
R2_PUBLIC_BASE_URL=https://media.alobaidipainting.com
```

Apply the CORS policy in `R2_CORS.json` to the bucket. If your production domain is different, update the allowed origins first.

## 3. Configure the admin login

Choose the email that should be allowed into the CMS:

```env
ADMIN_EMAIL=you@example.com
```

Generate a password hash locally:

```bash
npm run auth:hash -- "your strong password"
```

Copy the entire output into:

```env
ADMIN_PASSWORD_HASH=scrypt$...
```

Create a long random session secret. For example, you can use a password manager to generate a long random string:

```env
ADMIN_SESSION_SECRET=put_a_long_random_secret_here
```

## 4. Final `.env.local`

Your complete local file should contain only these backend values:

```env
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_D1_DATABASE_ID=
CLOUDFLARE_D1_API_TOKEN=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=alobaidi-media
R2_PUBLIC_BASE_URL=

ADMIN_EMAIL=
ADMIN_PASSWORD_HASH=
ADMIN_SESSION_SECRET=
```

Never expose the D1 token, R2 secret, password hash, or session secret as public environment variables.

## 5. Run locally

```bash
npm install
npm run d1:setup
npm run dev
```

Then open:

```text
http://localhost:3000/admin/login
```

## 6. Deploy

Add the same environment variables to your hosting project, then deploy normally.

The website can remain hosted where it is now. D1 and R2 are accessed only through server-side routes, so the Cloudflare secrets are never sent to visitors.

## How old-data cleanup works

### Text/data

Home and Business Settings each have the fixed ID `main`. Saving uses SQLite `ON CONFLICT ... DO UPDATE`, so a new revision row is not created. The previous text is replaced in the same row.

Services, reviews, and FAQs also update the existing record when you edit them. Deleting an item removes the row entirely.

### Media

New media uploads receive an R2 object key. When a hero video or About image is replaced, the database is updated only after the new upload succeeds. After that, the old object is deleted.

If a save fails after an upload, the newly uploaded object is deleted as a rollback.

The admin dashboard also contains a manual cleanup scanner. It compares every website media reference in D1 with the objects currently in R2. Unreferenced media older than one hour can then be deleted with **Delete Old Data**.
