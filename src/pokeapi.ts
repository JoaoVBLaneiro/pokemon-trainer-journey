import {
  db,
  type PokemonAbilityOption,
  type PokemonCatalogEntry,
  type PokemonEvolutionChainCache,
  type PokemonHeldItem,
  type PokemonItemDetails,
  type PokemonItemIndexEntry,
  type PokemonMoveDetails,
  type PokemonMoveOption,
  type PokemonSpeciesDetails,
  type PokemonSpeciesIndexEntry,
  type PokemonVariety,
} from "./db";

const API_BASE = "https://pokeapi.co/api/v2";
const CACHE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

const specialDisplayNames: Record<string, string> = {
  farfetchd: "Farfetch'd",
  sirfetchd: "Sirfetch'd",
  "mr-mime": "Mr. Mime",
  "mr-rime": "Mr. Rime",
  "mime-jr": "Mime Jr.",
  "nidoran-f": "Nidoran♀",
  "nidoran-m": "Nidoran♂",
  flabebe: "Flabébé",
  "type-null": "Type: Null",
  "jangmo-o": "Jangmo-o",
  "hakamo-o": "Hakamo-o",
  "kommo-o": "Kommo-o",
  "ho-oh": "Ho-Oh",
  "porygon-z": "Porygon-Z",
};

type NamedResource = {
  name: string;
  url: string;
};

type NamedResourceList = {
  count: number;
  results: NamedResource[];
};

type RawPokemonSpecies = {
  id: number;
  name: string;
  gender_rate: number;
  generation: NamedResource;
  evolution_chain: { url: string } | null;
  names: Array<{
    name: string;
    language: NamedResource;
  }>;
  genera: Array<{
    genus: string;
    language: NamedResource;
  }>;
  flavor_text_entries: Array<{
    flavor_text: string;
    language: NamedResource;
    version: NamedResource;
  }>;
  varieties: Array<{
    is_default: boolean;
    pokemon: NamedResource;
  }>;
};

type RawPokemon = {
  id: number;
  name: string;
  types: Array<{
    slot: number;
    type: NamedResource;
  }>;
  abilities: Array<{
    ability: NamedResource;
    is_hidden: boolean;
    slot: number;
  }>;
  moves: Array<{
    move: NamedResource;
  }>;
  sprites: {
    front_default: string | null;
    other?: {
      "official-artwork"?: {
        front_default: string | null;
        front_shiny: string | null;
      };
    };
  };
};


type RawItem = {
  name: string;
  names: Array<{
    name: string;
    language: NamedResource;
  }>;
  sprites: {
    default: string | null;
  };
};

type RawMove = {
  name: string;
  names: Array<{
    name: string;
    language: NamedResource;
  }>;
  type: NamedResource;
};

type RawEvolutionDetail = {
  trigger?: NamedResource | null;
  item?: NamedResource | null;
  held_item?: NamedResource | null;
  known_move?: NamedResource | null;
  known_move_type?: NamedResource | null;
  location?: NamedResource | null;
  min_level?: number | null;
  min_happiness?: number | null;
  min_beauty?: number | null;
  min_affection?: number | null;
  time_of_day?: string | null;
  trade_species?: NamedResource | null;
  party_species?: NamedResource | null;
  party_type?: NamedResource | null;
  relative_physical_stats?: number | null;
  needs_overworld_rain?: boolean | null;
  turn_upside_down?: boolean | null;
  region?: NamedResource | null;
  used_move?: NamedResource | null;
  min_move_count?: number | null;
  min_steps?: number | null;
  min_damage_taken?: number | null;
};

type RawEvolutionChainLink = {
  species: NamedResource;
  evolution_details?: RawEvolutionDetail[] | null;
  evolves_to: RawEvolutionChainLink[];
};

type RawEvolutionChain = {
  id: number;
  chain: RawEvolutionChainLink;
};

export type EvolutionOption = {
  speciesApiName: string;
  speciesId: number;
  displayName: string;
  suggestedMethod: string;
};

function isFresh(date: string) {
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) && Date.now() - timestamp < CACHE_LIFETIME_MS;
}

async function requestJsonFromUrl<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("That Pokémon could not be found in PokéAPI.");
    }

    throw new Error(
      `PokéAPI request failed (${response.status} ${response.statusText}).`,
    );
  }

  return (await response.json()) as T;
}

