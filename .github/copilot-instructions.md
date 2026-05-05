# Copilot / AI coding agent instructions

Focus: make meaningful, minimal changes to the React + Vite card-game app. Keep behavior-preserving edits unless the user explicitly requests rule changes.

Quick project facts
- Framework: React (18) + Vite. Entry: `index.html` -> `src/main.jsx` -> `src/App.jsx`.
- Package manager: pnpm (see `package.json` `packageManager`). Use `pnpm install` then `pnpm dev` / `pnpm build`.
- Source structure: application logic lives in `src/modules/*.js`. UI/state lives in `src/App.jsx`.

High-level architecture and data flow
- UI (`App.jsx`) holds all game state (deck, hands, table items, scores, currentPlayer).
- Domain logic is split into focused modules under `src/modules/`:
  - `deck.js` — card creation, value helpers (note: Ace treated two ways: build/combo A=1, capture A uses captureValues).
  - `dealing.js` — initial deal and incremental dealing helpers.
  - `captureLogic.js` — computes all valid capture sets (returns arrays of table items). Exposes `CaptureValidator.getValidCaptures` and `areItemSetsEqual`.
  - `buildLogic.js` — complex build validation and partitioning (single builds, multi-builds, increases). Returns structured validation objects `{ isValid, ... }`.
  - `pairLogic.js` — simple pairing validation.
  - `turns.js` — orchestrates actions: `handleCapture`, `handleBuild`, `handlePair`. These functions expect validated inputs and return `{ success, newTableItems, message, ... }`.
  - `scoring.js` — final scoring helper `calculateScores(player1Pile, player2Pile, p1, p2)`.

Important conventions and invariants (must preserve)
- Table items must have an `id` property. Many validators and set comparisons rely on item.id. When creating or transforming table items, ensure unique IDs (see `dealInitialCards` usage and `turns.js` id generators).
- Item `type` field is one of: `'card'`, `'build'`, `'pair'`. Builds/pairs contain a `cards` array.
- Face cards behave differently: `J/Q/K` have no build (sum) value. Ace is treated as 1 for builds/combinations but has a separate `captureValues` mapping for capture rank logic.
- Handlers return structured objects rather than throwing. Follow existing pattern: return `{ success: boolean, newTableItems, message, ... }`.

Typical change patterns you will implement
- Small bug fixes: keep signatures and return shapes the same. E.g., change internal validation while returning the same `{ isValid, message }` shape from `buildLogic.validateBuild`.
- New features: prefer adding to `src/modules/` and then call from `App.jsx` action handlers. Keep UI changes minimal and add tests or a dev-mode flag if behaviour may break gameplay.

Developer workflows / commands
- Install: `pnpm install` (repository indicates pnpm). If pnpm is unavailable, `npm install` works but prefer pnpm for consistency.
- Dev server: `pnpm dev` — opens a Vite dev server, hot reloads React.
- Build: `pnpm build`; Preview: `pnpm preview`.

Files to inspect first when working on game logic
- `src/App.jsx` — single-page UI and global state. Main consumer of module exports; any state changes must line up with its expectations (IDs, `newTableItems` shapes, scores).
- `src/modules/turns.js` — canonical place where actions are validated and table state is transformed. New action variants should go here or delegate to `*Logic.js` modules.
- `src/modules/buildLogic.js` and `src/modules/captureLogic.js` — contain non-trivial algorithms. Preserve their return contracts; copy their testable helper logic into new functions if refactoring.

Testing & validation guidance (manual)
- No unit tests present. Quick validation approach:
  1. Run `pnpm dev`, open the app in the browser.
  2. Use UI to run through a few deals, builds, captures, and verify messages and score outcomes.
- When changing rules, add small unit tests (Jest or Vitest) in a `test/` folder that import the small pure helpers (e.g., `CaptureValidator.getValidCaptures`, `validateBuild`, handlers in `turns.js`).

Notes for AI agents
- Be conservative with gameplay-rule changes. If a rule is ambiguous, propose the change in the PR description and keep old behavior behind a small feature flag.
- Prefer to change or add pure functions in `src/modules/*` and keep `App.jsx` as the UI glue.
- Use existing helper conventions (return objects with `success`/`isValid` and `message`) to avoid UI churn.

Examples (quick references)
- To see capture set generation: `src/modules/captureLogic.js` (search `getValidCaptures`).
- To follow build partitioning logic: `src/modules/buildLogic.js` (search `findBuildPartitions` and `validateBuild`).
- To observe how the UI expects results: `src/App.jsx` (search `playCapture`, `playBuild`, `playPair`).

If something is unclear, ask the repo owner for the intended rule variant (especially around Ace capture value vs build value or pair extension rules). After review, I'll iterate on this file.
