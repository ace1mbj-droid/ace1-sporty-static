# Free deploy (no Hostinger access, no cost)

Your live site `https://ace1.in` is currently sending a **server-side Content-Security-Policy (CSP)** header.
You can't change CSP from frontend code.

Good news: because this is LiteSpeed/Apache-style hosting, you can often change headers **via FTP** by updating the root `.htaccess` (no hPanel required). This repo already includes one.

If FTP header changes are not possible in your environment, the free workaround is: **deploy this repo to a host you control (free tier)** and point your domain to it (if you have DNS access), or use the free `*.vercel.app` / `*.pages.dev` / `*.netlify.app` URL.

---

## Option 0: Keep same FTP (no hPanel)

If you can upload files via FTP, you can usually manage CSP and security headers by editing `.htaccess` in the site root:

- Update the `Header always set Content-Security-Policy ...` line
- Upload the updated `.htaccess`
- Verify with:
   - `curl -sI https://your-domain/ | tr -d '\r' | egrep -i 'content-security-policy|x-frame-options|referrer-policy|permissions-policy'`

If the header does not change after upload, then the host is overriding headers at a higher level and you’ll need Option A/B/C below.

This repo is already compatible with a strict CSP (we removed the YouTube iframes and reduced noisy console errors locally).

---

## Option A (recommended): Vercel (free)

Best if you want CSP/security headers controlled via `vercel.json`.

### Deploy via Vercel UI
1. Create a free Vercel account.
2. Import this Git repo as a new project.
3. Framework preset: **Other** (static).
4. Build command: **None**
5. Output directory: **.** (root)
6. Deploy.

Vercel will serve the site and apply headers from `vercel.json`.

### Connect `ace1.in` (if you have DNS access)
- In Vercel project → Settings → Domains → add `ace1.in`.
- Vercel will show the required DNS records.
- Update DNS at your domain registrar/DNS provider (not Hostinger hosting).

If you *don’t* have DNS access, use the free `https://<project>.vercel.app` URL.

---

## Option B: Cloudflare Pages (free)

Good free hosting + free HTTPS. CSP headers are set via a `_headers` file (optional).

1. Create a free Cloudflare account.
2. Pages → Create a project → connect your Git repo.
3. Build settings:
   - Build command: **None**
   - Build output directory: **/** (root)

### Connect `ace1.in`
If your domain’s DNS is in Cloudflare (or you can move it), you can connect the domain in Pages.

---

## Option C: Netlify (free)

1. Create a free Netlify account.
2. Import this Git repo.
3. Build command: **None**
4. Publish directory: **.**

Netlify supports headers via a `_headers` file (optional).

---

## Why this is necessary (in one line)

CSP is a **response header** controlled by the server/CDN. If you can’t change the server config, you can’t relax CSP for embedded frames like YouTube.

---

## Quick check (after deploy)

Run:

- `curl -sI https://<your-new-domain>/ | tr -d '\r' | egrep -i 'content-security-policy|x-frame-options|referrer-policy|permissions-policy'`

You should see a CSP that matches your deployment target (e.g., Vercel’s `vercel.json`).
