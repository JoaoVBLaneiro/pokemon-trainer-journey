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
  ambientRouteStepsLeft: number;
  zoneIntent?: HabitatMovementIntent;
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

type HabitatTheme = "lab" | "training" | "garden" | "wild" | "camp" | "ranch" | "meadow" | "mountain" | "desert" | "beach" | "aquarium";
type HabitatSpot = "pond" | "shore" | "campfire" | "berries" | "flowers" | "monitor" | "training" | "tent" | "sand" | "dune" | "oasis-shore" | "palm-shade" | "trees" | "tree-perch" | "mountain-perch" | "grotto" | "lava-edge" | "lava-pool" | "clearing";
type HabitatViewport = "default" | "compact" | "narrow";
type HabitatMovementIntent = "ambient" | "spot" | "water" | "lava";

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

function habitatLevel(pokemon: OwnedPokemon) {
  return clamp(Math.round(pokemon.level ?? 1), 1, 100);
}

function evolutionExperienceBonus(standing?: EvolutionStanding | null) {
  if (!standing) return 0;
  if (standing.isFullyEvolved || standing.isSingleStage) return 2;
  if (standing.depth > 0) return 1;
  return 0;
}

function isSeniorTo(
  senior: OwnedPokemon,
  junior: OwnedPokemon,
  seniorStanding?: EvolutionStanding | null,
  juniorStanding?: EvolutionStanding | null,
) {
  const levelGap = habitatLevel(senior) - habitatLevel(junior);

  // A meaningful Level advantage is enough by itself.
  if (levelGap >= 5) return true;

  // When Levels are close, evolution can contribute a LITTLE experience,
  // but it never outweighs a clearly higher-level Pokémon.
  if (
    levelGap >= 2 &&
    evolutionExperienceBonus(seniorStanding) >
      evolutionExperienceBonus(juniorStanding)
  ) {
    return true;
  }

  return false;
}

function highestLevelPokemon(pokemon: OwnedPokemon[]) {
  if (pokemon.length === 0) return null;
  return pokemon.reduce((best, candidate) => {
    const candidateLevel = habitatLevel(candidate);
    const bestLevel = habitatLevel(best);
    if (candidateLevel !== bestLevel) {
      return candidateLevel > bestLevel ? candidate : best;
    }
    return hashString(candidate.id) < hashString(best.id) ? candidate : best;
  });
}

type HabitatMoveFamily = {
  type: string;
  moves: string[];
};

const habitatMoveFamilies: HabitatMoveFamily[] = [
  { type: "fire", moves: ["ember", "flame-wheel", "flame-charge", "flamethrower", "fire-blast", "inferno", "overheat"] },
  { type: "water", moves: ["bubble", "water-gun", "bubble-beam", "water-pulse", "surf", "hydro-pump"] },
  { type: "electric", moves: ["thunder-shock", "spark", "electro-ball", "discharge", "thunderbolt", "thunder"] },
  { type: "grass", moves: ["absorb", "mega-drain", "giga-drain"] },
  { type: "grass", moves: ["leafage", "razor-leaf", "leaf-blade"] },
  { type: "ice", moves: ["powder-snow", "icy-wind", "ice-beam", "blizzard"] },
  { type: "flying", moves: ["gust", "air-cutter", "air-slash", "hurricane"] },
  { type: "dragon", moves: ["dragon-breath", "dragon-pulse", "draco-meteor"] },
  { type: "dark", moves: ["bite", "crunch"] },
  { type: "normal", moves: ["echoed-voice", "round", "hyper-voice", "boomburst"] },
  { type: "rock", moves: ["rock-throw", "rock-tomb", "rock-slide", "stone-edge"] },
  { type: "ground", moves: ["mud-slap", "mud-shot", "bulldoze", "earth-power", "earthquake"] },
  { type: "psychic", moves: ["confusion", "psybeam", "psychic"] },
  { type: "ghost", moves: ["astonish", "shadow-sneak", "shadow-ball"] },
  { type: "poison", moves: ["acid", "sludge", "sludge-bomb", "sludge-wave", "gunk-shot"] },
  { type: "bug", moves: ["struggle-bug", "bug-bite", "x-scissor", "megahorn"] },
];

const habitatBoringSharedMoves = new Set([
  "protect",
  "detect",
  "rest",
  "sleep-talk",
  "substitute",
  "swagger",
  "endure",
]);

function knownHabitatMoves(pokemon: OwnedPokemon) {
  return (pokemon.moves ?? []).filter(
    (move) => move && move.apiName && move.displayName,
  );
}

function moveTypeEmote(type?: string) {
  switch ((type ?? "").toLowerCase()) {
    case "fire": return "🔥";
    case "water": return "💧";
    case "electric": return "⚡";
    case "grass": return "🌿";
    case "ice": return "❄";
    case "fighting": return "🥊";
    case "poison": return "☠";
    case "ground": return "◆";
    case "flying": return "☁";
    case "psychic": return "✨";
    case "bug": return "✿";
    case "rock": return "◆";
    case "ghost": return "👻";
    case "dragon": return "✦";
    case "dark": return "☾";
    case "fairy": return "☆";
    default: return "✦";
  }
}

function movePracticeSpot(type: string | undefined, theme: HabitatTheme): HabitatSpot {
  switch ((type ?? "").toLowerCase()) {
    case "water":
      return waterSpotForTheme(theme) ?? visiblePondSpotForTheme(theme) ?? "clearing";
    case "grass":
    case "bug":
      return theme === "lab" || theme === "training" ? "clearing" : "trees";
    case "ground":
    case "rock":
      return theme === "camp" ? "sand" : theme === "training" ? "training" : "clearing";
    case "fighting":
      return theme === "training" ? "training" : "clearing";
    default:
      return "clearing";
  }
}

function sharedMovePracticeBeat(
  a: OwnedPokemon,
  b: OwnedPokemon,
  theme: HabitatTheme,
): HabitatPairBeat | null {
  const aMoves = knownHabitatMoves(a);
  const bMoves = knownHabitatMoves(b);
  if (aMoves.length === 0 || bMoves.length === 0) return null;

  const bMoveNames = new Set(bMoves.map((move) => move.apiName));
  const shared = aMoves.filter(
    (move) =>
      bMoveNames.has(move.apiName) &&
      !habitatBoringSharedMoves.has(move.apiName),
  );
  if (shared.length === 0) return null;

  const move = randomFrom(shared);
  const aName = companionName(a);
  const bName = companionName(b);
  const emote = moveTypeEmote(move.type);
  const spot = movePracticeSpot(move.type, theme);
  const playful =
    natureTemperament(a) === "playful" ||
    natureTemperament(b) === "playful";

  return {
    message: playful
      ? `${aName} and ${bName} are practicing ${move.displayName} together and have somehow turned it into a little competition.`
      : `${aName} and ${bName} are practicing ${move.displayName} together, carefully matching each other's timing.`,
    approachMessage: `${aName} and ${bName} are finding some room to practice ${move.displayName} together.`,
    aActivity: `practicing ${move.displayName} with ${bName}`,
    bActivity: `practicing ${move.displayName} with ${aName}`,
    aEmote: emote,
    bEmote: emote,
    spot,
  };
}

