# Cafe Social — Admin / CMS (boilerplate)

Separate Next.js app for future CMS: venues, challenges, word decks, etc. (no coupling to the Expo client).

## Scripts

- `npm run dev` — local dev
- `npm run build` / `npm start` — production
- `npm run lint` — ESLint

## Docker

```bash
docker build -t cafe-social-admin .
docker run -p 3000:3000 cafe-social-admin
```

Uses Next.js `output: "standalone"` (see `next.config.ts`).

## Env

Add when you wire the CMS to the API, e.g. `NEXT_PUBLIC_API_URL`, auth secrets, etc.
