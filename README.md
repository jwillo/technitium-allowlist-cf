# Technitium Allowlist Worker (Cloudflare)

A Cloudflare Worker that stores your Technitium DNS allowlist in Adblock Plus format in R2 and gives you:

- `GET /api/domains` to list domains
- `POST /api/domains` to add a domain
- `GET /allowlist.txt` to fetch the raw Adblock Plus text file
- `GET /` a simple UI to manage the allowlist

## 1) Prerequisites

- Cloudflare account
- `npm i -g wrangler`

## 2) Add your Cloudflare API token

Create and fill `.env` in the project root:

```dotenv
CLOUDFLARE_API_TOKEN=your_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
```

Then load it in your shell before running Wrangler:

```bash
set -a; source .env; set +a
```

## 3) Create your R2 bucket

```bash
wrangler r2 bucket create technitium-allowlist
```

If you want a different bucket name, update `wrangler.toml`.

## 4) Run locally

```bash
wrangler dev
```

Open the local URL and use the form to add domains.

## 5) Deploy

```bash
wrangler deploy
```

After deployment:

- UI: `https://<your-worker-domain>/`
- API list: `https://<your-worker-domain>/api/domains`
- API add: `POST https://<your-worker-domain>/api/domains`
- Raw file: `https://<your-worker-domain>/allowlist.txt`

## 6) Technitium DNS integration

Set your Technitium allowlist source to the deployed `allowlist.txt` URL.

Example content format:

```text
[Adblock Plus 2.0]
! Technitium DNS allowlist exceptions
! Format: @@||domain^

@@||example.com^
@@||*.trusted.org^
@@||cdn.vendor.net^
```

## API examples

### List domains

```bash
curl https://<your-worker-domain>/api/domains
```

### Add a domain

```bash
curl -X POST https://<your-worker-domain>/api/domains \
  -H "content-type: application/json" \
  -d '{"domain":"example.com"}'
```
