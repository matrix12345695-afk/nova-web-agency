# NOVA WEB: primary domain cutover runbook
**Primary public site:** https://novaweb.uz/
**Render (internal webhook and demos):** https://novaweb-agency.onrender.com/
**Do not merge / deploy until custom-domain verification & HTTPS work.**
No paid plan required to prepare these steps.

## Domain connection
1. Render Dashboard → web service `novaweb-agency` → Settings → Custom Domains → Add `novaweb.uz`.
2. Obtain DNS requirements from Render. For ordinary DNS providers supporting A records: apex (@) A → `216.24.57.1`. When supported, prefer ALIAS/ANAME/CNAME flattening to `novaweb-agency.onrender.com`. Configure `www` CNAME → `novaweb-agency.onrender.com`. Follow specific provider instructions; for Cloudflare use CNAME and consult Render docs.
3. Remove conflicting A/AAAA records only for novaweb.uz and its www hostname, not MX/TXT email records. Never delete the zone blindly.
4. Render dashboard → Verify both domains, wait for automatic TLS certificate. Test `https://novaweb.uz/health`, `https://novaweb.uz/api/status`, contact form and homepage.
5. Only once HTTPS and CRM/Telegram readiness checks pass, merge the domain PR. It changes canonical, sitemap, navigation and chatbot site links to novaweb.uz, but keeps Telegram webhook at Render and demo links on Render.
6. Confirm portfolio links go to Render and demo contact buttons return to novaweb.uz. Check Telegram `/start`, `/sources`, `/backup` and submit one clearly marked test lead using non-real contact; delete it later only via an approved manual maintenance procedure.
7. Keep `onrender.com` accessible for demos and webhook. Do not force a global redirect of all Render paths to main domain.
8. On failure, revert the PR deploy to prior commit and keep old Render link while DNS/TLS is repaired. Do not touch DATABASE_URL during domain migration.

## Confirmations required
- Domain ownership and DNS-provider control.
- Correct DNS entries and successful Render domain verification.
- HTTPS works before public navigation is changed.
- No transfer of domain registration, no new hosting charges.
