import Dexie, { type Table } from "dexie";

export const PRIMARY_TRAINER_ID = "primary";

export type TrainerProfile = {
  id: string;
  name: string;
  role: string;
  region: string;
  favoriteType: string;
  currentCity: string;
  quote: string;
  createdAt: string;
  updatedAt: string;
};

export type PokemonVariety = {
  apiName: string;
  displayName: string;
  isDefault: boolean;
};

export type PokemonSpeciesIndexEntry = {
  apiName: string;
  speciesId: number;
  displayName: string;
  url: string;
  fetchedAt: string;
};

export type PokemonSpeciesDetails = {
  apiName: string;
  speciesId: number;
  displayName: string;
  genderRate: number;
  genus: string;
  flavorText: string;
  generation: string;
  evolutionChainUrl: string;
  varieties: PokemonVariety[];
  fetchedAt: string;
};

export type PokemonAbilityOption = {
  apiName: string;
  displayName: string;
  isHidden: boolean;
};

export type PokemonMoveOption = {
  apiName: string;
  displayName: string;
  type?: string;
  isCustom?: boolean;
};

export type PokemonHeldItem = {
  apiName: string;
  displayName: string;
  sprite?: string;
  isCustom?: boolean;
};

export type PokemonItemIndexEntry = PokemonHeldItem & {
  url: string;
  fetchedAt: string;
};

export type PokemonItemDetails = PokemonHeldItem & {
  fetchedAt: string;
};

export type PokemonMoveDetails = PokemonMoveOption & {
  type: string;
  fetchedAt: string;
};

export type PokemonCatalogEntry = {
  apiName: string;
  pokemonId: number;
  speciesId: number;
  speciesApiName: string;
  displayName: string;
  formLabel: string;
  types: string[];
  abilities: PokemonAbilityOption[];
  moves: PokemonMoveOption[];
  artwork: string;
  shinyArtwork: string;
  sprite: string;
  fetchedAt: string;
};

export type PokemonEvolutionChainCache = {
  chainUrl: string;
  data: unknown;
  fetchedAt: string;
};

export type OwnedPokemonStatus = "party" | "reserve";
export type PokemonGender =
  | "male"
  | "female"
  | "genderless"
  | "unknown";

export type PokemonPlaceKind =
  | "home"
  | "laboratory"
  | "ranch"
  | "daycare"
  | "gym"
  | "pokemon-center"
  | "camp"
  | "habitat"
  | "pc"
  | "other";

