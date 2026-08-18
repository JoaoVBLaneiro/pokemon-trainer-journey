import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type OwnedPokemon } from "./db";
import {
  chooseDesktopHoverReaction,
  chooseDesktopSocialInteraction,
  chooseDesktopSoloActivity,
  clamp,
  companionName,
  desktopActivityText,
  desktopSocialActivity,
  desktopSocialEmote,
  desktopSocialText,
  emoteForDesktopActivity,
  hashString,
  hasType,
  idleDurationMs,
  preferredTravelDistance,
  randomBetween,
  temperamentForPokemon,
  verticalBandForPokemon,
  wanderRestChance,
  type DesktopHoverReaction,
  type DesktopSocialChoice,
  type DesktopSocialKind,
  type DesktopSoloActivity,
} from "./habitat/desktopBehavior";
import {
  readDesktopPreferences,
  subscribeDesktopPreferences,
} from "./desktopPreferences";
import "./DesktopOverlay.css";

declare global {
  interface Window {
    trainerJourneyDesktop?: {
      setMouseCapture: (shouldCapture: boolean) => void;
      setAppVisibilityRules: (rules: {
        mode: "everywhere" | "hide-selected" | "show-selected";
        apps: Array<{ key: string; name: string; path?: string }>;
      }) => void;
      listRunningApps: () => Promise<
        Array<{ key: string; name: string; path?: string; title?: string }>
      >;
    };
  }
}

type DesktopActor = {
  x: number;
  y: number;
  facing: 1 | -1;
  moveDurationMs: number;
  isMoving: boolean;
  moveEndsAt: number;
  nextDecisionAt: number;
  activity: DesktopSoloActivity;
  emote: string;
};

type DesktopFeedEvent = {
  id: string;
  text: string;
  pokemonIds?: string[];
};

type DesktopEffectKind =
  | "music"
  | "battle"
  | "sleep"
  | "sparkles"
  | "focus"
  | "stretch"
  | "snack";

type PetReactionMap = Record<string, number>;

type ActiveHoverReaction = {
  pokemonId: string;
  reaction: DesktopHoverReaction;
  token: number;
};

type DesktopSocialPhase = "approaching" | "active";

type DesktopSocialSession = {
  id: string;
  participantIds: string[];
  choice: DesktopSocialChoice;
  phase: DesktopSocialPhase;
  arriveAt: number;
  endAt: number;
};

const MIN_X = 5.5;
const MAX_X = 94.5;

const ACTIVITY_FEED_VISIBLE_MS = 7200;
const ACTIVITY_FEED_GAP_MS = 950;
const PRIORITY_FEED_VISIBLE_MS = 7200;
const PRIORITY_FEED_GAP_MS = 950;

// Social events should be noticeable, but still feel like little moments that
// happen naturally instead of a permanent party huddle.
const SOCIAL_FIRST_EVENT_MIN_MS = 12000;
const SOCIAL_FIRST_EVENT_MAX_MS = 19000;
const SOCIAL_NEXT_EVENT_MIN_MS = 19000;
const SOCIAL_NEXT_EVENT_MAX_MS = 31000;
const SOCIAL_RETRY_MIN_MS = 4200;
const SOCIAL_RETRY_MAX_MS = 7200;
const SOCIAL_PARTICIPANT_COOLDOWN_MIN_MS = 36000;
const SOCIAL_PARTICIPANT_COOLDOWN_MAX_MS = 58000;
const SOCIAL_ATTEMPT_CHANCE = 0.52;
const SOCIAL_GROUP_CHANCE = 0.24;
const SOCIAL_FOUR_MEMBER_CHANCE = 0.10;
const SOCIAL_ACTIVE_MIN_MS = 7800;
const SOCIAL_ACTIVE_MAX_MS = 10800;

function initialActor(pokemon: OwnedPokemon, index: number): DesktopActor {
  const hash = hashString(pokemon.id);
  const range = verticalBandForPokemon(pokemon);
  const baseX = 10 + ((index * 16 + (hash % 13)) % 80);
  const yNoise = ((hash >>> 5) % 1000) / 1000;
  const now = Date.now();

  return {
    x: clamp(baseX, MIN_X, MAX_X),
    y: range.min + (range.max - range.min) * yNoise,
    facing: hash % 2 === 0 ? 1 : -1,
    moveDurationMs: 3600,
    isMoving: false,
    moveEndsAt: 0,
    nextDecisionAt: now + 800 + (hash % 2600),
    activity: "idle",
    emote: "",
  };
}

function distanceScore(
  x: number,
  y: number,
  actors: Record<string, DesktopActor>,
  selfId: string,
) {
  let nearest = Number.POSITIVE_INFINITY;

  for (const [pokemonId, actor] of Object.entries(actors)) {
    if (pokemonId === selfId) continue;

    const dx = (x - actor.x) / 10.5;
    const dy = (y - actor.y) / 8.5;
    nearest = Math.min(nearest, Math.hypot(dx, dy));
  }

  return nearest === Number.POSITIVE_INFINITY ? 10 : nearest;
}

