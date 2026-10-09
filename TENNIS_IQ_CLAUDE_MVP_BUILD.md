# Tennis IQ — Claude Code Weekend MVP Build Brief

> **Instruction to Claude Code:** Implement a complete, runnable, mobile-first browser game in this repository. Act as the coordinating engineer, delegate scoped tasks to no more than **four agents total (including yourself)**, integrate the work, run checks, and report what works. This document is the source of truth for MVP scope. **Do not stop at planning or mockups.**

## 0. Mission and guardrails

Build **Tennis IQ v0.1**, a portrait-first, no-install browser game that teaches beginner tennis rules and tactical decision-making through short lessons, court-based puzzles, and tennis-scored battles. A first-time visitor should be playing in **two taps or fewer**, without a signup form. Show immediate, informative explanations and let users replay.

- **Timebox:** one weekend / approximately 12–16 focused engineering hours. Optimize for a *working vertical slice*, not architecture breadth.
- **Target:** mobile portrait first (test at 320×568, 360×780, 390×844, 430×932 CSS pixels); also usable on desktop.
- **Backend:** **Supabase** (PostgreSQL, anonymous Auth, Row-Level Security, SQL RPC or Edge Functions only when necessary). No separate custom server.
- **Public deployment:** Vercel (or another straightforward static-site host). HTTPS, browser access only; no app store, native wrapper, or mandatory installation.
- **Art:** reuse the attached `tennis-iq-portrait-sprites-v2.zip`. Extract to `public/assets/tennis-iq/`; do not redraw or promise polished production assets. Follow pack manifest and README.
- **Gameplay:** deterministic question answers and tennis scoring; **no LLM at runtime**, no generated questions at runtime.
- **Data:** 30 original, source-traceable, carefully reviewed challenge records (10 each for Rookie, Challenger, Strategist); seed to Supabase, and bundle a local read-only fallback so the game remains playable if content requests fail.
- **No paywall, dark patterns, punitive streak resets, ads, or notification prompts.** Prioritize enjoyable, accurate learning.

## 1. Technical stack

| Area | Choice | Constraints |
|---|---|---|
| App | React + Vite + TypeScript | Strict TS; SPA |
| Styling | Tailwind CSS | Touch-first, accessible controls |
| Routing | React Router | Home, modes, academy, battle, daily, result/profile |
| Court | SVG plus CSS/React animations | Start with `courts/gameplay/hard.svg`; avoid Phaser for MVP unless a working animation demonstrably needs it |
| Sprites | Provided PNGs + sprite strips | 128×128 source frames; image-rendering `pixelated` where appropriate |
| Backend | Supabase JS SDK | Browser uses **anon/publishable key only** |
| Auth | Supabase anonymous sign-in | No signup UX; create per-device identity; optional full account upgrade **deferred** |
| Database | Supabase Postgres | Tables, constraints, indices, RLS |
| Server-authoritative writes | Postgres RPC (`SECURITY DEFINER` only when justified and carefully hardened) | Validate ownership, question identifiers and award rules; never trust client XP/rating |
| Testing | Vitest + React Testing Library | Unit scoring, tie-break, daily puzzle, progress |
| E2E / visual QA | Playwright if available | Mobile portrait smoke path |
| Hosting | Vercel static SPA | SPA history fallback; env var config |

Use current compatible stable package releases already supported by the repo. **No Redux, WebSockets, multiplayer, 3D, camera, or AI services** in v0.1.

## 2. Scope lock: exactly three playable modes

### Mode A — Academy (learn)

- Three tracks: **Rookie** (rules/scoring), **Challenger** (positioning/geometry), **Strategist** (tactics/shot choice).
- 10 challenges per track. Sessions show **5 questions**, selected deterministically without repeats within a session.
- Multiple choice (4 options), immediate correct/incorrect state, one short *why* explanation, Next, end-of-session recap.
- Rookie includes score recognition, deuce/advantage, serve order, tie-break rules. Challenger and Strategist use court diagrams where informative.
- Users may freely select any track; no progression lock.