export type PokemonPlace = {
  id: string;
  name: string;
  kind: PokemonPlaceKind;
  region: string;
  locality: string;
  caretaker: string;
  description: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type OwnedPokemon = {
  id: string;

  // Canonical data snapshot from PokéAPI.
  pokemonApiName: string;
  pokemonId: number;
  speciesId: number;
  speciesApiName: string;
  displayName: string;
  formLabel: string;
  types: string[];
  artwork: string;
  shinyArtwork: string;
  sprite: string;
  genus: string;
  flavorText: string;

  // The individual companion.
  nickname: string;
  gender: PokemonGender;
  isShiny: boolean;
  nature: string;
  level?: number;
  ability?: PokemonAbilityOption;
  heldItem?: PokemonHeldItem;
  moves?: PokemonMoveOption[];
  metDate: string;
  metLocation: string;
  meetingStory: string;
  personalityNotes: string;

  status: OwnedPokemonStatus;
  partySlot?: number;

  // A party Pokémon is physically with the trainer. Reserve Pokémon may live
  // in a meaningful custom place. lastLocationId remembers their home while
  // they temporarily travel in the party.
  locationId?: string;
  lastLocationId?: string;

  createdAt: string;
  updatedAt: string;
};

export type PokemonEvolutionSnapshot = {
  pokemonApiName: string;
  pokemonId: number;
  speciesId: number;
  speciesApiName: string;
  displayName: string;
  formLabel: string;
  types: string[];
  artwork: string;
  shinyArtwork: string;
  sprite: string;
  genus: string;
  flavorText: string;
};

export type EvolutionMemory = {
  id: string;
  pokemonId: string;
  pokemonNickname: string;
  isShiny: boolean;
  fromSpeciesId: number;
  toSpeciesId: number;
  from: PokemonEvolutionSnapshot;
  to: PokemonEvolutionSnapshot;
  fromAbility?: PokemonAbilityOption;
  toAbility?: PokemonAbilityOption;
  evolutionDate: string;
  evolutionLocation: string;
  evolutionMethod: string;
  evolutionNotes: string;
  createdAt: string;
  updatedAt: string;
};

export type ReleaseMemory = {
  id: string;
  originalPokemonId: string;

  // Snapshot kept after the active Pokémon is removed.
  pokemonApiName: string;
  pokemonId: number;
  speciesId: number;
  speciesApiName: string;
  displayName: string;
  formLabel: string;
  types: string[];
  artwork: string;
  shinyArtwork: string;
  sprite: string;
  genus: string;
  flavorText: string;
  nickname: string;
  gender: PokemonGender;
  isShiny: boolean;
  nature: string;
  level?: number;
  ability?: PokemonAbilityOption;
  heldItem?: PokemonHeldItem;
  moves?: PokemonMoveOption[];
  metDate: string;
  metLocation: string;
  meetingStory: string;
  personalityNotes: string;
  previousStatus: OwnedPokemonStatus;
  previousPartySlot?: number;
  partnerSince: string;

  // Release memory.
  releaseDate: string;
  releaseLocation: string;
  releaseReason: string;
  farewellNote: string;
  createdAt: string;
};

const createdAt = new Date().toISOString();

export const DEFAULT_TRAINER: TrainerProfile = {
  id: PRIMARY_TRAINER_ID,
  name: "João Vitor",
  role: "Pokémon Trainer & Explorer",
  region: "Johto",
  favoriteType: "Grass",
  currentCity: "Ecruteak City",
  quote:
    "I want every partner to have a story worth remembering—not just a place in a box.",
  createdAt,
  updatedAt: createdAt,
};

class TrainerJourneyDatabase extends Dexie {
  trainerProfiles!: Table<TrainerProfile, string>;
  pokemonSpeciesIndex!: Table<PokemonSpeciesIndexEntry, string>;
  pokemonSpeciesDetails!: Table<PokemonSpeciesDetails, string>;
  pokemonCatalog!: Table<PokemonCatalogEntry, string>;
  pokemonItemIndex!: Table<PokemonItemIndexEntry, string>;
  pokemonItemDetails!: Table<PokemonItemDetails, string>;
  pokemonMoveDetails!: Table<PokemonMoveDetails, string>;
  pokemonEvolutionChains!: Table<PokemonEvolutionChainCache, string>;
  ownedPokemon!: Table<OwnedPokemon, string>;
  releaseMemories!: Table<ReleaseMemory, string>;
  evolutionMemories!: Table<EvolutionMemory, string>;
  pokemonPlaces!: Table<PokemonPlace, string>;

  constructor() {
    super("trainerJourney");

    // Keep historical schemas so existing local data migrates safely.
    this.version(1).stores({
      trainerProfiles: "id, name, region, updatedAt",
    });

    this.version(2).stores({
      trainerProfiles: "id, name, region, updatedAt",
      pokemonSpeciesIndex:
        "apiName, speciesId, displayName, fetchedAt",
      pokemonSpeciesDetails:
        "apiName, speciesId, displayName, fetchedAt",
      pokemonCatalog:
        "apiName, pokemonId, speciesId, displayName, fetchedAt, *types",
      ownedPokemon:
        "id, pokemonApiName, speciesId, nickname, status, partySlot, createdAt, updatedAt, *types",
    });

    this.version(3).stores({
      trainerProfiles: "id, name, region, updatedAt",
      pokemonSpeciesIndex:
        "apiName, speciesId, displayName, fetchedAt",
      pokemonSpeciesDetails:
        "apiName, speciesId, displayName, fetchedAt",
      pokemonCatalog:
        "apiName, pokemonId, speciesId, displayName, fetchedAt, *types",
      ownedPokemon:
        "id, pokemonApiName, speciesId, nickname, status, partySlot, createdAt, updatedAt, *types",
      releaseMemories:
        "id, originalPokemonId, releaseDate, createdAt, nickname, displayName, speciesId, *types",
    });

    this.version(4).stores({
      trainerProfiles: "id, name, region, updatedAt",
      pokemonSpeciesIndex:
        "apiName, speciesId, displayName, fetchedAt",
      pokemonSpeciesDetails:
        "apiName, speciesId, displayName, fetchedAt",
      pokemonCatalog:
        "apiName, pokemonId, speciesId, displayName, fetchedAt, *types",
      pokemonEvolutionChains: "chainUrl, fetchedAt",
      ownedPokemon:
        "id, pokemonApiName, speciesId, nickname, status, partySlot, createdAt, updatedAt, *types",
      releaseMemories:
        "id, originalPokemonId, releaseDate, createdAt, nickname, displayName, speciesId, *types",
      evolutionMemories:
        "id, pokemonId, evolutionDate, createdAt, updatedAt, fromSpeciesId, toSpeciesId",
    });

    this.version(5).stores({
      trainerProfiles: "id, name, region, updatedAt",
      pokemonSpeciesIndex:
        "apiName, speciesId, displayName, fetchedAt",
      pokemonSpeciesDetails:
        "apiName, speciesId, displayName, fetchedAt",
      pokemonCatalog:
        "apiName, pokemonId, speciesId, displayName, fetchedAt, *types",
      pokemonEvolutionChains: "chainUrl, fetchedAt",
      ownedPokemon:
        "id, pokemonApiName, speciesId, nickname, status, partySlot, locationId, lastLocationId, createdAt, updatedAt, *types",
      releaseMemories:
        "id, originalPokemonId, releaseDate, createdAt, nickname, displayName, speciesId, *types",
      evolutionMemories:
        "id, pokemonId, evolutionDate, createdAt, updatedAt, fromSpeciesId, toSpeciesId",
      pokemonPlaces: "id, name, kind, region, updatedAt",
    });

    this.version(6).stores({
      trainerProfiles: "id, name, region, updatedAt",
      pokemonSpeciesIndex:
        "apiName, speciesId, displayName, fetchedAt",
      pokemonSpeciesDetails:
        "apiName, speciesId, displayName, fetchedAt",
      pokemonCatalog:
        "apiName, pokemonId, speciesId, displayName, fetchedAt, *types",
      pokemonItemIndex: "apiName, displayName, fetchedAt",
      pokemonEvolutionChains: "chainUrl, fetchedAt",
      ownedPokemon:
        "id, pokemonApiName, speciesId, nickname, status, partySlot, locationId, lastLocationId, createdAt, updatedAt, *types",
      releaseMemories:
        "id, originalPokemonId, releaseDate, createdAt, nickname, displayName, speciesId, *types",
      evolutionMemories:
        "id, pokemonId, evolutionDate, createdAt, updatedAt, fromSpeciesId, toSpeciesId",
      pokemonPlaces: "id, name, kind, region, updatedAt",
    });


    this.version(7).stores({
      trainerProfiles: "id, name, region, updatedAt",
      pokemonSpeciesIndex:
        "apiName, speciesId, displayName, fetchedAt",
      pokemonSpeciesDetails:
        "apiName, speciesId, displayName, fetchedAt",
      pokemonCatalog:
        "apiName, pokemonId, speciesId, displayName, fetchedAt, *types",
      pokemonItemIndex: "apiName, displayName, fetchedAt",
      pokemonItemDetails: "apiName, displayName, fetchedAt",
      pokemonMoveDetails: "apiName, displayName, type, fetchedAt",
      pokemonEvolutionChains: "chainUrl, fetchedAt",
      ownedPokemon:
        "id, pokemonApiName, speciesId, nickname, status, partySlot, locationId, lastLocationId, createdAt, updatedAt, *types",
      releaseMemories:
        "id, originalPokemonId, releaseDate, createdAt, nickname, displayName, speciesId, *types",
      evolutionMemories:
        "id, pokemonId, evolutionDate, createdAt, updatedAt, fromSpeciesId, toSpeciesId",
      pokemonPlaces: "id, name, kind, region, updatedAt",
    });
  }
}

export const db = new TrainerJourneyDatabase();

export async function ensureTrainerProfile() {
  const existingProfile = await db.trainerProfiles.get(PRIMARY_TRAINER_ID);

  if (!existingProfile) {
    await db.trainerProfiles.put(DEFAULT_TRAINER);
  }
}

type EditableTrainerProfile = Pick<
  TrainerProfile,
  "name" | "role" | "region" | "favoriteType" | "currentCity" | "quote"
>;

export async function saveTrainerProfile(
  changes: EditableTrainerProfile,
) {
  const existingProfile = await db.trainerProfiles.get(PRIMARY_TRAINER_ID);
  const now = new Date().toISOString();

  const profile: TrainerProfile = {
    ...changes,
    id: PRIMARY_TRAINER_ID,
    createdAt: existingProfile?.createdAt ?? now,
    updatedAt: now,
  };

  await db.trainerProfiles.put(profile);
  return profile;
}

export type NewOwnedPokemonInput = Omit<
  OwnedPokemon,
  | "id"
  | "status"
  | "partySlot"
  | "locationId"
  | "lastLocationId"
  | "createdAt"
  | "updatedAt"
> & {
  addToParty: boolean;
  locationId?: string | null;
};

export type EditableOwnedPokemonInput = Pick<
  OwnedPokemon,
  | "nickname"
  | "gender"
  | "isShiny"
  | "nature"
  | "level"
  | "ability"
  | "heldItem"
  | "moves"
  | "metDate"
  | "metLocation"
  | "meetingStory"
  | "personalityNotes"
  | "status"
> & {
  locationId?: string | null;
};

export type SavePokemonPlaceInput = Pick<
  PokemonPlace,
  | "name"
  | "kind"
  | "region"
  | "locality"
  | "caretaker"
  | "description"
  | "notes"
>;

export type ReleasePokemonInput = {
  releaseDate: string;
  releaseLocation: string;
  releaseReason: string;
  farewellNote: string;
};

export type EvolvePokemonInput = {
  targetSpecies: PokemonSpeciesDetails;
  targetForm: PokemonCatalogEntry;
  evolutionDate: string;
  evolutionLocation: string;
  evolutionMethod: string;
  evolutionNotes: string;
};

export type EditableEvolutionMemoryInput = Pick<
  EvolutionMemory,
  | "evolutionDate"
  | "evolutionLocation"
  | "evolutionMethod"
  | "evolutionNotes"
>;

export class PartyFullError extends Error {
  constructor() {
    super("Your travelling party already has six Pokémon.");
    this.name = "PartyFullError";
  }
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function findOpenPartySlot(party: OwnedPokemon[]) {
  const usedSlots = new Set(
    party
      .map((pokemon) => pokemon.partySlot)
      .filter((slot): slot is number => typeof slot === "number"),
  );

  for (let slot = 1; slot <= 6; slot += 1) {
    if (!usedSlots.has(slot)) {
      return slot;
    }
  }

  throw new PartyFullError();
}

function snapshotPokemon(pokemon: OwnedPokemon): PokemonEvolutionSnapshot {
  return {
    pokemonApiName: pokemon.pokemonApiName,
    pokemonId: pokemon.pokemonId,
    speciesId: pokemon.speciesId,
    speciesApiName: pokemon.speciesApiName,
    displayName: pokemon.displayName,
    formLabel: pokemon.formLabel,
    types: [...pokemon.types],
    artwork: pokemon.artwork,
    shinyArtwork: pokemon.shinyArtwork,
    sprite: pokemon.sprite,
    genus: pokemon.genus,
    flavorText: pokemon.flavorText,
  };
}

function snapshotTarget(
  species: PokemonSpeciesDetails,
  form: PokemonCatalogEntry,
): PokemonEvolutionSnapshot {
  return {
    pokemonApiName: form.apiName,
    pokemonId: form.pokemonId,
    speciesId: species.speciesId,
    speciesApiName: species.apiName,
    displayName: form.displayName,
    formLabel: form.formLabel,
    types: [...form.types],
    artwork: form.artwork,
    shinyArtwork: form.shinyArtwork,
    sprite: form.sprite,
    genus: species.genus,
    flavorText: species.flavorText,
  };
}

function applySnapshot(
  pokemon: OwnedPokemon,
  snapshot: PokemonEvolutionSnapshot,
): OwnedPokemon {
  return {
    ...pokemon,
    ...snapshot,
    types: [...snapshot.types],
    updatedAt: new Date().toISOString(),
  };
}

async function resolveExistingPlaceId(
  locationId: string | null | undefined,
) {
  const normalized = locationId?.trim();

  if (!normalized) {
    return undefined;
  }

  const place = await db.pokemonPlaces.get(normalized);

  if (!place) {
    throw new Error("That place no longer exists.");
  }

  return place.id;
}

export async function savePokemonPlace(
  input: SavePokemonPlaceInput,
  id?: string,
) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Give this place a name.");
  }

  const now = new Date().toISOString();
  const existing = id ? await db.pokemonPlaces.get(id) : undefined;
  const place: PokemonPlace = {
    id: existing?.id ?? createId(),
    name,
    kind: input.kind,
    region: input.region.trim(),
    locality: input.locality.trim(),
    caretaker: input.caretaker.trim(),
    description: input.description.trim(),
    notes: input.notes.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await db.pokemonPlaces.put(place);
  return place;
}

export async function deletePokemonPlace(id: string) {
  return db.transaction(
    "rw",
    [db.pokemonPlaces, db.ownedPokemon],
    async () => {
      const place = await db.pokemonPlaces.get(id);

      if (!place) {
        return { place: undefined, affectedPokemon: 0 };
      }

      let affectedPokemon = 0;
      const pokemon = await db.ownedPokemon.toArray();

      for (const companion of pokemon) {
        if (
          companion.locationId !== id &&
          companion.lastLocationId !== id
        ) {
          continue;
        }

        affectedPokemon += 1;
        await db.ownedPokemon.put({
          ...companion,
          locationId:
            companion.locationId === id
              ? undefined
              : companion.locationId,
          lastLocationId:
            companion.lastLocationId === id
              ? undefined
              : companion.lastLocationId,
          updatedAt: new Date().toISOString(),
        });
      }

      await db.pokemonPlaces.delete(id);
      return { place, affectedPokemon };
    },
  );
}

export async function addOwnedPokemon(
  input: NewOwnedPokemonInput,
) {
  return db.transaction(
    "rw",
    [db.ownedPokemon, db.pokemonPlaces],
    async () => {
      const { addToParty, locationId: requestedLocationId, ...details } = input;
      const party = await db.ownedPokemon
        .where("status")
        .equals("party")
        .toArray();

      if (addToParty && party.length >= 6) {
        throw new PartyFullError();
      }

      const locationId = addToParty
        ? undefined
        : await resolveExistingPlaceId(requestedLocationId);
      const now = new Date().toISOString();
      const pokemon: OwnedPokemon = {
        ...details,
        id: createId(),
        status: addToParty ? "party" : "reserve",
        partySlot: addToParty ? findOpenPartySlot(party) : undefined,
        locationId,
        lastLocationId: locationId,
        createdAt: now,
        updatedAt: now,
      };

      await db.ownedPokemon.add(pokemon);
      return pokemon;
    },
  );
}

export async function updateOwnedPokemon(
  id: string,
  changes: EditableOwnedPokemonInput,
) {
  return db.transaction(
    "rw",
    [db.ownedPokemon, db.pokemonPlaces],
    async () => {
      const pokemon = await db.ownedPokemon.get(id);

      if (!pokemon) {
        throw new Error("This Pokémon no longer exists in your journey.");
      }

      let partySlot = pokemon.partySlot;
      let locationId = pokemon.locationId;
      let lastLocationId = pokemon.lastLocationId;
      const requestedLocationId =
        changes.locationId === null
          ? undefined
          : changes.locationId !== undefined
            ? await resolveExistingPlaceId(changes.locationId)
            : undefined;

      if (changes.status === "party") {
        if (pokemon.status !== "party") {
          const party = await db.ownedPokemon
            .where("status")
            .equals("party")
            .toArray();

          if (party.length >= 6) {
            throw new PartyFullError();
          }

          partySlot = findOpenPartySlot(party);
          lastLocationId =
            requestedLocationId ??
            pokemon.locationId ??
            pokemon.lastLocationId;
        }

        locationId = undefined;
      } else {
        partySlot = undefined;

        if (changes.locationId !== undefined) {
          locationId = requestedLocationId;
          lastLocationId = requestedLocationId;
        } else if (pokemon.status === "party") {
          locationId = pokemon.lastLocationId;
          lastLocationId = locationId;
        } else {
          lastLocationId = locationId ?? pokemon.lastLocationId;
        }
      }

      const updated: OwnedPokemon = {
        ...pokemon,
        ...changes,
        locationId,
        lastLocationId,
        partySlot,
        updatedAt: new Date().toISOString(),
      };

      await db.ownedPokemon.put(updated);
      return updated;
    },
  );
}

export async function movePokemonToParty(id: string) {
  return db.transaction("rw", db.ownedPokemon, async () => {
    const pokemon = await db.ownedPokemon.get(id);

    if (!pokemon || pokemon.status === "party") {
      return pokemon;
    }

    const party = await db.ownedPokemon
      .where("status")
      .equals("party")
      .toArray();

    if (party.length >= 6) {
      throw new PartyFullError();
    }

    const updated: OwnedPokemon = {
      ...pokemon,
      status: "party",
      partySlot: findOpenPartySlot(party),
      locationId: undefined,
      lastLocationId: pokemon.locationId ?? pokemon.lastLocationId,
      updatedAt: new Date().toISOString(),
    };

    await db.ownedPokemon.put(updated);
    return updated;
  });
}

export async function movePokemonToReserve(id: string) {
  return db.transaction(
    "rw",
    [db.ownedPokemon, db.pokemonPlaces],
    async () => {
      const pokemon = await db.ownedPokemon.get(id);

      if (!pokemon || pokemon.status === "reserve") {
        return pokemon;
      }

      const restoredLocationId = pokemon.lastLocationId
        ? await db.pokemonPlaces.get(pokemon.lastLocationId)
        : undefined;
      const locationId = restoredLocationId?.id;
      const updated: OwnedPokemon = {
        ...pokemon,
        status: "reserve",
        partySlot: undefined,
        locationId,
        lastLocationId: locationId ?? pokemon.lastLocationId,
        updatedAt: new Date().toISOString(),
      };

      await db.ownedPokemon.put(updated);
      return updated;
    },
  );
}

export async function movePokemonToLocation(
  id: string,
  locationId: string | null,
) {
  return db.transaction(
    "rw",
    [db.ownedPokemon, db.pokemonPlaces],
    async () => {
      const pokemon = await db.ownedPokemon.get(id);

      if (!pokemon) {
        throw new Error("This Pokémon no longer exists in your journey.");
      }

      const resolvedLocationId = await resolveExistingPlaceId(locationId);
      const updated: OwnedPokemon = {
        ...pokemon,
        status: "reserve",
        partySlot: undefined,
        locationId: resolvedLocationId,
        lastLocationId: resolvedLocationId,
        updatedAt: new Date().toISOString(),
      };

      await db.ownedPokemon.put(updated);
      return updated;
    },
  );
}

export async function evolveOwnedPokemon(
  id: string,
  input: EvolvePokemonInput,
) {
  return db.transaction(
    "rw",
    [db.ownedPokemon, db.evolutionMemories],
    async () => {
      const pokemon = await db.ownedPokemon.get(id);

      if (!pokemon) {
        throw new Error("This Pokémon no longer exists in your journey.");
      }

      if (pokemon.pokemonApiName === input.targetForm.apiName) {
        throw new Error("Choose a different evolutionary stage or form.");
      }

      const now = new Date().toISOString();
      const from = snapshotPokemon(pokemon);
      const to = snapshotTarget(input.targetSpecies, input.targetForm);
      const evolvedSnapshot = applySnapshot(pokemon, to);
      const currentAbilityStillAvailable =
        pokemon.ability &&
        input.targetForm.abilities.some(
          (ability) => ability.apiName === pokemon.ability?.apiName,
        );
      const replacementAbility =
        input.targetForm.abilities.find((ability) => !ability.isHidden) ??
        input.targetForm.abilities[0];
      const nextAbility = currentAbilityStillAvailable
        ? pokemon.ability
        : replacementAbility;
      const updated: OwnedPokemon = {
        ...evolvedSnapshot,
        ability: nextAbility,
      };
      const memory: EvolutionMemory = {
        id: createId(),
        pokemonId: pokemon.id,
        pokemonNickname: pokemon.nickname,
        isShiny: pokemon.isShiny,
        fromSpeciesId: from.speciesId,
        toSpeciesId: to.speciesId,
        from,
        to,
        fromAbility: pokemon.ability ? { ...pokemon.ability } : undefined,
        toAbility: nextAbility ? { ...nextAbility } : undefined,
        evolutionDate: input.evolutionDate,
        evolutionLocation: input.evolutionLocation.trim(),
        evolutionMethod: input.evolutionMethod.trim(),
        evolutionNotes: input.evolutionNotes.trim(),
        createdAt: now,
        updatedAt: now,
      };

      await db.evolutionMemories.add(memory);
      await db.ownedPokemon.put(updated);

      return { pokemon: updated, memory };
    },
  );
}

export async function updateEvolutionMemory(
  id: string,
  changes: EditableEvolutionMemoryInput,
) {
  const memory = await db.evolutionMemories.get(id);

  if (!memory) {
    throw new Error("That evolution memory no longer exists.");
  }

  const updated: EvolutionMemory = {
    ...memory,
    evolutionDate: changes.evolutionDate,
    evolutionLocation: changes.evolutionLocation.trim(),
    evolutionMethod: changes.evolutionMethod.trim(),
    evolutionNotes: changes.evolutionNotes.trim(),
    updatedAt: new Date().toISOString(),
  };

  await db.evolutionMemories.put(updated);
  return updated;
}

export async function undoLatestEvolution(
  pokemonId: string,
  evolutionMemoryId: string,
) {
  return db.transaction(
    "rw",
    [db.ownedPokemon, db.evolutionMemories],
    async () => {
      const pokemon = await db.ownedPokemon.get(pokemonId);

      if (!pokemon) {
        throw new Error(
          "This companion is no longer active, so its evolution cannot be undone.",
        );
      }

      const history = await db.evolutionMemories
        .where("pokemonId")
        .equals(pokemonId)
        .toArray();
      const latest = history.sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      )[0];

      if (!latest || latest.id !== evolutionMemoryId) {
        throw new Error(
          "Only the most recent evolution can be undone. Undo later stages first.",
        );
      }

      const restoredSnapshot = applySnapshot(pokemon, latest.from);
      const updated: OwnedPokemon = {
        ...restoredSnapshot,
        ability: latest.fromAbility ?? pokemon.ability,
      };
      await db.ownedPokemon.put(updated);
      await db.evolutionMemories.delete(latest.id);

      return { pokemon: updated, removedMemory: latest };
    },
  );
}

