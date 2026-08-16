import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { OwnedPokemon, PokemonPlace, PokemonPlaceKind } from "./db";

type HabitatPageProps = {
  ownedPokemon: OwnedPokemon[];
  places: PokemonPlace[];
  onEditPokemon: (pokemon: OwnedPokemon) => void;
};

type HabitatSource = {
  key: string;
  label: string;
  subtitle: string;
  kind: PokemonPlaceKind | "party" | "unassigned";
  pokemon: OwnedPokemon[];
};

type HabitatActorState = {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  facing: 1 | -1;
  activity: string;
  emote: string;
  isInteracting: boolean;
  isMoving: boolean;
  moveDurationMs: number;
};

type HabitatActorClock = {
  nextWanderAt: number;
  nextSoloAt: number;
  nextSocialAt: number;
  busyUntil: number;
};

type PendingHabitatInteraction = {
  id: string;
  firstId: string;
  secondId: string;
  queuedAt: number;
  forced: boolean;
};

type HabitatTheme = "lab" | "training" | "garden" | "wild" | "camp" | "ranch" | "meadow";
type HabitatSpot = "pond" | "shore" | "campfire" | "berries" | "flowers" | "monitor" | "training" | "tent" | "clearing";

type HabitatSoloBeat = {
  activity: string;
  emote: string;
  message: string;
  approachMessage?: string;
  spot?: HabitatSpot;
};

type HabitatPairBeat = {
  message: string;
  approachMessage: string;
  aActivity: string;
  bActivity: string;
  aEmote: string;
  bEmote: string;
  spot?: HabitatSpot;
};

const genericSoloActivities = [
  "looking around curiously",
  "enjoying the scenery",
  "stretching a little",
  "watching the others",
  "resting for a moment",
  "sniffing around nearby",
  "taking a tiny stroll",
  "dozing peacefully",
];

const genericSoloEmotes = ["♪", "✦", "☀", "💤", "♥"];

const ambientWanderActivities = [
  "taking a little stroll",
  "wandering around the island",
  "checking out another part of the habitat",
  "sniffing around while they walk",
  "doing a little lap around the clearing",
];

const genericPairMoments = [
  (a: string, b: string) => `${a} and ${b} are happily keeping each other company.`,
  (a: string, b: string) => `${a} wandered over to spend some time with ${b}.`,
  (a: string, b: string) => `${a} and ${b} seem to be having a very serious Pokémon conversation.`,
  (a: string, b: string) => `${a} and ${b} are relaxing side by side.`,
  (a: string, b: string) => `${a} and ${b} are playing together.`,
  (a: string, b: string) => `${a} and ${b} have apparently invented a game with rules known only to them.`,
];

const genericPairEmotes = ["♥", "♪", "✦", "☀", "☆"];

function companionName(pokemon: OwnedPokemon) {
  return pokemon.nickname.trim() || pokemon.displayName;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}



type EvolutionStanding = {
  depth: number;
  maxDepth: number;
  isFullyEvolved: boolean;
  isSingleStage: boolean;
};

type NatureTemperament =
  | "bold"
  | "playful"
  | "gentle"
  | "shy"
  | "serious"
  | "curious"
  | "stubborn"
  | "relaxed";

const evolutionStandingCache = new Map<string, Promise<EvolutionStanding | null>>();
const pokemonSpeciesDataCache = new Map<string, Promise<any | null>>();

