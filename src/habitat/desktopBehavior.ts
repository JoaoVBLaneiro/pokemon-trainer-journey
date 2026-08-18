import type { OwnedPokemon } from "../db";

export type DesktopTemperament =
  | "bold"
  | "playful"
  | "gentle"
  | "shy"
  | "serious"
  | "curious"
  | "stubborn"
  | "relaxed";

export type DesktopSoloActivity =
  | "idle"
  | "observe"
  | "play"
  | "train"
  | "nap"
  | "hover"
  | "drift"
  | "sunbathe"
  | "zigzag"
  | "stretch"
  | "snack";

export type DesktopVerticalBand = {
  min: number;
  max: number;
};

export type DesktopSocialKind =
  | "hangout"
  | "play"
  | "spar"
  | "snack"
  | "move-practice"
  | "group-hangout"
  | "group-play"
  | "group-snack"
  | "group-training";

export type DesktopSocialChoice = {
  kind: DesktopSocialKind;
  sharedMoveName?: string;
};

export type DesktopHoverReactionKind =
  | "caring"
  | "playful"
  | "cautious"
  | "stoic"
  | "grumpy"
  | "sleepy"
  | "alert"
  | "snack-happy"
  | "snack-protective"
  | "stroll-look";

export type DesktopHoverReaction = {
  kind: DesktopHoverReactionKind;
  emote: string;
  text: string;
  durationMs: number;
};

export function companionName(pokemon: OwnedPokemon) {
  return pokemon.nickname.trim() || pokemon.displayName;
}

export function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function hasType(pokemon: OwnedPokemon, ...types: string[]) {
  const normalized = new Set(pokemon.types.map((type) => type.toLowerCase()));
  return types.some((type) => normalized.has(type.toLowerCase()));
}

function normalizedNature(pokemon: OwnedPokemon) {
  return pokemon.nature.trim().toLowerCase();
}

export function temperamentForPokemon(
  pokemon: OwnedPokemon,
): DesktopTemperament {
  const nature = normalizedNature(pokemon);

  if (["jolly", "naive", "hasty", "quirky"].includes(nature)) return "playful";
  if (["timid", "bashful", "lonely"].includes(nature)) return "shy";
  if (["serious", "hardy"].includes(nature)) return "serious";
  if (["brave", "adamant", "bold", "naughty"].includes(nature)) return "bold";
  if (["gentle", "calm", "mild", "careful"].includes(nature)) return "gentle";
  if (["modest", "rash"].includes(nature)) return "curious";
  if (["impish", "sassy"].includes(nature)) return "stubborn";
  if (["relaxed", "docile", "lax", "quiet"].includes(nature)) return "relaxed";

  // Keep the same deterministic fallback philosophy used by Habitat:
  // a missing Nature should still produce a stable personality.
  return hashString(pokemon.id) % 2 === 0 ? "serious" : "shy";
}

export function verticalBandForPokemon(
  pokemon: OwnedPokemon,
): DesktopVerticalBand {
  // Desktop companions are intentionally much less "grounded" than Habitat
  // actors. Type still gives them a tendency, but almost everyone can now
  // explore a large portion of the screen instead of living in one thin band.
  if (hasType(pokemon, "flying")) return { min: 8, max: 88 };
  if (hasType(pokemon, "ghost")) return { min: 10, max: 90 };
  if (hasType(pokemon, "psychic")) return { min: 14, max: 90 };
  if (hasType(pokemon, "ground", "rock", "steel")) return { min: 34, max: 92 };
  if (hasType(pokemon, "water")) return { min: 24, max: 91 };
  if (hasType(pokemon, "bug")) return { min: 20, max: 91 };
  return { min: 18, max: 91 };
}

export function wanderRestChance(pokemon: OwnedPokemon) {
  const temperament = temperamentForPokemon(pokemon);

  switch (temperament) {
    case "playful":
      return 0.18;
    case "bold":
    case "stubborn":
      return 0.23;
    case "curious":
      return 0.27;
    case "gentle":
    case "shy":
      return 0.38;
    case "relaxed":
      return 0.48;
    case "serious":
    default:
      return 0.33;
  }
}