async function requestJson<T>(path: string): Promise<T> {
  return requestJsonFromUrl<T>(`${API_BASE}${path}`);
}

function getResourceId(url: string) {
  const match = url.match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : 0;
}

function titleCasePart(part: string) {
  return part.length > 0
    ? `${part[0].toUpperCase()}${part.slice(1)}`
    : part;
}

export function formatPokemonName(apiName: string) {
  const special = specialDisplayNames[apiName];

  if (special) {
    return special;
  }

  return apiName
    .split("-")
    .map(titleCasePart)
    .join(" ");
}

function formatGeneration(generation: string) {
  const roman = generation.replace("generation-", "").toUpperCase();
  return `Generation ${roman}`;
}

function cleanFlavorText(text: string) {
  return text.replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim();
}

function getEnglishName(species: RawPokemonSpecies) {
  return (
    species.names.find((entry) => entry.language.name === "en")?.name ??
    formatPokemonName(species.name)
  );
}

function getEnglishResourceName(
  apiName: string,
  names: Array<{ name: string; language: NamedResource }>,
) {
  return (
    names.find((entry) => entry.language.name === "en")?.name ??
    formatPokemonName(apiName)
  );
}

function getFormLabel(
  speciesApiName: string,
  pokemonApiName: string,
  isDefault: boolean,
) {
  if (isDefault) {
    return "Standard form";
  }

  const prefix = `${speciesApiName}-`;
  const suffix = pokemonApiName.startsWith(prefix)
    ? pokemonApiName.slice(prefix.length)
    : pokemonApiName;

  return formatPokemonName(suffix);
}

function createVarieties(
  species: RawPokemonSpecies,
  displayName: string,
): PokemonVariety[] {
  return species.varieties.map((variety) => ({
    apiName: variety.pokemon.name,
    isDefault: variety.is_default,
    displayName: variety.is_default
      ? displayName
      : `${displayName} — ${getFormLabel(
          species.name,
          variety.pokemon.name,
          false,
        )}`,
  }));
}

function formatResource(resource?: NamedResource | null) {
  return resource ? formatPokemonName(resource.name) : "";
}

function formatEvolutionDetail(detail: RawEvolutionDetail) {
  const parts: string[] = [];
  const trigger = detail.trigger?.name ?? "special";

  if (trigger === "level-up") {
    parts.push("Level up");
  } else if (trigger === "use-item") {
    parts.push(detail.item ? `Use ${formatResource(detail.item)}` : "Use an item");
  } else if (trigger === "trade") {
    parts.push("Trade");
  } else {
    parts.push(formatPokemonName(trigger));
  }

  if (detail.min_level) {
    parts.push(`at level ${detail.min_level}`);
  }

  if (detail.item && trigger !== "use-item") {
    parts.push(`with ${formatResource(detail.item)}`);
  }

  if (detail.held_item) {
    parts.push(`while holding ${formatResource(detail.held_item)}`);
  }

  if (detail.known_move) {
    parts.push(`while knowing ${formatResource(detail.known_move)}`);
  }

  if (detail.known_move_type) {
    parts.push(`while knowing a ${formatResource(detail.known_move_type)}-type move`);
  }

  if (detail.min_happiness) {
    parts.push(`with at least ${detail.min_happiness} friendship`);
  }

  if (detail.min_affection) {
    parts.push(`with at least ${detail.min_affection} affection`);
  }

  if (detail.min_beauty) {
    parts.push(`with at least ${detail.min_beauty} beauty`);
  }

  if (detail.time_of_day) {
    parts.push(`during the ${detail.time_of_day}`);
  }

  if (detail.location) {
    parts.push(`at ${formatResource(detail.location)}`);
  }

  if (detail.region) {
    parts.push(`in ${formatResource(detail.region)}`);
  }

  if (detail.trade_species) {
    parts.push(`for ${formatResource(detail.trade_species)}`);
  }

  if (detail.party_species) {
    parts.push(`with ${formatResource(detail.party_species)} in the party`);
  }

  if (detail.party_type) {
    parts.push(`with a ${formatResource(detail.party_type)}-type Pokémon in the party`);
  }

  if (detail.used_move) {
    const count = detail.min_move_count ? ` ${detail.min_move_count} times` : "";
    parts.push(`after using ${formatResource(detail.used_move)}${count}`);
  }

  if (detail.min_steps) {
    parts.push(`after ${detail.min_steps} steps`);
  }

  if (detail.min_damage_taken) {
    parts.push(`after taking at least ${detail.min_damage_taken} damage`);
  }

  if (detail.needs_overworld_rain) {
    parts.push("while it is raining");
  }

  if (detail.turn_upside_down) {
    parts.push("while the system is upside down");
  }

  if (detail.relative_physical_stats === 1) {
    parts.push("with Attack higher than Defense");
  } else if (detail.relative_physical_stats === -1) {
    parts.push("with Defense higher than Attack");
  } else if (detail.relative_physical_stats === 0) {
    parts.push("with Attack equal to Defense");
  }

  return parts.join(" ");
}