async function fetchPokemonSpeciesData(pokemon: OwnedPokemon) {
  const species = pokemon.speciesApiName || pokemon.pokemonApiName;
  if (!species) return null;
  const cacheKey = species.toLowerCase();
  const cached = pokemonSpeciesDataCache.get(cacheKey);
  if (cached) return cached;

  const request = (async () => {
    try {
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${cacheKey}`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  })();

  pokemonSpeciesDataCache.set(cacheKey, request);
  return request;
}

async function fetchEggGroups(pokemon: OwnedPokemon): Promise<string[]> {
  const data = await fetchPokemonSpeciesData(pokemon);
  if (!data || !Array.isArray(data.egg_groups)) return [];
  return data.egg_groups
    .map((group: any) => group?.name)
    .filter((name: unknown): name is string => typeof name === "string");
}

function effectiveNature(pokemon: OwnedPokemon) {
  const established = pokemon.nature?.trim();
  if (established) return established;
  return hashString(`${pokemon.id}:fallback-nature`) % 2 === 0 ? "Serious" : "Bashful";
}

function natureTemperament(pokemon: OwnedPokemon): NatureTemperament {
  const nature = effectiveNature(pokemon).toLowerCase();
  if (["brave", "adamant", "bold", "naughty"].includes(nature)) return "bold";
  if (["jolly", "naive", "hasty", "quirky"].includes(nature)) return "playful";
  if (["gentle", "calm", "mild", "careful"].includes(nature)) return "gentle";
  if (["timid", "bashful", "lonely"].includes(nature)) return "shy";
  if (["serious", "hardy"].includes(nature)) return "serious";
  if (["modest", "rash"].includes(nature)) return "curious";
  if (["impish", "sassy"].includes(nature)) return "stubborn";
  return "relaxed";
}

function natureAdverb(pokemon: OwnedPokemon) {
  switch (natureTemperament(pokemon)) {
    case "bold": return "confidently";
    case "playful": return "excitedly";
    case "gentle": return "gently";
    case "shy": return "a little shyly";
    case "serious": return "very seriously";
    case "curious": return "curiously";
    case "stubborn": return "with suspicious determination";
    default: return "contentedly";
  }
}

function natureSoloActivity(pokemon: OwnedPokemon) {
  const name = companionName(pokemon);
  switch (natureTemperament(pokemon)) {
    case "bold":
      return { activity: "practicing an impressive little pose", emote: "💪", message: `${name} is confidently practicing an impressive little pose.` };
    case "playful":
      return { activity: "bouncing around looking for a game", emote: "♪", message: `${name} is bouncing around looking for someone to play with.` };
    case "gentle":
      return { activity: "checking that everyone seems comfortable", emote: "♥", message: `${name} is gently checking that everyone seems comfortable.` };
    case "shy":
      return { activity: "watching the others from a comfortable little spot", emote: "…", message: `${name} is quietly watching the others from a comfortable little spot.` };
    case "serious":
      return { activity: "carefully observing what everyone is doing", emote: "👀", message: `${name} is very seriously observing what everyone is doing.` };
    case "curious":
      return { activity: "investigating something extremely interesting", emote: "?", message: `${name} has discovered something that apparently requires a full investigation.` };
    case "stubborn":
      return { activity: "trying the same little trick again", emote: "!", message: `${name} is determined to get one particular little trick exactly right.` };
    default:
      return { activity: "taking it easy and enjoying the scenery", emote: "☀", message: `${name} is taking it easy and enjoying the scenery.` };
  }
}

function evolutionChainDepths(chain: any) {
  const depths = new Map<string, { depth: number; hasChildren: boolean }>();
  let maxDepth = 0;
  const walk = (node: any, depth: number) => {
    if (!node?.species?.name) return;
    maxDepth = Math.max(maxDepth, depth);
    const children = Array.isArray(node.evolves_to) ? node.evolves_to : [];
    depths.set(node.species.name, { depth, hasChildren: children.length > 0 });
    for (const child of children) walk(child, depth + 1);
  };
  walk(chain, 0);
  return { depths, maxDepth };
}

async function fetchEvolutionStanding(pokemon: OwnedPokemon): Promise<EvolutionStanding | null> {
  const species = pokemon.speciesApiName || pokemon.pokemonApiName;
  if (!species) return null;
  const cacheKey = species.toLowerCase();
  const cached = evolutionStandingCache.get(cacheKey);
  if (cached) return cached;

  const request = (async () => {
    try {
      const speciesData = await fetchPokemonSpeciesData(pokemon);
      const chainUrl = speciesData?.evolution_chain?.url;
      if (!chainUrl) return null;
      const chainResponse = await fetch(chainUrl);
      if (!chainResponse.ok) return null;
      const chainData = await chainResponse.json();
      const { depths, maxDepth } = evolutionChainDepths(chainData.chain);
      const own = depths.get(speciesData.name ?? cacheKey);
      if (!own) return null;
      return {
        depth: own.depth,
        maxDepth,
        isFullyEvolved: !own.hasChildren,
        isSingleStage: maxDepth === 0 && !own.hasChildren,
      };
    } catch {
      return null;
    }
  })();

  evolutionStandingCache.set(cacheKey, request);
  return request;
}

function isJuniorStanding(standing?: EvolutionStanding | null) {
  return Boolean(standing && standing.depth < standing.maxDepth);
}

function isSeniorStanding(standing?: EvolutionStanding | null) {
  return Boolean(standing && (standing.isFullyEvolved || standing.isSingleStage));
}

function mentorPairBeat(junior: OwnedPokemon, senior: OwnedPokemon, theme: HabitatTheme): HabitatPairBeat {
  const juniorName = companionName(junior);
  const seniorName = companionName(senior);
  const juniorTemperament = natureTemperament(junior);
  const seniorTemperament = natureTemperament(senior);

  // Mentor moments can use the same physical props as the type/habitat system.
  // This makes "looking up to" feel like something actually happening in the
  // little world rather than a generic line in the clearing.
  const mentorWaterSpot = waterSpotForTheme(theme);
  if (mentorWaterSpot && hasType(junior, "water") && hasType(senior, "water")) {
    const atShore = mentorWaterSpot === "shore";
    return {
      message: juniorTemperament === "playful"
        ? atShore
          ? `${juniorName} is enthusiastically copying ${seniorName}'s splashing in the shallows.`
          : `${juniorName} is enthusiastically copying ${seniorName}'s swimming around the pond.`
        : atShore
          ? `${juniorName} is watching ${seniorName} demonstrate how to move through the shallows.`
          : `${juniorName} is watching ${seniorName} demonstrate how to move through the pond.`,
      approachMessage: atShore
        ? `${juniorName} is following ${seniorName} down to the shoreline for a little lesson.`
        : `${juniorName} is following ${seniorName} over to the pond for a little lesson.`,
      aActivity: atShore ? `learning shoreline tricks from ${seniorName}` : `learning pond tricks from ${seniorName}`,
      bActivity: atShore ? `showing ${juniorName} a few shoreline tricks` : `showing ${juniorName} a few pond tricks`,
      aEmote: juniorTemperament === "shy" ? "👀" : "💧",
      bEmote: "⭐",
      spot: mentorWaterSpot,
    };
  }

  if (theme === "camp" && hasType(senior, "fire")) {
    return {
      message: `${juniorName} is watching ${seniorName} tend the campfire and trying to learn the trick.`,
      approachMessage: `${juniorName} is ${natureAdverb(junior)} following ${seniorName} over to the campfire.`,
      aActivity: `learning about the campfire from ${seniorName}`,
      bActivity: `showing ${juniorName} how to tend the campfire`,
      aEmote: juniorTemperament === "bold" ? "💪" : "👀",
      bEmote: "🔥",
      spot: "campfire",
    };
  }

  if (theme === "training" && (likesTraining(junior) || likesTraining(senior))) {
    return {
      message: juniorTemperament === "bold" || juniorTemperament === "stubborn"
        ? `${juniorName} is doing everything possible to keep up with ${seniorName}'s drills.`
        : `${juniorName} is carefully copying ${seniorName}'s drills in the training circle.`,
      approachMessage: `${seniorName} is leading ${juniorName} over to the training circle.`,
      aActivity: `copying ${seniorName}'s training drills`,
      bActivity: `demonstrating training drills for ${juniorName}`,
      aEmote: juniorTemperament === "shy" ? "👀" : "💪",
      bEmote: hasType(senior, "fighting") ? "🥊" : "⭐",
      spot: "training",
    };
  }

  if (theme === "lab" && (likesTechnology(junior) || likesTechnology(senior))) {
    return {
      message: `${juniorName} is following ${seniorName}'s explanation of the lab equipment with great concentration.`,
      approachMessage: `${seniorName} is showing ${juniorName} something interesting on the lab monitor.`,
      aActivity: `learning about the lab equipment from ${seniorName}`,
      bActivity: `showing the lab equipment to ${juniorName}`,
      aEmote: juniorTemperament === "playful" ? "!" : "💡",
      bEmote: hasType(senior, "electric") ? "⚡" : "⚙",
      spot: "monitor",
    };
  }

  if (juniorTemperament === "shy") {
    return {
      message: `${juniorName} is quietly watching ${seniorName} and trying to copy every little movement.`,
      approachMessage: `${juniorName} is ${natureAdverb(junior)} edging closer to watch ${seniorName}.`,
      aActivity: `quietly learning from ${seniorName}`,
      bActivity: seniorTemperament === "gentle" ? `patiently encouraging ${juniorName}` : `letting ${juniorName} watch closely`,
      aEmote: "👀",
      bEmote: seniorTemperament === "gentle" ? "♥" : "⭐",
      spot: "clearing",
    };
  }

  if (juniorTemperament === "playful") {
    return {
      message: `${juniorName} is enthusiastically copying ${seniorName}. The imitation is... mostly accurate.`,
      approachMessage: `${juniorName} has noticed ${seniorName} and is already bouncing over to join in.`,
      aActivity: `enthusiastically imitating ${seniorName}`,
      bActivity: seniorTemperament === "playful" ? `turning the lesson into a game with ${juniorName}` : `showing ${juniorName} how it is done`,
      aEmote: "⭐",
      bEmote: seniorTemperament === "playful" ? "♪" : "💡",
      spot: "clearing",
    };
  }

  if (juniorTemperament === "bold" || juniorTemperament === "stubborn") {
    return {
      message: `${juniorName} is trying very hard to keep up with ${seniorName}'s demonstration.`,
      approachMessage: `${juniorName} is marching over to ${seniorName} with a very clear request for a demonstration.`,
      aActivity: `trying to keep up with ${seniorName}`,
      bActivity: `demonstrating a few tricks for ${juniorName}`,
      aEmote: "💪",
      bEmote: "⭐",
      spot: "clearing",
    };
  }

  if (juniorTemperament === "serious" || juniorTemperament === "curious") {
    return {
      message: `${juniorName} is studying ${seniorName}'s technique with absolute concentration.`,
      approachMessage: `${juniorName} has decided ${seniorName} is currently the most interesting thing in the habitat.`,
      aActivity: `carefully studying ${seniorName}'s technique`,
      bActivity: seniorTemperament === "gentle" ? `patiently teaching ${juniorName}` : `demonstrating for ${juniorName}`,
      aEmote: "👀",
      bEmote: "💡",
      spot: "clearing",
    };
  }

  return {
    message: seniorTemperament === "gentle"
      ? `${seniorName} is patiently showing ${juniorName} a few things while ${juniorName} follows along.`
      : `${juniorName} seems to really look up to ${seniorName} and is following along closely.`,
    approachMessage: `${juniorName} is wandering over to spend some time learning from ${seniorName}.`,
    aActivity: `learning a few things from ${seniorName}`,
    bActivity: seniorTemperament === "gentle" ? `encouraging ${juniorName}` : `showing ${juniorName} the ropes`,
    aEmote: "⭐",
    bEmote: seniorTemperament === "gentle" ? "♥" : "💡",
    spot: "clearing",
  };
}

function seededPercent(id: string, salt: number, min: number, max: number) {
  const value = hashString(`${id}:${salt}`) % 1000;
  return min + (value / 999) * (max - min);
}

const HABITAT_HOME_SLOTS = [
  { x: 28, y: 45 },
  { x: 50, y: 42 },
  { x: 72, y: 46 },
  { x: 30, y: 62 },
  { x: 53, y: 65 },
  { x: 75, y: 61 },
  { x: 40, y: 53 },
  { x: 62, y: 54 },
  { x: 20, y: 54 },
  { x: 82, y: 53 },
  { x: 42, y: 68 },
  { x: 64, y: 68 },
];

function initialActorState(pokemon: OwnedPokemon, index: number): HabitatActorState {
  const slot = HABITAT_HOME_SLOTS[index % HABITAT_HOME_SLOTS.length];
  const ring = Math.floor(index / HABITAT_HOME_SLOTS.length);

  // Tiny deterministic jitter keeps the scene organic without allowing two
  // initial homes to collapse onto one another.
  const jitterX = seededPercent(pokemon.id, index + 17, -1.6, 1.6);
  const jitterY = seededPercent(pokemon.id, index + 43, -1.2, 1.2);
  const ringOffset = ring * 1.6;

  const homeX = clamp(
    slot.x + jitterX + (index % 2 === 0 ? -ringOffset : ringOffset),
    14,
    86,
  );
  const homeY = clamp(
    slot.y + jitterY + ((index % 3) - 1) * ringOffset * 0.55,
    36,
    71,
  );

  return {
    x: homeX,
    y: homeY,
    homeX,
    homeY,
    facing: hashString(`${pokemon.id}:face`) % 2 === 0 ? 1 : -1,
    activity: "settling in",
    emote: "",
    isInteracting: false,
    isMoving: false,
    moveDurationMs: 2800,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function shortWander(previous: HabitatActorState) {
  // Ambient movement is no longer tethered to the Pokémon's original spawn.
  // Companions can gradually explore the whole safe island area while still
  // taking mostly short, PokéPelago-like strolls.
  const wantsToRest = Math.random() < 0.08;
  if (wantsToRest) return { x: previous.x, y: previous.y };

  const isLongStroll = Math.random() < 0.42;

  // Keep a little momentum so a Pokémon often continues generally in the
  // direction it was already facing, rather than jittering around one point.
  let direction = Math.random() < 0.64 ? previous.facing : (Math.random() < 0.5 ? -1 : 1);

  // Only pull toward the original home when the Pokémon has wandered very far
  // from it. Home is now a loose comfort area, not an invisible leash.
  const farFromHomeX = Math.abs(previous.x - previous.homeX) > 25;
  if (farFromHomeX && Math.random() < 0.42) {
    direction = previous.x > previous.homeX ? -1 : 1;
  }

  const xStep = isLongStroll
    ? 9.5 + Math.random() * 8.5
    : 4.5 + Math.random() * 6.0;
  const yStep = isLongStroll
    ? (Math.random() - 0.5) * 12
    : (Math.random() - 0.5) * 7.0;

  const x = clamp(previous.x + direction * xStep, 14, 86);
  const y = clamp(previous.y + yStep, 36, 72);

  return { x, y };
}

function spacingScore(
  point: { x: number; y: number },
  actors: Record<string, HabitatActorState>,
  selfId: string,
) {
  let best = Number.POSITIVE_INFINITY;

  for (const [id, actor] of Object.entries(actors)) {
    if (id === selfId) continue;

    // The Habitat is much wider than it is tall, so use an anisotropic
    // distance. A score of 1 is roughly one comfortable sprite footprint.
    const dx = Math.abs(point.x - actor.x) / 9.5;
    const dy = Math.abs(point.y - actor.y) / 7.5;
    const distance = Math.hypot(dx, dy);
    best = Math.min(best, distance);
  }

  return Number.isFinite(best) ? best : 99;
}

function chooseSpacedWander(
  previous: HabitatActorState,
  actors: Record<string, HabitatActorState>,
  selfId: string,
  minimumTravel = 0,
) {
  let bestPoint = { x: previous.x, y: previous.y };
  let bestValue = -Infinity;

  // Try enough destinations that a genuine stroll can ask for a clearly
  // visible amount of travel without giving up the soft personal-space rule.
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const candidate = shortWander(previous);
    const score = spacingScore(candidate, actors, selfId);
    const travel = percentDistance(previous, candidate);
    const travelFit = minimumTravel <= 0 ? 1 : Math.min(1, travel / minimumTravel);
    const value = score + travelFit * 0.34;

    if (travel >= minimumTravel && score >= 0.82) return candidate;

    if (value > bestValue) {
      bestPoint = candidate;
      bestValue = value;
    }
  }

  // If this Pokémon is already crowded, gently bias it away from the nearest
  // neighbour. This is what gradually "de-clumps" the scene over time.
  let nearest: HabitatActorState | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const [id, actor] of Object.entries(actors)) {
    if (id === selfId) continue;
    const distance = percentDistance(previous, actor);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = actor;
    }
  }

  if (nearest && spacingScore(bestPoint, actors, selfId) < 0.72) {
    const dx = previous.x - nearest.x;
    const dy = previous.y - nearest.y;
    const magnitude = Math.hypot(dx, dy) || 1;
    const pushed = {
      x: clamp(previous.x + (dx / magnitude) * 5.2, 14, 86),
      y: clamp(previous.y + (dy / magnitude) * 4.0, 36, 72),
    };

    if (
      spacingScore(pushed, actors, selfId) >
      spacingScore(bestPoint, actors, selfId)
    ) {
      return pushed;
    }
  }

  return bestPoint;
}

function separatePairPoints(
  first: { x: number; y: number },
  second: { x: number; y: number },
) {
  const distance = Math.hypot(second.x - first.x, second.y - first.y);
  const minimum = 6.8;
  if (distance >= minimum) return [first, second] as const;

  const centerX = (first.x + second.x) / 2;
  const centerY = (first.y + second.y) / 2;
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const magnitude = Math.hypot(dx, dy) || 1;
  const ux = dx / magnitude;
  const uy = dy / magnitude;
  const half = minimum / 2;

  return [
    {
      x: clamp(centerX - ux * half, 8, 92),
      y: clamp(centerY - uy * half, 29, 78),
    },
    {
      x: clamp(centerX + ux * half, 8, 92),
      y: clamp(centerY + uy * half, 29, 78),
    },
  ] as const;
}

function percentDistance(
  from: Pick<HabitatActorState, "x" | "y">,
  to: { x: number; y: number },
) {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function ambientTravelDurationMs(
  from: Pick<HabitatActorState, "x" | "y">,
  to: { x: number; y: number },
) {
  return clamp(1900 + percentDistance(from, to) * 130, 2400, 5400);
}

function interactionTravelDurationMs(
  from: Pick<HabitatActorState, "x" | "y">,
  to: { x: number; y: number },
) {
  // Longer interaction walks receive proportionally more time instead of
  // covering half the island at the same speed as a two-step adjustment.
  return clamp(2700 + percentDistance(from, to) * 78, 3000, 5500);
}

function menuSpriteCandidates(pokemon: OwnedPokemon) {
  return [
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-vii/icons/${pokemon.pokemonId}.png`,
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-viii/icons/${pokemon.pokemonId}.png`,
    pokemon.sprite,
    pokemon.artwork,
  ].filter((value, index, values): value is string =>
    Boolean(value) && values.indexOf(value) === index
  );
}

function HabitatMenuSprite({ pokemon, facing }: { pokemon: OwnedPokemon; facing: 1 | -1 }) {
  const candidates = menuSpriteCandidates(pokemon);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [pokemon.id, pokemon.pokemonId]);

  const sprite = candidates[candidateIndex];
  if (!sprite) return <b>{companionName(pokemon)[0]}</b>;

  return (
    <img
      src={sprite}
      alt={companionName(pokemon)}
      style={{ transform: `scaleX(${facing})` }}
      onError={() => setCandidateIndex((index) => Math.min(index + 1, candidates.length))}
    />
  );
}

function getSprite(pokemon: OwnedPokemon) {
  if (pokemon.isShiny) {
    if (
      pokemon.sprite &&
      pokemon.sprite.includes("/sprites/pokemon/") &&
      !pokemon.sprite.includes("/shiny/")
    ) {
      return pokemon.sprite.replace("/sprites/pokemon/", "/sprites/pokemon/shiny/");
    }
    return pokemon.shinyArtwork || pokemon.sprite || pokemon.artwork;
  }
  return pokemon.sprite || pokemon.artwork;
}

