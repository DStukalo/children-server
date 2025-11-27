
# TS Auth Server

Run:

```bash
npm install
npm run dev
```

## Environment

The server requires a Postgres connection string exposed as `DATABASE_URL`. When deploying to Render, use the value from the Render Postgres add-on (it is injected automatically for web services). For local development, copy `.env.example` to `.env` and provide your own connection string.

On startup the server will ensure a `users` table exists, so no manual migrations are required for the basic auth flow.
