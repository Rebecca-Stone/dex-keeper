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

function createUuid() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();

  if (!cryptoApi?.getRandomValues) {
    throw new Error("Secure random UUID generation is unavailable.");
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

function isValidListId(id) {
  if (Number.isSafeInteger(id) && id >= 1) return true;
  return typeof id === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function generateListId(existingIds = new Set()) {
  let id;
  do {
    id = createUuid();
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
    if (regenerateListIds || !isValidListId(id) || usedListIds.has(id)) {
      if (regenerateListIds || !hasOwn(list, "id")) {
        id = generateListId(usedListIds);
      } else {
        addError(errors, `${listPath}.id`, "Each list needs a unique id.");
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