### Mode B — Tie-Break Battle (flagship)

- One player vs **scripted opponent**, not real AI/multiplayer.
- Correct answer awards player one point; wrong answer awards opponent one point.
- First to **7, win by 2**, including continued play at 6–6; score always displayed clearly. Limit any test scenario loop safely; user can exit.
- Use a randomized but nonrepeating question queue, refill/shuffle if a very long tie-break exhausts the bank; **previously seen questions become unranked** for reward purposes.
- Present player's point, opponent's point, rally/court scenario, choices, answer explanation, and resulting tie-break score.
- Finish with Game, Set, Match screen, points won, correct answers, and earned rewards. Label this a **gamified knowledge battle**, not a simulation of real tennis ability.

### Mode C — Daily Puzzle (habit)

- Exactly **one shared challenge per UTC day** for all users, selected deterministically from the approved pool by a stable date-to-index function. Clearly display the date; UTC behavior must be consistent.
- Players can retry for learning, but only the **first completed attempt** is recorded for the daily achievement/reward. No timezone rollovers or duplicate rewards.
- Show concise result and optional share using native Web Share API when available, else selectable text; do **not** share identifying account data.
- A streak is a *positive indicator*, never a penalty: missing a day simply starts a new count; historical achievements remain.

## 3. UI flow and mobile interaction

```text
Open site
  ├─ Start Playing (anonymous session established invisibly)
  └─ Home dashboard: TIQ rating + XP + daily card + 3 modes
      ├─ Academy → select track → 5 questions → feedback → recap
      ├─ Tie-Break → score + court + scenario → answer → feedback → next point → match result
      ├─ Daily Puzzle → answer → explanation → one-time daily reward → home/share
      └─ Progress → lifetime stats + 3 skill breakdowns
```

**Portrait game screen composition (guideline, not fixed-height trap):**

1. Header/status (roughly 10–15%): mode, Back, rating/battle score.
2. Court panel (roughly 40–50%): tall responsive SVG, sprites and ball markers, optional route/shot curve. Court *never* covers answer controls.
3. Decision area (remaining space, scrolling naturally if needed): scenario text, 4 large answers, feedback and Next.

- Minimum 44px tap targets; readable labels; account for phone safe areas and small screens. No forced horizontal scroll, no hover-only actions.
- Use `aspect-ratio` for court, with sensible max sizes. Reserve space for feedback to avoid large layout jumps; avoid fixed viewport height lock.
- Preserve visual identity from the existing Tennis IQ concept: dark navy top bars, blue court, green CTA, light cards, restrained pixel-art accents.
- Provide loading, offline/content fallback, and recoverable error states. Reduced-motion friendly; animations must not block understanding.
- Court puzzle UI must describe spatial context in text as well (accessible alternative to visual-only reasoning).

## 4. Asset integration and quality checks

The provided ZIP contains extracted prototype assets, **not guaranteed pixel-perfect animation art**. Verify files against `assets-manifest.json`. Relevant paths after extraction:

```text
public/assets/tennis-iq/
  characters/male/...         # individual transparent frames
  characters/female/...
  characters/opponents/...
  characters/npcs/...
  spritesheets/male_idle.png  # 128×128 per frame, 5 frames in 640×128 strip
  spritesheets/male_run.png
  spritesheets/female_idle.png
  courts/gameplay/hard.svg    # designed for 360×580 portrait rendering
  courts/gameplay/clay.svg
  courts/gameplay/grass.svg
  courts/gameplay/indoor.svg
  effects/...
  items/ball.png
  icons/...
  arenas/...
  assets-manifest.json
```