function getTheme(kind: HabitatSource["kind"]): HabitatTheme {
  if (kind === "laboratory" || kind === "pc") return "lab";
  if (kind === "gym") return "training";
  if (kind === "pokemon-center" || kind === "daycare" || kind === "home") return "garden";
  if (kind === "habitat") return "wild";
  if (kind === "camp" || kind === "party") return "camp";
  if (kind === "ranch") return "ranch";
  return "meadow";
}

function habitatAsset(file: string) {
  return `${import.meta.env.BASE_URL}assets/habitat/kenney/${file}`;
}

function sourceDescription(source: HabitatSource) {
  if (source.kind === "party") {
    return "The Pokémon currently travelling with you are taking a break together.";
  }
  if (source.kind === "unassigned") {
    return "These companions are waiting for a permanent place to call home.";
  }
  return source.subtitle || "A place where your companions can spend time together.";
}

function randomFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomMs(minSeconds: number, maxSeconds: number) {
  return (minSeconds + Math.random() * (maxSeconds - minSeconds)) * 1000;
}

function initialActorClock(pokemon: OwnedPokemon, now: number): HabitatActorClock {
  // Stagger every companion from the moment the scene opens. The small
  // deterministic offset stops a freshly loaded party from all becoming due
  // at exactly the same moment, while the random portion keeps repeated visits
  // from feeling scripted.
  const phase = (hashString(`${pokemon.id}:habitat-clock`) % 5000);
  return {
    nextWanderAt: now + 1900 + phase * 0.14 + randomMs(0.8, 2.6),
    nextSoloAt: now + 11000 + phase * 0.8 + randomMs(4, 12),
    nextSocialAt: now + 22000 + phase * 1.35 + randomMs(8, 18),
    busyUntil: 0,
  };
}

function pokemonTypes(pokemon: OwnedPokemon) {
  return (pokemon.types ?? []).map((type) => type.toLowerCase());
}

function hasType(pokemon: OwnedPokemon, ...types: string[]) {
  const present = new Set(pokemonTypes(pokemon));
  return types.some((type) => present.has(type));
}

function normalizedEggGroups(groups: string[] | undefined) {
  return (groups ?? []).map((group) => group.toLowerCase());
}

function hasEggGroup(groups: string[] | undefined, ...wanted: string[]) {
  const present = new Set(normalizedEggGroups(groups));
  return wanted.some((group) => present.has(group));
}

function sharedEggGroups(a: string[] | undefined, b: string[] | undefined) {
  const bGroups = new Set(normalizedEggGroups(b));
  return normalizedEggGroups(a).filter((group) => bGroups.has(group));
}

