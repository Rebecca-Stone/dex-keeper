import { RAW } from "./data.js";

export const LIST_NAME_MAX = 60;
export const ENTRY_TEXT_MAX = 240;
export const POKEDEX_SIZE = RAW.length;

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function addError(errors, path, message) {
  errors.push({ path, message });
}

function cleanText(value) {
  return typeof value === "string" ? value.trim().slice(0, ENTRY_TEXT_MAX) : "";
}

export function generateListId(existingIds = new Set()) {
  let id;
  do {
    id = Date.now() + Math.floor(Math.random() * 1_000_000);
  } while (existingIds.has(id));
  existingIds.add(id);
  return id;
}

export function formatListValidationError(result) {
  return result.errors?.[0]?.message || "List data is invalid.";
}

export function normalizeLists(value, options = {}) {
  const {
    allowLegacyPokemonNumbers = true,
    regenerateListIds = false,
    existingListIds = new Set(),
    skipInvalidPokemon = false,
    dedupePokemon = true,
  } = options;
  const errors = [];

  if (!Array.isArray(value)) {
    return { ok: false, lists: [], errors: [{ path: "lists", message: "lists must be an array" }] };
  }

  const usedListIds = new Set(existingListIds);
  const lists = [];

  value.forEach((list, listIndex) => {
    const listPath = `lists[${listIndex}]`;
    if (!list || typeof list !== "object" || Array.isArray(list)) {
      addError(errors, listPath, "Each list must be an object.");
      return;
    }

    let id = list.id;
    if (regenerateListIds || !Number.isSafeInteger(id) || id < 1 || usedListIds.has(id)) {
      if (regenerateListIds || !hasOwn(list, "id")) {
        id = generateListId(usedListIds);
      } else {
        addError(errors, `${listPath}.id`, "Each list needs a unique numeric id.");
      }
    } else {
      usedListIds.add(id);
    }

    const name = typeof list.name === "string" ? list.name.trim().slice(0, LIST_NAME_MAX) : "";
    if (!name) {
      addError(errors, `${listPath}.name`, "Each list needs a name.");
    }

    if (!Array.isArray(list.pokemon)) {
      addError(errors, `${listPath}.pokemon`, "Each list needs a pokemon array.");
      return;
    }

    const seenPokemon = new Set();
    const pokemon = [];

    list.pokemon.forEach((entry, entryIndex) => {
      const entryPath = `${listPath}.pokemon[${entryIndex}]`;
      const legacyNumber = typeof entry === "number";
      const idValue = legacyNumber ? entry : entry?.id;

      if (legacyNumber && !allowLegacyPokemonNumbers) {
        addError(errors, entryPath, "Pokemon entries must be objects.");
        return;
      }

      if (!Number.isInteger(idValue) || idValue < 1 || idValue > POKEDEX_SIZE) {
        if (!skipInvalidPokemon) {
          addError(errors, `${entryPath}.id`, `Pokemon id must be between 1 and ${POKEDEX_SIZE}.`);
        }
        return;
      }

      if (seenPokemon.has(idValue)) {
        if (!dedupePokemon) {
          addError(errors, `${entryPath}.id`, "Pokemon ids must be unique within a list.");
        }
        return;
      }

      seenPokemon.add(idValue);
      pokemon.push({
        id: idValue,
        nick: legacyNumber ? "" : cleanText(entry?.nick),
        note: legacyNumber ? "" : cleanText(entry?.note),
      });
    });

    lists.push({ id, name, team: !!list.team, pokemon });
  });

  return { ok: errors.length === 0, lists, errors };
}

export function validateLists(value) {
  return normalizeLists(value, {
    allowLegacyPokemonNumbers: false,
    regenerateListIds: false,
    skipInvalidPokemon: false,
    dedupePokemon: false,
  });
}
