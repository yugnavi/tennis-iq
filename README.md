# Tennis IQ v0.1 (MVP)

A portrait-first, no-install browser game that teaches beginner tennis rules and tactics. It has three modes:

- **Academy**: 3 tracks × 10 challenges, with 5-question sessions.
- **Tie-Break Battle**: answer questions to win points; first to 7, win by 2.
- **Daily Puzzle**: one shared challenge per UTC day.

Stack: React 19, Vite, TypeScript (strict), Tailwind v4, React Router and Zod, with Supabase for Postgres, anonymous Auth, RLS and RPC. There is no LLM at runtime and no question generation.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build to dist/
npm run test       # Vitest: engine, content, hooks, UI, service layer
npm run test:sql   # Postgres-level checks of migrations, RLS, RPC and idempotency (needs local Postgres 15–17 binaries, no Docker)
npm run e2e        # Playwright mobile-portrait smoke tests (run `npx playwright install chromium` once)
```

Without Supabase env vars the app runs fully in **Practice mode (unranked)**. It uses the bundled, read-only question set, and progress is kept in this browser only. This is clearly labeled in the UI.

## Supabase setup (ranked mode)

1. Create a Supabase project. Under **Authentication → Sign In / Providers**, enable **Allow anonymous sign-ins**. Consider enabling CAPTCHA, or keep the anonymous sign-in rate limit (local `config.toml` uses 30/hour/IP).
2. Apply the schema and seed, using one of these:
   - **CLI (hosted):** `supabase link --project-ref <ref>` → `supabase db push` → run `supabase/seed.sql` (SQL editor, or `psql "$DB_URL" -f supabase/seed.sql`).
   - **CLI (local, needs Docker):** `supabase start` → `supabase db reset`. This applies migrations and `seed.sql` automatically.
   - **No CLI:** paste `supabase/migrations/20261010000000_tennis_iq_init.sql`, then `supabase/seed.sql`, into the SQL editor.
3. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Use the **anon/publishable key only, never `service_role`**.
4. Verify: the "Practice mode" banner disappears, and XP/TIQ persist across a page refresh (the anonymous session is restored).

### Google sign-in (optional)

Players start as anonymous guests. On the Progress page they can choose **Continue with Google**, which links Google to their existing anonymous user, so `auth.uid()` and all their progress stay the same. If that Google account is already linked to other progress, the page offers to switch to it, and the guest progress on this device is left behind.

1. In Google Cloud Console, create an OAuth client (type: Web application). Add `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI.
2. In Supabase, go to **Authentication → Sign In / Providers → Google**, enable it, and paste the client ID and secret.
3. On the same page, enable **Allow manual linking**. Without it, linking fails with "Manual linking is disabled".
4. Under **Authentication → URL Configuration**, add `<your-site>/progress` to the redirect URLs for each environment, for example `http://localhost:5173/progress` and your Vercel URL.

For local Supabase, set `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` before running `supabase start`. The Google section in `supabase/config.toml` reads them.

If you edit `src/data/challenges.json`, regenerate the seed with `npm run seed:generate`. A test fails while `seed.sql` is out of sync.

### Security model

- RLS is enabled on every table, and users can read only their own rows. Users can write only `profiles.display_name`; every other write goes through `SECURITY DEFINER` RPCs that use `search_path = ''` and derive the user from `auth.uid()`.
- `challenges` exposes only redacted columns (a column-level grant). `correct_option_id` and `explanation` are returned only by `submit_answer`, after an answer.
- `submit_answer(challenge_id, choice_id, mode, battle_id)` validates the option. The server computes correctness, XP, TIQ, battle score and daily credit; the client never sends them. A per-user row lock plus unique indexes make the RPC idempotent. A SQL test fires 24 concurrent duplicate submissions and confirms one award.
- **Reward rules:**
  - +20 XP for the first correct answer to each distinct challenge.
  - +10 XP once per finished battle (win or lose).
  - +10 XP for the first daily completion per UTC day, correct or not.
  - TIQ starts at 500. It moves +15/−5 on the first-ever attempt of a challenge only, and never goes below 0.
- The daily pick uses the database UTC date: challenges are sorted by id (`COLLATE "C"`), and `index = (days since 1970-01-01 × 7) mod N`. The same formula runs client-side (`src/game/daily.ts`) for practice mode.

## Deploy (Vercel)

Import the repo as a Vite project (build: `npm run build`, output: `dist`), then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Project → Environment Variables. `vercel.json` adds the SPA history fallback. Add the deployed URL to the Supabase Auth URL configuration.

## Project layout and ownership

| Path | Contents | Built by |
|---|---|---|
| `src/types/`, `src/app/`, `e2e/`, configs | Shared Zod schemas, types and service/hook contracts; router; session provider; Playwright smoke tests | Agent 1 (lead) |
| `src/components/`, `src/pages/` | Mobile UI kit, SVG court + normalized overlay, all screens | Agent 2 (UX & court) |
| `src/game/`, `src/data/`, `src/hooks/game/` | Tie-break / daily / academy engine, 30 challenges, game hooks | Agent 3 (gameplay & content) |
| `supabase/`, `src/lib/supabase/`, `src/services/` | Migration, RLS, RPCs, seed, Supabase + practice services with failover | Agent 4 (Supabase & security) |

## Assets

The sprite pack is extracted to `public/assets/tennis-iq/` and all 109 manifest entries have been checked against `assets-manifest.json`. Gameplay uses `courts/gameplay/hard.svg`, with player and ball markers placed by normalized 0–100 coordinates over the 360×580 viewBox, and single idle sprite frames used as decorative markers. Arena art appears only as small mode-card thumbnails. The pack is AI-generated prototype art (see its README); clear credit and licensing before any commercial use.

## Content

There are 30 original challenges (10 Rookie rules, 10 Challenger positioning, 10 Strategist tactics) in `src/data/challenges.json`, each with a source reference and an explanation.

**Editorial note:** rules items are paraphrased from the ITF Rules of Tennis. Tactical items (`coachReviewRequired: true`) are paraphrased coaching concepts with stated assumptions, and **must be verified by a qualified coach** before any claim of coaching accuracy.

## Known limitations

- The Supabase backend is verified on local Postgres 17 with a stubbed `auth` schema (`npm run test:sql`). On 10 Oct 2026 a production build was also run against the hosted project. In one ranked journey, a correct answer moved TIQ from 500 to 515 and XP from 0 to 20, both survived a refresh, the daily reward was recorded, and a battle point was server-scored. Google sign-in was not part of that run.
- Anonymous identity is per browser, so clearing site data loses progress. Account upgrade is deferred.
- Answers are server-checked, but a player can learn them by answering. TIQ is a prototype knowledge score, not cheat-proof and not an official rating.
- After a mid-session connection failure, the app stays in practice mode until reload.
- The main JS chunk is about 175 kB gzipped (React, Supabase SDK, Zod). Code-splitting the SDK is a future optimization.
