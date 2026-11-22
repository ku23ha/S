# CLAUDE.md

## What this is
The World's Best Registry. One holder per "World's Best ___" title. See docs/PRD.md.

## Commands
- npm run dev: local server
- npm run test: Vitest
- npm run e2e: Playwright
- npm run typecheck: tsc --noEmit
- npm run lint: ESLint

## Rules
- Read docs/ before changing behaviour. docs/PRD.md wins conflicts, then docs/DATA_MODEL.md.
- TypeScript strict. No `any`.
- All database access goes through src/lib/db.ts on the server.
- All payment calls go through src/lib/payments/index.ts.
- Validate every request body and query with a zod schema.
- Never trust client-sent prices. Never claim a title outside the webhook handler.
- The disclaimer line in docs/COPY.md appears on every page, image and email.
- Out-of-scope features in docs/PRD.md stay out.
- Run typecheck and tests before every commit.