- For **tactical court puzzles**, prefer the accurate scalable SVG court and position player/ball as **normalized percentages** within an overlay; avoid using portrait illustration crops for hit-testing.
- Sprite art may mix side-on character poses with top-down court. Keep characters as **decorative readable markers** initially; do not imply precise rally physics. If assets look wrong, use clean CSS/SVG markers, preserving gameplay.
- Never upscale low-resolution arena art as a full-screen gameplay background; use only for optional mode cards.
- If spritesheets animate inconsistently, show a **single clean idle frame**; no broken or jittering animations in the shipping MVP.
- Do not embed the sprite showcase/contact-sheet itself in the gameplay UI.

## 5. Data contracts / game domain

Use explicit shared TypeScript types and Zod or equivalent data validation at the Supabase boundary.

```ts
type Mode = 'rookie' | 'challenger' | 'strategist';
type QuestionKind = 'rules' | 'court-position' | 'shot-choice';
type CourtPoint = { x: number; y: number }; // normalized 0..100

type Challenge = {
  id: string;
  track: Mode;
  kind: QuestionKind;
  difficulty: 1 | 2 | 3;
  prompt: string;
  options: { id: string; label: string }[]; // always four
  correctOptionId: string; // protected from pre-answer access where practical
  explanation: string;
  sourceName: string;
  sourceUrl: string;
  reviewStatus: 'approved';
  court?: {
    player: CourtPoint;
    opponent: CourtPoint;
    ball?: CourtPoint;
    recommendedPath?: CourtPoint[];
  };
};
```

**Critical answer-integrity rule:** A fully public browser game cannot enforce secret answers if shipped in JSON; this is acceptable for a casual learning MVP, but **do not pretend a client-only TIQ rating is cheat-proof**. Where possible, expose a **public challenge view without `correctOptionId`**, check submitted answers in server-side RPC, and return feedback there. Offline fallback is clearly labeled **practice/unranked**.

For tactics, write sufficiently specific scenarios to support a **preferred answer under stated assumptions**. For genuinely reasonable alternatives, explain contextual trade-offs rather than asserting there is always one objectively best shot. Rules derive from the current official ITF Rules of Tennis; tactical concepts should be independently paraphrased from appropriate coaching sources. Do not copy proprietary diagrams/text or scrape copyrighted material. Include source references for maintainers.

## 6. Supabase schema and security

Implement SQL migrations and seeds in `supabase/migrations/` and `supabase/seed.sql` (or equivalent repeatable migration approach):

| Table | Main columns | Use |
|---|---|---|
| `challenges` | `id`, `track`, `kind`, `difficulty`, `prompt`, `options jsonb`, `correct_option_id`, `explanation`, `court jsonb`, `source_name`, `source_url`, `approved`, `created_at` | Approved question bank |
| `profiles` | `user_id uuid PK`, `display_name`, `xp`, `tiq_rating`, `created_at`, `updated_at` | Anonymous player progress |
| `attempts` | `id`, `user_id`, `challenge_id`, `mode`, `chosen_option_id`, `is_correct`, `attempted_on`, `rewarded`, `created_at` | History and no-repeat awards |
| `battle_sessions` | `id`, `user_id`, `player_points`, `opponent_points`, `status`, `started_at`, `finished_at` | Tie-break resumability / results |
| `daily_completions` | `user_id`, `puzzle_date date`, `challenge_id`, `first_attempt_id`, `created_at`, unique(`user_id`,`puzzle_date`) | One daily credit per day |

**Server authoritative reward rules:**

- First correctly completed *distinct challenge* awards **+20 XP** once, regardless of mode. No double XP from concurrent submissions.
- Completed tie-break awards a one-time **+10 XP bonus** for that battle (winner or loser), only if its finished transition is committed exactly once.
- First completion of the daily puzzle awards **+10 XP** once per UTC day (irrespective of correctness; encourage effort).
- **TIQ rating:** start 500; +15 for correct / −5 for incorrect **on first-ever ranked attempt of a challenge**, floor 0. Future retries are unranked. Clearly label this a **prototype knowledge score**, not an official tennis rating.
- Keep award logic transactional/idempotent using unique indexes and RPC; request carries `challenge_id`, `choice_id`, and context/session ID, *never client-calculated XP or correctness*. Use UTC dates from database rather than a user-supplied local date.
- Answers/options: RPC verifies the submitted option belongs to the challenge; returns correctness, explanation, new XP/rating, and earned awards. Restrict direct writes to protected columns.