function chooseDestination(
  pokemon: OwnedPokemon,
  previous: DesktopActor,
  actors: Record<string, DesktopActor>,
) {
  const band = verticalBandForPokemon(pokemon);
  const travel = preferredTravelDistance(pokemon);
  const temperament = temperamentForPokemon(pokemon);
  const candidates: Array<{ x: number; y: number; score: number }> = [];

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const longStroll = Math.random() < (temperament === "playful" ? 0.34 : 0.22);
    const distance = longStroll
      ? randomBetween(Math.max(20, travel.min), Math.max(32, travel.max))
      : randomBetween(travel.min, travel.max);

    const horizontalBias = hasType(pokemon, "flying")
      ? randomBetween(0.68, 1)
      : randomBetween(0.76, 1);

    const direction = Math.random() < 0.5 ? -1 : 1;
    const x = clamp(
      previous.x + direction * distance * horizontalBias,
      MIN_X,
      MAX_X,
    );

    const makesVerticalExcursion = Math.random() < 0.34;
    const verticalReach = hasType(pokemon, "flying", "ghost")
      ? randomBetween(-24, 24)
      : randomBetween(-17, 17);

    // About a third of strolls deliberately choose a different vertical zone
    // instead of only nudging the previous Y coordinate. This is what lets the
    // companions genuinely spread across the desktop over time.
    const y = makesVerticalExcursion
      ? randomBetween(band.min, band.max)
      : clamp(previous.y + verticalReach, band.min, band.max);
    const spacing = distanceScore(x, y, actors, pokemon.id);

    // Prefer genuinely useful movement and positions that do not land directly
    // on another companion.
    const actualDistance = Math.hypot(x - previous.x, y - previous.y);
    const targetDistance = (travel.min + travel.max) / 2;
    const distanceFit =
      1 - Math.min(1, Math.abs(actualDistance - targetDistance) / Math.max(1, targetDistance));

    candidates.push({
      x,
      y,
      score: spacing * 1.7 + distanceFit + Math.random() * 0.35,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const chosen = candidates[0] ?? {
    x: clamp(previous.x + randomBetween(-18, 18), MIN_X, MAX_X),
    y: clamp(previous.y + randomBetween(-6, 6), band.min, band.max),
  };

  return { x: chosen.x, y: chosen.y };
}

function movementDurationMs(
  pokemon: OwnedPokemon,
  previous: DesktopActor,
  x: number,
  y: number,
) {
  const distance = Math.hypot(x - previous.x, y - previous.y);
  const temperament = temperamentForPokemon(pokemon);
  const speedFactor =
    temperament === "playful"
      ? 0.90
      : temperament === "relaxed"
        ? 1.16
        : temperament === "shy"
          ? 1.08
          : 1;

  return clamp((2800 + distance * 92) * speedFactor, 3200, 8600);
}


function socialParticipantOffsets(count: number) {
  if (count <= 2) {
    return [
      { x: -3.8, y: 0 },
      { x: 3.8, y: 0 },
    ];
  }

  if (count === 3) {
    return [
      { x: -4.6, y: 1.8 },
      { x: 4.6, y: 1.8 },
      { x: 0, y: -3.8 },
    ];
  }

  return [
    { x: -5.0, y: 2.0 },
    { x: 5.0, y: 2.0 },
    { x: -2.7, y: -3.8 },
    { x: 2.7, y: -3.8 },
  ];
}

function chooseSocialMeetingPoint(
  participantIds: string[],
  actors: Record<string, DesktopActor>,
) {
  const participantActors = participantIds
    .map((pokemonId) => actors[pokemonId])
    .filter((actor): actor is DesktopActor => Boolean(actor));

  if (participantActors.length === 0) {
    return { x: randomBetween(24, 76), y: randomBetween(22, 82) };
  }

  const averageX =
    participantActors.reduce((sum, actor) => sum + actor.x, 0) /
    participantActors.length;
  const averageY =
    participantActors.reduce((sum, actor) => sum + actor.y, 0) /
    participantActors.length;

  // Meet roughly between everyone, but with enough jitter that the desktop
  // does not develop one permanent "social hotspot" in the exact center.
  return {
    x: clamp(averageX + randomBetween(-9, 9), 14, 86),
    y: clamp(averageY + randomBetween(-12, 12), 14, 88),
  };
}

function socialFacingTowardOthers(
  pokemonId: string,
  participantIds: string[],
  actors: Record<string, DesktopActor>,
): 1 | -1 {
  const actor = actors[pokemonId];
  if (!actor) return 1;

  const others = participantIds
    .filter((participantId) => participantId !== pokemonId)
    .map((participantId) => actors[participantId])
    .filter((candidate): candidate is DesktopActor => Boolean(candidate));

  if (others.length === 0) return actor.facing;

  // Face the center of the OTHER participants. This makes duos look directly
  // at each other and makes groups naturally face inward rather than all
  // keeping whatever direction they happened to have while walking over.
  const othersCenterX =
    others.reduce((sum, candidate) => sum + candidate.x, 0) / others.length;

  if (othersCenterX > actor.x + 0.35) return 1;
  if (othersCenterX < actor.x - 0.35) return -1;

  // A participant can sit almost exactly on the group's horizontal center
  // (for example, the top member of a triangle). In that case, face the
  // nearest friend instead of leaving the direction random.
  const nearest = [...others].sort((a, b) => {
    const distanceA = Math.hypot(a.x - actor.x, a.y - actor.y);
    const distanceB = Math.hypot(b.x - actor.x, b.y - actor.y);
    return distanceA - distanceB;
  })[0];

  if (!nearest) return actor.facing;
  if (nearest.x > actor.x + 0.1) return 1;
  if (nearest.x < actor.x - 0.1) return -1;
  return actor.facing;
}

function socialClassName(kind: DesktopSocialKind) {
  return `social-${kind}`;
}

function menuSpriteCandidates(pokemon: OwnedPokemon) {
  return [
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-vii/icons/${pokemon.pokemonId}.png`,
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-viii/icons/${pokemon.pokemonId}.png`,
    pokemon.sprite,
    pokemon.isShiny ? pokemon.shinyArtwork : pokemon.artwork,
    pokemon.artwork,
  ].filter(
    (value, index, values): value is string =>
      Boolean(value) && values.indexOf(value) === index,
  );
}

function DesktopPokemonSprite({
  pokemon,
  facing,
}: {
  pokemon: OwnedPokemon;
  facing: 1 | -1;
}) {
  const candidates = useMemo(() => menuSpriteCandidates(pokemon), [pokemon]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [pokemon.id, pokemon.pokemonId]);

  const sprite = candidates[candidateIndex];

  if (!sprite) {
    return (
      <strong className="desktop-pokemon-fallback">
        {companionName(pokemon)[0]}
      </strong>
    );
  }

  // The Gen VII menu icons used by the desktop overlay have a left-facing
  // visual baseline. Actor `facing` is semantic (1 = right, -1 = left), so
  // the rendered X scale must be inverted. Keeping the CSS variable in the
  // same visual convention also preserves facing inside activity/social
  // keyframe animations.
  const spriteFacingScale = facing === 1 ? -1 : 1;

  return (
    <img
      src={sprite}
      alt=""
      draggable={false}
      style={{
        transform: `scaleX(${spriteFacingScale})`,
        ["--desktop-facing" as string]: String(spriteFacingScale),
      }}
      onError={() => {
        setCandidateIndex((index) => Math.min(index + 1, candidates.length));
      }}
    />
  );
}


function effectKindForActor(actor: DesktopActor): DesktopEffectKind | null {
  if (/[🍓🍎🍊🍒🍇🫐🍑🍍🥭🍐🍏]/u.test(actor.emote)) {
    return "snack";
  }

  switch (actor.activity) {
    case "play":
    case "zigzag":
      return "music";
    case "train":
      return "battle";
    case "nap":
      return "sleep";
    case "hover":
    case "drift":
    case "sunbathe":
      return "sparkles";
    case "observe":
      return "focus";
    case "stretch":
      return "stretch";
    case "snack":
      return "snack";
    default:
      return null;
  }
}

function DesktopPokemonEffects({ actor }: { actor: DesktopActor }) {
  const effectKind = effectKindForActor(actor);

  if (!effectKind || actor.isMoving) return null;

  switch (effectKind) {
    case "music":
      return (
        <span className="desktop-pokemon-effects effect-music" aria-hidden="true">
          <span className="desktop-effect note note-a">♪</span>
          <span className="desktop-effect note note-b">♫</span>
          <span className="desktop-effect sparkle sparkle-c">✦</span>
        </span>
      );
    case "battle":
      return (
        <span className="desktop-pokemon-effects effect-battle" aria-hidden="true">
          <span className="desktop-effect impact impact-a" />
          <span className="desktop-effect impact impact-b" />
          <span className="desktop-effect burst burst-c">✦</span>
        </span>
      );
    case "sleep":
      return (
        <span className="desktop-pokemon-effects effect-sleep" aria-hidden="true">
          <span className="desktop-effect sleep sleep-a">z</span>
          <span className="desktop-effect sleep sleep-b">Z</span>
          <span className="desktop-effect sleep sleep-c">z</span>
        </span>
      );
    case "focus":
      return (
        <span className="desktop-pokemon-effects effect-focus" aria-hidden="true">
          <span className="desktop-effect focus focus-a">?</span>
          <span className="desktop-effect focus focus-b">·</span>
        </span>
      );
    case "stretch":
      return (
        <span className="desktop-pokemon-effects effect-stretch" aria-hidden="true">
          <span className="desktop-effect stretch-line stretch-a" />
          <span className="desktop-effect stretch-line stretch-b" />
        </span>
      );
    case "snack":
      return (
        <span className="desktop-pokemon-effects effect-snack" aria-hidden="true">
          <span className="desktop-effect snack snack-a">✦</span>
          <span className="desktop-effect snack snack-b">✦</span>
          <span className="desktop-effect snack snack-c">♥</span>
        </span>
      );
    case "sparkles":
    default:
      return (
        <span className="desktop-pokemon-effects effect-sparkles" aria-hidden="true">
          <span className="desktop-effect sparkle sparkle-a">✦</span>
          <span className="desktop-effect sparkle sparkle-b">✦</span>
          <span className="desktop-effect sparkle sparkle-c">✦</span>
        </span>
      );
  }
}


function DesktopCursorReactionEffects({
  reaction,
}: {
  reaction: DesktopHoverReaction;
}) {
  return (
    <span
      className={`desktop-cursor-reaction-effects cursor-reaction-${reaction.kind}`}
      aria-hidden="true"
    >
      <span className="desktop-cursor-reaction-emote">{reaction.emote}</span>
      {(reaction.kind === "caring" || reaction.kind === "snack-happy") && (
        <>
          <span className="cursor-reaction-heart heart-one">♥</span>
          <span className="cursor-reaction-sparkle sparkle-one">✦</span>
        </>
      )}
      {reaction.kind === "playful" && (
        <>
          <span className="cursor-reaction-note note-one">♪</span>
          <span className="cursor-reaction-sparkle sparkle-one">✦</span>
        </>
      )}
      {reaction.kind === "grumpy" && (
        <span className="cursor-reaction-puff">〰</span>
      )}
      {reaction.kind === "alert" && (
        <>
          <span className="cursor-reaction-slash slash-one" />
          <span className="cursor-reaction-slash slash-two" />
        </>
      )}
      {reaction.kind === "snack-protective" && (
        <span className="cursor-reaction-berry">🍓</span>
      )}
    </span>
  );
}

export function DesktopOverlay() {
  const party: OwnedPokemon[] =
    useLiveQuery(
      async () => {
        const pokemon = await db.ownedPokemon
          .where("status")
          .equals("party")
          .toArray();

        return pokemon.sort(
          (a, b) =>
            (a.partySlot ?? Number.MAX_SAFE_INTEGER) -
            (b.partySlot ?? Number.MAX_SAFE_INTEGER),
        );
      },
      [],
    ) ?? [];

  const partyIdentity = party
    .map((pokemon) => `${pokemon.id}:${pokemon.pokemonId}:${pokemon.partySlot ?? "-"}`)
    .join("|");

  const [actors, setActors] = useState<Record<string, DesktopActor>>({});
  const actorsRef = useRef<Record<string, DesktopActor>>({});
  const previousActivitiesRef = useRef<Record<string, DesktopSoloActivity>>({});
  const feedSequenceRef = useRef(0);
  const feedEventRef = useRef<DesktopFeedEvent | null>(null);
  const pendingFeedEventRef = useRef<DesktopFeedEvent | null>(null);
  const feedGapTimerRef = useRef<number | null>(null);
  const priorityFeedSequenceRef = useRef(0);
  const priorityFeedEventRef = useRef<DesktopFeedEvent | null>(null);
  const pendingPriorityFeedEventRef = useRef<DesktopFeedEvent | null>(null);
  const priorityFeedGapTimerRef = useRef<number | null>(null);
  const [activityFeedEnabled, setActivityFeedEnabled] = useState(
    () => readDesktopPreferences().activityFeedEnabled,
  );
  const [mouseInteractionsEnabled, setMouseInteractionsEnabled] = useState(
    () => readDesktopPreferences().mouseInteractionsEnabled,
  );
  const [hoveredPokemonId, setHoveredPokemonId] = useState<string | null>(null);
  const [petReactions, setPetReactions] = useState<PetReactionMap>({});
  const [activeHoverReaction, setActiveHoverReaction] =
    useState<ActiveHoverReaction | null>(null);
  const hoverReactionSequenceRef = useRef(0);
  const hoverReactionCooldownsRef = useRef<Record<string, number>>({});
  const mouseCaptureRef = useRef(false);
  const cursorPositionRef = useRef<{ x: number; y: number } | null>(null);
  const [feedEvent, setFeedEvent] = useState<DesktopFeedEvent | null>(null);
  const [priorityFeedEvent, setPriorityFeedEvent] =
    useState<DesktopFeedEvent | null>(null);
  const [socialSession, setSocialSession] =
    useState<DesktopSocialSession | null>(null);
  const socialSessionRef = useRef<DesktopSocialSession | null>(null);
  const nextSocialAtRef = useRef(
    Date.now() + randomBetween(SOCIAL_FIRST_EVENT_MIN_MS, SOCIAL_FIRST_EVENT_MAX_MS),
  );
  const socialSequenceRef = useRef(0);
  const socialCooldownUntilRef = useRef<Record<string, number>>({});

  useEffect(() => {
    actorsRef.current = actors;
  }, [actors]);

  useEffect(() => {
    const preferences = readDesktopPreferences();
    window.trainerJourneyDesktop?.setAppVisibilityRules({
      mode: preferences.appVisibilityMode,
      apps: preferences.appVisibilityApps,
    });
  }, []);

  useEffect(() => {
    socialSessionRef.current = socialSession;
  }, [socialSession]);

  useEffect(() => {
    const setMouseCapture = (shouldCapture: boolean) => {
      if (mouseCaptureRef.current === shouldCapture) return;
      mouseCaptureRef.current = shouldCapture;
      window.trainerJourneyDesktop?.setMouseCapture(shouldCapture);
    };

    if (!mouseInteractionsEnabled) {
      cursorPositionRef.current = null;
      setHoveredPokemonId(null);
      setActiveHoverReaction(null);
      setMouseCapture(false);
      return;
    }

    const updateHitTest = () => {
      const cursor = cursorPositionRef.current;
      if (!cursor) {
        setHoveredPokemonId(null);
        setMouseCapture(false);
        return;
      }

      const target = document.elementFromPoint(cursor.x, cursor.y);
      const pokemonElement = target?.closest<HTMLElement>(
        ".desktop-pokemon[data-pokemon-id]",
      );
      const pokemonId = pokemonElement?.dataset.pokemonId ?? null;

      setHoveredPokemonId((current) =>
        current === pokemonId ? current : pokemonId,
      );
      setMouseCapture(Boolean(pokemonId));
    };

    const onMouseMove = (event: MouseEvent) => {
      cursorPositionRef.current = { x: event.clientX, y: event.clientY };
      updateHitTest();
    };

    const onMouseLeave = () => {
      cursorPositionRef.current = null;
      setHoveredPokemonId(null);
      setActiveHoverReaction(null);
      setMouseCapture(false);
    };

    document.addEventListener("mousemove", onMouseMove, true);
    document.documentElement.addEventListener("mouseleave", onMouseLeave);

    // Important: a Pokémon may walk out from underneath a stationary mouse.
    // Re-checking the hit target keeps the giant transparent window from ever
    // getting accidentally "stuck" capturing the desktop.
    const watchdog = window.setInterval(updateHitTest, 120);

    return () => {
      document.removeEventListener("mousemove", onMouseMove, true);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      window.clearInterval(watchdog);
      cursorPositionRef.current = null;
      setMouseCapture(false);
    };
  }, [mouseInteractionsEnabled]);


  const queuePriorityFeedText = (text: string, pokemonIds?: string[]) => {
    if (!activityFeedEnabled) return;

    priorityFeedSequenceRef.current += 1;
    const nextEvent: DesktopFeedEvent = {
      id: `${Date.now()}-priority-${priorityFeedSequenceRef.current}`,
      text,
      pokemonIds,
    };

    const feedIsBusy =
      priorityFeedEventRef.current !== null ||
      priorityFeedGapTimerRef.current !== null;

    if (feedIsBusy) {
      // Hover + social messages share the upper/high-priority lane, but they
      // never interrupt one another. We retain only the newest waiting event.
      pendingPriorityFeedEventRef.current = nextEvent;
    } else {
      priorityFeedEventRef.current = nextEvent;
      setPriorityFeedEvent(nextEvent);
    }
  };


  const clearSoloFeedForParticipants = (participantIds: string[]) => {
    const participantSet = new Set(participantIds);
    const belongsToParticipant = (event: DesktopFeedEvent | null) =>
      Boolean(event?.pokemonIds?.some((pokemonId) => participantSet.has(pokemonId)));

    if (belongsToParticipant(pendingFeedEventRef.current)) {
      pendingFeedEventRef.current = null;
    }

    if (!belongsToParticipant(feedEventRef.current)) return;

    feedEventRef.current = null;
    setFeedEvent(null);

    // If another Pokémon already had a waiting solo event, let that unrelated
    // message take the lower lane shortly after the conflicting message is
    // removed. Do not leave it stranded in the pending slot.
    const pending = pendingFeedEventRef.current;
    if (pending && feedGapTimerRef.current === null) {
      feedGapTimerRef.current = window.setTimeout(() => {
        feedGapTimerRef.current = null;
        const nextPending = pendingFeedEventRef.current;
        pendingFeedEventRef.current = null;
        if (!nextPending) return;
        feedEventRef.current = nextPending;
        setFeedEvent(nextPending);
      }, 420);
    }
  };

  useEffect(() => {
    if (party.length < 2) {
      socialSessionRef.current = null;
      setSocialSession(null);
      return;
    }

    const interval = window.setInterval(() => {
      const now = Date.now();
      const currentSession = socialSessionRef.current;

      if (currentSession) {
        if (currentSession.phase === "approaching" && now >= currentSession.arriveAt) {
          const activeSession: DesktopSocialSession = {
            ...currentSession,
            phase: "active",
          };
          socialSessionRef.current = activeSession;
          setSocialSession(activeSession);

          const activity = desktopSocialActivity(currentSession.choice.kind);
          const emote = desktopSocialEmote(currentSession.choice.kind);

          clearSoloFeedForParticipants(currentSession.participantIds);

          setActors((current) => {
            const next = { ...current };
            const facingByPokemon = Object.fromEntries(
              currentSession.participantIds.map((pokemonId) => [
                pokemonId,
                socialFacingTowardOthers(
                  pokemonId,
                  currentSession.participantIds,
                  current,
                ),
              ]),
            ) as Record<string, 1 | -1>;

            currentSession.participantIds.forEach((pokemonId) => {
              const actor = next[pokemonId];
              if (!actor) return;
              next[pokemonId] = {
                ...actor,
                facing: facingByPokemon[pokemonId] ?? actor.facing,
                isMoving: false,
                moveEndsAt: 0,
                activity,
                emote,
                nextDecisionAt: currentSession.endAt,
              };
            });

            actorsRef.current = next;
            return next;
          });

          const participants = currentSession.participantIds
            .map((pokemonId) => party.find((pokemon) => pokemon.id === pokemonId))
            .filter((pokemon): pokemon is OwnedPokemon => Boolean(pokemon));

          if (participants.length >= 2) {
            queuePriorityFeedText(
              desktopSocialText(participants, currentSession.choice),
              currentSession.participantIds,
            );
          }

          return;
        }

        if (currentSession.phase === "active" && now >= currentSession.endAt) {
          const finishedIds = currentSession.participantIds;
          socialSessionRef.current = null;
          setSocialSession(null);
          nextSocialAtRef.current =
            now + randomBetween(SOCIAL_NEXT_EVENT_MIN_MS, SOCIAL_NEXT_EVENT_MAX_MS);

          finishedIds.forEach((pokemonId) => {
            socialCooldownUntilRef.current[pokemonId] =
              now +
              randomBetween(
                SOCIAL_PARTICIPANT_COOLDOWN_MIN_MS,
                SOCIAL_PARTICIPANT_COOLDOWN_MAX_MS,
              );
          });

          setActors((current) => {
            const next = { ...current };

            finishedIds.forEach((pokemonId) => {
              const actor = next[pokemonId];
              if (!actor) return;
              next[pokemonId] = {
                ...actor,
                activity: "idle",
                emote: "",
                isMoving: false,
                moveEndsAt: 0,
                nextDecisionAt: now + randomBetween(2200, 4800),
              };
            });

            actorsRef.current = next;
            return next;
          });
        }

        return;
      }

      if (now < nextSocialAtRef.current) return;

      const unavailableIds = new Set<string>();
      if (hoveredPokemonId) unavailableIds.add(hoveredPokemonId);
      Object.keys(petReactions).forEach((pokemonId) => unavailableIds.add(pokemonId));

      const available = party.filter((pokemon) => {
        const actor = actorsRef.current[pokemon.id];
        const socialCooldownUntil =
          socialCooldownUntilRef.current[pokemon.id] ?? 0;
        return Boolean(
          actor &&
            !actor.isMoving &&
            !unavailableIds.has(pokemon.id) &&
            now >= socialCooldownUntil,
        );
      });

      if (available.length < 2) {
        // Don't give up for another half-minute just because everyone happened
        // to be strolling at the same instant. Retry soon.
        nextSocialAtRef.current =
          now + randomBetween(SOCIAL_RETRY_MIN_MS, SOCIAL_RETRY_MAX_MS);
        return;
      }

      // Reaching the social window only means a meetup MAY happen. This soft
      // probability keeps the moments from becoming a constant chain of events.
      if (Math.random() > SOCIAL_ATTEMPT_CHANCE) {
        nextSocialAtRef.current =
          now + randomBetween(SOCIAL_RETRY_MIN_MS, SOCIAL_RETRY_MAX_MS);
        return;
      }

      const shuffled = [...available].sort(() => Math.random() - 0.5);
      const canMakeGroup = shuffled.length >= 3;
      const wantsGroup = canMakeGroup && Math.random() < SOCIAL_GROUP_CHANCE;
      const participantCount = wantsGroup
        ? shuffled.length >= 4 && Math.random() < SOCIAL_FOUR_MEMBER_CHANCE
          ? 4
          : 3
        : 2;
      const participants = shuffled.slice(0, participantCount);
      const participantIds = participants.map((pokemon) => pokemon.id);
      const choice = chooseDesktopSocialInteraction(participants);
      const meeting = chooseSocialMeetingPoint(participantIds, actorsRef.current);
      const offsets = socialParticipantOffsets(participantIds.length);

      let longestTravelMs = 0;

      // The social session takes precedence immediately, even during the walk
      // over. Retire contradictory solo-feed messages from its participants.
      clearSoloFeedForParticipants(participantIds);
      participantIds.forEach((pokemonId) => {
        previousActivitiesRef.current[pokemonId] = "idle";
      });

      setActors((current) => {
        const next = { ...current };
        const targetActors: Record<string, DesktopActor> = { ...current };

        participantIds.forEach((pokemonId, index) => {
          const pokemon = participants[index];
          const actor = current[pokemonId];
          if (!pokemon || !actor) return;

          const offset = offsets[index] ?? { x: 0, y: 0 };
          const targetX = clamp(meeting.x + offset.x, MIN_X, MAX_X);
          const targetY = clamp(meeting.y + offset.y, 10, 91);
          targetActors[pokemonId] = {
            ...actor,
            x: targetX,
            y: targetY,
          };
        });

        const facingByPokemon = Object.fromEntries(
          participantIds.map((pokemonId) => [
            pokemonId,
            socialFacingTowardOthers(pokemonId, participantIds, targetActors),
          ]),
        ) as Record<string, 1 | -1>;

        participantIds.forEach((pokemonId, index) => {
          const pokemon = participants[index];
          const actor = next[pokemonId];
          const targetActor = targetActors[pokemonId];
          if (!pokemon || !actor || !targetActor) return;

          const targetX = targetActor.x;
          const targetY = targetActor.y;
          const travelMs = movementDurationMs(pokemon, actor, targetX, targetY);
          longestTravelMs = Math.max(longestTravelMs, travelMs);

          next[pokemonId] = {
            ...actor,
            x: targetX,
            y: targetY,
            facing: facingByPokemon[pokemonId] ?? actor.facing,
            moveDurationMs: travelMs,
            isMoving: true,
            moveEndsAt: now + travelMs,
            nextDecisionAt: now + travelMs + SOCIAL_ACTIVE_MAX_MS + 1200,
            activity: "idle",
            emote: "",
          };
        });

        actorsRef.current = next;
        return next;
      });

      const arriveAt = now + longestTravelMs + 180;
      const endAt =
        arriveAt + randomBetween(SOCIAL_ACTIVE_MIN_MS, SOCIAL_ACTIVE_MAX_MS);

      socialSequenceRef.current += 1;
      const nextSession: DesktopSocialSession = {
        id: `social-${Date.now()}-${socialSequenceRef.current}`,
        participantIds,
        choice,
        phase: "approaching",
        arriveAt,
        endAt,
      };

      socialSessionRef.current = nextSession;
      setSocialSession(nextSession);
    }, 550);

    return () => window.clearInterval(interval);
  }, [partyIdentity, activityFeedEnabled, hoveredPokemonId, petReactions]);

  const petPokemon = (pokemonId: string) => {
    if (!mouseInteractionsEnabled) return;

    let token = 0;
    setPetReactions((current) => {
      token = (current[pokemonId] ?? 0) + 1;
      return { ...current, [pokemonId]: token };
    });

    window.setTimeout(() => {
      setPetReactions((current) => {
        if (current[pokemonId] !== token) return current;
        const next = { ...current };
        delete next[pokemonId];
        return next;
      });
    }, 1150);
  };


  useEffect(() => {
    if (!mouseInteractionsEnabled || !hoveredPokemonId) {
      setActiveHoverReaction(null);
      return;
    }

    const now = Date.now();
    const cooldownUntil = hoverReactionCooldownsRef.current[hoveredPokemonId] ?? 0;
    if (now < cooldownUntil) return;

    const pokemon = party.find((candidate) => candidate.id === hoveredPokemonId);
    const actor = actorsRef.current[hoveredPokemonId];
    if (!pokemon || !actor) return;

    const currentSocialSession = socialSessionRef.current;
    if (currentSocialSession?.participantIds.includes(hoveredPokemonId)) {
      // Social sessions own their participants from approach through the end of
      // the interaction. Cursor reactions wait their turn instead of visually
      // overriding a meetup that is supposed to feel intentional.
      return;
    }

    const reaction = chooseDesktopHoverReaction(
      pokemon,
      actor.activity,
      actor.isMoving,
    );

    hoverReactionSequenceRef.current += 1;
    const token = hoverReactionSequenceRef.current;
    hoverReactionCooldownsRef.current[hoveredPokemonId] = now + 2800;

    // If the cursor catches a Pokémon mid-stroll, stop it at its ACTUAL current
    // rendered position rather than letting it snap to the destination stored in
    // state. After the cursor leaves, the normal scheduler will choose a fresh
    // destination naturally.
    const element = document.querySelector<HTMLElement>(
      `.desktop-pokemon[data-pokemon-id="${CSS.escape(hoveredPokemonId)}"]`,
    );

    setActors((current) => {
      const currentActor = current[hoveredPokemonId];
      if (!currentActor) return current;

      let x = currentActor.x;
      let y = currentActor.y;

      if (currentActor.isMoving && element) {
        const rect = element.getBoundingClientRect();
        x = clamp(((rect.left + rect.width / 2) / window.innerWidth) * 100, MIN_X, MAX_X);
        y = clamp((rect.bottom / window.innerHeight) * 100, 4, 94);
      }

      const next = {
        ...current,
        [hoveredPokemonId]: {
          ...currentActor,
          x,
          y,
          isMoving: false,
          moveEndsAt: 0,
          nextDecisionAt: Math.max(
            currentActor.nextDecisionAt,
            now + reaction.durationMs + 650,
          ),
        },
      };

      actorsRef.current = next;
      return next;
    });

    setActiveHoverReaction({
      pokemonId: hoveredPokemonId,
      reaction,
      token,
    });

    queuePriorityFeedText(reaction.text);
  }, [hoveredPokemonId, mouseInteractionsEnabled]);

  useEffect(
    () =>
      subscribeDesktopPreferences((preferences) => {
        window.trainerJourneyDesktop?.setAppVisibilityRules({
          mode: preferences.appVisibilityMode,
          apps: preferences.appVisibilityApps,
        });
        setActivityFeedEnabled(preferences.activityFeedEnabled);
        setMouseInteractionsEnabled(preferences.mouseInteractionsEnabled);

        if (!preferences.activityFeedEnabled) {
          feedEventRef.current = null;
          pendingFeedEventRef.current = null;
          priorityFeedEventRef.current = null;
          pendingPriorityFeedEventRef.current = null;

          if (feedGapTimerRef.current !== null) {
            window.clearTimeout(feedGapTimerRef.current);
            feedGapTimerRef.current = null;
          }

          if (priorityFeedGapTimerRef.current !== null) {
            window.clearTimeout(priorityFeedGapTimerRef.current);
            priorityFeedGapTimerRef.current = null;
          }

          setFeedEvent(null);
          setPriorityFeedEvent(null);
        }
      }),
    [],
  );

  useEffect(() => {
    feedEventRef.current = feedEvent;
  }, [feedEvent]);

  useEffect(() => {
    priorityFeedEventRef.current = priorityFeedEvent;
  }, [priorityFeedEvent]);


  useEffect(() => {
    if (!activityFeedEnabled || !feedEvent) return;

    const timeout = window.setTimeout(() => {
      if (feedEventRef.current?.id !== feedEvent.id) return;

      feedEventRef.current = null;
      setFeedEvent(null);

      // Leave a little breathing room between messages. If several activities
      // happened while this one was visible, only the newest pending event is
      // shown after the gap instead of creating a long notification backlog.
      if (pendingFeedEventRef.current) {
        feedGapTimerRef.current = window.setTimeout(() => {
          const pending = pendingFeedEventRef.current;
          pendingFeedEventRef.current = null;
          feedGapTimerRef.current = null;

          if (!pending) return;

          feedEventRef.current = pending;
          setFeedEvent(pending);
        }, ACTIVITY_FEED_GAP_MS);
      }
    }, ACTIVITY_FEED_VISIBLE_MS);

    return () => window.clearTimeout(timeout);
  }, [activityFeedEnabled, feedEvent]);


  useEffect(() => {
    if (!activityFeedEnabled || !priorityFeedEvent) return;

    const timeout = window.setTimeout(() => {
      if (priorityFeedEventRef.current?.id !== priorityFeedEvent.id) return;

      priorityFeedEventRef.current = null;
      setPriorityFeedEvent(null);

      if (pendingPriorityFeedEventRef.current) {
        priorityFeedGapTimerRef.current = window.setTimeout(() => {
          const pending = pendingPriorityFeedEventRef.current;
          pendingPriorityFeedEventRef.current = null;
          priorityFeedGapTimerRef.current = null;

          if (!pending) return;

          priorityFeedEventRef.current = pending;
          setPriorityFeedEvent(pending);
        }, PRIORITY_FEED_GAP_MS);
      }
    }, PRIORITY_FEED_VISIBLE_MS);

    return () => window.clearTimeout(timeout);
  }, [activityFeedEnabled, priorityFeedEvent]);

  useEffect(() => {
    if (!activityFeedEnabled) {
      previousActivitiesRef.current = Object.fromEntries(
        Object.entries(actors).map(([pokemonId, actor]) => [
          pokemonId,
          actor.activity,
        ]),
      );
      return;
    }

    let newest: { pokemon: OwnedPokemon; activity: DesktopSoloActivity } | null =
      null;

    const socialParticipantIds = new Set(
      socialSessionRef.current?.participantIds ?? [],
    );

    for (const pokemon of party) {
      const actor = actors[pokemon.id];
      if (!actor || actor.isMoving) continue;

      if (socialParticipantIds.has(pokemon.id)) {
        // The actor's activity field is reused to animate social play/training/
        // snacks. Do not misreport that visual state as a SOLO event.
        previousActivitiesRef.current[pokemon.id] = actor.activity;
        continue;
      }

      const previous = previousActivitiesRef.current[pokemon.id];
      if (
        previous !== actor.activity &&
        actor.activity !== "idle" &&
        desktopActivityText(pokemon, actor.activity)
      ) {
        newest = { pokemon, activity: actor.activity };
      }

      previousActivitiesRef.current[pokemon.id] = actor.activity;
    }

    if (newest) {
      const text = desktopActivityText(newest.pokemon, newest.activity);
      if (text) {
        feedSequenceRef.current += 1;

        const nextEvent: DesktopFeedEvent = {
          id: `${Date.now()}-${feedSequenceRef.current}`,
          text,
          pokemonIds: [newest.pokemon.id],
        };

        const feedIsBusy =
          feedEventRef.current !== null ||
          feedGapTimerRef.current !== null;

        if (feedIsBusy) {
          // Do not interrupt the readable message already on screen.
          // Keeping only the latest pending event prevents a large backlog.
          pendingFeedEventRef.current = nextEvent;
        } else {
          feedEventRef.current = nextEvent;
          setFeedEvent(nextEvent);
        }
      }
    }
  }, [actors, activityFeedEnabled, party]);

  useEffect(() => {
    socialSessionRef.current = null;
    setSocialSession(null);
    socialCooldownUntilRef.current = {};
    nextSocialAtRef.current =
      Date.now() + randomBetween(SOCIAL_FIRST_EVENT_MIN_MS, SOCIAL_FIRST_EVENT_MAX_MS);

    setActors((current) => {
      const next: Record<string, DesktopActor> = {};

      party.forEach((pokemon, index) => {
        next[pokemon.id] = current[pokemon.id] ?? initialActor(pokemon, index);
      });

      actorsRef.current = next;
      return next;
    });
  }, [partyIdentity]);

  useEffect(() => {
    if (party.length === 0) return;

    const interval = window.setInterval(() => {
      const now = Date.now();

      setActors((current) => {
        let changed = false;
        const next = { ...current };

        party.forEach((pokemon, index) => {
          let actor = next[pokemon.id] ?? initialActor(pokemon, index);

          const currentSocialSession = socialSessionRef.current;
          if (currentSocialSession?.participantIds.includes(pokemon.id)) {
            // Social movement / activity owns these actors until the session
            // finishes. The solo clock is not allowed to pull one away early.
            return;
          }

          // Finish a walk without immediately forcing another one. The Pokémon
          // gets a genuine little pause/activity after reaching its destination.
          if (actor.isMoving && now >= actor.moveEndsAt) {
            const activity = chooseDesktopSoloActivity(pokemon);
            actor = {
              ...actor,
              isMoving: false,
              moveEndsAt: 0,
              activity,
              emote: emoteForDesktopActivity(activity),
              nextDecisionAt: now + idleDurationMs(pokemon),
            };
            next[pokemon.id] = actor;
            changed = true;
            return;
          }

          if (actor.isMoving || now < actor.nextDecisionAt) {
            if (!next[pokemon.id]) next[pokemon.id] = actor;
            return;
          }

          // Sometimes they simply choose another idle beat rather than walking.
          // This makes the desktop feel inhabited instead of constantly in motion.
          if (Math.random() < wanderRestChance(pokemon)) {
            const activity = chooseDesktopSoloActivity(pokemon);
            next[pokemon.id] = {
              ...actor,
              activity,
              emote: emoteForDesktopActivity(activity),
              isMoving: false,
              nextDecisionAt: now + idleDurationMs(pokemon),
            };
            changed = true;
            return;
          }

          const destination = chooseDestination(pokemon, actor, next);
          const moveDurationMs = movementDurationMs(
            pokemon,
            actor,
            destination.x,
            destination.y,
          );

          next[pokemon.id] = {
            ...actor,
            x: destination.x,
            y: destination.y,
            facing:
              destination.x === actor.x
                ? actor.facing
                : destination.x > actor.x
                  ? 1
                  : -1,
            moveDurationMs,
            isMoving: true,
            moveEndsAt: now + moveDurationMs,
            nextDecisionAt: now + moveDurationMs,
            activity: hasType(pokemon, "flying")
              ? "hover"
              : hasType(pokemon, "ghost")
                ? "drift"
                : temperamentForPokemon(pokemon) === "playful"
                  ? "play"
                  : "idle",
            emote: "",
          };

          changed = true;
        });

        if (changed) {
          actorsRef.current = next;
          return next;
        }

        return current;
      });
    }, 300);

    return () => window.clearInterval(interval);
  }, [partyIdentity]);

  return (
    <div
      className={`desktop-overlay-root ${
        mouseInteractionsEnabled ? "mouse-interactions-enabled" : ""
      }`}
      aria-label="Trainer Journey desktop companions"
    >
      {party.length === 0 && (
        <div className="desktop-overlay-empty">
          <strong>No party found in the desktop app yet.</strong>
          <span>
            Import your Trainer Journey save in the Electron window, then your
            current party will appear here.
          </span>
        </div>
      )}

      {party.map((pokemon, index) => {
        const actor = actors[pokemon.id] ?? initialActor(pokemon, index);
        const phase = -((hashString(pokemon.id) % 1000) / 1000);
        const isCursorHovered = hoveredPokemonId === pokemon.id;
        const isPetted = Boolean(petReactions[pokemon.id]);
        const cursorReaction =
          activeHoverReaction?.pokemonId === pokemon.id
            ? activeHoverReaction.reaction
            : null;
        const isSocialParticipant = Boolean(
          socialSession?.participantIds.includes(pokemon.id),
        );
        const socialIsActive =
          isSocialParticipant && socialSession?.phase === "active";
        const socialIsApproaching =
          isSocialParticipant && socialSession?.phase === "approaching";

        const style = {
          left: `${actor.x}%`,
          top: `${actor.y}%`,
          zIndex: Math.round(actor.y * 10),
          "--desktop-move-duration": `${actor.moveDurationMs}ms`,
          "--desktop-bounce-delay": `${phase}s`,
        } as CSSProperties;

        const classes = [
          "desktop-pokemon",
          actor.isMoving ? "is-moving" : "is-idle",
          `activity-${actor.activity}`,
          `temperament-${temperamentForPokemon(pokemon)}`,
          isCursorHovered ? "is-cursor-hovered" : "",
          cursorReaction ? `hover-reaction-${cursorReaction.kind}` : "",
          cursorReaction ? "has-contextual-hover-reaction" : "",
          isPetted ? "is-petted" : "",
          socialIsApproaching ? "is-social-approaching" : "",
          socialIsActive ? "is-social-active" : "",
          socialIsActive && socialSession
            ? socialClassName(socialSession.choice.kind)
            : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            className={classes}
            style={style}
            title={companionName(pokemon)}
            data-pokemon-id={pokemon.id}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              petPokemon(pokemon.id);
            }}
            key={pokemon.id}
          >
            {actor.emote && !actor.isMoving && (
              <span className="desktop-pokemon-emote" aria-hidden="true">
                {actor.emote}
              </span>
            )}

            {cursorReaction && !isPetted && (
              <DesktopCursorReactionEffects
                reaction={cursorReaction}
                key={`${activeHoverReaction?.token ?? 0}-${pokemon.id}`}
              />
            )}

            {isPetted && (
              <span className="desktop-pet-effects" aria-hidden="true">
                <span className="pet-heart heart-a">♥</span>
                <span className="pet-heart heart-b">♥</span>
                <span className="pet-sparkle pet-sparkle-a">✦</span>
                <span className="pet-sparkle pet-sparkle-b">✦</span>
              </span>
            )}

            {!isSocialParticipant && <DesktopPokemonEffects actor={actor} />}

            {socialIsActive && socialSession && (
              <span
                className={`desktop-social-effects ${socialClassName(
                  socialSession.choice.kind,
                )}`}
                aria-hidden="true"
              >
                <span className="social-effect social-effect-a">✦</span>
                <span className="social-effect social-effect-b">
                  {socialSession.choice.kind.includes("snack") ? "🍓" : "✦"}
                </span>
              </span>
            )}

            <span className="desktop-pokemon-shadow" />

            <span className="desktop-pokemon-bouncer">
              <DesktopPokemonSprite
                pokemon={pokemon}
                facing={actor.facing}
              />
            </span>
          </div>
        );
      })}

      {activityFeedEnabled && feedEvent && (
        <div
          className="desktop-activity-feed desktop-activity-feed-solo"
          key={feedEvent.id}
        >
          <span aria-hidden="true">✦</span>
          <p>{feedEvent.text}</p>
        </div>
      )}

      {activityFeedEnabled && priorityFeedEvent && (
        <div
          className={`desktop-activity-feed desktop-activity-feed-priority ${
            feedEvent ? "is-stacked" : ""
          }`}
          key={priorityFeedEvent.id}
        >
          <span aria-hidden="true">◆</span>
          <p>{priorityFeedEvent.text}</p>
        </div>
      )}
    </div>
  );
}
