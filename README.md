# Dex Keeper

A Pokédex-styled team builder and list manager covering all 1,025 Pokémon across nine generations. Built with React + Vite.

## Features

- **Accounts** — sign up / log in with a trainer name; each trainer's lists are stored separately. Note: authentication is a toy (hashed locally, no server) — don't reuse real passwords.
- **Lists** — create unlimited lists, add/remove Pokémon, drag (or ▲▼) to reorder, per-Pokémon nicknames and notes, optional ⚔ 6-slot battle-team mode with legality warnings.
- **Full National Dex** — search plus filters for generation, type, habitat, rarity (legendary/mythical), color, and body shape.
- **Detail panel** — base stats, abilities (hidden flagged), height/weight, capture rate, base happiness, growth rate, egg groups, gender ratio, shiny sprite toggle, and the full evolution family with per-step evolution methods.
- **Evolution tools** — add a whole evolution line in one tap; evolve a list member in place (nickname and notes carry over), with a chooser for branching families.
- **Team Analysis** — average stats and full defensive type coverage for the active list, including unanswered threats.
- **⚔ Battle prep** — compare any two lists: a STAB matchup matrix, recommended leads per opponent, and warnings for uncovered threats.
- **⚑ Boss teams** — 109 preset gym leader, Elite Four, and champion teams from every generation, importable as opponent lists.
- **Export / Import** — back up or share lists as JSON.

## Running locally

```bash
npm install
npm run dev
```

## Data sources

Pokédex data (names, types, stats, abilities, evolution chains and methods, breeding info, habitats) is generated from [PokeAPI](https://github.com/PokeAPI/pokeapi) CSV data and embedded in `src/data.js`. Sprites are loaded at runtime from the [PokeAPI sprites](https://github.com/PokeAPI/sprites) repository. Boss team rosters are hand-compiled and may contain minor inaccuracies; regional forms are shown as base species and duplicate species are merged.

Pokémon and Pokémon character names are trademarks of Nintendo. This is an unofficial fan project, not affiliated with or endorsed by Nintendo, Game Freak, or The Pokémon Company.