export async function releaseOwnedPokemon(
  id: string,
  input: ReleasePokemonInput,
) {
  return db.transaction(
    "rw",
    [db.ownedPokemon, db.releaseMemories],
    async () => {
      const pokemon = await db.ownedPokemon.get(id);

      if (!pokemon) {
        throw new Error("This Pokémon no longer exists in your journey.");
      }

      const memory: ReleaseMemory = {
        id: createId(),
        originalPokemonId: pokemon.id,
        pokemonApiName: pokemon.pokemonApiName,
        pokemonId: pokemon.pokemonId,
        speciesId: pokemon.speciesId,
        speciesApiName: pokemon.speciesApiName,
        displayName: pokemon.displayName,
        formLabel: pokemon.formLabel,
        types: [...pokemon.types],
        artwork: pokemon.artwork,
        shinyArtwork: pokemon.shinyArtwork,
        sprite: pokemon.sprite,
        genus: pokemon.genus,
        flavorText: pokemon.flavorText,
        nickname: pokemon.nickname,
        gender: pokemon.gender,
        isShiny: pokemon.isShiny,
        nature: pokemon.nature,
        level: pokemon.level,
        ability: pokemon.ability ? { ...pokemon.ability } : undefined,
        heldItem: pokemon.heldItem ? { ...pokemon.heldItem } : undefined,
        moves: pokemon.moves?.map((move) => ({ ...move })) ?? [],
        metDate: pokemon.metDate,
        metLocation: pokemon.metLocation,
        meetingStory: pokemon.meetingStory,
        personalityNotes: pokemon.personalityNotes,
        previousStatus: pokemon.status,
        previousPartySlot: pokemon.partySlot,
        partnerSince: pokemon.createdAt,
        releaseDate: input.releaseDate,
        releaseLocation: input.releaseLocation.trim(),
        releaseReason: input.releaseReason.trim(),
        farewellNote: input.farewellNote.trim(),
        createdAt: new Date().toISOString(),
      };

      await db.releaseMemories.add(memory);
      await db.ownedPokemon.delete(id);

      return memory;
    },
  );
}

export async function deleteReleaseMemory(id: string) {
  const memory = await db.releaseMemories.get(id);

  if (!memory) {
    return undefined;
  }

  await db.releaseMemories.delete(id);
  return memory;
}