**RLS and trust boundaries:**

- Enable RLS on **all** tables. All private rows restricted to `auth.uid() = user_id`. Public read access only to approved *redacted* challenge fields. **Never** expose `correct_option_id` through broadly accessible SELECT endpoints; prefer private base table + a safe public view/RPC with explicit grants.
- Anonymous Supabase Auth is still an `authenticated` session: don't conflate anon API key with anonymous user identity. Handle browser session restoration; if auth fails, allow unranked/local practice and label it accurately.
- Avoid storing unnecessary personal data. No email requirement, no analytics identifiers beyond anonymous user ID for MVP.
- No service-role key in browser/build output. Configure and document `.env.example` using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or SDK publishable key equivalent).
- Don't build administrative content editing or expose unsafe mutation APIs for challenges.

## 7. Question inventory (exactly 30)

| Track | Count | Example coverage |
|---|---:|---|
| Rookie | 10 | 15/30/40, deuce, advantage, double fault, serve box, games, sets, tie-break |
| Challenger | 10 | baseline vs service line, court zones, recovery position, crosscourt geometry, doubles basics |
| Strategist | 10 | opponent deep/wide, drop shot opportunity, safer targets, approaching net, defensive lob, point construction |

- Source and explanation required for every entry; no placeholders or duplicate prompts. Make incorrect options plausible but not trick questions.
- A *coach-review* flag is necessary for future expert validation; seed only the curated approved sample set and include an editorial note that tactical content needs coach verification before claims of coaching accuracy.
- No scraping or unrestricted generative content in the app.

## 8. Agent orchestration — maximum four agents total

**Use 1 coordinator + up to 3 specialist agents.** If Claude Code does not support subagents in the current environment, execute roles sequentially in this order; do not fake delegation. Assign clear file ownership and prevent simultaneous changes to shared files.

| Agent | Responsibility | File ownership | Exit artifact |
|---|---|---|---|
| **Agent 1 — Lead / Integrator (you)** | Interpret this brief, create tasks, architecture, shared contracts, merge work, resolve conflicts, test, deploy guidance, ensure scope | `package.json`, app shell/router, `src/types/**`, `.env.example`, `README.md`, integration tests | Working integrated project + final report |
| **Agent 2 — UX & Court** | Mobile portrait UI, home/mode/results screens, accessible controls, sprites/asset integration, court overlay | `src/components/ui/**`, `src/components/court/**`, `src/pages/**` (coordinate page exports with Agent 1), `public/assets/**` | Responsive screens and usable visual court |
| **Agent 3 — Gameplay & Content** | Academy/tie-break/daily game logic, 30 original questions, validation, reward rules specification, engine unit tests | `src/game/**`, `src/data/**`, `src/hooks/game/**`, `src/__tests__/game/**` | Deterministic playable modes and tested rules |
| **Agent 4 — Supabase & Security** | Auth, migration/seed, server RPC, RLS/grants, API client, persistence/idempotency tests | `supabase/**`, `src/lib/supabase/**`, `src/services/**`, `src/__tests__/backend/**` | Secure backend and functioning progress writes |

**Delegation handshake:**

1. Agent 1 establishes project skeleton, shared types, routes, interface contracts, and env names **before** specialists implement.
2. Agent 2 and Agent 3 work in parallel on disjoint paths. Agent 4 implements migration/API against the agreed contracts in parallel.
3. Specialists report exact changed files, assumptions, failing tests, and integration requirements; they must **not** silently change shared contracts or add scope.
4. Agent 1 integrates, validates mobile flow and end-to-end server scoring, fixes mismatches, runs test/build, documents setup, and completes MVP acceptance checklist.
5. If blocked by Supabase credentials, ship the working unranked practice fallback and fully runnable migrations rather than fabricating a successful remote connection. Clearly identify the missing setup step.

