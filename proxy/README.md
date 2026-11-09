# Proxy (Cloudflare Worker)

Lets people use the Pages site with just the shared password. The Anthropic API key lives here as a Cloudflare secret and never reaches the browser.

```
browser ──(username + password)──▶ Worker ──(secret API key)──▶ api.anthropic.com
```

What it enforces:

- **Password checked server-side** (`APP_USER` + `APP_PASSWORD` secret). This replaces the browser-only gate.
- **Only the Pages site may call it** (`ALLOWED_ORIGINS`).
- **Only Claude Haiku 5.5** (`ALLOWED_MODELS`) and `max_tokens` capped, so cost stays predictable.
- **20 requests a minute per IP** (one chat message = 2 requests).
- **No logging of message content.**

Also set a **spend limit** in the Anthropic Console for the key it uses.

## One-time setup

```bash
cd proxy
npm install
npx wrangler login                          # opens the browser
npx wrangler secret put ANTHROPIC_API_KEY   # paste the key when asked
npx wrangler secret put APP_PASSWORD        # type the shared password
npx wrangler deploy                         # prints https://is4250-proxy.<you>.workers.dev
gh variable set PROXY_URL --body https://is4250-proxy.<you>.workers.dev
gh workflow run deploy.yml                  # rebuild the site in proxy mode
```

Run the `secret put` commands in your own terminal, so the key isn't saved in any chat or log.

## Changing things

- Password: `npx wrangler secret put APP_PASSWORD`, then share the new one. No redeploy of the site needed.
- Rotate the key: create a new key in the Anthropic Console, `npx wrangler secret put ANTHROPIC_API_KEY`, then delete the old key.
- Turn it off: `npx wrangler delete`. The site falls back to "bring your own key" after `gh variable delete PROXY_URL` and a rebuild.