export function preferredTravelDistance(pokemon: OwnedPokemon) {
  const temperament = temperamentForPokemon(pokemon);

  if (hasType(pokemon, "flying")) {
    return temperament === "playful"
      ? { min: 20, max: 42 }
      : { min: 16, max: 36 };
  }

  switch (temperament) {
    case "playful":
      return { min: 18, max: 36 };
    case "bold":
    case "stubborn":
      return { min: 16, max: 32 };
    case "curious":
      return { min: 14, max: 30 };
    case "shy":
      return { min: 9, max: 22 };
    case "relaxed":
      return { min: 8, max: 20 };
    default:
      return { min: 11, max: 27 };
  }
}

export function idleDurationMs(pokemon: OwnedPokemon) {
  const temperament = temperamentForPokemon(pokemon);

  switch (temperament) {
    case "playful":
      return randomBetween(2200, 5200);
    case "bold":
    case "stubborn":
      return randomBetween(3000, 6200);
    case "relaxed":
      return randomBetween(6200, 11500);
    case "gentle":
    case "shy":
      return randomBetween(4800, 9200);
    default:
      return randomBetween(3600, 7600);
  }
}

export function chooseDesktopSoloActivity(
  pokemon: OwnedPokemon,
): DesktopSoloActivity {
  const temperament = temperamentForPokemon(pokemon);
  const roll = Math.random();

  // A small universal snack chance gives the desktop overlay an actual eating
  // state without dominating the existing Nature / Type activity balance.
  if (Math.random() < 0.09) return "snack";

  if (hasType(pokemon, "flying") && roll < 0.24) return "hover";
  if (hasType(pokemon, "ghost") && roll < 0.28) return "drift";
  if (hasType(pokemon, "fire") && roll < 0.18) return "sunbathe";
  if (hasType(pokemon, "bug") && temperament === "playful" && roll < 0.42) {
    return "zigzag";
  }

  switch (temperament) {
    case "playful":
      if (roll < 0.46) return "play";
      if (roll < 0.66) return "stretch";
      return "observe";
    case "bold":
      if (roll < 0.52) return "train";
      if (roll < 0.72) return "observe";
      return "stretch";
    case "stubborn":
      if (roll < 0.44) return "train";
      if (roll < 0.68) return "observe";
      return "idle";
    case "curious":
      if (roll < 0.58) return "observe";
      if (roll < 0.78) return "play";
      return "stretch";
    case "relaxed":
      if (roll < 0.56) return "nap";
      if (roll < 0.78) return "idle";
      return "stretch";
    case "gentle":
      if (roll < 0.36) return "observe";
      if (roll < 0.62) return "idle";
      if (roll < 0.78) return "nap";
      return "stretch";
    case "shy":
      if (roll < 0.52) return "observe";
      if (roll < 0.78) return "idle";
      return "nap";
    case "serious":
    default:
      if (roll < 0.56) return "observe";
      if (roll < 0.76) return "stretch";
      return "idle";
  }
}

export function emoteForDesktopActivity(activity: DesktopSoloActivity) {
  switch (activity) {
    case "play":
      return "♪";
    case "train":
      return "!";
    case "nap":
      return "💤";
    case "hover":
    case "drift":
      return "✦";
    case "sunbathe":
      return "☀";
    case "zigzag":
      return "!";
    case "observe":
      return Math.random() < 0.42 ? "?" : "";
    case "snack":
      return "🍓";
    default:
      return "";
  }
}


export function desktopActivityText(
  pokemon: OwnedPokemon,
  activity: DesktopSoloActivity,
) {
  const name = companionName(pokemon);

  switch (activity) {
    case "observe":
      return `${name} is quietly watching what everyone is doing.`;
    case "play":
      return `${name} has found something to entertain itself with.`;
    case "train":
      return `${name} is practicing its movements.`;
    case "nap":
      return `${name} has settled down for a little nap.`;
    case "hover":
      return `${name} is lazily hovering around the desktop.`;
    case "drift":
      return `${name} is quietly drifting around.`;
    case "sunbathe":
      return `${name} is soaking up a comfortable patch of light.`;
    case "zigzag":
      return `${name} is darting around in little zigzags.`;
    case "stretch":
      return `${name} is taking a moment to stretch.`;
    case "snack":
      return `${name} has settled down with a little berry snack.`;
    case "idle":
    default:
      return null;
  }
}