**Agent rule:** Stay at four agents or fewer **including coordinator**, never create nested subagents. Prefer smallest implementation that meets acceptance criteria.

## 9. Weekend execution plan / milestones

### Saturday — playable local vertical slice

- **S1:** Scaffold, types, routes, shell, asset import and responsive court.
- **S2:** Academy 5-question session with explanations, results, local fallback.
- **S3:** Tie-break scoring state machine (first to 7, by 2) and UI.
- **Saturday gate:** complete a match on a mobile-sized browser without errors or Supabase credentials.

### Sunday — persistence, daily, QA, deployment

- **D1:** Supabase schema, anonymous auth, approved seed, RLS, secure attempt RPC, idempotent XP/TIQ.
- **D2:** Daily puzzle, UTC consistency, progress profile, session results.
- **D3:** Mobile layout pass, accessibility, tests, performance, Vercel build/readme.
- **Sunday gate:** end-to-end journey on production build, with Supabase; if credentials unavailable, document exact deployment steps and retain practice fallback.

**Scope cuts if needed:** remove decorative animations first, then detailed progress graphs, then selectable avatar. **Do not cut** interactive court, answers/feedback, three modes, or basic progress persistence with a correctly configured backend.

## 10. Required tests and acceptance criteria

- [ ] `npm install`, `npm run dev`, `npm run build`, `npm run test` succeed.
- [ ] Site is usable at 320px and 390px portrait without sideways page scrolling; game controls remain tappable.
- [ ] Onboarding starts game in at most 2 taps; no manual signup needed.
- [ ] All 3 modes work; exactly 30 reviewed challenges are available (10 per track).
- [ ] Academy presents 5 non-repeated questions and a correct recap.
- [ ] Tie-break ends only with >=7 and >=2 point margin; test 7–0, 7–5, 8–6, 10–8; no false win at 7–6.
- [ ] Correct/incorrect feedback explains the decision, including contextual tactics.
- [ ] The tactical court is portrait, legible, and uses stable normalized coordinates.
- [ ] Daily puzzle is the same on the same UTC date and changes by date; duplicate daily reward impossible.
- [ ] Client cannot directly update XP/TIQ, read others' profile data, or query unpublished answers via public read APIs.
- [ ] Simultaneous repeated attempt submission does not duplicate awards.
- [ ] A refresh restores anonymous authenticated progress; offline/connection failure falls back to labeled unranked practice.
- [ ] No service-role or secret values committed; `.env.example` and migrations included.
- [ ] Final README documents Supabase setup (anonymous sign-ins enabled), seed/migrate commands, Vercel deployment, assets, and known limitations.

## 11. Explicit non-goals (defer)

No multiplayer, public leaderboards, user-generated question editor, real opponent AI, GPT coaching, adaptive ML, payments, PWA install prompt, push notifications, complex tournament brackets, ball physics, video analysis, coach dashboard, more than 30 core questions, OAuth/email signup, native app builds, audio production, or production-ready sprite reillustration.

## 12. Final completion report requested from Claude

When done, provide **only verifiable status**:

1. What was implemented (routes, modes, counts, Supabase persistence, assets).
2. Which agents worked on which files; whether any role had to be done serially.
3. Commands run and their actual pass/fail results.
4. Supabase migrations/RLS/RPC created, environment variables needed, and how to deploy.
5. Remaining gaps, content-accuracy limitations, and the **top three** next steps.

**Begin by inspecting the repository and attached sprite ZIP, then create a short implementation task list. After that, implement — do not ask for permission to proceed unless an external credential or action is genuinely required.**