function relatedMoveLessonBeat(
  a: OwnedPokemon,
  b: OwnedPokemon,
  theme: HabitatTheme,
): HabitatPairBeat | null {
  const aMoves = knownHabitatMoves(a);
  const bMoves = knownHabitatMoves(b);
  if (aMoves.length === 0 || bMoves.length === 0) return null;

  const candidates: Array<{
    strongerPokemon: OwnedPokemon;
    strongerMove: (typeof aMoves)[number];
    weakerPokemon: OwnedPokemon;
    weakerMove: (typeof aMoves)[number];
    type: string;
    gap: number;
  }> = [];

  for (const family of habitatMoveFamilies) {
    for (const aMove of aMoves) {
      const aRank = family.moves.indexOf(aMove.apiName);
      if (aRank < 0) continue;

      for (const bMove of bMoves) {
        const bRank = family.moves.indexOf(bMove.apiName);
        if (bRank < 0 || aRank === bRank) continue;

        if (aRank > bRank) {
          candidates.push({
            strongerPokemon: a,
            strongerMove: aMove,
            weakerPokemon: b,
            weakerMove: bMove,
            type: family.type,
            gap: aRank - bRank,
          });
        } else {
          candidates.push({
            strongerPokemon: b,
            strongerMove: bMove,
            weakerPokemon: a,
            weakerMove: aMove,
            type: family.type,
            gap: bRank - aRank,
          });
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // Prefer a clearly more advanced technique if several families match.
  const maxGap = Math.max(...candidates.map((candidate) => candidate.gap));
  const bestCandidates = candidates.filter(
    (candidate) => candidate.gap >= Math.max(1, maxGap - 1),
  );
  const lesson = randomFrom(bestCandidates);

  const strongName = companionName(lesson.strongerPokemon);
  const weakName = companionName(lesson.weakerPokemon);
  const strongMove = lesson.strongerMove.displayName;
  const weakMove = lesson.weakerMove.displayName;
  const weakTemperament = natureTemperament(lesson.weakerPokemon);
  const emote = moveTypeEmote(lesson.type);
  const spot = movePracticeSpot(lesson.type, theme);

  let message: string;
  if (weakTemperament === "playful") {
    message = `${weakName} watches ${strongName} use ${strongMove}, then immediately tries to copy it with the biggest ${weakMove} they can manage.`;
  } else if (weakTemperament === "shy") {
    message = `${weakName} is watching ${strongName}'s ${strongMove} wide-eyed, then cautiously tries the same idea with ${weakMove}.`;
  } else if (weakTemperament === "serious" || weakTemperament === "curious") {
    message = `${weakName} carefully studies ${strongName}'s ${strongMove}, then experiments with the same technique using ${weakMove}.`;
  } else {
    message = `${strongName} demonstrates ${strongMove}, and ${weakName} tries to recreate the technique with ${weakMove}.`;
  }

  const strongIsA = lesson.strongerPokemon.id === a.id;
  return {
    message,
    approachMessage: `${strongName} is finding some space to show ${weakName} a move technique.`,
    aActivity: strongIsA
      ? `demonstrating ${strongMove} for ${weakName}`
      : `trying to imitate ${strongMove} with ${weakMove}`,
    bActivity: strongIsA
      ? `trying to imitate ${strongMove} with ${weakMove}`
      : `demonstrating ${strongMove} for ${weakName}`,
    aEmote: strongIsA ? emote : "👀",
    bEmote: strongIsA ? "👀" : emote,
    spot,
  };
}

function moveBasedPairBeat(
  a: OwnedPokemon,
  b: OwnedPokemon,
  theme: HabitatTheme,
): HabitatPairBeat | null {
  const shared = sharedMovePracticeBeat(a, b, theme);
  if (shared && Math.random() < 0.48) return shared;

  const related = relatedMoveLessonBeat(a, b, theme);
  if (related && Math.random() < 0.56) return related;

  return null;
}

function teamAceTrainingBeat(
  ace: OwnedPokemon,
  partner: OwnedPokemon,
  theme: HabitatTheme,
): HabitatPairBeat {
  const aceName = companionName(ace);
  const partnerName = companionName(partner);
  const aceLevel = habitatLevel(ace);
  const partnerLevel = habitatLevel(partner);
  const closeEnoughToSpar = aceLevel - partnerLevel <= 9;
  const trainingSpot: HabitatSpot =
    theme === "training" ? "training" : "clearing";

  if (closeEnoughToSpar) {
    return {
      message: `${aceName} and ${partnerName} are having a friendly little sparring session.`,
      approachMessage: `${aceName} is calling ${partnerName} over for a little practice match.`,
      aActivity: `sparring with ${partnerName}`,
      bActivity: `sparring with ${aceName}`,
      aEmote: hasType(ace, "fighting") ? "🥊" : "💪",
      bEmote: hasType(partner, "fighting") ? "🥊" : "✦",
      spot: trainingSpot,
    };
  }

  return {
    message: `${aceName} is leading ${partnerName} through a few training drills and keeping the pace manageable.`,
    approachMessage: `${aceName} is gathering ${partnerName} for a short training session.`,
    aActivity: `leading training drills for ${partnerName}`,
    bActivity: `training with ${aceName}`,
    aEmote: hasType(ace, "fighting") ? "🥊" : "⭐",
    bEmote: natureTemperament(partner) === "shy" ? "👀" : "💪",
    spot: trainingSpot,
  };
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

function initialActorState(
  pokemon: OwnedPokemon,
  index: number,
  theme: HabitatTheme = "camp",
  viewport: HabitatViewport = "default",
): HabitatActorState {
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
  const home = keepPointInRoamArea(
    { x: homeX, y: homeY },
    theme,
    viewport,
    "ambient",
  );

  return {
    x: home.x,
    y: home.y,
    homeX: home.x,
    homeY: home.y,
    facing: hashString(`${pokemon.id}:face`) % 2 === 0 ? 1 : -1,
    activity: "settling in",
    emote: "",
    isInteracting: false,
    isMoving: false,
    moveDurationMs: 2800,
    ambientRouteStepsLeft: 0,
    zoneIntent: "ambient",
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

type HabitatNoGoZone = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  blockedFor: HabitatMovementIntent[];
};

function habitatViewportForWidth(width: number): HabitatViewport {
  if (width > 0 && width <= 820) return "narrow";
  if (width > 0 && width <= 1120) return "compact";
  return "default";
}

function habitatRoamBounds(viewport: HabitatViewport) {
  if (viewport === "narrow") {
    return { minX: 16, maxX: 84, minY: 38, maxY: 70.5 };
  }
  if (viewport === "compact") {
    return { minX: 15, maxX: 85, minY: 37, maxY: 71.5 };
  }
  return { minX: 14, maxX: 86, minY: 36, maxY: 72 };
}

function habitatNoGoZones(
  theme: HabitatTheme,
  viewport: HabitatViewport,
): HabitatNoGoZone[] {
  const scale = viewport === "narrow" ? 1.18 : viewport === "compact" ? 1.08 : 1;

  if (theme === "camp") {
    return [
      {
        cx: 76.6,
        cy: 58.0,
        rx: 8.4 * scale,
        ry: 5.8 * scale,
        blockedFor: ["ambient", "spot"],
      },
    ];
  }

  if (theme === "beach") {
    return [
      {
        cx: 76.8,
        cy: 57.6,
        rx: 9.0 * scale,
        ry: 6.3 * scale,
        blockedFor: ["ambient", "spot"],
      },
    ];
  }

  if (theme === "desert") {
    return [
      {
        // The oasis is real water. Ordinary strolling and land interactions
        // stay on the bank instead of cutting straight through the pond.
        cx: 80.0,
        cy: 57.0,
        rx: 7.7 * scale,
        ry: 5.5 * scale,
        blockedFor: ["ambient", "spot"],
      },
    ];
  }

  if (theme === "mountain") {
    return [
      {
        // Ordinary wandering must respect the visible lava pit. Explicit
        // lava-swimming activities opt into the dedicated lava intent.
        cx: 62.5,
        cy: 46.5,
        rx: 7.2 * scale,
        ry: 4.6 * scale,
        blockedFor: ["ambient", "spot"],
      },
    ];
  }

  return [];
}

function keepPointInRoamArea(
  point: { x: number; y: number },
  theme: HabitatTheme,
  viewport: HabitatViewport,
  intent: HabitatMovementIntent = "ambient",
) {
  const bounds = habitatRoamBounds(viewport);
  const next = {
    x: clamp(point.x, bounds.minX, bounds.maxX),
    y: clamp(point.y, bounds.minY, bounds.maxY),
  };

  for (const zone of habitatNoGoZones(theme, viewport)) {
    if (!zone.blockedFor.includes(intent)) continue;

    let dx = next.x - zone.cx;
    let dy = next.y - zone.cy;
    let normalizedDistance = Math.hypot(dx / zone.rx, dy / zone.ry);

    if (normalizedDistance < 1) {
      if (normalizedDistance < 0.001) {
        dx = zone.rx;
        dy = 0;
        normalizedDistance = 0.001;
      }
      const factor = 1.04 / normalizedDistance;
      next.x = zone.cx + dx * factor;
      next.y = zone.cy + dy * factor;
      next.x = clamp(next.x, bounds.minX, bounds.maxX);
      next.y = clamp(next.y, bounds.minY, bounds.maxY);
    }
  }

  return next;
}

function movementIntentForSpot(spot?: HabitatSpot | null): HabitatMovementIntent {
  if (spot === "pond") return "water";
  if (spot === "lava-pool") return "lava";
  return "spot";
}

function movementIntentForActivity(
  pokemon: OwnedPokemon,
  spot: HabitatSpot | undefined,
  activity: string,
): HabitatMovementIntent {
  if (!spot) return "ambient";

  if (spot === "lava-pool" && canSwimInLava(pokemon)) {
    return "lava";
  }

  const waterActivity = /swim|splash|paddl|shallows|water|pond|surf/i.test(activity);
  if (
    hasType(pokemon, "water") &&
    (spot === "pond" || spot === "shore") &&
    waterActivity
  ) {
    return "water";
  }

  return "spot";
}

function shortWander(
  previous: HabitatActorState,
  theme: HabitatTheme = "camp",
  viewport: HabitatViewport = "default",
) {
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

  return keepPointInRoamArea(
    {
      x: previous.x + direction * xStep,
      y: previous.y + yStep,
    },
    theme,
    viewport,
    "ambient",
  );
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
  theme: HabitatTheme = "camp",
  viewport: HabitatViewport = "default",
) {
  let bestPoint = { x: previous.x, y: previous.y };
  let bestValue = -Infinity;

  // Try enough destinations that a genuine stroll can ask for a clearly
  // visible amount of travel without giving up the soft personal-space rule.
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const candidate = shortWander(previous, theme, viewport);
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
    const pushed = keepPointInRoamArea(
      {
        x: previous.x + (dx / magnitude) * 5.2,
        y: previous.y + (dy / magnitude) * 4.0,
      },
      theme,
      viewport,
      "ambient",
    );

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
  theme: HabitatTheme = "camp",
  viewport: HabitatViewport = "default",
  intent: HabitatMovementIntent = "spot",
) {
  const distance = Math.hypot(second.x - first.x, second.y - first.y);
  const minimum = 6.8;
  if (distance >= minimum) {
    return [
      keepPointInRoamArea(first, theme, viewport, intent),
      keepPointInRoamArea(second, theme, viewport, intent),
    ] as const;
  }

  const centerX = (first.x + second.x) / 2;
  const centerY = (first.y + second.y) / 2;
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const magnitude = Math.hypot(dx, dy) || 1;
  const ux = dx / magnitude;
  const uy = dy / magnitude;
  const half = minimum / 2;

  return [
    keepPointInRoamArea(
      {
        x: clamp(centerX - ux * half, 8, 92),
        y: clamp(centerY - uy * half, 29, 78),
      },
      theme,
      viewport,
      intent,
    ),
    keepPointInRoamArea(
      {
        x: clamp(centerX + ux * half, 8, 92),
        y: clamp(centerY + uy * half, 29, 78),
      },
      theme,
      viewport,
      intent,
    ),
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
  if (kind === "mountain") return "mountain";
  if (kind === "desert") return "desert";
  if (kind === "beach") return "beach";
  if (kind === "aquarium") return "aquarium";
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
  if (source.kind === "mountain") {
    return source.subtitle || "A rocky mountain refuge with ledges, stone paths, and high winds.";
  }
  if (source.kind === "desert") {
    return source.subtitle || "A dry, sandy habitat with warm dunes and sparse shade.";
  }
  if (source.kind === "beach") {
    return source.subtitle || "A sunny shoreline where your companions can relax by the surf.";
  }
  if (source.kind === "aquarium") {
    return source.subtitle || "A water-filled enclosure where aquatic companions can drift and play.";
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
    nextSocialAt: now + 20000 + phase * 1.25 + randomMs(7, 16),
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

function hasAbility(pokemon: OwnedPokemon, ...abilities: string[]) {
  const ability = pokemon.ability?.apiName?.toLowerCase();
  if (!ability) return false;
  return abilities.some((candidate) => candidate.toLowerCase() === ability);
}

const lavaSwimmingAbilities = [
  "flash-fire",
  "flame-body",
  "magma-armor",
  "solid-rock",
  "steam-engine",
] as const;

function canSwimInLava(pokemon: OwnedPokemon) {
  return hasAbility(pokemon, ...lavaSwimmingAbilities);
}

function canSafelyApproachLava(pokemon: OwnedPokemon) {
  return hasType(pokemon, "fire", "rock", "ground");
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
  // Camp and beach lean on a visible shoreline instead of an inland pond.
  // Aquarium also has a clearly visible water enclosure.
  return theme === "garden" || theme === "ranch" || theme === "wild" || theme === "meadow" || theme === "aquarium";
}

function waterSpotForTheme(theme: HabitatTheme): "pond" | "shore" | null {
  if (theme === "camp" || theme === "beach") return "shore";
  if (pondIsProminent(theme)) return "pond";
  return null;
}

function visiblePondSpotForTheme(theme: HabitatTheme): "pond" | null {
  return theme === "camp" || theme === "beach" || pondIsProminent(theme) ? "pond" : null;
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

function likesTrees(pokemon: OwnedPokemon) {
  return hasType(pokemon, "grass", "bug", "flying", "normal", "fairy");
}

function likesSand(pokemon: OwnedPokemon) {
  return hasType(pokemon, "ground", "rock", "fire", "dragon");
}

function hasGrove(theme: HabitatTheme) {
  return theme === "camp" || theme === "garden" || theme === "meadow" || theme === "wild" || theme === "beach";
}

function hasFlowers(theme: HabitatTheme) {
  return theme === "garden" || theme === "ranch" || theme === "wild" || theme === "meadow" || theme === "beach";
}

function hasSandZone(theme: HabitatTheme) {
  return theme === "camp" || theme === "desert" || theme === "beach";
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
    case "sand": return "the sandy patch";
    case "dune": return "the dunes";
    case "oasis-shore": return "the oasis";
    case "palm-shade": return "the palm shade";
    case "trees": return "the little grove";
    case "tree-perch": return "a perch in the trees";
    case "mountain-perch": return "a rocky perch";
    case "grotto": return "the mountain grotto";
    case "lava-edge": return "the edge of the lava pool";
    case "lava-pool": return "the lava pool";
    default: return "the clearing";
  }
}

function spotPoint(
  spot: HabitatSpot,
  pokemonId: string,
  role = 0,
  theme: HabitatTheme = "camp",
  viewport: HabitatViewport = "default",
) {
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
    sand: [
      { x: 70.5, y: 60.5 },
      { x: 76.5, y: 59.5 },
      { x: 73.5, y: 64.5 },
      { x: 79.5, y: 63.0 },
    ],
    dune: [
      { x: 22.0, y: 61.0 },
      { x: 69.0, y: 42.5 },
      { x: 74.0, y: 67.0 },
      { x: 31.0, y: 54.0 },
    ],
    "oasis-shore": [
      { x: 72.5, y: 55.5 },
      { x: 77.0, y: 50.5 },
      { x: 84.0, y: 61.0 },
      { x: 76.0, y: 64.0 },
    ],
    "palm-shade": [
      { x: 71.0, y: 50.0 },
      { x: 75.0, y: 47.5 },
      { x: 83.0, y: 63.5 },
      { x: 73.0, y: 61.5 },
    ],
    trees: [
      { x: 15.5, y: 45.0 },
      { x: 27.5, y: 45.2 },
      { x: 84.5, y: 42.5 },
      { x: 80.5, y: 66.0 },
      { x: 72.8, y: 64.2 },
      { x: 18.5, y: 47.5 },
    ],
    "tree-perch": [
      { x: 14.0, y: 35.0 },
      { x: 26.5, y: 35.2 },
      { x: 85.5, y: 33.5 },
      { x: 81.0, y: 58.5 },
      { x: 73.8, y: 57.4 },
      { x: 16.5, y: 36.5 },
    ],
    "mountain-perch": [
      { x: 27.5, y: 50.5 },
      { x: 39.0, y: 48.0 },
      { x: 70.5, y: 52.0 },
      { x: 78.0, y: 56.0 },
    ],
    grotto: [
      { x: 45.0, y: 68.5 },
      { x: 48.0, y: 69.0 },
      { x: 50.5, y: 68.0 },
      { x: 47.0, y: 70.0 },
    ],
    "lava-edge": [
      { x: 55.0, y: 47.8 },
      { x: 69.2, y: 47.4 },
      { x: 58.0, y: 51.2 },
      { x: 67.2, y: 51.0 },
    ],
    "lava-pool": [
      { x: 60.0, y: 45.8 },
      { x: 64.0, y: 45.7 },
      { x: 61.5, y: 48.0 },
      { x: 65.2, y: 47.5 },
    ],
    clearing: [
      { x: 43.0, y: 52.0 },
      { x: 57.0, y: 53.0 },
      { x: 46.0, y: 63.0 },
      { x: 58.0, y: 64.0 },
    ],
  };

  const compactCampPoints: Partial<Record<HabitatSpot, Array<{ x: number; y: number }>>> = {
    pond: [
      { x: 74.8, y: 55.3 },
      { x: 79.0, y: 58.3 },
      { x: 72.0, y: 60.4 },
      { x: 77.6, y: 61.8 },
    ],
    shore: [
      { x: 82.0, y: 57.8 },
      { x: 84.8, y: 61.5 },
      { x: 80.4, y: 64.2 },
      { x: 83.2, y: 66.6 },
    ],
    sand: [
      { x: 71.0, y: 60.6 },
      { x: 75.3, y: 60.0 },
      { x: 72.8, y: 64.0 },
      { x: 77.2, y: 63.1 },
    ],
    trees: [
      { x: 14.8, y: 45.0 },
      { x: 26.8, y: 45.0 },
      { x: 82.8, y: 42.0 },
      { x: 78.0, y: 64.2 },
      { x: 71.0, y: 63.0 },
      { x: 18.0, y: 47.0 },
    ],
    "tree-perch": [
      { x: 13.6, y: 35.2 },
      { x: 26.0, y: 35.3 },
      { x: 83.6, y: 33.2 },
      { x: 78.4, y: 56.9 },
      { x: 71.8, y: 56.1 },
      { x: 16.2, y: 36.5 },
    ],
  };

  const sourcePoints =
    theme === "camp" && viewport !== "default" && compactCampPoints[spot]
      ? compactCampPoints[spot]!
      : points[spot];

  const selected = sourcePoints[(variant + role) % sourcePoints.length];
  return keepPointInRoamArea(
    selected,
    theme,
    viewport,
    movementIntentForSpot(spot),
  );
}

function pairSpotPoints(
  spot: HabitatSpot,
  pairKey: string,
  theme: HabitatTheme = "camp",
  viewport: HabitatViewport = "default",
  firstIntent: HabitatMovementIntent = "spot",
  secondIntent: HabitatMovementIntent = "spot",
) {
  const anchor = spotPoint(spot, pairKey, 0, theme, viewport);
  let halfX = 3.8;
  let halfY = 0.55;

  switch (spot) {
    case "tree-perch":
      halfX = 3.45;
      halfY = 0.18;
      break;
    case "trees":
      halfX = 3.55;
      halfY = 0.32;
      break;
    case "campfire":
      halfX = 4.0;
      halfY = 0.9;
      break;
    case "pond":
    case "shore":
    case "oasis-shore":
      halfX = 3.6;
      halfY = 0.45;
      break;
    case "palm-shade":
      halfX = 3.35;
      halfY = 0.35;
      break;
    case "dune":
      halfX = 3.8;
      halfY = 0.7;
      break;
    case "lava-pool":
      halfX = 2.7;
      halfY = 0.28;
      break;
    case "lava-edge":
    case "mountain-perch":
      halfX = 3.2;
      halfY = 0.35;
      break;
    case "grotto":
      halfX = 2.8;
      halfY = 0.3;
      break;
    case "tent":
      halfX = 3.7;
      halfY = 0.5;
      break;
    default:
      halfX = 3.8;
      halfY = 0.55;
      break;
  }

  return [
    keepPointInRoamArea(
      { x: anchor.x - halfX, y: anchor.y + halfY },
      theme,
      viewport,
      firstIntent,
    ),
    keepPointInRoamArea(
      { x: anchor.x + halfX, y: anchor.y - halfY },
      theme,
      viewport,
      secondIntent,
    ),
  ] as const;
}

function desertSoloBeat(
  pokemon: OwnedPokemon,
  isNight: boolean,
): HabitatSoloBeat | null {
  const name = companionName(pokemon);
  const temperament = natureTemperament(pokemon);

  // Desert events are common enough to give the habitat its own identity,
  // while still leaving room for Nature, Egg Group, and generic idle beats.
  if (Math.random() > 0.78) return null;

  const options: HabitatSoloBeat[] = [];

  if (prefersBerries(pokemon) || Math.random() < 0.55) {
    options.push({
      activity: "enjoying some berry juice by the oasis",
      emote: "🍓",
      message: `${name} is enjoying a cool cup of berry juice beside the oasis.`,
      approachMessage: `${name} is heading over to the oasis for a refreshing berry drink.`,
      spot: "oasis-shore",
    });
  }

  if (!isNight && (!hasType(pokemon, "fire") || Math.random() < 0.24)) {
    options.push({
      activity: "seeking shade beneath the palm trees",
      emote: "🌿",
      message: `${name} has found a comfortable patch of shade beneath the oasis palms.`,
      approachMessage: `${name} is making their way toward the cool shade of the palm trees.`,
      spot: "palm-shade",
    });
  }

  if (isNight) {
    options.push({
      activity: "resting beside the oasis in the cool night air",
      emote: "✨",
      message: `${name} is quietly enjoying the cool desert air beside the oasis.`,
      approachMessage: `${name} is wandering over toward the oasis for a peaceful nighttime rest.`,
      spot: "oasis-shore",
    });
  }

  if (hasType(pokemon, "ground", "bug", "rock") || (hasType(pokemon, "fire") && Math.random() < 0.38)) {
    options.push({
      activity: "burrowing into the warm sand",
      emote: "◆",
      message: `${name} is burrowing into the sand and seems delighted by the warmth underneath.`,
      approachMessage: `${name} is hurrying toward a warm dune to dig in.`,
      spot: "dune",
    });
  }

  if (
    temperament === "playful" ||
    temperament === "curious" ||
    hasType(pokemon, "ground", "fairy", "normal")
  ) {
    options.push({
      activity: "playing with the sand",
      emote: temperament === "curious" ? "?" : "♪",
      message:
        temperament === "curious"
          ? `${name} is drawing very deliberate little patterns in the sand.`
          : `${name} is happily pushing the warm sand around and making tiny piles.`,
      approachMessage: `${name} is heading over to one of the dunes to play in the sand.`,
      spot: "dune",
    });
  }

  if (!isNight && likesSand(pokemon)) {
    options.push({
      activity: "basking on top of a sun-warmed dune",
      emote: "☀",
      message: `${name} is stretched out on top of a dune, soaking up the desert heat.`,
      approachMessage: `${name} is climbing onto a sunny dune to warm up.`,
      spot: "dune",
    });
  }

  if (temperament === "gentle" || temperament === "shy" || temperament === "relaxed") {
    options.push({
      activity: "watching the oasis ripple quietly",
      emote: "💧",
      message: `${name} is sitting quietly beside the oasis and watching the water ripple.`,
      approachMessage: `${name} is wandering over toward the oasis for a quiet moment.`,
      spot: "oasis-shore",
    });
  }

  if (options.length === 0) {
    options.push({
      activity: "wandering between the warm dunes",
      emote: "☀",
      message: `${name} is calmly exploring the warm desert dunes.`,
      approachMessage: `${name} is heading toward another dune to explore.`,
      spot: "dune",
    });
  }

  return randomFrom(options);
}

function describeSoloBeat(
  pokemon: OwnedPokemon,
  theme: HabitatTheme,
  isNight: boolean,
  eggGroups: string[],
): HabitatSoloBeat {
  const name = companionName(pokemon);

  if (theme === "mountain") {
    // Lava swimming is Ability-gated rather than Type-gated. This makes the
    // saved Ability on the individual Pokémon matter to habitat behavior.
    if (canSwimInLava(pokemon) && Math.random() < 0.42) {
      const abilityName = pokemon.ability?.displayName ?? "its Ability";
      return {
        activity: "swimming lazily through the lava pool",
        emote: "🔥",
        message: `${name} is actually swimming through the lava pool, completely at ease thanks to ${abilityName}.`,
        approachMessage: `${name} is heading straight for the lava pool without the slightest hesitation.`,
        spot: "lava-pool",
      };
    }

    // Direct edge contact with lava is limited to Fire / Rock / Ground types.
    if (canSafelyApproachLava(pokemon) && Math.random() < 0.38) {
      const lavaMoments: HabitatSoloBeat[] = [
        {
          activity: "dipping its feet into the warm lava",
          emote: "🔥",
          message: `${name} is sitting at the edge of the lava pool and dipping its feet into the warm molten rock.`,
          approachMessage: `${name} is carefully making its way over to the lava pool's edge.`,
          spot: "lava-edge",
        },
        {
          activity: "soaking up the heat beside the lava",
          emote: "☀",
          message: `${name} looks extremely comfortable basking beside the lava pool.`,
          approachMessage: `${name} is wandering over toward the warm glow of the lava.`,
          spot: "lava-edge",
        },
        {
          activity: "watching the lava bubble",
          emote: "🔥",
          message: `${name} is quietly watching the molten surface bubble and shift.`,
          approachMessage: `${name} is heading over to inspect the lava pool.`,
          spot: "lava-edge",
        },
      ];
      return randomFrom(lavaMoments);
    }

    if (hasType(pokemon, "fire", "rock", "ground", "dragon", "flying") && Math.random() < 0.44) {
      const perchMoments: HabitatSoloBeat[] = [
        {
          activity: "basking in the warm sunlight on top of a rock",
          emote: "☀",
          message: `${name} has claimed a high rocky perch and is basking contentedly in the warm sunlight.`,
          approachMessage: `${name} is climbing up toward one of the sun-warmed rocky perches.`,
          spot: "mountain-perch",
        },
        {
          activity: "surveying the habitat from a rocky perch",
          emote: hasType(pokemon, "dragon") ? "✦" : "◆",
          message: `${name} is perched high above the ground, quietly surveying the mountain refuge.`,
          approachMessage: `${name} is making its way up toward a higher rocky ledge.`,
          spot: "mountain-perch",
        },
      ];
      return randomFrom(perchMoments);
    }

    const grottoAffinity = hasType(pokemon, "rock", "ground", "dragon", "dark", "ghost", "ice");
    if (Math.random() < (grottoAffinity ? 0.36 : 0.18)) {
      const grottoMoments: HabitatSoloBeat[] = [
        {
          activity: "finding comfort in the chill grotto",
          emote: "💤",
          message: `${name} has settled into the cool stone of the grotto and looks completely at ease.`,
          approachMessage: `${name} is wandering toward the sheltered mountain grotto.`,
          spot: "grotto",
        },
        {
          activity: "napping in the dark cave",
          emote: "💤",
          message: `${name} has curled up inside the dark little cave for a peaceful nap.`,
          approachMessage: `${name} is slipping into the quiet darkness of the grotto.`,
          spot: "grotto",
        },
        {
          activity: "resting against the cool cave wall",
          emote: "◆",
          message: `${name} is relaxing against the cool stone inside the grotto.`,
          approachMessage: `${name} is heading into the sheltered grotto for a break.`,
          spot: "grotto",
        },
      ];
      return randomFrom(grottoMoments);
    }

    if (hasType(pokemon, "rock", "ground", "steel", "dragon") && Math.random() < 0.52) {
      return {
        activity: "climbing along the rocky ledges",
        emote: hasType(pokemon, "dragon") ? "✦" : "◆",
        message: `${name} is exploring the mountain ledges with impressive confidence.`,
        approachMessage: `${name} is making their way toward the stony slope.`,
        spot: "mountain-perch",
      };
    }
  }

  if (theme === "desert") {
    const desertBeat = desertSoloBeat(pokemon, isNight);
    if (desertBeat) return desertBeat;
  }

  if (theme === "beach" && hasType(pokemon, "flying", "water") && Math.random() < 0.46) {
    return {
      activity: hasType(pokemon, "water") ? "playing at the shoreline" : "coasting over the shoreline",
      emote: hasType(pokemon, "water") ? "💧" : "☁",
      message: hasType(pokemon, "water")
        ? `${name} is happily playing where the surf meets the sand.`
        : `${name} is gliding along the shoreline and enjoying the sea breeze.`,
      approachMessage: `${name} is heading for the edge of the water.`,
      spot: "shore",
    };
  }

  if (theme === "aquarium" && hasType(pokemon, "water") && Math.random() < 0.72) {
    return {
      activity: "gliding through the aquarium pool",
      emote: "💧",
      message: `${name} is making relaxed little loops through the aquarium water.`,
      approachMessage: `${name} is slipping back into the water.`,
      spot: "pond",
    };
  }

  if (theme === "camp" && hasType(pokemon, "fire") && Math.random() < 0.72) {
    return {
      activity: "keeping an eye on the campfire",
      emote: "🔥",
      message: `${name} is happily tending the campfire.`,
      approachMessage: `${name} is hopping over to check on the campfire.`,
      spot: "campfire",
    };
  }

  if (hasSandZone(theme) && (hasType(pokemon, "ground", "rock") || (hasType(pokemon, "dragon") && Math.random() < 0.72)) && Math.random() < 0.42) {
    return {
      activity: "digging around in the sandy patch",
      emote: "◆",
      message: `${name} is busily nosing through the sandy patch and leaving little trails behind.`,
      approachMessage: `${name} is trotting over toward the sandy patch with a purpose.`,
      spot: "sand",
    };
  }

  if (hasSandZone(theme) && hasType(pokemon, "fire") && Math.random() < 0.40) {
    return {
      activity: "basking in the warm sand",
      emote: "☀",
      message: `${name} is happily soaking up the warmth from the sandy patch.`,
      approachMessage: `${name} is padding over toward the warm sand.`,
      spot: "sand",
    };
  }

  if (hasSandZone(theme) && likesSand(pokemon) && Math.random() < 0.32) {
    return {
      activity: "resting in the warm sand",
      emote: "☀",
      message: `${name} seems very content in the sandy patch by the water.`,
      approachMessage: `${name} is padding over toward the sandy patch.`,
      spot: "sand",
    };
  }

  if (hasGrove(theme) && hasType(pokemon, "flying") && Math.random() < 0.34) {
    return {
      activity: "perching up in the trees",
      emote: "☁",
      message: `${name} has found a nice perch in one of the grove's trees.`,
      approachMessage: `${name} is fluttering over toward a tree branch.`,
      spot: "tree-perch",
    };
  }

  if (hasGrove(theme) && hasType(pokemon, "bug") && Math.random() < 0.34) {
    return {
      activity: "climbing around the tree trunks",
      emote: "✿",
      message: `${name} is happily skittering around the trunks and leaves in the grove.`,
      approachMessage: `${name} is making a determined little march toward the trees.`,
      spot: "trees",
    };
  }

  if (hasGrove(theme) && hasType(pokemon, "grass", "fairy", "normal") && Math.random() < 0.32) {
    return {
      activity: "resting in the shade of the trees",
      emote: hasType(pokemon, "fairy") ? "✨" : "🌿",
      message: `${name} is enjoying a peaceful little rest in the shade of the grove.`,
      approachMessage: `${name} is heading over to the shade of the trees.`,
      spot: "trees",
    };
  }

  if (hasGrove(theme) && likesTrees(pokemon) && Math.random() < 0.24) {
    return {
      activity: "exploring near the trees",
      emote: "🌿",
      message: `${name} is wandering around the little grove.`,
      approachMessage: `${name} is heading over to the shade of the trees.`,
      spot: "trees",
    };
  }

  const visiblePondSpot = visiblePondSpotForTheme(theme);
  if (visiblePondSpot && hasType(pokemon, "flying") && Math.random() < 0.30) {
    return {
      activity: "skimming over the pond",
      emote: "☁",
      message: `${name} is making little passes over the pond and circling back again.`,
      approachMessage: `${name} is drifting over toward the pond.`,
      spot: "pond",
    };
  }

  if (visiblePondSpot && hasType(pokemon, "dragon", "psychic") && Math.random() < 0.22) {
    return {
      activity: "watching the pond in complete concentration",
      emote: hasType(pokemon, "psychic") ? "💡" : "💧",
      message: `${name} is staring into the pond like there is something extremely important happening in there.`,
      approachMessage: `${name} is wandering over to inspect the pond.`,
      spot: "pond",
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

  if (hasFlowers(theme) && hasType(pokemon, "grass", "bug", "fairy") && Math.random() < 0.52) {
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

function desertPairBeat(
  a: OwnedPokemon,
  b: OwnedPokemon,
  isNight: boolean,
): HabitatPairBeat | null {
  if (Math.random() > 0.46) return null;

  const aName = companionName(a);
  const bName = companionName(b);
  const moments: HabitatPairBeat[] = [
    {
      message: `${aName} and ${bName} are sharing some cool berry juice beside the oasis.`,
      approachMessage: `${aName} and ${bName} are heading toward the oasis for a refreshing drink.`,
      aActivity: `sharing berry juice by the oasis with ${bName}`,
      bActivity: `sharing berry juice by the oasis with ${aName}`,
      aEmote: "🍓",
      bEmote: "🍓",
      spot: "oasis-shore",
    },
    {
      message: `${aName} and ${bName} are happily making little shapes and piles in the sand together.`,
      approachMessage: `${aName} and ${bName} are heading toward a dune to play in the sand.`,
      aActivity: `playing in the sand with ${bName}`,
      bActivity: `playing in the sand with ${aName}`,
      aEmote: "♪",
      bEmote: "♪",
      spot: "dune",
    },
  ];

  if (!isNight) {
    moments.push({
      message: `${aName} and ${bName} have squeezed into a cool patch of shade beneath the oasis palms.`,
      approachMessage: `${aName} and ${bName} are heading toward the palm trees to get out of the sun.`,
      aActivity: `relaxing in the palm shade with ${bName}`,
      bActivity: `relaxing in the palm shade with ${aName}`,
      aEmote: "🌿",
      bEmote: "🌿",
      spot: "palm-shade",
    });
  } else {
    moments.push({
      message: `${aName} and ${bName} are relaxing together beside the oasis under the desert night sky.`,
      approachMessage: `${aName} and ${bName} are wandering toward the oasis for a quiet nighttime break.`,
      aActivity: `resting by the oasis with ${bName}`,
      bActivity: `resting by the oasis with ${aName}`,
      aEmote: "✨",
      bEmote: "✨",
      spot: "oasis-shore",
    });
  }

  const bothDiggers =
    hasType(a, "ground", "bug", "rock") &&
    hasType(b, "ground", "bug", "rock");

  if (bothDiggers) {
    moments.push({
      message: `${aName} and ${bName} are enthusiastically digging into the same warm dune.`,
      approachMessage: `${aName} and ${bName} have both picked the same dune for some digging.`,
      aActivity: `burrowing in the warm sand with ${bName}`,
      bActivity: `burrowing in the warm sand with ${aName}`,
      aEmote: "◆",
      bEmote: "◆",
      spot: "dune",
    });
  }

  return randomFrom(moments);
}

function describePairBeat(
  a: OwnedPokemon,
  b: OwnedPokemon,
  theme: HabitatTheme,
  isNight: boolean,
  evolutionStandings: Record<string, EvolutionStanding | null>,
  eggGroupsByPokemon: Record<string, string[]>,
  teamAceId?: string,
): HabitatPairBeat {
  const aName = companionName(a);
  const bName = companionName(b);

  const aStanding = evolutionStandings[a.id];
  const bStanding = evolutionStandings[b.id];

  // The highest-level companion sometimes takes an informal "team ace" role.
  // This is deliberately not every ace interaction, so the Pokémon still gets
  // plenty of ordinary social moments too.
  if (
    teamAceId &&
    (a.id === teamAceId || b.id === teamAceId) &&
    Math.random() < 0.38
  ) {
    const ace = a.id === teamAceId ? a : b;
    const partner = ace.id === a.id ? b : a;
    const beat = teamAceTrainingBeat(ace, partner, theme);

    if (ace.id === a.id) return beat;
    return {
      ...beat,
      aActivity: beat.bActivity,
      bActivity: beat.aActivity,
      aEmote: beat.bEmote,
      bEmote: beat.aEmote,
    };
  }

  if (isSeniorTo(b, a, bStanding, aStanding) && Math.random() < 0.68) {
    return mentorPairBeat(a, b, theme);
  }
  if (isSeniorTo(a, b, aStanding, bStanding) && Math.random() < 0.68) {
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

  // Moves are individual loadout data, so two Pokémon with compatible
  // techniques can develop their own practice/teaching moments independent of
  // species, Type seniority, or evolution stage.
  const moveBeat = moveBasedPairBeat(a, b, theme);
  if (moveBeat) return moveBeat;

  if (theme === "desert") {
    const desertBeat = desertPairBeat(a, b, isNight);
    if (desertBeat) return desertBeat;
  }

  // A small tree-side berry break gives ordinary duo moments a little more
  // cozy "team hanging out together" energy.
  const naturalTreeTheme =
    theme === "camp" ||
    theme === "garden" ||
    theme === "ranch" ||
    theme === "wild" ||
    theme === "meadow";

  if (
    naturalTreeTheme &&
    (prefersBerries(a) || prefersBerries(b)) &&
    Math.random() < 0.30
  ) {
    const berryMoments = [
      {
        message: `${aName} and ${bName} have gathered under the trees to share a few berries.`,
        aActivity: `sharing berries under the trees with ${bName}`,
        bActivity: `sharing berries under the trees with ${aName}`,
      },
      {
        message: `${aName} and ${bName} found a little handful of berries near the grove and are happily splitting them.`,
        aActivity: `eating berries with ${bName}`,
        bActivity: `eating berries with ${aName}`,
      },
      {
        message: `${aName} and ${bName} are taking a quiet berry break together in the shade.`,
        aActivity: `having a berry break with ${bName}`,
        bActivity: `having a berry break with ${aName}`,
      },
    ];
    const moment = randomFrom(berryMoments);
    return {
      ...moment,
      approachMessage: `${aName} and ${bName} are heading over toward the trees for a little snack.`,
      aEmote: "🍓",
      bEmote: "🍓",
      spot: "trees",
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

  if (theme === "camp" && (likesSand(a) || likesSand(b)) && Math.random() < 0.46) {
    const bothDiggers = (hasType(a, "ground", "rock") || hasType(a, "dragon")) && (hasType(b, "ground", "rock") || hasType(b, "dragon"));
    const basking = hasType(a, "fire") || hasType(b, "fire");
    return {
      message: bothDiggers
        ? `${aName} and ${bName} are enthusiastically digging around in the sandy patch together.`
        : basking
          ? `${aName} and ${bName} are stretching out together in the warm sand.`
          : `${aName} and ${bName} are poking around the sandy patch together.`,
      approachMessage: `${aName} and ${bName} are heading over toward the sandy patch.`,
      aActivity: bothDiggers ? `digging in the sand with ${bName}` : basking ? `basking in the sand with ${bName}` : `exploring the sandy patch with ${bName}`,
      bActivity: bothDiggers ? `digging in the sand with ${aName}` : basking ? `basking in the sand with ${aName}` : `exploring the sandy patch with ${aName}`,
      aEmote: hasType(a, "fire") ? "☀" : "◆",
      bEmote: hasType(b, "fire") ? "☀" : "◆",
      spot: "sand",
    };
  }

  if ((theme === "camp" || theme === "garden" || theme === "meadow" || theme === "wild") && (likesTrees(a) || likesTrees(b)) && Math.random() < 0.42) {
    const bothFlying = hasType(a, "flying") && hasType(b, "flying");
    const bothBuggy = hasType(a, "bug") && hasType(b, "bug");
    return {
      message: bothFlying
        ? `${aName} and ${bName} are weaving around the grove and swapping perches between the trees.`
        : bothBuggy
          ? `${aName} and ${bName} are busily exploring the trunks and leaves together.`
          : `${aName} and ${bName} are spending some time together in the shade of the little grove.`,
      approachMessage: `${aName} and ${bName} are wandering over toward the trees.`,
      aActivity: bothFlying ? `perching and fluttering with ${bName}` : bothBuggy ? `exploring the trunks with ${bName}` : `relaxing in the shade with ${bName}`,
      bActivity: bothFlying ? `perching and fluttering with ${aName}` : bothBuggy ? `exploring the trunks with ${aName}` : `relaxing in the shade with ${aName}`,
      aEmote: hasType(a, "flying") ? "☁" : hasType(a, "bug") ? "✿" : "🌿",
      bEmote: hasType(b, "flying") ? "☁" : hasType(b, "bug") ? "✿" : "🌿",
      spot: bothFlying ? "tree-perch" : "trees",
    };
  }

  const visiblePondSpot = visiblePondSpotForTheme(theme);
  if (visiblePondSpot && ((hasType(a, "water") && hasType(b, "flying")) || (hasType(b, "water") && hasType(a, "flying"))) && Math.random() < 0.68) {
    const waterFriend = hasType(a, "water") ? a : b;
    const flyingFriend = waterFriend.id === a.id ? b : a;
    const waterName = companionName(waterFriend);
    const flyingName = companionName(flyingFriend);
    const waterIsA = waterFriend.id === a.id;
    return {
      message: `${waterName} is splashing around in the pond while ${flyingName} skims low over the surface.`,
      approachMessage: `${waterName} and ${flyingName} are heading over toward the pond together.`,
      aActivity: waterIsA ? `splashing in the pond while ${flyingName} circles overhead` : `skimming over the pond with ${waterName}`,
      bActivity: waterIsA ? `skimming over the pond with ${waterName}` : `splashing in the pond while ${flyingName} circles overhead`,
      aEmote: waterIsA ? "💧" : "☁",
      bEmote: waterIsA ? "☁" : "💧",
      spot: "pond",
    };
  }

  if (visiblePondSpot && hasType(a, "flying") && hasType(b, "flying") && Math.random() < 0.38) {
    return {
      message: `${aName} and ${bName} are circling over the pond together and occasionally swooping low.`,
      approachMessage: `${aName} and ${bName} are drifting over toward the pond.`,
      aActivity: `circling over the pond with ${bName}`,
      bActivity: `circling over the pond with ${aName}`,
      aEmote: "☁",
      bEmote: "☁",
      spot: "pond",
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
  const movementDeadlineRef = useRef(0);
  const actorClocksRef = useRef<Record<string, HabitatActorClock>>({});
  const actorsRef = useRef<Record<string, HabitatActorState>>({});
  const pendingInteractionsRef = useRef<PendingHabitatInteraction[]>([]);
  const ambientMoveTimersRef = useRef<Record<string, number>>({});
  const ambientMoveDeadlinesRef = useRef<Record<string, number>>({});
  const nextSceneEventAtRef = useRef(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageWidth, setStageWidth] = useState(0);

  useEffect(() => {
    actorsRef.current = actors;
  }, [actors]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;

    const updateStageWidth = () => {
      setStageWidth(node.getBoundingClientRect().width);
    };

    updateStageWidth();
    window.addEventListener("resize", updateStageWidth);

    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", updateStageWidth);
    }

    const observer = new ResizeObserver(updateStageWidth);
    observer.observe(node);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateStageWidth);
    };
  }, [selectedSourceKey]);

  const selectedSource =
    sources.find((source) => source.key === selectedSourceKey) ??
    firstPopulatedSource ??
    sources[0];
  const scenePokemon = selectedSource?.pokemon ?? [];
  const selectedPokemon = scenePokemon.find(
    (pokemon) => pokemon.id === selectedPokemonId,
  );
  const theme = getTheme(selectedSource?.kind ?? "party");
  const habitatViewport = habitatViewportForWidth(stageWidth);
  const isNight = new Date().getHours() < 6 || new Date().getHours() >= 19;
  const sceneryStyle = {
    "--pelago-sheet": `url("${habitatAsset("RPGpack_sheet.png")}")`,
    "--pelago-island": `url("${habitatAsset("rpgTile000.png")}")`,
    "--pelago-pond": `url("${habitatAsset("rpgTile004.png")}")`,
  } as CSSProperties;

  useEffect(() => {
    if (scenePokemon.length === 0) return;

    setActors((current) => {
      let changed = false;
      const next = { ...current };

      for (const pokemon of scenePokemon) {
        const actor = next[pokemon.id];
        if (!actor) continue;
        const corrected = keepPointInRoamArea(
          { x: actor.x, y: actor.y },
          theme,
          habitatViewport,
          actor.zoneIntent ?? "ambient",
        );
        if (
          Math.abs(corrected.x - actor.x) > 0.05 ||
          Math.abs(corrected.y - actor.y) > 0.05
        ) {
          next[pokemon.id] = {
            ...actor,
            x: corrected.x,
            y: corrected.y,
          };
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [scenePokemon, theme, habitatViewport]);

  const clearMovementTimer = () => {
    if (movementTimerRef.current !== null) {
      window.clearTimeout(movementTimerRef.current);
      movementTimerRef.current = null;
    }
    movementDeadlineRef.current = 0;
  };

  const clearAmbientMoveTimer = (pokemonId: string) => {
    const timer = ambientMoveTimersRef.current[pokemonId];
    if (timer !== undefined) {
      window.clearTimeout(timer);
      delete ambientMoveTimersRef.current[pokemonId];
    }
    delete ambientMoveDeadlinesRef.current[pokemonId];
  };

  const clearAllAmbientMoveTimers = () => {
    for (const timer of Object.values(ambientMoveTimersRef.current)) {
      window.clearTimeout(timer);
    }
    ambientMoveTimersRef.current = {};
    ambientMoveDeadlinesRef.current = {};
  };

  useEffect(
    () => () => {
      clearMovementTimer();
      clearAllAmbientMoveTimers();
    },
    [],
  );

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
    clearAllAmbientMoveTimers();
    const next: Record<string, HabitatActorState> = {};
    const clocks: Record<string, HabitatActorClock> = {};
    scenePokemon.forEach((pokemon, index) => {
      next[pokemon.id] = initialActorState(pokemon, index, theme, habitatViewport);
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

        // Ambient stroll/lap movement has its own exact per-Pokémon timer.
        // Do not let the coarse Habitat heartbeat end it between route legs.
        if (ambientMoveTimersRef.current[pokemon.id] !== undefined) continue;

        const actor = next[pokemon.id];
        if (!actor) {
          clock.busyUntil = 0;
          continue;
        }

        clock.busyUntil = 0;
        next[pokemon.id] = {
          ...actor,
          activity: "relaxing and enjoying the habitat",
          emote: "",
          isInteracting: false,
          isMoving: false,
          moveDurationMs: 2800,
          ambientRouteStepsLeft: 0,
          zoneIntent: "ambient",
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
    clock.nextSocialAt = clock.busyUntil + randomMs(24, 42);
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

  const finishAmbientMoveLeg = (pokemonId: string) => {
    delete ambientMoveTimersRef.current[pokemonId];
    delete ambientMoveDeadlinesRef.current[pokemonId];
    const now = Date.now();
    const pokemon = scenePokemon.find((candidate) => candidate.id === pokemonId);
    const actor = actorsRef.current[pokemonId];
    const clock = actorClocksRef.current[pokemonId];

    if (!pokemon || !actor || !clock) return;

    // If a social interaction was queued during this leg, finish the current
    // step and stop here so the pair can meet on the next scheduler heartbeat.
    if (isPokemonQueued(pokemonId)) {
      clock.busyUntil = 0;
      clock.nextWanderAt = now + randomMs(3, 6);
      actorClocksRef.current[pokemonId] = clock;
      setActors((current) => ({
        ...current,
        [pokemonId]: {
          ...(current[pokemonId] ?? actor),
          activity: "waiting for a friend",
          isMoving: false,
          isInteracting: false,
          ambientRouteStepsLeft: 0,
          moveDurationMs: 2800,
          zoneIntent: "ambient",
        },
      }));
      return;
    }

    if (actor.ambientRouteStepsLeft > 0) {
      const minimumTravel =
        actor.activity === "doing a little lap around the clearing" ? 11 : 9;
      const position = chooseSpacedWander(
        actor,
        actorsRef.current,
        pokemonId,
        minimumTravel,
        theme,
        habitatViewport,
      );
      const actuallyMoved =
        Math.abs(position.x - actor.x) > 0.05 ||
        Math.abs(position.y - actor.y) > 0.05;

      if (actuallyMoved) {
        const travelDurationMs = ambientTravelDurationMs(actor, position);
        clock.busyUntil = now + travelDurationMs + 80;
        actorClocksRef.current[pokemonId] = clock;

        setActors((current) => ({
          ...current,
          [pokemonId]: {
            ...(current[pokemonId] ?? actor),
            ...position,
            facing:
              position.x === actor.x
                ? actor.facing
                : position.x > actor.x
                  ? 1
                  : -1,
            isMoving: true,
            isInteracting: false,
            moveDurationMs: travelDurationMs,
            ambientRouteStepsLeft: actor.ambientRouteStepsLeft - 1,
            zoneIntent: "ambient",
          },
        }));

        const ambientDeadline = now + travelDurationMs + 90;
        ambientMoveDeadlinesRef.current[pokemonId] = ambientDeadline + 1400;
        ambientMoveTimersRef.current[pokemonId] = window.setTimeout(
          () => finishAmbientMoveLeg(pokemonId),
          travelDurationMs + 90,
        );
        return;
      }
    }

    clock.busyUntil = 0;
    clock.nextWanderAt = now + randomMs(1.8, 4.2);
    actorClocksRef.current[pokemonId] = clock;
    setActors((current) => ({
      ...current,
      [pokemonId]: {
        ...(current[pokemonId] ?? actor),
        activity: "relaxing and enjoying the habitat",
        emote: "",
        isMoving: false,
        isInteracting: false,
        ambientRouteStepsLeft: 0,
        moveDurationMs: 2800,
        zoneIntent: "ambient",
      },
    }));
  };

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
    clearAmbientMoveTimer(first.id);
    clearAmbientMoveTimer(second.id);

    const firstIndex = scenePokemon.findIndex((pokemon) => pokemon.id === first.id);
    const secondIndex = scenePokemon.findIndex((pokemon) => pokemon.id === second.id);
    const teamAce = highestLevelPokemon(scenePokemon);
    const pairBeat = describePairBeat(
      first,
      second,
      theme,
      isNight,
      evolutionStandings,
      eggGroupsByPokemon,
      teamAce?.id,
    );
    const firstIntent = pairBeat.spot
      ? movementIntentForActivity(first, pairBeat.spot, pairBeat.aActivity)
      : "spot";
    const secondIntent = pairBeat.spot
      ? movementIntentForActivity(second, pairBeat.spot, pairBeat.bActivity)
      : "spot";
    const [firstTarget, secondTarget] = pairBeat.spot
      ? pairSpotPoints(
          pairBeat.spot,
          `${first.id}:${second.id}:${pairBeat.spot}`,
          theme,
          habitatViewport,
          firstIntent,
          secondIntent,
        )
      : [null, null] as const;

    const timingFirst = actorsRef.current[first.id] ?? initialActorState(first, Math.max(0, firstIndex), theme, habitatViewport);
    const timingSecond = actorsRef.current[second.id] ?? initialActorState(second, Math.max(0, secondIndex), theme, habitatViewport);
    const timingMeetingX = (timingFirst.x + timingSecond.x) / 2;
    const timingMeetingY = (timingFirst.y + timingSecond.y) / 2;
    const [timingFirstPoint, timingSecondPoint] = pairBeat.spot
      ? [firstTarget!, secondTarget!] as const
      : separatePairPoints(
          { x: timingMeetingX - 3.4, y: timingMeetingY + 0.45 },
          { x: timingMeetingX + 3.4, y: timingMeetingY - 0.45 },
          theme,
          habitatViewport,
          "spot",
        );
    const travelDurationMs = Math.max(
      interactionTravelDurationMs(timingFirst, timingFirstPoint),
      interactionTravelDurationMs(timingSecond, timingSecondPoint),
    );

    scheduleAfterSocial(first, now);
    scheduleAfterSocial(second, now);
    nextSceneEventAtRef.current = now + randomMs(9, 14);

    setActors((current) => {
      const firstPrevious = current[first.id] ?? initialActorState(first, Math.max(0, firstIndex), theme, habitatViewport);
      const secondPrevious = current[second.id] ?? initialActorState(second, Math.max(0, secondIndex), theme, habitatViewport);
      const meetingX = (firstPrevious.x + secondPrevious.x) / 2;
      const meetingY = (firstPrevious.y + secondPrevious.y) / 2;
      const next = { ...current };

      const [firstPoint, secondPoint] = pairBeat.spot
        ? [firstTarget!, secondTarget!] as const
        : separatePairPoints(
            { x: meetingX - 3.4, y: meetingY + 0.45 },
            { x: meetingX + 3.4, y: meetingY - 0.45 },
            theme,
            habitatViewport,
            "spot",
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
        ambientRouteStepsLeft: 0,
        zoneIntent: firstIntent,
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
        ambientRouteStepsLeft: 0,
        zoneIntent: secondIntent,
      };
      return next;
    });

    setAmbientMessage(pairBeat.approachMessage);
    movementDeadlineRef.current = Date.now() + travelDurationMs + 120 + 1800;
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
            zoneIntent: firstIntent,
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
            zoneIntent: secondIntent,
          };
        }
        return next;
      });
      setAmbientMessage(pairBeat.message);
      movementTimerRef.current = null;
      movementDeadlineRef.current = 0;
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
    clearAmbientMoveTimer(focus.id);

    const focusIndex = scenePokemon.findIndex((pokemon) => pokemon.id === focus.id);
    const soloBeat = describeSoloBeat(focus, theme, isNight, eggGroupsByPokemon[focus.id] ?? []);
    const soloIntent = movementIntentForActivity(focus, soloBeat.spot, soloBeat.activity);
    const focusTarget = soloBeat.spot
      ? keepPointInRoamArea(
          spotPoint(soloBeat.spot, focus.id, 0, theme, habitatViewport),
          theme,
          habitatViewport,
          soloIntent,
        )
      : null;
    const timingActor = actorsRef.current[focus.id] ?? initialActorState(focus, Math.max(0, focusIndex), theme, habitatViewport);
    const timingTarget =
      focusTarget ?? chooseSpacedWander(timingActor, actorsRef.current, focus.id, 0, theme, habitatViewport);
    const travelDurationMs = interactionTravelDurationMs(timingActor, timingTarget);

    scheduleAfterSolo(focus, now);
    nextSceneEventAtRef.current = now + randomMs(8, 14);

    setActors((current) => {
      const previous = current[focus.id] ?? initialActorState(focus, Math.max(0, focusIndex), theme, habitatViewport);
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
          ambientRouteStepsLeft: 0,
          zoneIntent: focusTarget ? soloIntent : "ambient",
        },
      };
    });

    if (focusTarget && soloBeat.spot) {
      setAmbientMessage(
        soloBeat.approachMessage ?? `${companionName(focus)} is heading toward ${spotLabel(soloBeat.spot)}.`,
      );
      movementDeadlineRef.current = Date.now() + travelDurationMs + 120 + 1800;
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
              zoneIntent: soloBeat.spot ? soloIntent : "ambient",
            },
          };
        });
        setAmbientMessage(soloBeat.message);
        movementTimerRef.current = null;
        movementDeadlineRef.current = 0;
      }, travelDurationMs + 120);
    } else {
      setAmbientMessage(soloBeat.message);
      clearMovementTimer();
      movementDeadlineRef.current = Date.now() + travelDurationMs + 120 + 1800;
      movementTimerRef.current = window.setTimeout(() => {
        setActors((current) => {
          const actor = current[focus.id];
          if (!actor) return current;
          return {
            ...current,
            [focus.id]: { ...actor, isMoving: false, ambientRouteStepsLeft: 0 },
          };
        });
        movementTimerRef.current = null;
        movementDeadlineRef.current = 0;
      }, travelDurationMs + 120);
    }
  };

  const startQuietWander = (pokemon: OwnedPokemon, now: number) => {
    const index = scenePokemon.findIndex((candidate) => candidate.id === pokemon.id);
    const previousForTiming =
      actorsRef.current[pokemon.id] ?? initialActorState(pokemon, Math.max(0, index), theme, habitatViewport);
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
      theme,
      habitatViewport,
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

    // Labels that explicitly describe walking now guarantee a real route.
    // A stroll is three visible legs total; a lap is four.
    const ambientRouteStepsLeft =
      wanderActivity === "doing a little lap around the clearing"
        ? 3
        : wanderActivity === "taking a little stroll"
          ? 2
          : wanderActivity === "wandering around the island"
            ? 1
            : 0;

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
          ambientRouteStepsLeft,
          zoneIntent: "ambient",
        },
      };
    });

    clearAmbientMoveTimer(pokemon.id);
    ambientMoveDeadlinesRef.current[pokemon.id] =
      now + travelDurationMs + 90 + 1400;
    ambientMoveTimersRef.current[pokemon.id] = window.setTimeout(
      () => finishAmbientMoveLeg(pokemon.id),
      travelDurationMs + 90,
    );

    // Ambient walking now chains with an exact per-Pokémon timer instead of
    // waiting for the coarse global scheduler between steps.
  };

  const recoverStaleSchedulerState = (now: number) => {
    const staleAmbientIds = Object.entries(ambientMoveDeadlinesRef.current)
      .filter(([, deadline]) => deadline > 0 && now > deadline)
      .map(([pokemonId]) => pokemonId);

    if (staleAmbientIds.length > 0) {
      for (const pokemonId of staleAmbientIds) {
        const timer = ambientMoveTimersRef.current[pokemonId];
        if (timer !== undefined) window.clearTimeout(timer);
        delete ambientMoveTimersRef.current[pokemonId];
        delete ambientMoveDeadlinesRef.current[pokemonId];

        const clock = actorClocksRef.current[pokemonId];
        if (clock) {
          clock.busyUntil = 0;
          clock.nextWanderAt = now + randomMs(0.8, 2.2);
          actorClocksRef.current[pokemonId] = clock;
        }
      }

      setActors((current) => {
        const next = { ...current };
        for (const pokemonId of staleAmbientIds) {
          const actor = next[pokemonId];
          if (!actor) continue;
          next[pokemonId] = {
            ...actor,
            activity: "relaxing and enjoying the habitat",
            emote: "",
            isMoving: false,
            isInteracting: false,
            ambientRouteStepsLeft: 0,
            moveDurationMs: 2800,
            zoneIntent: "ambient",
          };
        }
        return next;
      });
    }

    if (
      movementTimerRef.current !== null &&
      movementDeadlineRef.current > 0 &&
      now > movementDeadlineRef.current
    ) {
      window.clearTimeout(movementTimerRef.current);
      movementTimerRef.current = null;
      movementDeadlineRef.current = 0;

      setActors((current) => {
        const next = { ...current };
        for (const pokemon of scenePokemon) {
          const actor = next[pokemon.id];
          const clock = actorClocksRef.current[pokemon.id];
          if (!actor) continue;

          // A major travel timer should never own a Pokémon indefinitely.
          // Recover any actor that still claims it is travelling after the
          // timer's watchdog deadline.
          if (actor.isMoving && ambientMoveTimersRef.current[pokemon.id] === undefined) {
            next[pokemon.id] = {
              ...actor,
              activity: "relaxing and enjoying the habitat",
              emote: "",
              isMoving: false,
              isInteracting: false,
              ambientRouteStepsLeft: 0,
              moveDurationMs: 2800,
              zoneIntent: "ambient",
            };
            if (clock) {
              clock.busyUntil = 0;
              clock.nextWanderAt = now + randomMs(0.8, 2.2);
              actorClocksRef.current[pokemon.id] = clock;
            }
          }
        }
        return next;
      });
    }

    // Final safety net: if an actor says it is busy but its own clock has
    // already expired and no movement timer owns it, release it.
    const strandedIds = scenePokemon
      .filter((pokemon) => {
        const actor = actorsRef.current[pokemon.id];
        const clock = actorClocksRef.current[pokemon.id];
        if (!actor || !clock) return false;
        if (now < clock.busyUntil) return false;
        if (ambientMoveTimersRef.current[pokemon.id] !== undefined) return false;
        if (movementTimerRef.current !== null && actor.isMoving) return false;
        return actor.isMoving || actor.isInteracting;
      })
      .map((pokemon) => pokemon.id);

    if (strandedIds.length > 0) {
      setActors((current) => {
        const next = { ...current };
        for (const pokemonId of strandedIds) {
          const actor = next[pokemonId];
          if (!actor) continue;
          const clock = actorClocksRef.current[pokemonId];
          if (clock) {
            clock.busyUntil = 0;
            clock.nextWanderAt = Math.min(clock.nextWanderAt, now + randomMs(0.8, 2.2));
            actorClocksRef.current[pokemonId] = clock;
          }
          next[pokemonId] = {
            ...actor,
            activity: "relaxing and enjoying the habitat",
            emote: "",
            isMoving: false,
            isInteracting: false,
            ambientRouteStepsLeft: 0,
            moveDurationMs: 2800,
            zoneIntent: "ambient",
          };
        }
        return next;
      });
    }
  };

  const runHabitatClock = (forceInteraction = false) => {
    if (scenePokemon.length === 0) return;
    const now = Date.now();
    recoverStaleSchedulerState(now);
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
      if (socialReady.length >= 2 && Math.random() < 0.68) {
        let first = randomFrom(socialReady);
        let second = randomFrom(
          socialReady.filter((pokemon) => pokemon.id !== first.id),
        );

        let deliberatelyPickedAcePair = false;
        const teamAce = highestLevelPokemon(socialReady);
        if (teamAce && socialReady.length >= 2 && Math.random() < 0.28) {
          const lowerLevelPartners = socialReady.filter(
            (pokemon) =>
              pokemon.id !== teamAce.id &&
              habitatLevel(pokemon) <= habitatLevel(teamAce),
          );
          const partnerPool =
            lowerLevelPartners.length > 0
              ? lowerLevelPartners
              : socialReady.filter((pokemon) => pokemon.id !== teamAce.id);

          if (partnerPool.length > 0) {
            first = teamAce;
            second = randomFrom(partnerPool);
            deliberatelyPickedAcePair = true;
          }
        }

        const mentorPairs: Array<[OwnedPokemon, OwnedPokemon]> = [];
        for (const junior of socialReady) {
          for (const senior of socialReady) {
            if (junior.id === senior.id) continue;
            if (
              isSeniorTo(
                senior,
                junior,
                evolutionStandings[senior.id],
                evolutionStandings[junior.id],
              )
            ) {
              mentorPairs.push([junior, senior]);
            }
          }
        }

        if (
          !deliberatelyPickedAcePair &&
          mentorPairs.length > 0 &&
          Math.random() < 0.38
        ) {
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

    let debugInterval: number | null = null;
    if (import.meta.env.DEV) {
      debugInterval = window.setInterval(() => {
        console.debug("[Habitat scheduler]", {
          majorTimerActive: movementTimerRef.current !== null,
          majorDeadline: movementDeadlineRef.current,
          ambientTimers: Object.keys(ambientMoveTimersRef.current).length,
          queuedInteractions: pendingInteractionsRef.current.length,
          actors: Object.fromEntries(
            Object.entries(actorsRef.current).map(([id, actor]) => [
              id,
              {
                activity: actor.activity,
                moving: actor.isMoving,
                interacting: actor.isInteracting,
                busyUntil: actorClocksRef.current[id]?.busyUntil ?? 0,
              },
            ]),
          ),
        });
      }, 30000);
    }

    return () => {
      window.clearInterval(interval);
      if (debugInterval !== null) window.clearInterval(debugInterval);
    };
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
            <span>{source.kind === "party" ? "⛺" : source.kind === "laboratory" ? "⚗" : source.kind === "ranch" ? "♧" : source.kind === "gym" ? "△" : source.kind === "home" ? "⌂" : source.kind === "mountain" ? "⛰" : source.kind === "desert" ? "◌" : source.kind === "beach" ? "≈" : source.kind === "aquarium" ? "◉" : "◇"}</span>
            <strong>{source.label}</strong>
            <small>{source.pokemon.length}</small>
          </button>
        ))}
      </div>

      <div className="habitat-layout">
        <div ref={stageRef} data-habitat-viewport={habitatViewport} className={`habitat-stage habitat-theme-${theme} ${isNight ? "is-night" : "is-day"} ${isPaused ? "is-paused" : ""}`} style={sceneryStyle}>
          <div className="pelago-ocean-layer" aria-hidden="true" />
          <div className="pelago-sky-light" aria-hidden="true" />
          <div className="pelago-cloud pelago-cloud-one" aria-hidden="true"><i /><b /></div>
          <div className="pelago-cloud pelago-cloud-two" aria-hidden="true"><i /><b /></div>

          {theme === "mountain" && (
            <div className="pelago-mountain-sky-range" aria-hidden="true">
              <div className="pelago-mountain-peak peak-d is-far"><i /><b /></div>
              <div className="pelago-mountain-peak peak-e is-far"><i /><b /></div>
              <div className="pelago-mountain-peak peak-f is-far"><i /><b /></div>
              <div className="pelago-mountain-peak peak-g is-far"><i /><b /></div>

              <div className="pelago-mountain-peak peak-a is-near"><i /><b /></div>
              <div className="pelago-mountain-peak peak-b is-near"><i /><b /></div>
              <div className="pelago-mountain-peak peak-c is-middle"><i /><b /></div>
            </div>
          )}

          <div className="pelago-island-layer" aria-hidden="true">
            <div className="pelago-island-shadow" />
            <div className="pelago-island-art" />
            <div className="pelago-island-highlight" />
          </div>

          <div className="pelago-tree-asset pelago-tree-one" aria-hidden="true" />
          <div className="pelago-tree-asset pelago-tree-two" aria-hidden="true" />
          <div className="pelago-tree-asset pelago-tree-three" aria-hidden="true" />
          <div className="pelago-tree-asset pelago-tree-four" aria-hidden="true" />
          <div className="pelago-tree-asset pelago-tree-five" aria-hidden="true" />
          <div className="pelago-fence-asset pelago-fence-one" aria-hidden="true" />
          <div className="pelago-fence-asset pelago-fence-two" aria-hidden="true" />
          <div className="pelago-sandy-cove" aria-hidden="true"><i /><b /></div>
          {(pondIsProminent(theme) || theme === "camp") && <div className={`pelago-pond-asset ${theme === "camp" ? "is-camp-pond" : ""}`} aria-hidden="true"><i /><b /></div>}

          <div className="pelago-flower flower-a" aria-hidden="true" />
          <div className="pelago-flower flower-b" aria-hidden="true" />
          <div className="pelago-flower flower-c" aria-hidden="true" />
          <div className="pelago-flower flower-d" aria-hidden="true" />
          <div className="pelago-grass-tuft grass-a" aria-hidden="true" />
          <div className="pelago-grass-tuft grass-b" aria-hidden="true" />
          <div className="pelago-grass-tuft grass-c" aria-hidden="true" />

          {theme === "camp" && (
            <>
              <div className="pelago-camp-grove" aria-hidden="true">
                <div className="pelago-camp-tree camp-tree-a"><i /><b /></div>
                <div className="pelago-camp-tree camp-tree-b"><i /><b /></div>
                <div className="pelago-camp-tree camp-tree-c"><i /><b /></div>
                <div className="pelago-camp-tree camp-tree-d"><i /><b /></div>
                <div className="pelago-camp-tree camp-tree-e"><i /><b /></div>
              </div>
              <div className="pelago-camp-props" aria-hidden="true">
                <div className="pelago-pixel-tent"><i /><b /></div>
                <div className="pelago-campfire"><i /><b /><em /></div>
                <div className="pelago-log log-a" />
                <div className="pelago-log log-b" />
              </div>
            </>
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
          {theme === "mountain" && (
            <div className="pelago-mountain-props" aria-hidden="true">
              <div className="pelago-mountain-grass-patch grass-a" />
              <div className="pelago-mountain-grass-patch grass-b" />
              <div className="pelago-mountain-grass-patch grass-c" />
              <div className="pelago-mountain-grass-patch grass-d" />
              <div className="pelago-mountain-outcrop outcrop-a"><i /><b /></div>
              <div className="pelago-mountain-outcrop outcrop-b"><i /><b /></div>
              <div className="pelago-mountain-outcrop outcrop-c"><i /><b /></div>
              <div className="pelago-mountain-outcrop outcrop-d"><i /><b /></div>
              <div className="pelago-mountain-lava-pit lava-a"><i /><b /></div>
              <div className="pelago-mountain-ledge ledge-a" />
              <div className="pelago-mountain-ledge ledge-b" />
              <div className="pelago-mountain-ledge ledge-c" />
              <div className="pelago-mountain-pine pine-a"><i /><b /></div>
              <div className="pelago-mountain-pine pine-b"><i /><b /></div>
              <div className="pelago-mountain-pine pine-c"><i /><b /></div>
              <div className="pelago-mountain-grotto grotto-a"><i /><b /></div>
              <div className="pelago-rock rock-a" />
              <div className="pelago-rock rock-b" />
              <div className="pelago-rock rock-c" />
              <div className="pelago-rock rock-d" />
              <div className="pelago-pebbles pebble-a" />
              <div className="pelago-pebbles pebble-b" />
            </div>
          )}
          {theme === "desert" && (
            <div className="pelago-desert-props" aria-hidden="true">
              <div className="pelago-dune dune-a" />
              <div className="pelago-dune dune-b" />
              <div className="pelago-dune dune-c" />
              <div className="pelago-desert-oasis oasis-a"><i /><b /></div>
              <div className="pelago-desert-palm dpalm-a"><i /><b /><em /></div>
              <div className="pelago-desert-palm dpalm-b"><i /><b /><em /></div>
              <div className="pelago-desert-palm dpalm-c"><i /><b /><em /></div>
              <div className="pelago-desert-reed reed-a"></div>
              <div className="pelago-desert-reed reed-b"></div>
              <div className="pelago-cactus cactus-a"><i /><b /></div>
              <div className="pelago-cactus cactus-b"><i /><b /></div>
            </div>
          )}
          {theme === "beach" && (
            <div className="pelago-beach-props" aria-hidden="true">
              <div className="pelago-beach-shoreline shore-a"><i /><b /></div>
              <div className="pelago-beach-land-props">
                <div className="pelago-palm palm-a"><i /><b /><em /></div>
                <div className="pelago-palm palm-b"><i /><b /><em /></div>
                <div className="pelago-palm palm-c"><i /><b /><em /></div>
                <div className="pelago-palm palm-d"><i /><b /><em /></div>
                <div className="pelago-palm palm-e"><i /><b /><em /></div>
                <div className="pelago-beach-kiosk"><i /><b /><em /></div>
                <div className="pelago-shell shell-a" />
                <div className="pelago-shell shell-b" />
                <div className="pelago-shell shell-c" />
              </div>
            </div>
          )}
          {theme === "aquarium" && (
            <div className="pelago-aquarium-props" aria-hidden="true">
              <div className="pelago-aquarium-floor" />
              <div className="pelago-coral coral-a"><i /><b /></div>
              <div className="pelago-coral coral-b"><i /><b /></div>
              <div className="pelago-bubble-column bubbles-a"><i /><b /><em /></div>
              <div className="pelago-bubble-column bubbles-b"><i /><b /><em /></div>
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
              const actor = actors[pokemon.id] ?? initialActorState(pokemon, 0, theme, habitatViewport);
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
