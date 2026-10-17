# FlipAdmit

Universities compete for students. Students upload their application once, universities that match their priorities make scholarship offers across three rounds, and the student accepts one.

## Run it

Needs **Node 20 or newer** (Node 22 or 24 recommended). Nothing else: the database is an embedded PostgreSQL (PGlite) stored in `./data/pglite`, and nothing needs compiling.

```powershell
npm install
cp .env.example .env.local     # then fill it in (see below)
npm run dev                    # http://localhost:3000
```

The database and tables are created on first start. There is no seed or demo data: create real accounts through the app.

## Environment variables (`.env.local`)

| Variable | Needed? | What it does |
|---|---|---|
| `AUTH_SECRET` | Yes | Random string that signs sign-in state. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `APP_URL` | Yes | Used in email links. `http://localhost:3000` locally. |
| `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Yes | Creates the platform admin on first start. The admin runs the rounds. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Recommended | Nodemailer SMTP. If `SMTP_HOST` is empty, every email (including sign-in codes) is printed in the terminal running the app. |
| `NEBIUS_API_KEY` | Recommended | Turns on AI. Without it, every AI feature uses a built-in fallback. |
| `LLM_MODEL_MAIN`, `LLM_MODEL_CHEAP`, `EMBEDDING_MODEL` | Optional | Defaults: `openai/gpt-oss-120b` and `Qwen/Qwen3-Embedding-8B`. Check yours with `GET /v1/models`. |
| `LLM_DAILY_BUDGET_USD` | Optional | AI calls stop for the day after this spend and fall back. Default 5. |
| `DATABASE_URL` | Optional | A PostgreSQL connection string (Neon, Supabase, local Postgres). Leave empty to use the embedded database. |

**Gmail for email:** turn on 2-Step Verification, create an App Password at myaccount.google.com/apppasswords, then set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=you@gmail.com`, `SMTP_PASS=<the 16-character app password>`.

## Walkthrough

1. **University:** Launch, then Create account, choose University, use an `.ac.uk` email and enter the code from the email. Add a course with a description, seats (default 100), tuition and a scholarship fund.
2. **Student** (in a private window): sign up with a non-`.ac.uk` email. Upload CV, statement of purpose and a recommendation letter as PDFs, run the AI review, set priorities, pay with test card `4242 4242 4242 4242` (any future expiry, any 3 digits).
3. **University:** open the course, Students tab. The student is ranked by fit with an AI summary. Open them, view their PDFs, make an offer.
4. **Admin:** sign in with the admin account and advance the round. The landing page shows the calendar window based on the server date: Round 1 (September-December), Round 2 (January-March), or Round 3 (April-July). Universities can raise an offer any number of times during a round, but cannot lower or withdraw it.
5. **Student:** My offers shows every offer ranked by funding. Accept one for the confirmation screen.

Test cards: `4000 0000 0000 0002` is declined, `4000 0000 0000 3220` asks for 3D Secure.

## How it works

- **Accounts:** scrypt password hashing, database sessions in an httpOnly cookie, email verification and a one-time code on every sign-in, password reset by emailed link. Universities must use `.ac.uk`; `.ac.uk` is reserved for universities.
- **Matching:** a course is shown to a student when it's at their level, its subject matches or is related to one of their 3 preferences (e.g. Computer Science includes AI and Data Science) or to an AI-suggested area, and the university meets the student's minimum ranking. Rank = 70% document-to-description similarity (embeddings) + 30% preference match.
- **Offers:** scholarship in 0/25/50/75/100% steps of tuition plus perks. Universities can raise an active offer repeatedly, but cannot lower or withdraw it. Universities can see competing active scholarships and perks without seeing which university placed them. Seats and the scholarship fund are enforced inside database transactions. Accepting declines all other offers.
- **Money:** £100 test-mode fee into escrow; on acceptance £90 goes to the university as a deposit and £10 to the platform; refunds when the cycle closes (full if no offers, £90 if offers but none accepted). Double-entry ledger.
- **AI (Nebius):** document analysis with suggested courses, embeddings for fit ranking, and a per-student summary and ranking explanation for universities. Results are cached and costed in the database.

## Code map

- `src/db/schema.ts`: tables (Drizzle ORM). Migrations in `drizzle/`, generated with `npm run db:generate`.
- `src/lib/auth.ts`, `src/lib/mail.ts`: accounts, sessions, codes, Nodemailer.
- `src/lib/market.ts`: rounds, matching, offers, ledger. `src/lib/payments.ts`: test gateway.
- `src/lib/ai.ts`, `src/lib/llm.ts`: AI features, caching, embeddings, fallbacks.
- `src/app/(app)`: signed-in pages. `src/app/api`: route handlers.