function formatEvolutionMethod(details?: RawEvolutionDetail[] | null) {
  if (!details || details.length === 0) {
    return "Special evolution";
  }

  const alternatives = details
    .map(formatEvolutionDetail)
    .filter(Boolean);

  return [...new Set(alternatives)].join(" or ") || "Special evolution";
}

function findEvolutionLink(
  link: RawEvolutionChainLink,
  speciesApiName: string,
): RawEvolutionChainLink | undefined {
  if (link.species.name === speciesApiName) {
    return link;
  }

  for (const child of link.evolves_to) {
    const match = findEvolutionLink(child, speciesApiName);

    if (match) {
      return match;
    }
  }

  return undefined;
}

export async function loadSpeciesIndex() {
  const latest = await db.pokemonSpeciesIndex
    .orderBy("fetchedAt")
    .last();
  const cachedCount = await db.pokemonSpeciesIndex.count();

  if (latest && cachedCount > 0 && isFresh(latest.fetchedAt)) {
    return db.pokemonSpeciesIndex.orderBy("speciesId").toArray();
  }

  const response = await requestJson<NamedResourceList>(
    "/pokemon-species?limit=100000&offset=0",
  );
  const fetchedAt = new Date().toISOString();
  const entries: PokemonSpeciesIndexEntry[] = response.results.map(
    (resource) => ({
      apiName: resource.name,
      speciesId: getResourceId(resource.url),
      displayName: formatPokemonName(resource.name),
      url: resource.url,
      fetchedAt,
    }),
  );

  await db.transaction("rw", db.pokemonSpeciesIndex, async () => {
    await db.pokemonSpeciesIndex.clear();
    await db.pokemonSpeciesIndex.bulkPut(entries);
  });

  return entries.sort((a, b) => a.speciesId - b.speciesId);
}

export async function loadItemIndex(): Promise<PokemonItemIndexEntry[]> {
  const latest = await db.pokemonItemIndex.orderBy("fetchedAt").last();
  const cachedCount = await db.pokemonItemIndex.count();

  if (latest && cachedCount > 0 && isFresh(latest.fetchedAt)) {
    return db.pokemonItemIndex.orderBy("displayName").toArray();
  }

  const response = await requestJson<NamedResourceList>(
    "/item?limit=100000&offset=0",
  );
  const fetchedAt = new Date().toISOString();
  const entries: PokemonItemIndexEntry[] = response.results.map(
    (resource) => ({
      apiName: resource.name,
      displayName: formatPokemonName(resource.name),
      url: resource.url,
      fetchedAt,
    }),
  );

  await db.transaction("rw", db.pokemonItemIndex, async () => {
    await db.pokemonItemIndex.clear();
    await db.pokemonItemIndex.bulkPut(entries);
  });

  return entries.sort((a, b) => a.displayName.localeCompare(b.displayName));
}


export async function fetchItemDetails(
  apiName: string,
): Promise<PokemonHeldItem> {
  const cached = await db.pokemonItemDetails.get(apiName);

  if (cached && isFresh(cached.fetchedAt)) {
    return {
      apiName: cached.apiName,
      displayName: cached.displayName,
      sprite: cached.sprite,
    };
  }

  const item = await requestJson<RawItem>(
    `/item/${encodeURIComponent(apiName)}`,
  );
  const details: PokemonItemDetails = {
    apiName: item.name,
    displayName: getEnglishResourceName(item.name, item.names),
    sprite: item.sprites.default ?? "",
    fetchedAt: new Date().toISOString(),
  };

  await db.pokemonItemDetails.put(details);
  return {
    apiName: details.apiName,
    displayName: details.displayName,
    sprite: details.sprite,
  };
}

