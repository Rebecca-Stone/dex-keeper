# Bug Backlog

New triage list for Dex Keeper. Priorities are ordered by user impact and risk.

## P0

None currently known. `npm run build` passes.

## P1

### Rapid list edits can overwrite each other

- **Symptom:** Fast actions such as adding multiple Pokemon, reordering, toggling team mode, or editing notes can be calculated from stale `lists` / `activeList` state.
- **Why it matters:** A later optimistic save can drop an earlier change before the server ever sees it.
- **Where to start:** `src/App.jsx`, especially `persist`, `updateActive`, `toggleInList`, `addFamily`, `moveEntry`, and `reorder`.
- **Fix idea:** Move list mutations to functional state updates or a reducer, then persist the exact state produced by that update.

### Failed save rollback can discard newer local changes

- **Symptom:** `persist` captures `previousLists` and rolls back when the latest save fails. If several saves are in flight, rollback behavior may not match the user's most recent visible state.
- **Why it matters:** Network hiccups can make list changes appear to vanish.
- **Where to start:** `src/App.jsx` `persist` and `saveSeq`.
- **Fix idea:** Track pending mutations explicitly, or reload from the server after a failed latest save and show a recovery prompt.

### Session expiration loses unsaved optimistic changes

- **Symptom:** When a save returns `401`, the app clears the session and all lists immediately.
- **Why it matters:** Users may lose recent edits without a chance to export or retry after logging back in.
- **Where to start:** `src/App.jsx` `persist`, `api.js` request handling.
- **Fix idea:** Keep the last local list snapshot in memory, prompt for login, then retry save or offer export.

## P2

### Duplicate trainer-name races can throw server errors

- **Symptom:** Signup checks `findUserByUsername` before inserting. Two simultaneous signups with the same name can race and hit the SQLite unique constraint.
- **Why it matters:** One user gets a generic server failure instead of the expected "name is taken" response.
- **Where to start:** `server/index.js` signup route and `server/db.js` `createUser`.
- **Fix idea:** Catch unique-constraint errors from `createUser` and return `409`.

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

### API base URL normalizes all non-http values to https

- **Symptom:** `VITE_API_URL=localhost:3001` becomes `https://localhost:3001`.
- **Why it matters:** Local deployments that configure the env var without a scheme fail unexpectedly.
- **Where to start:** `src/api.js` `API_BASE`.
- **Fix idea:** Treat localhost / 127.0.0.1 as `http://` when no scheme is supplied, or require and validate an explicit scheme.
