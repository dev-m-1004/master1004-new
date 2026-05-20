# Admin Ops Proxy Fix

Applied changes:
- Replaced deprecated `middleware.ts` with `proxy.ts`
- Basic Auth decoding now uses `atob()` instead of `Buffer.from(...)`
- `proxy.ts` only protects `/admin/:path*`
- Added `turbopack.root = process.cwd()` to `next.config.ts`
- Removed stray root `master1004-new.zip`

After applying:
1. Check Vercel Production env:
   - ADMIN_BASIC_USER
   - ADMIN_BASIC_PASSWORD
   - ADMIN_BACKFILL_SECRET
   - CRON_SECRET
2. Commit and push.
3. Redeploy.
4. Open `/admin/ops` in a private browser window.