export async function fetchMoveDetails(
  apiName: string,
): Promise<PokemonMoveOption> {
  const cached = await db.pokemonMoveDetails.get(apiName);

  if (cached && isFresh(cached.fetchedAt)) {
    return {
      apiName: cached.apiName,
      displayName: cached.displayName,
      type: cached.type,
    };
  }

  const move = await requestJson<RawMove>(
    `/move/${encodeURIComponent(apiName)}`,
  );
  const details: PokemonMoveDetails = {
    apiName: move.name,
    displayName: getEnglishResourceName(move.name, move.names),
    type: move.type.name,
    fetchedAt: new Date().toISOString(),
  };

  await db.pokemonMoveDetails.put(details);
  return {
    apiName: details.apiName,
    displayName: details.displayName,
    type: details.type,
  };
}

async function enrichHeldItem(
  item: PokemonHeldItem | undefined,
): Promise<PokemonHeldItem | undefined> {
  if (!item || item.isCustom || item.sprite !== undefined) {
    return item;
  }

  try {
    return await fetchItemDetails(item.apiName);
  } catch (error) {
    console.warn(`Could not load the icon for ${item.displayName}:`, error);
    return item;
  }
}

async function enrichMoves(
  moves: PokemonMoveOption[] | undefined,
): Promise<PokemonMoveOption[] | undefined> {
  if (!moves || moves.length === 0) {
    return moves;
  }

  return Promise.all(
    moves.map(async (move) => {
      if (move.isCustom || move.type) {
        return move;
      }

      try {
        return await fetchMoveDetails(move.apiName);
      } catch (error) {
        console.warn(`Could not load the type for ${move.displayName}:`, error);
        return move;
      }
    }),
  );
}