function eggGroupDisplayName(group: string) {
  const names: Record<string, string> = {
    monster: "Monster",
    "water1": "Water 1",
    bug: "Bug",
    flying: "Flying",
    field: "Field",
    fairy: "Fairy",
    grass: "Grass",
    "human-like": "Human-Like",
    "water3": "Water 3",
    mineral: "Mineral",
    amorphous: "Amorphous",
    "water2": "Water 2",
    ditto: "Ditto",
    dragon: "Dragon",
    undiscovered: "Undiscovered",
  };
  return names[group] ?? group.replace(/(^|-)([a-z])/g, (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

function eggGroupSoloBeat(
  pokemon: OwnedPokemon,
  groups: string[],
  theme: HabitatTheme,
  isNight: boolean,
): HabitatSoloBeat | null {
  const name = companionName(pokemon);
  const naturalTheme = theme === "garden" || theme === "ranch" || theme === "wild" || theme === "meadow";
  const waterSpot = waterSpotForTheme(theme);

  // Egg Groups are a soft secondary instinct layer. They never grant Type-based
  // abilities: e.g. Water-group membership alone never makes a non-Water Pokémon swim.
  if (hasEggGroup(groups, "bug") && Math.random() < 0.42) {
    return naturalTheme
      ? {
          activity: "zigzagging curiously around the flowers",
          emote: "✿",
          message: `${name} is tracing quick little loops around the flowers, following some very Bug-like instincts.`,
          approachMessage: `${name} has suddenly become extremely interested in the flowers.`,
          spot: "flowers",
        }
      : {
          activity: "making quick little zigzags around the clearing",
          emote: "✿",
          message: `${name} is making quick little zigzags around the clearing like something tiny caught its attention.`,
          spot: "clearing",
        };
  }

  if (hasEggGroup(groups, "field") && Math.random() < 0.34) {
    return {
      activity: "following an interesting trail around the clearing",
      emote: "👃",
      message: `${name} has picked up an interesting trail and is carefully following it around the habitat.`,
      spot: "clearing",
    };
  }

  if (hasEggGroup(groups, "monster") && Math.random() < 0.32) {
    return {
      activity: "testing out a very important stomp",
      emote: "💥",
      message: `${name} is testing out a few very important-looking stomps in the clearing.`,
      spot: "clearing",
    };
  }

  if (hasEggGroup(groups, "flying") && Math.random() < 0.36) {
    return {
      activity: "enjoying the breeze through the open clearing",
      emote: "☁",
      message: `${name} seems especially happy wherever the breeze has the most room to move.`,
      spot: "clearing",
    };
  }

  if (hasEggGroup(groups, "fairy") && Math.random() < 0.34) {
    return {
      activity: naturalTheme ? "playing among the flowers" : "chasing tiny sparkles around the clearing",
      emote: "✨",
      message: naturalTheme
        ? `${name} is having a suspiciously delightful time among the flowers.`
        : `${name} is chasing tiny glints of light around the clearing.`,
      spot: naturalTheme ? "flowers" : "clearing",
    };
  }

  if (hasEggGroup(groups, "grass") && naturalTheme && Math.random() < 0.40) {
    return {
      activity: theme === "garden" || theme === "ranch" ? "checking over the berry bushes" : "inspecting the plants",
      emote: "🌿",
      message: theme === "garden" || theme === "ranch"
        ? `${name} is carefully checking over the berry bushes as if the plants are part of today's responsibilities.`
        : `${name} is spending some time inspecting the plants around the habitat.`,
      spot: theme === "garden" || theme === "ranch" ? "berries" : "flowers",
    };
  }

  if (hasEggGroup(groups, "human-like") && Math.random() < 0.36) {
    return {
      activity: "practicing a surprisingly deliberate little routine",
      emote: "☆",
      message: `${name} is practicing the same careful little routine over and over until it feels just right.`,
      spot: theme === "training" ? "training" : "clearing",
    };
  }

  if (hasEggGroup(groups, "mineral") && Math.random() < 0.38) {
    return {
      activity: theme === "lab" ? "examining the lab equipment" : "examining some interesting stones",
      emote: theme === "lab" ? "⚙" : "◆",
      message: theme === "lab"
        ? `${name} seems fascinated by the shapes and surfaces of the lab equipment.`
        : `${name} has found several stones that apparently require very careful inspection.`,
      spot: theme === "lab" ? "monitor" : "clearing",
    };
  }

  if (hasEggGroup(groups, "amorphous") && Math.random() < 0.38) {
    return {
      activity: isNight ? "drifting through the darker patches of the habitat" : "moving in an oddly fluid little rhythm",
      emote: isNight ? "👻" : "〰",
      message: isNight
        ? `${name} is quietly drifting through the darker patches of the habitat.`
        : `${name} is moving around in an oddly fluid rhythm that is difficult to stop watching.`,
      spot: "clearing",
    };
  }

  if (hasEggGroup(groups, "dragon") && Math.random() < 0.35) {
    return {
      activity: "surveying the habitat with considerable dignity",
      emote: "◇",
      message: `${name} has paused in the clearing to survey absolutely everything with considerable dignity.`,
      spot: theme === "training" ? "training" : "clearing",
    };
  }

  if (waterSpot && hasEggGroup(groups, "water1", "water2", "water3") && !hasType(pokemon, "water") && Math.random() < 0.30) {
    const atShore = waterSpot === "shore";
    return {
      activity: atShore ? "watching the little waves along the shoreline" : "watching the ripples on the pond",
      emote: "≈",
      message: atShore
        ? `${name} is lingering near the shoreline, completely absorbed by the little waves.`
        : `${name} is sitting by the pond and watching the ripples move across the surface.`,
      approachMessage: atShore
        ? `${name} is wandering down toward the shoreline.`
        : `${name} is wandering over to the pond's edge.`,
      spot: waterSpot,
    };
  }

  if (hasEggGroup(groups, "ditto") && Math.random() < 0.50) {
    return {
      activity: "practicing some extremely suspicious imitation",
      emote: "↺",
      message: `${name} appears to be practicing an imitation of somebody who was here a moment ago.`,
      spot: "clearing",
    };
  }

  // Undiscovered is intentionally not assigned a personality behavior. It is a
  // breeding-availability category rather than a useful behavioral motif.
  return null;
}

function eggGroupPairBeat(
  a: OwnedPokemon,
  b: OwnedPokemon,
  aGroups: string[],
  bGroups: string[],
  theme: HabitatTheme,
): HabitatPairBeat | null {
  const aName = companionName(a);
  const bName = companionName(b);
  const naturalTheme = theme === "garden" || theme === "ranch" || theme === "wild" || theme === "meadow";
  const waterSpot = waterSpotForTheme(theme);

  if (hasEggGroup(aGroups, "ditto") || hasEggGroup(bGroups, "ditto")) {
    const mimic = hasEggGroup(aGroups, "ditto") ? a : b;
    const model = mimic.id === a.id ? b : a;
    const mimicName = companionName(mimic);
    const modelName = companionName(model);
    const mimicIsA = mimic.id === a.id;
    return {
      message: `${mimicName} is copying ${modelName}'s little bounce with increasingly ridiculous accuracy.`,
      approachMessage: `${mimicName} has noticed ${modelName} and is clearly getting an idea.`,
      aActivity: mimicIsA ? `copying ${modelName}'s movements` : `being imitated by ${mimicName}`,
      bActivity: mimicIsA ? `being imitated by ${mimicName}` : `copying ${modelName}'s movements`,
      aEmote: mimicIsA ? "↺" : "?",
      bEmote: mimicIsA ? "?" : "↺",
      spot: "clearing",
    };
  }

  const shared = sharedEggGroups(aGroups, bGroups).filter((group) => group !== "undiscovered");
  if (shared.length === 0 || Math.random() >= 0.48) return null;
  const group = randomFrom(shared);

  switch (group) {
    case "bug":
      return {
        message: naturalTheme
          ? `${aName} and ${bName} have fallen into the same quick little rhythm while investigating the flowers.`
          : `${aName} and ${bName} are darting around one another in a strangely coordinated little pattern.`,
        approachMessage: naturalTheme
          ? `${aName} and ${bName} have both become interested in the flowers.`
          : `${aName} and ${bName} have noticed each other's quick movements.`,
        aActivity: `moving in a quick little rhythm with ${bName}`,
        bActivity: `moving in a quick little rhythm with ${aName}`,
        aEmote: "✿",
        bEmote: "✿",
        spot: naturalTheme ? "flowers" : "clearing",
      };
    case "field":
      return {
        message: `${aName} and ${bName} are following the same mysterious trail around the clearing.`,
        approachMessage: `${aName} and ${bName} have both noticed something interesting on the ground.`,
        aActivity: `following a trail with ${bName}`,
        bActivity: `following a trail with ${aName}`,
        aEmote: "👃",
        bEmote: "👃",
        spot: "clearing",
      };
    case "monster":
      return {
        message: `${aName} and ${bName} have started a friendly little contest to see who can make the more impressive stomp.`,
        approachMessage: `${aName} and ${bName} are sizing up an excellent stomping patch.`,
        aActivity: `having a stomping contest with ${bName}`,
        bActivity: `having a stomping contest with ${aName}`,
        aEmote: "💥",
        bEmote: "💥",
        spot: "clearing",
      };
    case "flying":
      return {
        message: `${aName} and ${bName} are keeping pace with one another through the breeziest part of the clearing.`,
        approachMessage: `${aName} and ${bName} are both drifting toward the open air.`,
        aActivity: `enjoying the breeze with ${bName}`,
        bActivity: `enjoying the breeze with ${aName}`,
        aEmote: "☁",
        bEmote: "☁",
        spot: "clearing",
      };
    case "fairy":
      return {
        message: `${aName} and ${bName} have turned a few tiny sparkles into an entire game.`,
        approachMessage: `${aName} and ${bName} have both noticed something shiny nearby.`,
        aActivity: `playing a sparkle game with ${bName}`,
        bActivity: `playing a sparkle game with ${aName}`,
        aEmote: "✨",
        bEmote: "✨",
        spot: naturalTheme ? "flowers" : "clearing",
      };
    case "grass":
      return {
        message: naturalTheme
          ? `${aName} and ${bName} are inspecting the plants together with surprising seriousness.`
          : `${aName} and ${bName} are comparing a couple of interesting leaves they found.`,
        approachMessage: `${aName} and ${bName} have both become interested in the nearby plants.`,
        aActivity: `inspecting plants with ${bName}`,
        bActivity: `inspecting plants with ${aName}`,
        aEmote: "🌿",
        bEmote: "🌿",
        spot: naturalTheme ? "flowers" : "clearing",
      };
    case "human-like":
      return {
        message: `${aName} and ${bName} are copying one another's poses like this has become a very serious routine.`,
        approachMessage: `${aName} and ${bName} have started mirroring one another from across the habitat.`,
        aActivity: `mirroring ${bName}'s movements`,
        bActivity: `mirroring ${aName}'s movements`,
        aEmote: "☆",
        bEmote: "☆",
        spot: theme === "training" ? "training" : "clearing",
      };
    case "mineral":
      return {
        message: `${aName} and ${bName} are arranging a few stones into a pattern that clearly makes perfect sense to them.`,
        approachMessage: `${aName} and ${bName} have found some extremely interesting stones.`,
        aActivity: `arranging stones with ${bName}`,
        bActivity: `arranging stones with ${aName}`,
        aEmote: "◆",
        bEmote: "◆",
        spot: "clearing",
      };
    case "amorphous":
      return {
        message: `${aName} and ${bName} are moving in a weirdly synchronized, almost liquid rhythm.`,
        approachMessage: `${aName} and ${bName} have started drifting toward one another.`,
        aActivity: `drifting in sync with ${bName}`,
        bActivity: `drifting in sync with ${aName}`,
        aEmote: "〰",
        bEmote: "〰",
        spot: "clearing",
      };
    case "dragon":
      return {
        message: `${aName} and ${bName} are engaged in a very dignified contest of posture and confidence.`,
        approachMessage: `${aName} and ${bName} have noticed one another and immediately become extremely dignified about it.`,
        aActivity: `having a proud little display with ${bName}`,
        bActivity: `having a proud little display with ${aName}`,
        aEmote: "◇",
        bEmote: "◇",
        spot: theme === "training" ? "training" : "clearing",
      };
    case "water1":
    case "water2":
    case "water3":
      if (waterSpot) {
        const atShore = waterSpot === "shore";
        return {
          message: atShore
            ? `${aName} and ${bName} are lingering by the shoreline together, completely absorbed by the little waves.`
            : `${aName} and ${bName} are watching ripples spread across the pond together.`,
          approachMessage: atShore
            ? `${aName} and ${bName} are wandering down toward the shoreline.`
            : `${aName} and ${bName} are wandering over toward the pond.`,
          aActivity: atShore ? `watching the waves with ${bName}` : `watching pond ripples with ${bName}`,
          bActivity: atShore ? `watching the waves with ${aName}` : `watching pond ripples with ${aName}`,
          aEmote: "≈",
          bEmote: "≈",
          spot: waterSpot,
        };
      }
      return null;
    default:
      return null;
  }
}

function pondIsProminent(theme: HabitatTheme) {
  // Camp already has a full ocean shoreline around the island, so it should
  // never pretend there is a separate pond. Lab/training scenes also do not
  // visually feature one.
  return theme === "garden" || theme === "ranch" || theme === "wild" || theme === "meadow";
}

function waterSpotForTheme(theme: HabitatTheme): "pond" | "shore" | null {
  if (theme === "camp") return "shore";
  if (pondIsProminent(theme)) return "pond";
  return null;
}

function prefersBerries(pokemon: OwnedPokemon) {
  return hasType(pokemon, "grass", "bug", "fairy", "normal");
}

function likesTraining(pokemon: OwnedPokemon) {
  return hasType(pokemon, "fighting", "electric", "steel", "rock", "dragon");
}

function likesTechnology(pokemon: OwnedPokemon) {
  return hasType(pokemon, "electric", "psychic", "steel");
}

function spotLabel(spot: HabitatSpot) {
  switch (spot) {
    case "pond": return "the pond";
    case "shore": return "the shoreline";
    case "campfire": return "the campfire";
    case "berries": return "the berry bushes";
    case "flowers": return "the flowers";
    case "monitor": return "the lab monitor";
    case "training": return "the training circle";
    case "tent": return "the tent";
    default: return "the clearing";
  }
}

function spotPoint(spot: HabitatSpot, pokemonId: string, role = 0) {
  const variant = hashString(`${pokemonId}:${spot}`) % 4;
  const points: Record<HabitatSpot, Array<{ x: number; y: number }>> = {
    pond: [
      { x: 76.5, y: 55.0 },
      { x: 81.0, y: 58.5 },
      { x: 72.5, y: 60.0 },
      { x: 79.5, y: 62.0 },
    ],
    shore: [
      { x: 84.0, y: 58.0 },
      { x: 87.0, y: 62.0 },
      { x: 82.5, y: 66.0 },
      { x: 86.0, y: 69.0 },
    ],
    campfire: [
      { x: 21.5, y: 64.5 },
      { x: 29.5, y: 64.0 },
      { x: 24.0, y: 69.0 },
      { x: 31.5, y: 68.0 },
    ],
    berries: [
      { x: 23.0, y: 44.0 },
      { x: 76.5, y: 65.0 },
      { x: 27.0, y: 47.0 },
      { x: 72.5, y: 68.0 },
    ],
    flowers: [
      { x: 31.0, y: 51.0 },
      { x: 41.0, y: 67.0 },
      { x: 66.0, y: 43.0 },
      { x: 70.0, y: 69.0 },
    ],
    monitor: [
      { x: 18.0, y: 65.0 },
      { x: 23.5, y: 66.0 },
      { x: 17.0, y: 69.0 },
      { x: 25.0, y: 70.0 },
    ],
    training: [
      { x: 45.5, y: 55.0 },
      { x: 54.5, y: 55.0 },
      { x: 48.0, y: 61.0 },
      { x: 52.0, y: 61.0 },
    ],
    tent: [
      { x: 17.0, y: 46.5 },
      { x: 22.5, y: 46.5 },
      { x: 18.8, y: 50.0 },
      { x: 24.4, y: 49.6 },
    ],
    clearing: [
      { x: 43.0, y: 52.0 },
      { x: 57.0, y: 53.0 },
      { x: 46.0, y: 63.0 },
      { x: 58.0, y: 64.0 },
    ],
  };
  return points[spot][(variant + role) % points[spot].length];
}

function describeSoloBeat(
  pokemon: OwnedPokemon,
  theme: HabitatTheme,
  isNight: boolean,
  eggGroups: string[],
): HabitatSoloBeat {
  const name = companionName(pokemon);

  if (theme === "camp" && hasType(pokemon, "fire") && Math.random() < 0.72) {
    return {
      activity: "keeping an eye on the campfire",
      emote: "🔥",
      message: `${name} is happily tending the campfire.`,
      approachMessage: `${name} is hopping over to check on the campfire.`,
      spot: "campfire",
    };
  }

  // Water activities must correspond to water that is actually visible in
  // this scene. Camp uses the island shoreline; pond themes use a real pond.
  const waterSpot = waterSpotForTheme(theme);
  if (waterSpot && hasType(pokemon, "water") && Math.random() < 0.64) {
    const atShore = waterSpot === "shore";
    return {
      activity: atShore ? "paddling around in the shallows" : "splashing around in the pond",
      emote: "💧",
      message: atShore
        ? `${name} is paddling around in the shallows by the island.`
        : `${name} is swimming around the pond.`,
      approachMessage: atShore
        ? `${name} is bouncing excitedly down toward the shoreline.`
        : `${name} is bouncing excitedly toward the pond.`,
      spot: waterSpot,
    };
  }

  if (waterSpot && hasType(pokemon, "ice") && Math.random() < 0.34) {
    const atShore = waterSpot === "shore";
    return {
      activity: atShore ? "enjoying the cool breeze by the water" : "cooling off beside the pond",
      emote: "❄",
      message: atShore
        ? `${name} is enjoying the cool breeze along the shoreline.`
        : `${name} is relaxing in the cool air beside the pond.`,
      approachMessage: atShore
        ? `${name} is wandering down toward the water's edge.`
        : `${name} is wandering over to the pond's edge.`,
      spot: waterSpot,
    };
  }

  if ((theme === "garden" || theme === "ranch") && prefersBerries(pokemon) && Math.random() < 0.58) {
    return {
      activity: "investigating the berry bushes",
      emote: "🍓",
      message: `${name} is checking the berry bushes for a snack.`,
      approachMessage: `${name} has noticed something interesting in the berry bushes.`,
      spot: "berries",
    };
  }

  if ((theme === "garden" || theme === "ranch" || theme === "wild" || theme === "meadow") && hasType(pokemon, "grass", "bug", "fairy") && Math.random() < 0.52) {
    return {
      activity: "wandering through the flowers",
      emote: hasType(pokemon, "bug") ? "✿" : "🌿",
      message: `${name} is happily wandering through the flowers.`,
      approachMessage: `${name} is making a tiny beeline for the flowers.`,
      spot: "flowers",
    };
  }

  if (theme === "lab" && likesTechnology(pokemon) && Math.random() < 0.65) {
    return {
      activity: "studying the blinking lab monitor",
      emote: hasType(pokemon, "electric") ? "⚡" : "⚙",
      message: `${name} is very seriously inspecting the lab equipment.`,
      approachMessage: `${name} is heading over to investigate the lab monitor.`,
      spot: "monitor",
    };
  }

  if (theme === "training" && likesTraining(pokemon) && Math.random() < 0.68) {
    return {
      activity: "doing little training drills",
      emote: hasType(pokemon, "fighting") ? "🥊" : "✦",
      message: `${name} is doing a few energetic drills in the training circle.`,
      approachMessage: `${name} is hopping into the training circle.`,
      spot: "training",
    };
  }

  if (hasType(pokemon, "flying") && Math.random() < 0.44) {
    return {
      activity: "fluttering over the clearing",
      emote: "☁",
      message: `${name} is fluttering in little circles over the clearing.`,
      approachMessage: `${name} is drifting toward the open clearing.`,
      spot: "clearing",
    };
  }

  if (hasType(pokemon, "ground", "rock") && Math.random() < 0.40) {
    return {
      activity: "fussing with a comfy patch of ground",
      emote: "◆",
      message: `${name} has found a very important patch of dirt to investigate.`,
      approachMessage: `${name} is wandering toward a promising patch of ground.`,
      spot: "clearing",
    };
  }

  if (isNight && hasType(pokemon, "ghost", "psychic", "dark", "fairy") && Math.random() < 0.54) {
    return {
      activity: "watching the fireflies drift by",
      emote: hasType(pokemon, "ghost") ? "👻" : "✨",
      message: `${name} is quietly watching the fireflies drift through the habitat.`,
      approachMessage: `${name} has spotted some fireflies over the clearing.`,
      spot: "clearing",
    };
  }

  if (theme === "camp" && Math.random() < 0.25) {
    return {
      activity: "getting cozy near the tent",
      emote: "💤",
      message: `${name} has found a cozy spot near the tent.`,
      approachMessage: `${name} is waddling over to the tent for a rest.`,
      spot: "tent",
    };
  }

  // Egg Group is a quieter secondary instinct layer. It gets a chance only
  // after the stronger Type + habitat rules above have declined to fire.
  if (Math.random() < 0.44) {
    const eggBeat = eggGroupSoloBeat(pokemon, eggGroups, theme, isNight);
    if (eggBeat) return eggBeat;
  }

  // When no habitat/type-specific beat fires, Nature becomes the personality
  // layer. Most of the time the companion gets a nature-flavoured idle moment;
  // otherwise we keep some generic variety.
  if (Math.random() < 0.68) {
    return natureSoloActivity(pokemon);
  }

  const activity = randomFrom(genericSoloActivities);
  return {
    activity,
    emote: Math.random() < 0.58 ? randomFrom(genericSoloEmotes) : "",
    message: `${name} is ${activity}.`,
  };
}

function describePairBeat(
  a: OwnedPokemon,
  b: OwnedPokemon,
  theme: HabitatTheme,
  isNight: boolean,
  evolutionStandings: Record<string, EvolutionStanding | null>,
  eggGroupsByPokemon: Record<string, string[]>,
): HabitatPairBeat {
  const aName = companionName(a);
  const bName = companionName(b);

  const aStanding = evolutionStandings[a.id];
  const bStanding = evolutionStandings[b.id];
  if (isJuniorStanding(aStanding) && isSeniorStanding(bStanding) && Math.random() < 0.74) {
    return mentorPairBeat(a, b, theme);
  }
  if (isJuniorStanding(bStanding) && isSeniorStanding(aStanding) && Math.random() < 0.74) {
    const beat = mentorPairBeat(b, a, theme);
    // mentorPairBeat is authored junior-first; swap the actor-specific fields so
    // they still correspond to describePairBeat(a, b).
    return {
      ...beat,
      aActivity: beat.bActivity,
      bActivity: beat.aActivity,
      aEmote: beat.bEmote,
      bEmote: beat.aEmote,
    };
  }

  if (theme === "camp" && (hasType(a, "fire") || hasType(b, "fire"))) {
    const fireFriend = hasType(a, "fire") ? a : b;
    const otherFriend = fireFriend.id === a.id ? b : a;
    const fireName = companionName(fireFriend);
    const otherName = companionName(otherFriend);
    const fireIsA = fireFriend.id === a.id;
    return {
      message: `${fireName} is roasting marshmallows with ${otherName} by the campfire.`,
      approachMessage: `${fireName} is calling ${otherName} over to the campfire.`,
      aActivity: fireIsA ? `roasting marshmallows with ${otherName}` : `sharing campfire snacks with ${fireName}`,
      bActivity: fireIsA ? `sharing campfire snacks with ${fireName}` : `roasting marshmallows with ${otherName}`,
      aEmote: fireIsA ? "🔥" : "♥",
      bEmote: fireIsA ? "♥" : "🔥",
      spot: "campfire",
    };
  }

  const pairWaterSpot = waterSpotForTheme(theme);
  if (pairWaterSpot && hasType(a, "water") && hasType(b, "water")) {
    const atShore = pairWaterSpot === "shore";
    return {
      message: atShore
        ? `${aName} and ${bName} are splashing around together in the shallows.`
        : `${aName} and ${bName} are splashing around together in the pond.`,
      approachMessage: atShore
        ? `${aName} and ${bName} are heading down to the shoreline.`
        : `${aName} and ${bName} have decided it is pond time.`,
      aActivity: `splashing around with ${bName}`,
      bActivity: `splashing around with ${aName}`,
      aEmote: "💧",
      bEmote: "💧",
      spot: pairWaterSpot,
    };
  }

  if (pairWaterSpot && (hasType(a, "water") || hasType(b, "water"))) {
    const waterFriend = hasType(a, "water") ? a : b;
    const shoreFriend = waterFriend.id === a.id ? b : a;
    const waterName = companionName(waterFriend);
    const shoreName = companionName(shoreFriend);
    const shoreIsFire = hasType(shoreFriend, "fire");
    const waterIsA = waterFriend.id === a.id;
    const atShore = pairWaterSpot === "shore";
    return {
      message: shoreIsFire
        ? `${waterName} is splashing around while ${shoreName} watches from a very safe distance.`
        : atShore
          ? `${waterName} is playing in the shallows while ${shoreName} watches from the shoreline.`
          : `${waterName} is showing off in the pond while ${shoreName} watches from the shore.`,
      approachMessage: atShore
        ? `${waterName} is heading down to the shoreline and ${shoreName} is following along.`
        : `${waterName} is heading for the pond and ${shoreName} is following along.`,
      aActivity: waterIsA
        ? (atShore ? `playing in the shallows while ${shoreName} watches` : `swimming while ${shoreName} watches`)
        : (atShore ? `watching ${waterName} from the shoreline` : `watching ${waterName} from the pond's edge`),
      bActivity: waterIsA
        ? (atShore ? `watching ${waterName} from the shoreline` : `watching ${waterName} from the pond's edge`)
        : (atShore ? `playing in the shallows while ${shoreName} watches` : `swimming while ${shoreName} watches`),
      aEmote: waterIsA ? "💧" : shoreIsFire ? "🔥" : "♪",
      bEmote: waterIsA ? shoreIsFire ? "🔥" : "♪" : "💧",
      spot: pairWaterSpot,
    };
  }

  if ((theme === "garden" || theme === "ranch") && (prefersBerries(a) || prefersBerries(b))) {
    return {
      message: `${aName} and ${bName} are sharing berries near the bushes.`,
      approachMessage: `${aName} and ${bName} have both noticed the berry bushes.`,
      aActivity: `sharing berries with ${bName}`,
      bActivity: `sharing berries with ${aName}`,
      aEmote: "🍓",
      bEmote: "🍓",
      spot: "berries",
    };
  }

  if ((theme === "garden" || theme === "ranch" || theme === "wild" || theme === "meadow") && (hasType(a, "grass", "bug", "fairy") || hasType(b, "grass", "bug", "fairy"))) {
    return {
      message: `${aName} and ${bName} are wandering through the flowers together.`,
      approachMessage: `${aName} and ${bName} are meeting over by the flowers.`,
      aActivity: `exploring the flowers with ${bName}`,
      bActivity: `exploring the flowers with ${aName}`,
      aEmote: hasType(a, "bug") ? "✿" : "🌿",
      bEmote: hasType(b, "bug") ? "✿" : "🌿",
      spot: "flowers",
    };
  }

  if (theme === "training" && (likesTraining(a) || likesTraining(b))) {
    return {
      message: `${aName} and ${bName} are running little drills together in the training circle.`,
      approachMessage: `${aName} and ${bName} are heading over for a quick training session.`,
      aActivity: `running drills with ${bName}`,
      bActivity: `running drills with ${aName}`,
      aEmote: hasType(a, "fighting") ? "🥊" : "✦",
      bEmote: hasType(b, "fighting") ? "🥊" : "✦",
      spot: "training",
    };
  }

  if (theme === "lab" && (likesTechnology(a) || likesTechnology(b))) {
    return {
      message: `${aName} and ${bName} are studying the blinking lab monitor together.`,
      approachMessage: `${aName} and ${bName} are waddling over to inspect the lab monitor.`,
      aActivity: `studying the lab monitor with ${bName}`,
      bActivity: `studying the lab monitor with ${aName}`,
      aEmote: hasType(a, "electric") ? "⚡" : "⚙",
      bEmote: hasType(b, "electric") ? "⚡" : "⚙",
      spot: "monitor",
    };
  }

  if (hasType(a, "electric") && hasType(b, "electric")) {
    return {
      message: `${aName} and ${bName} are trading tiny harmless sparks back and forth.`,
      approachMessage: `${aName} and ${bName} are getting suspiciously excited about something.`,
      aActivity: `playing a spark game with ${bName}`,
      bActivity: `playing a spark game with ${aName}`,
      aEmote: "⚡",
      bEmote: "⚡",
      spot: "clearing",
    };
  }

  if (hasType(a, "flying") && hasType(b, "flying")) {
    return {
      message: `${aName} and ${bName} are fluttering around the clearing together.`,
      approachMessage: `${aName} and ${bName} are drifting toward the open clearing.`,
      aActivity: `fluttering around with ${bName}`,
      bActivity: `fluttering around with ${aName}`,
      aEmote: "☁",
      bEmote: "☁",
      spot: "clearing",
    };
  }

  if (isNight && (hasType(a, "ghost", "dark", "psychic", "fairy") || hasType(b, "ghost", "dark", "psychic", "fairy"))) {
    return {
      message: `${aName} and ${bName} are watching the fireflies together.`,
      approachMessage: `${aName} and ${bName} have spotted something glowing over the clearing.`,
      aActivity: `watching fireflies with ${bName}`,
      bActivity: `watching fireflies with ${aName}`,
      aEmote: hasType(a, "ghost") ? "👻" : "✨",
      bEmote: hasType(b, "ghost") ? "👻" : "✨",
      spot: "clearing",
    };
  }

  if (hasType(a, "ground", "rock") && hasType(b, "ground", "rock")) {
    return {
      message: `${aName} and ${bName} are arranging stones into a tiny, extremely important pile.`,
      approachMessage: `${aName} and ${bName} have found an interesting patch of ground.`,
      aActivity: `stacking little stones with ${bName}`,
      bActivity: `stacking little stones with ${aName}`,
      aEmote: "◆",
      bEmote: "◆",
      spot: "clearing",
    };
  }

  // Shared Egg Groups provide a softer species-instinct connection after
  // explicit Type/habitat behaviors but before generic Nature chemistry.
  const eggPair = eggGroupPairBeat(
    a,
    b,
    eggGroupsByPokemon[a.id] ?? [],
    eggGroupsByPokemon[b.id] ?? [],
    theme,
  );
  if (eggPair) return eggPair;

  // Peer interactions also inherit some personality from Nature even when no
  // special type/habitat activity wins this cycle.
  const aTemperament = natureTemperament(a);
  const bTemperament = natureTemperament(b);
  if (aTemperament === "playful" && bTemperament === "playful") {
    return {
      message: `${aName} and ${bName} have started an extremely energetic game with rules that keep changing.`,
      approachMessage: `${aName} and ${bName} have both had the exact same terrible idea.`,
      aActivity: `playing a chaotic little game with ${bName}`,
      bActivity: `playing a chaotic little game with ${aName}`,
      aEmote: "♪",
      bEmote: "♪",
      spot: "clearing",
    };
  }

  if (aTemperament === "gentle" || bTemperament === "gentle") {
    const gentle = aTemperament === "gentle" ? a : b;
    const friend = gentle.id === a.id ? b : a;
    const gentleName = companionName(gentle);
    const friendName = companionName(friend);
    const gentleIsA = gentle.id === a.id;
    return {
      message: `${gentleName} is quietly making sure ${friendName} is doing alright.`,
      approachMessage: `${gentleName} is wandering over to check on ${friendName}.`,
      aActivity: gentleIsA ? `keeping ${friendName} company` : `relaxing with ${gentleName}`,
      bActivity: gentleIsA ? `relaxing with ${gentleName}` : `keeping ${friendName} company`,
      aEmote: gentleIsA ? "♥" : "♪",
      bEmote: gentleIsA ? "♪" : "♥",
      spot: "clearing",
    };
  }

  if ((aTemperament === "serious" || aTemperament === "curious") &&
      (bTemperament === "serious" || bTemperament === "curious")) {
    return {
      message: `${aName} and ${bName} appear to be having an incredibly important discussion.`,
      approachMessage: `${aName} and ${bName} have noticed one another and immediately become very serious about it.`,
      aActivity: `having a very serious conversation with ${bName}`,
      bActivity: `having a very serious conversation with ${aName}`,
      aEmote: "💡",
      bEmote: "💡",
      spot: "clearing",
    };
  }

  if ((aTemperament === "shy" && bTemperament === "bold") ||
      (bTemperament === "shy" && aTemperament === "bold")) {
    const shy = aTemperament === "shy" ? a : b;
    const bold = shy.id === a.id ? b : a;
    const shyName = companionName(shy);
    const boldName = companionName(bold);
    const shyIsA = shy.id === a.id;
    return {
      message: `${boldName} is confidently showing ${shyName} around while ${shyName} follows a little cautiously.`,
      approachMessage: `${boldName} has decided ${shyName} should come along.`,
      aActivity: shyIsA ? `cautiously following ${boldName}` : `showing ${shyName} around`,
      bActivity: shyIsA ? `showing ${shyName} around` : `cautiously following ${boldName}`,
      aEmote: shyIsA ? "…" : "💪",
      bEmote: shyIsA ? "💪" : "…",
      spot: "clearing",
    };
  }

  const phrase = randomFrom(genericPairMoments);
  const emote = randomFrom(genericPairEmotes);
  return {
    message: phrase(aName, bName),
    approachMessage: `${aName} is wandering over to spend some time with ${bName}.`,
    aActivity: `spending time with ${bName}`,
    bActivity: `spending time with ${aName}`,
    aEmote: emote,
    bEmote: emote,
  };
}

export function HabitatPage({
  ownedPokemon,
  places,
  onEditPokemon,
}: HabitatPageProps) {
  const sources = useMemo<HabitatSource[]>(() => {
    const party = ownedPokemon
      .filter((pokemon) => pokemon.status === "party")
      .sort((a, b) => (a.partySlot ?? 99) - (b.partySlot ?? 99));
    const reserves = ownedPokemon.filter((pokemon) => pokemon.status === "reserve");
    const result: HabitatSource[] = [
      {
        key: "party",
        label: "Travelling camp",
        subtitle: "Your current party",
        kind: "party",
        pokemon: party,
      },
    ];

    for (const place of [...places].sort((a, b) => a.name.localeCompare(b.name))) {
      result.push({
        key: `place:${place.id}`,
        label: place.name,
        subtitle: [place.locality, place.region].filter(Boolean).join(", "),
        kind: place.kind,
        pokemon: reserves.filter((pokemon) => pokemon.locationId === place.id),
      });
    }

    const unassigned = reserves.filter((pokemon) => !pokemon.locationId);
    if (unassigned.length > 0) {
      result.push({
        key: "unassigned",
        label: "Awaiting a home",
        subtitle: "Unassigned reserve companions",
        kind: "unassigned",
        pokemon: unassigned,
      });
    }

    return result;
  }, [ownedPokemon, places]);

  const firstPopulatedSource = sources.find((source) => source.pokemon.length > 0);
  const [selectedSourceKey, setSelectedSourceKey] = useState(
    firstPopulatedSource?.key ?? sources[0]?.key ?? "party",
  );
  const [actors, setActors] = useState<Record<string, HabitatActorState>>({});
  const [evolutionStandings, setEvolutionStandings] = useState<Record<string, EvolutionStanding | null>>({});
  const [eggGroupsByPokemon, setEggGroupsByPokemon] = useState<Record<string, string[]>>({});
  const [selectedPokemonId, setSelectedPokemonId] = useState<string | null>(null);
  const [ambientMessage, setAmbientMessage] = useState(
    "Everyone is settling into the area.",
  );
  const [isPaused, setIsPaused] = useState(false);
  const movementTimerRef = useRef<number | null>(null);
  const actorClocksRef = useRef<Record<string, HabitatActorClock>>({});
  const actorsRef = useRef<Record<string, HabitatActorState>>({});
  const pendingInteractionsRef = useRef<PendingHabitatInteraction[]>([]);
  const nextSceneEventAtRef = useRef(0);

  useEffect(() => {
    actorsRef.current = actors;
  }, [actors]);

  const selectedSource =
    sources.find((source) => source.key === selectedSourceKey) ??
    firstPopulatedSource ??
    sources[0];
  const scenePokemon = selectedSource?.pokemon ?? [];
  const selectedPokemon = scenePokemon.find(
    (pokemon) => pokemon.id === selectedPokemonId,
  );
  const theme = getTheme(selectedSource?.kind ?? "party");
  const isNight = new Date().getHours() < 6 || new Date().getHours() >= 19;
  const sceneryStyle = {
    "--pelago-sheet": `url("${habitatAsset("RPGpack_sheet.png")}")`,
    "--pelago-island": `url("${habitatAsset("rpgTile000.png")}")`,
    "--pelago-pond": `url("${habitatAsset("rpgTile004.png")}")`,
  } as CSSProperties;

  const clearMovementTimer = () => {
    if (movementTimerRef.current !== null) {
      window.clearTimeout(movementTimerRef.current);
      movementTimerRef.current = null;
    }
  };

  useEffect(() => () => clearMovementTimer(), []);

  useEffect(() => {
    if (!sources.some((source) => source.key === selectedSourceKey)) {
      setSelectedSourceKey(firstPopulatedSource?.key ?? sources[0]?.key ?? "party");
    }
  }, [firstPopulatedSource?.key, selectedSourceKey, sources]);

  const pokemonIdentity = scenePokemon.map((pokemon) => `${pokemon.id}:${pokemon.speciesApiName}:${pokemon.pokemonId}`).join("|");

  useEffect(() => {
    let cancelled = false;
    if (scenePokemon.length === 0) {
      setEvolutionStandings({});
      setEggGroupsByPokemon({});
      return () => { cancelled = true; };
    }

    Promise.all(
      scenePokemon.map(async (pokemon) => {
        const [standing, eggGroups] = await Promise.all([
          fetchEvolutionStanding(pokemon),
          fetchEggGroups(pokemon),
        ]);
        return [pokemon.id, standing, eggGroups] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setEvolutionStandings(Object.fromEntries(entries.map(([id, standing]) => [id, standing])));
      setEggGroupsByPokemon(Object.fromEntries(entries.map(([id, _standing, eggGroups]) => [id, eggGroups])));
    });

    return () => { cancelled = true; };
  }, [pokemonIdentity]);

  useEffect(() => {
    clearMovementTimer();
    const now = Date.now();
    const next: Record<string, HabitatActorState> = {};
    const clocks: Record<string, HabitatActorClock> = {};
    scenePokemon.forEach((pokemon, index) => {
      next[pokemon.id] = initialActorState(pokemon, index);
      clocks[pokemon.id] = initialActorClock(pokemon, now);
    });
    actorClocksRef.current = clocks;
    actorsRef.current = next;
    pendingInteractionsRef.current = [];
    // Even if a Pokémon happens to have an early clock, give the whole scene a
    // few calm seconds after opening before the first narrated event begins.
    nextSceneEventAtRef.current = now + randomMs(7, 12);
    setActors(next);
    setSelectedPokemonId(null);
    setAmbientMessage(
      scenePokemon.length > 0
        ? `${scenePokemon.length} companion${scenePokemon.length === 1 ? " is" : "s are"} enjoying some free time.`
        : "Nobody is spending time here right now.",
    );
  }, [pokemonIdentity, selectedSourceKey]);

  const releaseExpiredActors = (now: number) => {
    setActors((current) => {
      let changed = false;
      const next = { ...current };
      for (const pokemon of scenePokemon) {
        const clock = actorClocksRef.current[pokemon.id];
        if (!clock || clock.busyUntil <= 0 || now < clock.busyUntil) continue;
        clock.busyUntil = 0;
        const actor = next[pokemon.id];
        if (!actor) continue;
        next[pokemon.id] = {
          ...actor,
          activity: "relaxing and enjoying the habitat",
          emote: "",
          isInteracting: false,
          isMoving: false,
          moveDurationMs: 2800,
        };
        changed = true;
      }
      return changed ? next : current;
    });
  };

  const scheduleAfterSolo = (pokemon: OwnedPokemon, now: number) => {
    const clock = actorClocksRef.current[pokemon.id] ?? initialActorClock(pokemon, now);
    const hold = randomMs(9, 14);
    clock.busyUntil = now + hold;
    clock.nextSoloAt = clock.busyUntil + randomMs(18, 32);
    clock.nextSocialAt = Math.max(clock.nextSocialAt, clock.busyUntil + randomMs(10, 24));
    clock.nextWanderAt = clock.busyUntil + randomMs(3.8, 7.2);
    actorClocksRef.current[pokemon.id] = clock;
  };

  const scheduleAfterSocial = (pokemon: OwnedPokemon, now: number) => {
    const clock = actorClocksRef.current[pokemon.id] ?? initialActorClock(pokemon, now);
    const hold = randomMs(11, 17);
    clock.busyUntil = now + hold;
    // Social moments are deliberately the rarest thing an individual can do.
    // A Pokémon that just socialised should not immediately become the star of
    // the next interaction as soon as the global scheduler ticks again.
    clock.nextSocialAt = clock.busyUntil + randomMs(28, 48);
    clock.nextSoloAt = Math.max(clock.nextSoloAt, clock.busyUntil + randomMs(14, 28));
    clock.nextWanderAt = clock.busyUntil + randomMs(4.5, 8.5);
    actorClocksRef.current[pokemon.id] = clock;
  };

  const scheduleAfterWander = (
    pokemon: OwnedPokemon,
    now: number,
    travelDurationMs: number,
  ) => {
    const clock = actorClocksRef.current[pokemon.id] ?? initialActorClock(pokemon, now);
    // Even a casual stroll counts as "currently occupied" while the Pokémon is
    // physically moving. That prevents a social event from grabbing it midway
    // through the walk.
    clock.busyUntil = now + travelDurationMs + 250;
    clock.nextWanderAt = clock.busyUntil + randomMs(1.8, 4.2);
    actorClocksRef.current[pokemon.id] = clock;
  };

  const isAvailableForMajorEvent = (pokemon: OwnedPokemon, now: number) => {
    const clock = actorClocksRef.current[pokemon.id];
    const actor = actorsRef.current[pokemon.id];
    if (!clock || now < clock.busyUntil) return false;
    if (actor?.isMoving || actor?.isInteracting) return false;
    return true;
  };

  const isPokemonQueued = (pokemonId: string) =>
    pendingInteractionsRef.current.some(
      (pending) =>
        pending.firstId === pokemonId || pending.secondId === pokemonId,
    );

  const queuePairInteraction = (
    first: OwnedPokemon,
    second: OwnedPokemon,
    now: number,
    forced = false,
  ) => {
    if (first.id === second.id) return false;
    if (isPokemonQueued(first.id) || isPokemonQueued(second.id)) return false;
    if (pendingInteractionsRef.current.length >= 2) return false;

    pendingInteractionsRef.current.push({
      id: `${first.id}:${second.id}:${now}`,
      firstId: first.id,
      secondId: second.id,
      queuedAt: now,
      forced,
    });

    // Once an interaction has been planned, these Pokémon finish whatever
    // they're doing now but are not allowed to begin another wander/solo event
    // before meeting each other.
    nextSceneEventAtRef.current = Math.max(
      nextSceneEventAtRef.current,
      now + randomMs(4, 7),
    );
    return true;
  };

  const startPairEvent = (
    first: OwnedPokemon,
    second: OwnedPokemon,
    now: number,
  ) => {
    clearMovementTimer();

    const firstIndex = scenePokemon.findIndex((pokemon) => pokemon.id === first.id);
    const secondIndex = scenePokemon.findIndex((pokemon) => pokemon.id === second.id);
    const pairBeat = describePairBeat(first, second, theme, isNight, evolutionStandings, eggGroupsByPokemon);
    const firstTarget = pairBeat.spot ? spotPoint(pairBeat.spot, first.id, 0) : null;
    const secondTarget = pairBeat.spot ? spotPoint(pairBeat.spot, second.id, 1) : null;

    const timingFirst = actorsRef.current[first.id] ?? initialActorState(first, Math.max(0, firstIndex));
    const timingSecond = actorsRef.current[second.id] ?? initialActorState(second, Math.max(0, secondIndex));
    const timingMeetingX = (timingFirst.x + timingSecond.x) / 2;
    const timingMeetingY = (timingFirst.y + timingSecond.y) / 2;
    const [timingFirstPoint, timingSecondPoint] = separatePairPoints(
      firstTarget ?? { x: timingMeetingX - 3.4, y: timingMeetingY + 0.45 },
      secondTarget ?? { x: timingMeetingX + 3.4, y: timingMeetingY - 0.45 },
    );
    const travelDurationMs = Math.max(
      interactionTravelDurationMs(timingFirst, timingFirstPoint),
      interactionTravelDurationMs(timingSecond, timingSecondPoint),
    );

    scheduleAfterSocial(first, now);
    scheduleAfterSocial(second, now);
    nextSceneEventAtRef.current = now + randomMs(10, 16);

    setActors((current) => {
      const firstPrevious = current[first.id] ?? initialActorState(first, Math.max(0, firstIndex));
      const secondPrevious = current[second.id] ?? initialActorState(second, Math.max(0, secondIndex));
      const meetingX = (firstPrevious.x + secondPrevious.x) / 2;
      const meetingY = (firstPrevious.y + secondPrevious.y) / 2;
      const next = { ...current };

      const [firstPoint, secondPoint] = separatePairPoints(
        firstTarget ?? { x: meetingX - 3.4, y: meetingY + 0.45 },
        secondTarget ?? { x: meetingX + 3.4, y: meetingY - 0.45 },
      );

      next[first.id] = {
        ...firstPrevious,
        x: firstPoint.x,
        y: firstPoint.y,
        facing: firstPoint.x === firstPrevious.x ? firstPrevious.facing : firstPoint.x > firstPrevious.x ? 1 : -1,
        activity: pairBeat.spot
          ? `heading toward ${spotLabel(pairBeat.spot)} with ${companionName(second)}`
          : `heading over to ${companionName(second)}`,
        emote: "!",
        isInteracting: false,
        isMoving: Math.abs(firstPoint.x - firstPrevious.x) > 0.05 || Math.abs(firstPoint.y - firstPrevious.y) > 0.05,
        moveDurationMs: travelDurationMs,
      };

      next[second.id] = {
        ...secondPrevious,
        x: secondPoint.x,
        y: secondPoint.y,
        facing: secondPoint.x === secondPrevious.x ? secondPrevious.facing : secondPoint.x > secondPrevious.x ? 1 : -1,
        activity: pairBeat.spot
          ? `heading toward ${spotLabel(pairBeat.spot)} with ${companionName(first)}`
          : `heading over to ${companionName(first)}`,
        emote: "!",
        isInteracting: false,
        isMoving: Math.abs(secondPoint.x - secondPrevious.x) > 0.05 || Math.abs(secondPoint.y - secondPrevious.y) > 0.05,
        moveDurationMs: travelDurationMs,
      };
      return next;
    });

    setAmbientMessage(pairBeat.approachMessage);
    movementTimerRef.current = window.setTimeout(() => {
      setActors((current) => {
        const next = { ...current };
        const firstActor = next[first.id];
        const secondActor = next[second.id];
        if (firstActor) {
          next[first.id] = {
            ...firstActor,
            activity: pairBeat.aActivity,
            emote: pairBeat.aEmote,
            isMoving: false,
            isInteracting: true,
            facing: firstActor.x <= (secondActor?.x ?? firstActor.x) ? 1 : -1,
          };
        }
        if (secondActor) {
          next[second.id] = {
            ...secondActor,
            activity: pairBeat.bActivity,
            emote: pairBeat.bEmote,
            isMoving: false,
            isInteracting: true,
            facing: secondActor.x <= (firstActor?.x ?? secondActor.x) ? 1 : -1,
          };
        }
        return next;
      });
      setAmbientMessage(pairBeat.message);
      movementTimerRef.current = null;
    }, travelDurationMs + 120);
  };

  const tryStartQueuedInteraction = (now: number) => {
    if (movementTimerRef.current !== null) return false;

    // Keep one narrated social moment at a time. Other Pokémon may still
    // quietly wander while a pair is chatting/playing.
    const socialMomentActive = Object.values(actorsRef.current).some(
      (actor) => actor.isInteracting,
    );
    if (socialMomentActive) return false;

    // Drop stale entries if a Pokémon moved to another Habitat/source.
    pendingInteractionsRef.current = pendingInteractionsRef.current.filter(
      (pending) =>
        scenePokemon.some((pokemon) => pokemon.id === pending.firstId) &&
        scenePokemon.some((pokemon) => pokemon.id === pending.secondId),
    );

    for (let index = 0; index < pendingInteractionsRef.current.length; index += 1) {
      const pending = pendingInteractionsRef.current[index];
      const first = scenePokemon.find((pokemon) => pokemon.id === pending.firstId);
      const second = scenePokemon.find((pokemon) => pokemon.id === pending.secondId);
      if (!first || !second) continue;

      if (
        isAvailableForMajorEvent(first, now) &&
        isAvailableForMajorEvent(second, now)
      ) {
        pendingInteractionsRef.current.splice(index, 1);
        startPairEvent(first, second, now);
        return true;
      }
    }

    return false;
  };

  const startSoloEvent = (focus: OwnedPokemon, now: number) => {
    clearMovementTimer();

    const focusIndex = scenePokemon.findIndex((pokemon) => pokemon.id === focus.id);
    const soloBeat = describeSoloBeat(focus, theme, isNight, eggGroupsByPokemon[focus.id] ?? []);
    const focusTarget = soloBeat.spot ? spotPoint(soloBeat.spot, focus.id) : null;
    const timingActor = actorsRef.current[focus.id] ?? initialActorState(focus, Math.max(0, focusIndex));
    const timingTarget =
      focusTarget ?? chooseSpacedWander(timingActor, actorsRef.current, focus.id);
    const travelDurationMs = interactionTravelDurationMs(timingActor, timingTarget);

    scheduleAfterSolo(focus, now);
    nextSceneEventAtRef.current = now + randomMs(8, 14);

    setActors((current) => {
      const previous = current[focus.id] ?? initialActorState(focus, Math.max(0, focusIndex));
      const position = focusTarget ?? timingTarget;
      const isMoving =
        Math.abs(position.x - previous.x) > 0.05 || Math.abs(position.y - previous.y) > 0.05;
      return {
        ...current,
        [focus.id]: {
          ...previous,
          ...position,
          facing: position.x === previous.x ? previous.facing : position.x > previous.x ? 1 : -1,
          activity: focusTarget && soloBeat.spot
            ? `heading toward ${spotLabel(soloBeat.spot)}`
            : soloBeat.activity,
          emote: focusTarget ? "!" : soloBeat.emote,
          isInteracting: false,
          isMoving,
          moveDurationMs: travelDurationMs,
        },
      };
    });

    if (focusTarget && soloBeat.spot) {
      setAmbientMessage(
        soloBeat.approachMessage ?? `${companionName(focus)} is heading toward ${spotLabel(soloBeat.spot)}.`,
      );
      movementTimerRef.current = window.setTimeout(() => {
        setActors((current) => {
          const actor = current[focus.id];
          if (!actor) return current;
          return {
            ...current,
            [focus.id]: {
              ...actor,
              activity: soloBeat.activity,
              emote: soloBeat.emote,
              isMoving: false,
              isInteracting: false,
            },
          };
        });
        setAmbientMessage(soloBeat.message);
        movementTimerRef.current = null;
      }, travelDurationMs + 120);
    } else {
      setAmbientMessage(soloBeat.message);
      clearMovementTimer();
      movementTimerRef.current = window.setTimeout(() => {
        setActors((current) => {
          const actor = current[focus.id];
          if (!actor) return current;
          return {
            ...current,
            [focus.id]: { ...actor, isMoving: false },
          };
        });
        movementTimerRef.current = null;
      }, travelDurationMs + 120);
    }
  };

  const startQuietWander = (pokemon: OwnedPokemon, now: number) => {
    const index = scenePokemon.findIndex((candidate) => candidate.id === pokemon.id);
    const previousForTiming =
      actorsRef.current[pokemon.id] ?? initialActorState(pokemon, Math.max(0, index));
    const wanderActivity = randomFrom(ambientWanderActivities);
    const minimumTravel =
      wanderActivity === "taking a little stroll" ||
      wanderActivity === "doing a little lap around the clearing"
        ? 11
        : 7;
    const position = chooseSpacedWander(
      previousForTiming,
      actorsRef.current,
      pokemon.id,
      minimumTravel,
    );
    const actuallyMoved =
      Math.abs(position.x - previousForTiming.x) > 0.05 ||
      Math.abs(position.y - previousForTiming.y) > 0.05;

    if (!actuallyMoved) {
      const clock = actorClocksRef.current[pokemon.id] ?? initialActorClock(pokemon, now);
      clock.nextWanderAt = now + randomMs(1.8, 3.6);
      actorClocksRef.current[pokemon.id] = clock;
      return;
    }

    const travelDurationMs = ambientTravelDurationMs(previousForTiming, position);
    scheduleAfterWander(pokemon, now, travelDurationMs);

    setActors((current) => {
      const previous = current[pokemon.id] ?? previousForTiming;
      return {
        ...current,
        [pokemon.id]: {
          ...previous,
          ...position,
          facing: position.x === previous.x ? previous.facing : position.x > previous.x ? 1 : -1,
          activity: wanderActivity,
          emote: "",
          isInteracting: false,
          isMoving: true,
          moveDurationMs: travelDurationMs,
        },
      };
    });

    // No global timer here. Each Pokémon's own busyUntil ends this little walk,
    // so several companions can casually drift around at the same time.
  };

  const runHabitatClock = (forceInteraction = false) => {
    if (scenePokemon.length === 0) return;
    const now = Date.now();
    releaseExpiredActors(now);

    // A planned interaction gets first dibs as soon as its two participants
    // have finished whatever they were already doing.
    if (tryStartQueuedInteraction(now)) return;

    if (forceInteraction) {
      const candidates = scenePokemon.filter(
        (pokemon) => !isPokemonQueued(pokemon.id),
      );

      if (candidates.length < 2) {
        setAmbientMessage(
          "The others already have plans lined up. Give them a moment.",
        );
        return;
      }

      const first = randomFrom(candidates);
      const second = randomFrom(
        candidates.filter((pokemon) => pokemon.id !== first.id),
      );

      const canStartNow =
        movementTimerRef.current === null &&
        !Object.values(actorsRef.current).some((actor) => actor.isInteracting) &&
        isAvailableForMajorEvent(first, now) &&
        isAvailableForMajorEvent(second, now);

      if (canStartNow) {
        startPairEvent(first, second, now);
      } else if (queuePairInteraction(first, second, now, true)) {
        setAmbientMessage(
          `${companionName(first)} and ${companionName(second)} will spend some time together once they're both free.`,
        );
      } else {
        setAmbientMessage(
          "There are already a couple of interactions waiting to happen.",
        );
      }
      return;
    }

    // While a narrated Pokémon is still physically travelling toward a prop,
    // don't launch another major event. Quiet individual strolls remain
    // independent from this timer.
    if (movementTimerRef.current !== null) return;

    const socialReady = scenePokemon.filter((pokemon) => {
      const clock = actorClocksRef.current[pokemon.id];
      return (
        clock &&
        now >= clock.nextSocialAt &&
        !isPokemonQueued(pokemon.id)
      );
    });

    const soloEligible = scenePokemon.filter((pokemon) => {
      const clock = actorClocksRef.current[pokemon.id];
      return (
        clock &&
        now >= clock.nextSoloAt &&
        !isPokemonQueued(pokemon.id) &&
        isAvailableForMajorEvent(pokemon, now)
      );
    });

    if (now >= nextSceneEventAtRef.current) {
      if (socialReady.length >= 2 && Math.random() < 0.62) {
        let first = randomFrom(socialReady);
        let second = randomFrom(
          socialReady.filter((pokemon) => pokemon.id !== first.id),
        );

        const mentorPairs: Array<[OwnedPokemon, OwnedPokemon]> = [];
        for (const junior of socialReady) {
          if (!isJuniorStanding(evolutionStandings[junior.id])) continue;
          for (const senior of socialReady) {
            if (junior.id === senior.id) continue;
            if (isSeniorStanding(evolutionStandings[senior.id])) {
              mentorPairs.push([junior, senior]);
            }
          }
        }

        if (mentorPairs.length > 0 && Math.random() < 0.42) {
          [first, second] = randomFrom(mentorPairs);
        }

        const canStartNow =
          !Object.values(actorsRef.current).some((actor) => actor.isInteracting) &&
          isAvailableForMajorEvent(first, now) &&
          isAvailableForMajorEvent(second, now);

        if (canStartNow) {
          startPairEvent(first, second, now);
        } else {
          queuePairInteraction(first, second, now, false);
        }
        return;
      }

      if (soloEligible.length > 0) {
        startSoloEvent(randomFrom(soloEligible), now);
        return;
      }

      nextSceneEventAtRef.current = now + randomMs(4, 8);
    }

    // Pokémon with a social interaction queued finish their current activity,
    // then wait for their partner instead of starting something new.
    const wanderEligible = scenePokemon.filter((pokemon) => {
      const clock = actorClocksRef.current[pokemon.id];
      const actor = actorsRef.current[pokemon.id];
      return (
        clock &&
        now >= clock.nextWanderAt &&
        now >= clock.busyUntil &&
        !isPokemonQueued(pokemon.id) &&
        !actor?.isMoving &&
        !actor?.isInteracting
      );
    });

    if (wanderEligible.length > 0) {
      const pool = [...wanderEligible];
      const wanderCount =
        pool.length >= 4
          ? (Math.random() < 0.52 ? 2 : 1)
          : (Math.random() < 0.28 ? Math.min(2, pool.length) : 1);

      for (let i = 0; i < wanderCount && pool.length > 0; i += 1) {
        const chosen = randomFrom(pool);
        startQuietWander(chosen, now);
        const index = pool.findIndex((pokemon) => pokemon.id === chosen.id);
        if (index >= 0) pool.splice(index, 1);
      }
    }
  };

  useEffect(() => {
    if (isPaused || scenePokemon.length === 0) return;
    // This is only a lightweight scheduler heartbeat. It does NOT mean an event
    // happens every ~1.6 seconds; the individual Pokémon clocks still decide whether
    // anyone actually does something.
    const interval = window.setInterval(() => runHabitatClock(false), 1600);
    return () => window.clearInterval(interval);
  }, [isPaused, pokemonIdentity, selectedSourceKey, theme, isNight, evolutionStandings, eggGroupsByPokemon]);

  return (
    <section className="habitat-page">
      <header className="collection-page-header habitat-page-header">
        <div>
          <span className="section-kicker">A little life between adventures</span>
          <h1>Pokémon Habitat</h1>
          <p>
            Watch your companions wander around, relax, and spend time with one another.
          </p>
        </div>
        <div className="habitat-header-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => setIsPaused((value) => !value)}
          >
            {isPaused ? "▶ Resume" : "Ⅱ Pause"}
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => runHabitatClock(true)}
            disabled={scenePokemon.length < 2}
          >
            <span>✦</span>
            Encourage interaction
          </button>
        </div>
      </header>

      <div className="habitat-source-strip" role="tablist" aria-label="Habitat location">
        {sources.map((source) => (
          <button
            className={selectedSource?.key === source.key ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={selectedSource?.key === source.key}
            onClick={() => setSelectedSourceKey(source.key)}
            key={source.key}
          >
            <span>{source.kind === "party" ? "⛺" : source.kind === "laboratory" ? "⚗" : source.kind === "ranch" ? "♧" : source.kind === "gym" ? "△" : source.kind === "home" ? "⌂" : "◇"}</span>
            <strong>{source.label}</strong>
            <small>{source.pokemon.length}</small>
          </button>
        ))}
      </div>

      <div className="habitat-layout">
        <div className={`habitat-stage habitat-theme-${theme} ${isNight ? "is-night" : "is-day"} ${isPaused ? "is-paused" : ""}`} style={sceneryStyle}>
          <div className="pelago-ocean-layer" aria-hidden="true" />
          <div className="pelago-sky-light" aria-hidden="true" />
          <div className="pelago-cloud pelago-cloud-one" aria-hidden="true"><i /><b /></div>
          <div className="pelago-cloud pelago-cloud-two" aria-hidden="true"><i /><b /></div>

          <div className="pelago-island-layer" aria-hidden="true">
            <div className="pelago-island-shadow" />
            <div className="pelago-island-art" />
            <div className="pelago-island-highlight" />
          </div>

          <div className="pelago-tree-asset pelago-tree-one" aria-hidden="true" />
          <div className="pelago-tree-asset pelago-tree-two" aria-hidden="true" />
          <div className="pelago-tree-asset pelago-tree-three" aria-hidden="true" />
          <div className="pelago-fence-asset pelago-fence-one" aria-hidden="true" />
          <div className="pelago-fence-asset pelago-fence-two" aria-hidden="true" />
          {pondIsProminent(theme) && <div className="pelago-pond-asset" aria-hidden="true"><i /><b /></div>}

          <div className="pelago-flower flower-a" aria-hidden="true" />
          <div className="pelago-flower flower-b" aria-hidden="true" />
          <div className="pelago-flower flower-c" aria-hidden="true" />
          <div className="pelago-flower flower-d" aria-hidden="true" />
          <div className="pelago-grass-tuft grass-a" aria-hidden="true" />
          <div className="pelago-grass-tuft grass-b" aria-hidden="true" />
          <div className="pelago-grass-tuft grass-c" aria-hidden="true" />

          {theme === "camp" && (
            <div className="pelago-camp-props" aria-hidden="true">
              <div className="pelago-pixel-tent"><i /><b /></div>
              <div className="pelago-campfire"><i /><b /><em /></div>
              <div className="pelago-log log-a" />
              <div className="pelago-log log-b" />
            </div>
          )}
          {theme === "lab" && (
            <div className="pelago-lab-props" aria-hidden="true">
              <div className="pelago-lab-hut"><span>PKMN</span><i /></div>
              <div className="pelago-monitor"><i /></div>
            </div>
          )}
          {theme === "training" && (
            <div className="pelago-training-props" aria-hidden="true">
              <div className="pelago-training-circle" />
              <div className="pelago-flag flag-a"><i /></div>
              <div className="pelago-flag flag-b"><i /></div>
            </div>
          )}
          {(theme === "garden" || theme === "ranch") && (
            <div className="pelago-garden-props" aria-hidden="true">
              <div className="pelago-berry-bush bush-a"><i /><b /><em /></div>
              <div className="pelago-berry-bush bush-b"><i /><b /></div>
            </div>
          )}

          <div className="pelago-sparkle sparkle-a" aria-hidden="true">✦</div>
          <div className="pelago-sparkle sparkle-b" aria-hidden="true">✦</div>
          <div className="pelago-sparkle sparkle-c" aria-hidden="true">✦</div>
          <div className="pelago-butterfly butterfly-a" aria-hidden="true"><i /><b /></div>
          <div className="pelago-butterfly butterfly-b" aria-hidden="true"><i /><b /></div>
          <div className="pelago-floating-leaf leaf-a" aria-hidden="true" />
          <div className="pelago-floating-leaf leaf-b" aria-hidden="true" />
          <div className="pelago-firefly firefly-a" aria-hidden="true" />
          <div className="pelago-firefly firefly-b" aria-hidden="true" />
          <div className="pelago-firefly firefly-c" aria-hidden="true" />

          <div className="habitat-stage-label">
            <span>{isNight ? "☾" : "☀"}</span>
            <div>
              <strong>{selectedSource?.label ?? "Habitat"}</strong>
              <small>{sourceDescription(selectedSource ?? sources[0])}</small>
            </div>
          </div>

          {scenePokemon.length === 0 ? (
            <div className="habitat-empty">
              <span>♧</span>
              <strong>It's quiet here.</strong>
              <p>Move some Pokémon to this place and they will appear in the habitat.</p>
            </div>
          ) : (
            scenePokemon.map((pokemon) => {
              const actor = actors[pokemon.id] ?? initialActorState(pokemon, 0);
              const motionDelay = -((hashString(pokemon.id) % 900) / 1000);
              const style = {
                left: `${actor.x}%`,
                top: `${actor.y}%`,
                zIndex: Math.round(actor.y),
                "--habitat-walk-tilt": actor.facing === 1 ? "1.4deg" : "-1.4deg",
                "--habitat-motion-delay": `${motionDelay}s`,
                "--habitat-move-duration": `${actor.moveDurationMs}ms`,
              } as CSSProperties;
              return (
                <button
                  className={`habitat-pokemon ${actor.isMoving ? "is-moving" : ""} ${actor.isInteracting ? "is-interacting" : ""} ${selectedPokemonId === pokemon.id ? "is-selected" : ""}`}
                  style={style}
                  type="button"
                  title={`${companionName(pokemon)} — ${actor.activity}`}
                  onClick={() => setSelectedPokemonId(pokemon.id)}
                  key={pokemon.id}
                >
                  {actor.emote && (
                    <span className="habitat-emote" key={`${actor.emote}:${actor.activity}`}>
                      {actor.emote}
                    </span>
                  )}
                  <span className="habitat-pokemon-sprite-wrap">
                    <HabitatMenuSprite pokemon={pokemon} facing={actor.facing} />
                  </span>
                  <span className="habitat-pokemon-shadow" />
                  <span className="habitat-pokemon-name">{companionName(pokemon)}</span>
                </button>
              );
            })
          )}

          <div className="habitat-ambient-message">
            <span>✦</span>
            {ambientMessage}
          </div>
        </div>

        <aside className="habitat-sidebar-card">
          {selectedPokemon ? (
            <>
              <div className="habitat-selected-art">
                <img src={getSprite(selectedPokemon) || selectedPokemon.artwork} alt="" />
              </div>
              <span className="section-kicker">Watching now</span>
              <h2>{companionName(selectedPokemon)}</h2>
              <p className="habitat-species-name">{selectedPokemon.displayName}</p>
              <p className="habitat-current-activity">
                {actors[selectedPokemon.id]?.activity ?? "enjoying some free time"}
              </p>
              <div className="habitat-selected-stats">
                <div><small>Level</small><strong>{selectedPokemon.level ?? "—"}</strong></div>
                <div>
                  <small>Nature</small>
                  <strong title={selectedPokemon.nature ? undefined : "Ambient fallback used because no Nature is saved"}>
                    {selectedPokemon.nature || `${effectiveNature(selectedPokemon)}*`}
                  </strong>
                </div>
                <div><small>Ability</small><strong>{selectedPokemon.ability?.displayName || "—"}</strong></div>
                <div><small>Held item</small><strong>{selectedPokemon.heldItem?.displayName || "—"}</strong></div>
              </div>
              {(eggGroupsByPokemon[selectedPokemon.id]?.length ?? 0) > 0 && (
                <div className="habitat-instincts">
                  <small>Species instincts</small>
                  <div>
                    {eggGroupsByPokemon[selectedPokemon.id].map((group) => (
                      <span key={group}>{eggGroupDisplayName(group)}</span>
                    ))}
                  </div>
                </div>
              )}
              {!selectedPokemon.nature && (
                <p className="habitat-nature-fallback">
                  * Habitat personality fallback — set a Nature when you want to make it official.
                </p>
              )}
              <button
                className="secondary-button habitat-edit-button"
                type="button"
                onClick={() => onEditPokemon(selectedPokemon)}
              >
                Edit partner
              </button>
            </>
          ) : (
            <div className="habitat-sidebar-empty">
              <span>☝</span>
              <strong>Pick a companion</strong>
              <p>Click any Pokémon in the habitat to see what they are doing.</p>
            </div>
          )}
        </aside>
      </div>

      <p className="habitat-footnote">
        Habitat activity is ambient and temporary. It does not change Pokémon relationships or create journal memories yet.
      </p>
    </section>
  );
}
