# Smouk web app

Next.js app: sign up, **style passport**, and **LLM chat** that searches a real `products` table (no invented inventory).

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- An [OpenAI](https://platform.openai.com) API key

## Setup

1. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

   Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `OPENAI_API_KEY`.

2. In the Supabase SQL editor, run the script in `supabase/schema.sql` (creates `profiles`, `products`, RLS policies, auth trigger, and seed products).

3. In Supabase **Authentication → Providers**, enable **Email**. For local dev, consider disabling “Confirm email” so you get a session immediately after sign-up.

4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Routes

| Path | Purpose |
|------|---------|
| `/` | Landing |
| `/signup`, `/login` | Auth |
| `/settings/style-passport` | Profile + style passport (signed in) |
| `/chat` | Shop chat with tool-based product search (signed in) |

## Project layout

- `src/app/api/chat` — OpenAI + `search_products` tool calling Supabase
- `src/lib/search-products.ts` — Catalog query layer
- `supabase/schema.sql` — Database DDL + seed data
