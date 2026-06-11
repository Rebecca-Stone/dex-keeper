# Bug Backlog

New triage list for Dex Keeper. Priorities are ordered by user impact and risk.

## P0

None currently known. `npm run build` passes.

## P1

### Production data is wiped on every deploy or restart

- **Symptom:** Accounts and lists live in a SQLite file on the API service's local disk. Render's free plan has no persistent disk, so every deploy or restart starts from an empty database.
- **Why it matters:** All trainers and their lists vanish whenever a commit lands on `main` (auto-deploy) or the service restarts.
- **Where to start:** `server/db.js`, Render service `dex-keeper-api`.
- **Fix idea:** Paid Render plan with a persistent disk mounted at `DATABASE_PATH`, or move to a hosted database (Postgres, Turso, etc.).

## P2

### Import silently drops invalid Pokemon

- **Symptom:** Import uses `skipInvalidPokemon: true`; malformed or out-of-range entries are removed without a detailed warning.
- **Why it matters:** A shared backup can import partially, and the user may not notice missing Pokemon.
- **Where to start:** `src/App.jsx` `IOModal.doImport`, `src/listValidation.js`.
- **Fix idea:** Return import warnings with counts and show them before completing the import.

### Battle-team mode can remain over capacity

- **Symptom:** Existing lists can be toggled into 6-slot mode even when they already contain more than six Pokemon.
- **Why it matters:** The app shows a warning, but users can keep an illegal team state that may confuse compare/export workflows.
- **Where to start:** `src/App.jsx` team-mode toggle and `validateLists`.
- **Fix idea:** Confirm trimming, block the toggle until reduced to six, or make team mode a validation rule.

### Drag reorder has no keyboard equivalent beyond one-step movement

- **Symptom:** Keyboard users can move entries one slot at a time, but cannot perform direct reorder/drop behavior.
- **Why it matters:** Long lists are slower and less accessible to reorder.
- **Where to start:** `src/App.jsx` `RosterEntry`, `moveEntry`, and `reorder`.
- **Fix idea:** Add accessible grab/drop controls or a "move to position" action.

## P3

### Sprite failures are cached per component instance only

- **Symptom:** If a sprite URL fails in one card, other instances still retry independently.
- **Why it matters:** Offline or blocked sprite loading can produce lots of repeated failed requests.
- **Where to start:** `src/App.jsx` `Sprite`.
- **Fix idea:** Keep a shared failed-sprite set keyed by Pokemon id.

## Fixed

- **Rapid list edits can overwrite each other** — fixed: `persist` now takes an updater function applied to a `listsRef` that always mirrors the latest state, and capacity/duplicate checks run inside the updaters (`src/App.jsx`).
- **Failed save rollback can discard newer local changes** — fixed: saves are serialized and coalesced (one in flight, latest state wins); on failure the local state is kept and a banner offers RETRY instead of rolling back.
- **Session expiration loses unsaved optimistic changes** — fixed: a `401` during save keeps the lists in memory; logging back in as the same trainer restores and saves them.
- **Duplicate trainer-name races can throw server errors** — fixed: `server/index.js` signup catches `SQLITE_CONSTRAINT*` from `createUser` and returns the friendly `409`.
- **Silent fake-success on non-JSON 2xx responses** — fixed: `src/api.js` now rejects 2xx responses that aren't JSON objects and validates auth payloads before storing a session (this is what made broken production login look successful).
- **API base URL normalizes all non-http values to https** — fixed: scheme-less `localhost` / `127.0.0.1` / `[::1]` values get `http://` (`src/api.js` `withScheme`).
- **Production login broken (no API service)** — fixed: created the `dex-keeper-api` Render service, set `VITE_API_URL` on the static site, and made the static build fail loudly when `VITE_API_URL` is empty (`render.yaml` + dashboard build command).