function sharedMoveNames(pokemon: OwnedPokemon[]) {
  if (pokemon.length < 2) return [];

  const firstMoves = pokemon[0].moves ?? [];
  const otherMoveSets = pokemon.slice(1).map(
    (entry) => new Set((entry.moves ?? []).map((move) => move.apiName)),
  );

  return firstMoves
    .filter((move) => otherMoveSets.every((moves) => moves.has(move.apiName)))
    .map((move) => move.displayName);
}

export function chooseDesktopSocialInteraction(
  pokemon: OwnedPokemon[],
): DesktopSocialChoice {
  const group = pokemon.length >= 3;
  const roll = Math.random();
  const commonMoves = sharedMoveNames(pokemon);

  if (!group) {
    if (commonMoves.length > 0 && roll < 0.30) {
      return {
        kind: "move-practice",
        sharedMoveName:
          commonMoves[Math.floor(Math.random() * commonMoves.length)],
      };
    }

    const temperaments = pokemon.map(temperamentForPokemon);
    const likesCompetition = temperaments.some((temperament) =>
      ["bold", "stubborn", "playful"].includes(temperament),
    );

    if (likesCompetition && roll < 0.54) return { kind: "spar" };
    if (roll < 0.70) return { kind: "play" };
    if (roll < 0.84) return { kind: "snack" };
    return { kind: "hangout" };
  }

  if (roll < 0.27) return { kind: "group-snack" };
  if (roll < 0.51) return { kind: "group-play" };
  if (roll < 0.72) return { kind: "group-training" };
  return { kind: "group-hangout" };
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "The companions";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function desktopSocialText(
  pokemon: OwnedPokemon[],
  choice: DesktopSocialChoice,
) {
  const names = pokemon.map(companionName);
  const joined = joinNames(names);

  switch (choice.kind) {
    case "move-practice":
      return choice.sharedMoveName
        ? `${joined} are practicing ${choice.sharedMoveName} together.`
        : `${joined} are practicing one of their shared moves together.`;
    case "spar":
      return `${joined} have started a friendly little sparring match.`;
    case "play":
      return `${joined} have wandered over to play together for a while.`;
    case "snack":
      return `${joined} have settled down together for a little berry break.`;
    case "group-snack":
      return `${joined} have gathered together to share a few berries.`;
    case "group-play":
      return `${joined} have all gotten caught up in the same little game.`;
    case "group-training":
      return `${joined} have gathered for a short training session together.`;
    case "group-hangout":
      return `${joined} are spending a quiet little moment together.`;
    case "hangout":
    default:
      return `${joined} are spending a little time together.`;
  }
}

export function desktopSocialActivity(
  kind: DesktopSocialKind,
): DesktopSoloActivity {
  switch (kind) {
    case "spar":
    case "move-practice":
    case "group-training":
      return "train";
    case "play":
    case "group-play":
      return "play";
    case "snack":
    case "group-snack":
      return "snack";
    case "hangout":
    case "group-hangout":
    default:
      return "idle";
  }
}

export function desktopSocialEmote(kind: DesktopSocialKind) {
  switch (kind) {
    case "spar":
    case "group-training":
      return "!";
    case "move-practice":
      return "✦";
    case "play":
    case "group-play":
      return "♪";
    case "snack":
    case "group-snack":
      return "🍓";
    case "hangout":
    case "group-hangout":
    default:
      return "♥";
  }
}

function warmTemperament(temperament: DesktopTemperament) {
  return temperament === "gentle" || temperament === "relaxed";
}

function irritableTemperament(temperament: DesktopTemperament) {
  return temperament === "stubborn" || temperament === "bold";
}

export function chooseDesktopHoverReaction(
  pokemon: OwnedPokemon,
  activity: DesktopSoloActivity,
  isMoving: boolean,
): DesktopHoverReaction {
  const name = companionName(pokemon);
  const temperament = temperamentForPokemon(pokemon);

  // Moving companions treat the cursor as an interruption to their stroll,
  // regardless of the visual activity that was being used during movement.
  if (isMoving) {
    if (temperament === "playful") {
      return {
        kind: "playful",
        emote: "♪",
        text: `${name} stops mid-stroll and perks up excitedly when it notices you.`,
        durationMs: 2100,
      };
    }

    if (temperament === "shy") {
      return {
        kind: "cautious",
        emote: "?",
        text: `${name} pauses its stroll and watches the cursor cautiously.`,
        durationMs: 2300,
      };
    }

    return {
      kind: "stroll-look",
      emote: "!",
      text: `${name} stops for a moment and looks your way.`,
      durationMs: 2000,
    };
  }

  if (activity === "nap") {
    if (irritableTemperament(temperament)) {
      return {
        kind: "grumpy",
        emote: "💢",
        text: `${name} wakes up looking distinctly unimpressed about being disturbed.`,
        durationMs: 2700,
      };
    }

    if (temperament === "shy") {
      return {
        kind: "cautious",
        emote: "?",
        text: `${name} startles awake and gives you a sleepy, cautious look.`,
        durationMs: 2500,
      };
    }

    if (temperament === "serious") {
      return {
        kind: "stoic",
        emote: "…",
        text: `${name} slowly opens its eyes and quietly acknowledges you.`,
        durationMs: 2400,
      };
    }

    return {
      kind: "sleepy",
      emote: warmTemperament(temperament) ? "♥" : "💤",
      text: warmTemperament(temperament)
        ? `${name} stirs gently and seems comfortable with you being there.`
        : `${name} wakes with a drowsy little wobble and looks your way.`,
      durationMs: 2500,
    };
  }

  if (activity === "train") {
    return {
      kind: "alert",
      emote: "!",
      text: irritableTemperament(temperament)
        ? `${name} snaps into an intense, battle-ready stance when it notices you.`
        : `${name} pauses its training and sharpens its focus on you.`,
      durationMs: 2200,
    };
  }

  if (activity === "snack") {
    if (irritableTemperament(temperament) || temperament === "shy") {
      return {
        kind: "snack-protective",
        emote: "!",
        text: `${name} keeps its berry close and watches you protectively.`,
        durationMs: 2300,
      };
    }

    return {
      kind: "snack-happy",
      emote: "♥",
      text: `${name} happily keeps snacking while giving you a warm little look.`,
      durationMs: 2200,
    };
  }

  if (activity === "stretch" || activity === "idle" || activity === "sunbathe") {
    if (warmTemperament(temperament)) {
      return {
        kind: "caring",
        emote: "♥",
        text: `${name} notices you with a gentle, caring look.`,
        durationMs: 2100,
      };
    }

    if (temperament === "playful") {
      return {
        kind: "playful",
        emote: "♪",
        text: `${name} perks up happily when it notices you nearby.`,
        durationMs: 2000,
      };
    }

    if (temperament === "shy") {
      return {
        kind: "cautious",
        emote: "?",
        text: `${name} pauses and gives you a small, cautious glance.`,
        durationMs: 2200,
      };
    }

    if (temperament === "curious") {
      return {
        kind: "playful",
        emote: "?",
        text: `${name} leans your way, clearly curious about the cursor.`,
        durationMs: 2100,
      };
    }

    return {
      kind: "stoic",
      emote: "!",
      text: `${name} calmly perks up and acknowledges your presence.`,
      durationMs: 1900,
    };
  }

  if (activity === "play" || activity === "zigzag") {
    return {
      kind: temperament === "shy" ? "cautious" : "playful",
      emote: temperament === "shy" ? "?" : "♪",
      text:
        temperament === "shy"
          ? `${name} pauses its fun for a second to see what you are doing.`
          : `${name} seems delighted that you joined its little moment of fun.`,
      durationMs: 2000,
    };
  }

  if (activity === "observe") {
    return {
      kind: temperament === "shy" ? "cautious" : "stoic",
      emote: temperament === "shy" ? "?" : "!",
      text: `${name} realizes you are watching too and turns its attention toward you.`,
      durationMs: 2000,
    };
  }

  if (activity === "hover" || activity === "drift") {
    return {
      kind: temperament === "playful" ? "playful" : "stroll-look",
      emote: temperament === "playful" ? "♪" : "!",
      text: `${name} steadies itself in place and looks toward the cursor.`,
      durationMs: 2000,
    };
  }

  return {
    kind: "stoic",
    emote: "!",
    text: `${name} notices you and briefly turns its attention your way.`,
    durationMs: 1900,
  };
}