export async function hydrateStoredLoadoutVisuals() {
  const activePokemon = await db.ownedPokemon.toArray();

  for (const pokemon of activePokemon) {
    const heldItem = await enrichHeldItem(pokemon.heldItem);
    const moves = await enrichMoves(pokemon.moves);
    const itemChanged = heldItem?.sprite !== pokemon.heldItem?.sprite;
    const movesChanged = (moves ?? []).some(
      (move, index) => move.type !== pokemon.moves?.[index]?.type,
    );

    if (itemChanged || movesChanged) {
      await db.ownedPokemon.update(pokemon.id, {
        heldItem,
        moves,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  const releaseMemories = await db.releaseMemories.toArray();

  for (const memory of releaseMemories) {
    const heldItem = await enrichHeldItem(memory.heldItem);
    const moves = await enrichMoves(memory.moves);
    const itemChanged = heldItem?.sprite !== memory.heldItem?.sprite;
    const movesChanged = (moves ?? []).some(
      (move, index) => move.type !== memory.moves?.[index]?.type,
    );

    if (itemChanged || movesChanged) {
      await db.releaseMemories.update(memory.id, { heldItem, moves });
    }
  }
}

export async function fetchSpeciesDetails(
  apiName: string,
): Promise<PokemonSpeciesDetails> {
  const cached = await db.pokemonSpeciesDetails.get(apiName);

  // Old Version 2/3 cache rows do not include evolutionChainUrl, so refetch them.
  if (cached && cached.evolutionChainUrl && isFresh(cached.fetchedAt)) {
    return cached;
  }

  const species = await requestJson<RawPokemonSpecies>(
    `/pokemon-species/${encodeURIComponent(apiName)}`,
  );
  const displayName = getEnglishName(species);
  const englishFlavorEntries = species.flavor_text_entries.filter(
    (entry) => entry.language.name === "en",
  );
  const details: PokemonSpeciesDetails = {
    apiName: species.name,
    speciesId: species.id,
    displayName,
    genderRate: species.gender_rate,
    genus:
      species.genera.find((entry) => entry.language.name === "en")?.genus ??
      "Pokémon",
    flavorText: cleanFlavorText(
      englishFlavorEntries.at(-1)?.flavor_text ?? "",
    ),
    generation: formatGeneration(species.generation.name),
    evolutionChainUrl: species.evolution_chain?.url ?? "",
    varieties: createVarieties(species, displayName),
    fetchedAt: new Date().toISOString(),
  };

  await db.pokemonSpeciesDetails.put(details);
  return details;
}

export async function fetchPokemonForm(
  species: PokemonSpeciesDetails,
  pokemonApiName: string,
): Promise<PokemonCatalogEntry> {
  const cached = await db.pokemonCatalog.get(pokemonApiName);

  if (
    cached &&
    Array.isArray(cached.abilities) &&
    Array.isArray(cached.moves) &&
    isFresh(cached.fetchedAt)
  ) {
    return cached;
  }

  const pokemon = await requestJson<RawPokemon>(
    `/pokemon/${encodeURIComponent(pokemonApiName)}`,
  );
  const variety = species.varieties.find(
    (entry) => entry.apiName === pokemonApiName,
  );
  const officialArtwork =
    pokemon.sprites.other?.["official-artwork"];
  const artwork =
    officialArtwork?.front_default ?? pokemon.sprites.front_default ?? "";
  const entry: PokemonCatalogEntry = {
    apiName: pokemon.name,
    pokemonId: pokemon.id,
    speciesId: species.speciesId,
    speciesApiName: species.apiName,
    displayName: variety?.displayName ?? species.displayName,
    formLabel:
      variety && !variety.isDefault
        ? getFormLabel(species.apiName, pokemon.name, false)
        : "Standard form",
    types: pokemon.types
      .sort((a, b) => a.slot - b.slot)
      .map((entry) => entry.type.name),
    abilities: pokemon.abilities
      .sort((a, b) => a.slot - b.slot)
      .map<PokemonAbilityOption>((entry) => ({
        apiName: entry.ability.name,
        displayName: formatPokemonName(entry.ability.name),
        isHidden: entry.is_hidden,
      })),
    moves: [...new Map(
      pokemon.moves.map((entry) => [
        entry.move.name,
        {
          apiName: entry.move.name,
          displayName: formatPokemonName(entry.move.name),
        } satisfies PokemonMoveOption,
      ]),
    ).values()].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    artwork,
    shinyArtwork: officialArtwork?.front_shiny ?? artwork,
    sprite: pokemon.sprites.front_default ?? artwork,
    fetchedAt: new Date().toISOString(),
  };

  await db.pokemonCatalog.put(entry);
  return entry;
}

export async function fetchSpeciesSelection(apiName: string) {
  const species = await fetchSpeciesDetails(apiName);
  const defaultVariety =
    species.varieties.find((variety) => variety.isDefault) ??
    species.varieties[0];

  if (!defaultVariety) {
    throw new Error("PokéAPI did not return a usable form for this Pokémon.");
  }

  const form = await fetchPokemonForm(species, defaultVariety.apiName);
  return { species, form };
}

export async function fetchEvolutionOptions(
  speciesApiName: string,
): Promise<EvolutionOption[]> {
  const species = await fetchSpeciesDetails(speciesApiName);

  if (!species.evolutionChainUrl) {
    return [];
  }

  const cached = await db.pokemonEvolutionChains.get(
    species.evolutionChainUrl,
  );
  let chain: RawEvolutionChain;

  if (cached && isFresh(cached.fetchedAt)) {
    chain = cached.data as RawEvolutionChain;
  } else {
    chain = await requestJsonFromUrl<RawEvolutionChain>(
      species.evolutionChainUrl,
    );
    const cacheEntry: PokemonEvolutionChainCache = {
      chainUrl: species.evolutionChainUrl,
      data: chain,
      fetchedAt: new Date().toISOString(),
    };
    await db.pokemonEvolutionChains.put(cacheEntry);
  }

  const currentLink = findEvolutionLink(chain.chain, speciesApiName);

  if (!currentLink) {
    return [];
  }

  return currentLink.evolves_to.map((link) => ({
    speciesApiName: link.species.name,
    speciesId: getResourceId(link.species.url),
    displayName: formatPokemonName(link.species.name),
    suggestedMethod: formatEvolutionMethod(link.evolution_details),
  }));
}
