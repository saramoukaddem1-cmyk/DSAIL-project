# Smouk — Claude project guide

## Product snapshot
Smouk is an AI shopping engine that helps users:
- Discover brands they love
- Build a personal style portfolio
- Search for clothing using an LLM plus smart filters (size, budget, delivery date)

Primary outcomes: better discovery (relevance), higher trust (explainable results), and fewer dead-ends (in-stock + deliverable items).

## How to work in this repo
- Prefer small, reviewable changes. Keep related edits in the same commit/PR.
- Don’t introduce new dependencies unless needed; if you do, document why and how to run.
- Keep user-facing copy consistent: “Smouk” (capital S), “style portfolio”, “smart filters”.

## Domain rules (shopping)
- **Size**: treat as a hard constraint when provided; never “approximate” silently.
- **Budget**: default to total item price; be explicit if shipping/tax is unknown.
- **Delivery date**: treat as a hard constraint when provided; prefer items with a clear ETA.
- **Availability**: avoid recommending out-of-stock items unless explicitly asked to include them.
- **Explainability**: when ranking results, provide short reasons (e.g., “fits budget”, “delivery by Friday”, “matches minimal streetwear”).

## LLM + filters approach (high level)
- Use the LLM to interpret intent (style, occasion, brands to avoid, materials, fit).
- Convert intent into structured filters and ranking signals:
  - hard filters: size, max price, must-arrive-by date, excluded materials/brands
  - soft signals: style match, brand affinity, sustainability cues, reviews/quality proxies
- Always show (or log) the final structured query so results are debuggable.

## Style portfolio guidance
- Treat the portfolio as the user’s long-term preferences:
  - favorite brands, disliked brands
  - silhouettes, fits, colors, materials
  - sizes by category (tops/bottoms/shoes) if applicable
- Prefer updating the portfolio via explicit user feedback (“save this”, “more like this”, “avoid this”).

## When making code changes
- Keep business logic testable (pure functions where possible).
- Add/adjust tests for parsing intent → filters and for delivery-date/budget edge cases.
- Avoid leaking secrets. Don’t commit API keys, tokens, or `.env` files.

## Repo conventions
- Place reusable prompt templates or agent utilities under `.claude/skills/` (one skill per file/folder).
- Add a short header to each skill describing:
  - what it does
  - inputs/outputs
  - examples (1–2)

## gstack skills (vendored in this repo)
This repo vendors gstack under `.claude/skills/gstack/`. Use those skills to run structured workflows (planning, review, QA, shipping).

### Platform-agnostic skill behavior
gstack skills must not hardcode project-specific commands, file patterns, or directories. Instead:
1. Read `.claude/CLAUDE.md` for this project’s commands and conventions
2. If missing, ask for the project-specific answer (or discover it in-repo)
3. Persist the answer back into `.claude/CLAUDE.md` so future runs don’t re-ask

### Editing gstack skills safely
- **Generated docs**: many `SKILL.md` files are generated from `SKILL.md.tmpl` templates. Prefer editing the `.tmpl` source and regenerating docs when that workflow is in use.
- **Merge conflicts**: don’t “pick a side” on generated `SKILL.md` conflicts. Resolve the `.tmpl` conflicts, then regenerate the outputs.
- **Small commits**: keep commits bisectable (one logical change per commit).

### Browser interaction (Windows constraints)
Some gstack browser-control tools rely on Mac ARM binaries and won’t work on Windows in this repo.

When a task needs browser-like verification:
- Prefer fetching pages via URL (server-side fetch) when possible.
- Prefer reasoning from the code (routes, components, network calls, selectors).
- If true interaction is required, document the manual steps for a human to run in a real browser instead of attempting Mac-only tooling.

### Available skills
Commonly used:
- `/office-hours`
- `/plan-ceo-review`
- `/plan-eng-review`
- `/plan-design-review`
- `/review`
- `/qa` (browser-based QA; use Windows-safe approaches described above if gstack browsing isn’t available)
- `/ship`

Full list (as documented by gstack):
`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.

### Long-running tasks
For long-running jobs (evals, test runs, builds), keep polling until completion and report incremental progress rather than stopping after the first timeout.

### If you do develop gstack inside this repo
The gstack project’s common commands are:

```bash
bun install
bun test
bun run build
bun run gen:skill-docs
bun run skill:check
```

**Never commit compiled `browse/dist/` or `design/dist/` binaries** if they appear as changes—they can be platform-specific and are not needed for normal use.

### Troubleshooting: skills not showing up
If gstack skills aren’t working/showing up, rerun setup from the vendored copy:

- Windows PowerShell:
  - `powershell -ExecutionPolicy Bypass -File .claude/skills/gstack/setup.ps1`
- Git Bash / WSL (if you use them):
  - `cd .claude/skills/gstack && ./setup --no-prefix`

## Common pitfalls to watch
- Mixing “delivery date” (arrival) vs “ship by” (dispatch). Prefer arrival by default.
- Size normalization across regions/brands (US/UK/EU). Never assume conversion without data.
- Price comparisons across currencies. Don’t convert unless you have a reliable rate source.

