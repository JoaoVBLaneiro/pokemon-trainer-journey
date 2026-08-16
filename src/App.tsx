import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  HashRouter,
  NavLink,
  Route,
  Routes,
} from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import {
  addOwnedPokemon,
  db,
  DEFAULT_TRAINER,
  deleteJournalEntry,
  deletePokemonPlace,
  deleteReleaseMemory,
  ensureTrainerProfile,
  evolveOwnedPokemon,
  movePokemonToLocation,
  movePokemonToParty,
  PartyFullError,
  PRIMARY_TRAINER_ID,
  releaseOwnedPokemon,
  saveJournalEntry,
  savePokemonPlace,
  saveTrainerProfile,
  undoLatestEvolution,
  updateEvolutionMemory,
  updateOwnedPokemon,
  updateReleaseMemory,
  type EvolutionMemory,
  type JournalEntry,
  type JournalEntryKind,
  type JournalPokemonParticipant,
  type OwnedPokemon,
  type OwnedPokemonStatus,
  type PokemonAbilityOption,
  type PokemonCatalogEntry,
  type PokemonEvolutionSnapshot,
  type PokemonHeldItem,
  type PokemonItemIndexEntry,
  type PokemonMoveOption,
  type PokemonGender,
  type PokemonPlace,
  type PokemonPlaceKind,
  type PokemonSpeciesDetails,
  type PokemonSpeciesIndexEntry,
  type ReleaseMemory,
  type TrainerProfile,
} from "./db";
import {
  fetchEvolutionOptions,
  fetchItemDetails,
  fetchMoveDetails,
  fetchPokemonForm,
  fetchSpeciesDetails,
  fetchSpeciesSelection,
  hydrateStoredLoadoutVisuals,
  loadItemIndex,
  loadSpeciesIndex,
  type EvolutionOption,
} from "./pokeapi";
import { HabitatPage } from "./HabitatPage";
import "./App.css";

const pokemonTypes = [
  "Normal",
  "Fire",
  "Water",
  "Electric",
  "Grass",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Dark",
  "Steel",
  "Fairy",
];

const pokemonNatures = [
  "",
  "Hardy",
  "Lonely",
  "Brave",
  "Adamant",
  "Naughty",
  "Bold",
  "Docile",
  "Relaxed",
  "Impish",
  "Lax",
  "Timid",
  "Hasty",
  "Serious",
  "Jolly",
  "Naive",
  "Modest",
  "Mild",
  "Quiet",
  "Bashful",
  "Rash",
  "Calm",
  "Gentle",
  "Sassy",
  "Careful",
  "Quirky",
];

const placeKinds: Array<{
  value: PokemonPlaceKind;
  label: string;
  icon: string;
  description: string;
}> = [
  {
    value: "home",
    label: "Home",
    icon: "⌂",
    description: "A family home, apartment, or personal base.",
  },
  {
    value: "laboratory",
    label: "Laboratory",
    icon: "⚗",
    description: "A professor's lab or research reserve.",
  },
  {
    value: "ranch",
    label: "Ranch",
    icon: "♧",
    description: "Open land where several partners can live.",
  },
  {
    value: "daycare",
    label: "Day Care",
    icon: "♡",
    description: "A trusted place for rest and care.",
  },
  {
    value: "gym",
    label: "Gym or training site",
    icon: "△",
    description: "A location focused on training and practice.",
  },
  {
    value: "pokemon-center",
    label: "Pokémon Center",
    icon: "✚",
    description: "A recovery or long-term care location.",
  },
  {
    value: "camp",
    label: "Camp",
    icon: "⛺",
    description: "A temporary camp or expedition base.",
  },
  {
    value: "habitat",
    label: "Natural habitat",
    icon: "◇",
    description: "A forest, lake, cave, island, or other habitat.",
  },
  {
    value: "pc",
    label: "PC storage",
    icon: "▣",
    description: "A traditional digital PC box.",
  },
  {
    value: "other",
    label: "Other",
    icon: "⌖",
    description: "Any custom place that fits your story.",
  },
];

function getPlaceKindMeta(kind: PokemonPlaceKind) {
  return (
    placeKinds.find((entry) => entry.value === kind) ??
    placeKinds[placeKinds.length - 1]
  );
}

function getPlaceAddress(place: PokemonPlace) {
  return [place.locality, place.region].filter(Boolean).join(", ");
}

const typeColors: Record<string, { accent: string; tint: string }> = {
  normal: { accent: "#7b817b", tint: "#eceeec" },
  fire: { accent: "#c96f3d", tint: "#f7e7de" },
  water: { accent: "#4d82a5", tint: "#e4eff5" },
  electric: { accent: "#c99a31", tint: "#f8f0d7" },
  grass: { accent: "#5b8763", tint: "#e5efe5" },
  ice: { accent: "#5c9b9d", tint: "#e3f0f0" },
  fighting: { accent: "#a95549", tint: "#f3e4e1" },
  poison: { accent: "#80588d", tint: "#eee7f1" },
  ground: { accent: "#a67d49", tint: "#f1e9df" },
  flying: { accent: "#6f83a5", tint: "#e8edf4" },
  psychic: { accent: "#b96583", tint: "#f5e6ec" },
  bug: { accent: "#718342", tint: "#ebefdf" },
  rock: { accent: "#897657", tint: "#eee9e1" },
  ghost: { accent: "#6e5886", tint: "#ebe7f1" },
  dragon: { accent: "#5d638d", tint: "#e8e9f2" },
  dark: { accent: "#5f5957", tint: "#e9e7e6" },
  steel: { accent: "#647d83", tint: "#e7edef" },
  fairy: { accent: "#c37994", tint: "#f6e8ee" },
  stellar: { accent: "#7a6fc2", tint: "#eeebfa" },
  shadow: { accent: "#4f4369", tint: "#e9e5ef" },
  unknown: { accent: "#6f7773", tint: "#eceeed" },
};

const navItems = [
  { to: "/", label: "Home", icon: "⌂" },
  { to: "/pokemon", label: "My Pokémon", icon: "◉" },
  { to: "/party", label: "Party", icon: "✦" },
  { to: "/places", label: "Places", icon: "⌖" },
  { to: "/habitat", label: "Habitat", icon: "♧" },
  { to: "/journal", label: "Journal", icon: "▤" },
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "TR";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Trainer";
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function getWeekday() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
  }).format(new Date());
}

function getCompanionName(pokemon: OwnedPokemon) {
  return pokemon.nickname.trim() || pokemon.displayName;
}

function getArtwork(pokemon: OwnedPokemon) {
  return pokemon.isShiny
    ? pokemon.shinyArtwork || pokemon.artwork
    : pokemon.artwork;
}

function getTypeStyle(types: string[]): CSSProperties {
  const colors = typeColors[types[0]] ?? typeColors.normal;

  return {
    "--card-accent": colors.accent,
    "--card-tint": colors.tint,
  } as CSSProperties;
}

function getMoveTypeStyle(type?: string): CSSProperties {
  const colors = typeColors[type ?? "normal"] ?? typeColors.normal;

  return {
    "--move-accent": colors.accent,
    "--move-tint": colors.tint,
  } as CSSProperties;
}

function formatType(type: string) {
  return type.length > 0
    ? `${type[0].toUpperCase()}${type.slice(1)}`
    : type;
}

function formatStatus(status: OwnedPokemon["status"]) {
  return status === "party" ? "Travelling" : "In reserve";
}

function todayAsInputValue() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  return new Date(today.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 10);
}

function formatDisplayDate(value: string) {
  if (!value) {
    return "Date not recorded";
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getReleaseMemoryName(memory: ReleaseMemory) {
  return memory.nickname.trim() || memory.displayName;
}

function getReleaseMemoryArtwork(memory: ReleaseMemory) {
  return memory.isShiny
    ? memory.shinyArtwork || memory.artwork
    : memory.artwork;
}

function getEvolutionMemoryName(memory: EvolutionMemory) {
  return memory.pokemonNickname.trim() || memory.to.displayName;
}

function getSnapshotArtwork(
  snapshot: PokemonEvolutionSnapshot,
  isShiny: boolean,
) {
  return isShiny
    ? snapshot.shinyArtwork || snapshot.artwork
    : snapshot.artwork;
}

const journalKindMeta: Record<
  JournalEntryKind,
  { label: string; icon: string }
> = {
  "pokemon-met": { label: "Pokémon meeting", icon: "◉" },
  gym: { label: "Gym victory", icon: "🏅" },
  badge: { label: "Badge earned", icon: "◆" },
  battle: { label: "Battle", icon: "⚔" },
  journey: { label: "Journey moment", icon: "⌖" },
  bond: { label: "Pokémon bond", icon: "♥" },
  achievement: { label: "Achievement", icon: "★" },
  note: { label: "Journal note", icon: "✎" },
  custom: { label: "Custom memory", icon: "✦" },
};

function getJournalParticipantName(participant: JournalPokemonParticipant) {
  return participant.nickname.trim() || participant.displayName;
}

function getJournalParticipantArtwork(participant: JournalPokemonParticipant) {
  return participant.isShiny
    ? participant.shinyArtwork || participant.artwork
    : participant.artwork;
}

function getMemoryTimelineDate(
  memory: ReleaseMemory | EvolutionMemory | JournalEntry,
) {
  if ("eventDate" in memory) {
    return memory.eventDate || memory.createdAt.slice(0, 10);
  }

  if ("releaseDate" in memory) {
    return memory.releaseDate || memory.createdAt.slice(0, 10);
  }

  return memory.evolutionDate || memory.createdAt.slice(0, 10);
}

function resourceSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parsePokemonLevel(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const level = Number(trimmed);

  if (!Number.isInteger(level) || level < 1 || level > 100) {
    throw new Error("Level must be a whole number from 1 to 100.");
  }

  return level;
}

function findNamedResource<T extends { apiName: string; displayName: string }>(
  value: string,
  options: T[],
) {
  const normalized = value.trim().toLowerCase();

  return options.find(
    (option) =>
      option.apiName.toLowerCase() === normalized ||
      option.displayName.toLowerCase() === normalized,
  );
}

async function resolveHeldItem(
  value: string,
  itemOptions: PokemonItemIndexEntry[],
): Promise<PokemonHeldItem | undefined> {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const match = findNamedResource(trimmed, itemOptions);

  if (!match) {
    return {
      apiName: resourceSlug(trimmed),
      displayName: trimmed,
      isCustom: true,
    };
  }

  try {
    return await fetchItemDetails(match.apiName);
  } catch (error) {
    console.warn("Could not load the selected item icon:", error);
    return { apiName: match.apiName, displayName: match.displayName };
  }
}

async function resolveMoves(
  values: string[],
  moveOptions: PokemonMoveOption[],
): Promise<PokemonMoveOption[]> {
  const resolved: PokemonMoveOption[] = [];

  for (const value of values) {
    const trimmed = value.trim();

    if (!trimmed) {
      continue;
    }

    const match = findNamedResource(trimmed, moveOptions);
    let move: PokemonMoveOption;

    if (match) {
      try {
        move = await fetchMoveDetails(match.apiName);
      } catch (error) {
        console.warn("Could not load the selected move type:", error);
        move = { apiName: match.apiName, displayName: match.displayName };
      }
    } else {
      move = {
        apiName: resourceSlug(trimmed),
        displayName: trimmed,
        isCustom: true,
      };
    }

    if (!resolved.some((entry) => entry.apiName === move.apiName)) {
      resolved.push(move);
    }
  }

  return resolved.slice(0, 4);
}

function fourMoveInputs(moves?: PokemonMoveOption[]) {
  return Array.from({ length: 4 }, (_, index) => moves?.[index]?.displayName ?? "");
}

function getDefaultAbilityApiName(abilities: PokemonAbilityOption[]) {
  return (abilities.find((ability) => !ability.isHidden) ?? abilities[0])?.apiName ?? "";
}

function HeldItemIcon({
  item,
  className = "",
}: {
  item?: PokemonHeldItem;
  className?: string;
}) {
  if (item?.sprite) {
    return (
      <img
        className={`held-item-icon ${className}`.trim()}
        src={item.sprite}
        alt=""
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className={`held-item-icon held-item-icon-placeholder ${className}`.trim()}
      aria-hidden="true"
    >
      ◇
    </span>
  );
}

function PokemonLoadoutFields({
  idPrefix,
  level,
  onLevelChange,
  abilities,
  abilityApiName,
  onAbilityChange,
  heldItem,
  onHeldItemChange,
  itemOptions,
  moves,
  onMoveChange,
  moveOptions,
  isLoading = false,
}: {
  idPrefix: string;
  level: string;
  onLevelChange: (value: string) => void;
  abilities: PokemonAbilityOption[];
  abilityApiName: string;
  onAbilityChange: (value: string) => void;
  heldItem: string;
  onHeldItemChange: (value: string) => void;
  itemOptions: PokemonItemIndexEntry[];
  moves: string[];
  onMoveChange: (index: number, value: string) => void;
  moveOptions: PokemonMoveOption[];
  isLoading?: boolean;
}) {
  const itemListId = `${idPrefix}-held-items`;
  const moveListId = `${idPrefix}-moves`;
  const [itemPreview, setItemPreview] = useState<PokemonHeldItem | undefined>();
  const [movePreviews, setMovePreviews] = useState<
    Array<PokemonMoveOption | undefined>
  >(() => Array.from({ length: 4 }, () => undefined));

  useEffect(() => {
    let cancelled = false;
    const match = findNamedResource(heldItem, itemOptions);

    if (!match) {
      setItemPreview(undefined);
      return () => {
        cancelled = true;
      };
    }

    void fetchItemDetails(match.apiName)
      .then((item) => {
        if (!cancelled) {
          setItemPreview(item);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItemPreview({
            apiName: match.apiName,
            displayName: match.displayName,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [heldItem, itemOptions]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all(
      moves.map(async (move) => {
        const match = findNamedResource(move, moveOptions);

        if (!match) {
          return undefined;
        }

        try {
          return await fetchMoveDetails(match.apiName);
        } catch {
          return match;
        }
      }),
    ).then((previews) => {
      if (!cancelled) {
        setMovePreviews(previews);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [moves, moveOptions]);

  return (
    <section className="pokemon-loadout-zone">
      <div className="loadout-zone-heading">
        <div>
          <span className="section-kicker">Current training details</span>
          <h3>Level, ability, item, and moves</h3>
          <p>
            PokéAPI suggestions follow this form's available abilities and broad
            move learnset. You may still type a custom item or move for your story.
          </p>
        </div>
        {isLoading && <span className="loadout-loading">Loading options…</span>}
      </div>

      <div className="loadout-core-grid">
        <label className="form-field">
          <span>Current level</span>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={level}
            onChange={(event) => onLevelChange(event.target.value)}
            placeholder="Not recorded"
          />
          <small>Optional · Levels 1–100</small>
        </label>

        <label className="form-field">
          <span>Ability</span>
          <select
            value={abilityApiName}
            onChange={(event) => onAbilityChange(event.target.value)}
            disabled={isLoading && abilities.length === 0}
          >
            <option value="">Not recorded</option>
            {abilities.map((ability) => (
              <option value={ability.apiName} key={ability.apiName}>
                {ability.displayName}{ability.isHidden ? " — Hidden Ability" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field form-field-full">
          <span>Held item</span>
          <div className="loadout-held-item-input">
            <HeldItemIcon item={itemPreview} />
            <input
              type="text"
              list={itemListId}
              value={heldItem}
              onChange={(event) => onHeldItemChange(event.target.value)}
              placeholder="Leftovers, Sitrus Berry, a custom keepsake…"
              maxLength={60}
            />
          </div>
          <small>Choose an official item suggestion or type a custom one.</small>
          <datalist id={itemListId}>
            {itemOptions.map((item) => (
              <option value={item.displayName} key={item.apiName} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="move-set-heading">
        <strong>Current moves</strong>
        <span>{moves.filter((move) => move.trim()).length}/4 selected</span>
      </div>
      <div className="move-picker-grid">
        {moves.map((move, index) => {
          const preview = movePreviews[index];

          return (
            <label
              className="move-picker-field"
              key={`${idPrefix}-move-${index}`}
            >
              <span>Move {index + 1}</span>
              <div
                className={`move-input-shell ${preview?.type ? "typed" : ""}`}
                style={getMoveTypeStyle(preview?.type)}
              >
                {preview?.type && (
                  <span className="move-input-type">
                    {formatType(preview.type)}
                  </span>
                )}
                <input
                  type="text"
                  list={moveListId}
                  value={move}
                  onChange={(event) => onMoveChange(index, event.target.value)}
                  placeholder={
                    index === 0 ? "Choose or type a move" : "Empty move slot"
                  }
                  maxLength={60}
                />
              </div>
            </label>
          );
        })}
      </div>
      <datalist id={moveListId}>
        {moveOptions.map((move) => (
          <option value={move.displayName} key={move.apiName} />
        ))}
      </datalist>
    </section>
  );
}

type TrainerComponentProps = {
  trainer: TrainerProfile;
  onEditProfile: () => void;
};

function Sidebar({ trainer, onEditProfile }: TrainerComponentProps) {
  const initials = getInitials(trainer.name);

  return (
    <aside className="sidebar">
      <div>
        <div className="brand">
          <div className="brand-mark">
            <span />
          </div>
          <div>
            <strong>Trainer Journey</strong>
            <small>Your Pokémon life</small>
          </div>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              end={item.to === "/"}
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar-footer">
        <button
          className="trainer-mini-card"
          type="button"
          onClick={onEditProfile}
          aria-label="Edit trainer profile"
        >
          <span className="mini-avatar">{initials}</span>
          <span className="mini-trainer-copy">
            <strong>{trainer.name}</strong>
            <small>
              {trainer.role} · {trainer.region}
            </small>
          </span>
          <span className="mini-more">•••</span>
        </button>
        <p>Local journey · PokéAPI connected</p>
      </div>
    </aside>
  );
}

function MobileHeader({
  trainer,
  onEditProfile,
}: TrainerComponentProps) {
  return (
    <header className="mobile-header">
      <div className="brand compact">
        <div className="brand-mark">
          <span />
        </div>
        <strong>Trainer Journey</strong>
      </div>
      <button
        className="mobile-profile-button"
        type="button"
        onClick={onEditProfile}
        aria-label="Edit trainer profile"
      >
        <span className="mini-avatar">{getInitials(trainer.name)}</span>
      </button>
    </header>
  );
}

function PageHeader({
  trainer,
  onAddPokemon,
}: {
  trainer: TrainerProfile;
  onAddPokemon: () => void;
}) {
  const greeting = useMemo(() => getGreeting(), []);
  const weekday = useMemo(() => getWeekday(), []);

  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">
          {weekday} · {trainer.currentCity}
        </p>
        <h1>
          {greeting}, {getFirstName(trainer.name)}.
        </h1>
        <p className="header-description">
          Your journey is beginning to feel like your own.
        </p>
      </div>

      <button
        className="primary-button"
        type="button"
        onClick={onAddPokemon}
      >
        <span>＋</span>
        Add a Pokémon
      </button>
    </header>
  );
}

function TrainerCard({
  trainer,
  onEditProfile,
  partnerCount,
  partyCount,
  memoryCount,
}: TrainerComponentProps & {
  partnerCount: number;
  partyCount: number;
  memoryCount: number;
}) {
  return (
    <section className="trainer-card">
      <div className="trainer-card-decoration decoration-one" />
      <div className="trainer-card-decoration decoration-two" />

      <div className="trainer-card-top">
        <span className="section-kicker light">Trainer profile</span>
        <button
          className="ghost-light-button"
          type="button"
          onClick={onEditProfile}
        >
          Edit profile
        </button>
      </div>

      <div className="trainer-identity">
        <div className="trainer-avatar">
          <span>{getInitials(trainer.name)}</span>
          <div className="avatar-status" />
        </div>

        <div>
          <h2>{trainer.name}</h2>
          <p>{trainer.role}</p>
          <div className="trainer-tags">
            <span>{trainer.region}</span>
            <span>{trainer.favoriteType} enthusiast</span>
          </div>
        </div>
      </div>

      <div className="trainer-quote">
        <span>“</span>
        <p>{trainer.quote}</p>
      </div>

      <div className="trainer-stats">
        <div>
          <strong>{partnerCount}</strong>
          <span>Partners</span>
        </div>
        <div>
          <strong>{partyCount}</strong>
          <span>Travelling</span>
        </div>
        <div>
          <strong>{memoryCount}</strong>
          <span>Memories</span>
        </div>
      </div>
    </section>
  );
}

function JourneyCard({ trainer }: { trainer: TrainerProfile }) {
  return (
    <section className="journey-card">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Current journey</span>
          <h2>Exploring {trainer.region}</h2>
        </div>
        <button className="icon-button" type="button" aria-label="More options">
          •••
        </button>
      </div>

      <div className="route-visual">
        <div className="route-line" />
        <div className="route-stop completed">
          <span>✓</span>
          <small>Last stop</small>
        </div>
        <div className="route-stop current">
          <span>●</span>
          <small>{trainer.currentCity}</small>
        </div>
        <div className="route-stop">
          <span />
          <small>Next stop</small>
        </div>
      </div>

      <div className="journey-note">
        <div className="weather-icon">☁</div>
        <div>
          <strong>Resting in {trainer.currentCity}</strong>
          <p>
            Add the companions who are sharing this part of the journey with
            you.
          </p>
        </div>
      </div>
    </section>
  );
}

function PokemonCard({
  pokemon,
  slot,
  actionLabel,
  onAction,
  onEdit,
  actionDisabled = false,
}: {
  pokemon: OwnedPokemon;
  slot?: number;
  actionLabel?: string;
  onAction?: () => void;
  onEdit?: () => void;
  actionDisabled?: boolean;
}) {
  const name = getCompanionName(pokemon);

  return (
    <article className="pokemon-card" style={getTypeStyle(pokemon.types)}>
      {typeof slot === "number" && (
        <div className="slot-number">{String(slot).padStart(2, "0")}</div>
      )}
      <div className="pokemon-art">
        <div className="pokemon-glow" />
        {getArtwork(pokemon) ? (
          <img src={getArtwork(pokemon)} alt={pokemon.displayName} />
        ) : (
          <span className="missing-art">?</span>
        )}
      </div>
      <div className="pokemon-copy">
        <small>{pokemon.displayName}</small>
        <h3>{name}</h3>
        {(pokemon.level || pokemon.heldItem) && (
          <div className="pokemon-quick-details">
            {pokemon.level && <span>Lv. {pokemon.level}</span>}
            {pokemon.heldItem && (
              <span className="held-item-chip">
                <HeldItemIcon item={pokemon.heldItem} className="compact" />
                {pokemon.heldItem.displayName}
              </span>
            )}
          </div>
        )}
        <p>
          {pokemon.personalityNotes ||
            pokemon.meetingStory ||
            formatStatus(pokemon.status)}
        </p>
        <div className="pokemon-type-row">
          {pokemon.types.map((type) => (
            <span key={type}>{formatType(type)}</span>
          ))}
          {pokemon.isShiny && <span className="shiny-tag">Shiny</span>}
        </div>
      </div>

      {(onEdit || (actionLabel && onAction)) && (
        <div className="pokemon-card-actions">
          {onEdit && (
            <button
              className="card-edit-button"
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${name}`}
            >
              Edit
            </button>
          )}
          {actionLabel && onAction && (
            <button
              className="card-action-button"
              type="button"
              onClick={onAction}
              disabled={actionDisabled}
              aria-label={`${actionLabel}: ${name}`}
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function EmptyPartySlot({
  slot,
  onAddPokemon,
}: {
  slot: number;
  onAddPokemon: () => void;
}) {
  return (
    <button
      className="empty-party-slot"
      type="button"
      onClick={onAddPokemon}
    >
      <span className="slot-number">{String(slot).padStart(2, "0")}</span>
      <span className="empty-slot-mark">＋</span>
      <strong>Open party slot</strong>
      <small>Add a companion</small>
    </button>
  );
}

function PartySection({
  party,
  onAddPokemon,
  onEditPokemon,
}: {
  party: OwnedPokemon[];
  onAddPokemon: () => void;
  onEditPokemon: (pokemon: OwnedPokemon) => void;
}) {
  const bySlot = new Map(party.map((pokemon) => [pokemon.partySlot, pokemon]));

  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Travelling with you</span>
          <h2>Current party</h2>
        </div>
        <NavLink to="/party" className="text-link">
          Manage party <span>→</span>
        </NavLink>
      </div>

      <div className="party-grid">
        {Array.from({ length: 6 }, (_, index) => {
          const slot = index + 1;
          const pokemon = bySlot.get(slot);

          return pokemon ? (
            <PokemonCard
              pokemon={pokemon}
              slot={slot}
              onEdit={() => onEditPokemon(pokemon)}
              key={pokemon.id}
            />
          ) : (
            <EmptyPartySlot
              slot={slot}
              onAddPokemon={onAddPokemon}
              key={`empty-${slot}`}
            />
          );
        })}
      </div>
    </section>
  );
}

function PlacesPreview({
  places,
  reserves,
}: {
  places: PokemonPlace[];
  reserves: OwnedPokemon[];
}) {
  const unassignedCount = reserves.filter((pokemon) => !pokemon.locationId).length;
  const featuredPlaces = [...places]
    .sort((a, b) => {
      const aCount = reserves.filter((pokemon) => pokemon.locationId === a.id).length;
      const bCount = reserves.filter((pokemon) => pokemon.locationId === b.id).length;
      return bCount - aCount || b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, 2);

  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Everyone has somewhere to belong</span>
          <h2>Places</h2>
        </div>
        <NavLink to="/places" className="text-link">
          Manage places <span>→</span>
        </NavLink>
      </div>

      <div className="places-grid places-preview-grid">
        <NavLink to="/places" className="place-card real-place-card place-preview-link">
          <div className="place-icon">◉</div>
          <div className="place-copy">
            <h3>Awaiting a home</h3>
            <p>Reserve companions not assigned to a location yet</p>
            <div className="place-footer">
              <span className="place-status-dot" />
              <strong>{unassignedCount} Pokémon</strong>
            </div>
          </div>
        </NavLink>

        {featuredPlaces.map((place) => {
          const meta = getPlaceKindMeta(place.kind);
          const count = reserves.filter(
            (pokemon) => pokemon.locationId === place.id,
          ).length;

          return (
            <NavLink
              to="/places"
              className="place-card real-place-card place-preview-link"
              key={place.id}
            >
              <div className="place-icon">{meta.icon}</div>
              <div className="place-copy">
                <h3>{place.name}</h3>
                <p>{getPlaceAddress(place) || meta.label}</p>
                <div className="place-footer">
                  <span className="place-status-dot" />
                  <strong>{count} Pokémon</strong>
                </div>
              </div>
            </NavLink>
          );
        })}

        {featuredPlaces.length < 2 && (
          <NavLink
            to="/places"
            className="new-place-card place-preview-create"
          >
            <span>＋</span>
            <strong>Create a place</strong>
            <small>Home, ranch, laboratory...</small>
          </NavLink>
        )}
      </div>
    </section>
  );
}

function JournalPreview({
  releaseMemories,
  evolutionMemories,
  journalMemories,
}: {
  releaseMemories: ReleaseMemory[];
  evolutionMemories: EvolutionMemory[];
  journalMemories: JournalEntry[];
}) {
  const latest = [
    ...releaseMemories.map((memory) => ({ kind: "release" as const, memory })),
    ...evolutionMemories.map((memory) => ({ kind: "evolution" as const, memory })),
    ...journalMemories.map((memory) => ({ kind: "journal" as const, memory })),
  ].sort((a, b) => {
    const dateCompare = getMemoryTimelineDate(b.memory).localeCompare(
      getMemoryTimelineDate(a.memory),
    );
    return dateCompare || b.memory.createdAt.localeCompare(a.memory.createdAt);
  })[0];

  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Stories worth keeping</span>
          <h2>Journey journal</h2>
        </div>
        <NavLink to="/journal" className="text-link">
          Open journal <span>→</span>
        </NavLink>
      </div>

      {latest ? (
        latest.kind === "journal" ? (
          <article className="journal-release-preview general-memory-preview">
            <div className="journal-general-preview-icon">
              {journalKindMeta[latest.memory.kind].icon}
            </div>
            <div className="journal-release-copy">
              <span className="section-kicker">
                {journalKindMeta[latest.memory.kind].label}
              </span>
              <h3>{latest.memory.title}</h3>
              <p>
                {latest.memory.description || "A moment from your journey."}
              </p>
              <div className="release-preview-meta">
                <span>{formatDisplayDate(latest.memory.eventDate)}</span>
                {latest.memory.location && <span>{latest.memory.location}</span>}
              </div>
            </div>
            <NavLink to="/journal" className="release-preview-link">
              Read memory →
            </NavLink>
          </article>
        ) : latest.kind === "release" ? (
          <article className="journal-release-preview">
            <div className="journal-release-art" style={getTypeStyle(latest.memory.types)}>
              <div className="collection-art-glow" />
              {getReleaseMemoryArtwork(latest.memory) ? (
                <img src={getReleaseMemoryArtwork(latest.memory)} alt={latest.memory.displayName} />
              ) : (
                <span className="missing-art">?</span>
              )}
            </div>
            <div className="journal-release-copy">
              <span className="section-kicker">Released companion</span>
              <h3>{getReleaseMemoryName(latest.memory)} began a new chapter.</h3>
              <p>{latest.memory.releaseReason}</p>
              <div className="release-preview-meta">
                <span>{formatDisplayDate(latest.memory.releaseDate)}</span>
                {latest.memory.releaseLocation && <span>{latest.memory.releaseLocation}</span>}
              </div>
            </div>
            <NavLink to="/journal" className="release-preview-link">Read memory →</NavLink>
          </article>
        ) : (
          <article className="journal-release-preview evolution-preview">
            <div className="journal-release-art evolution-preview-art" style={getTypeStyle(latest.memory.to.types)}>
              <div className="collection-art-glow" />
              {getSnapshotArtwork(latest.memory.to, latest.memory.isShiny) ? (
                <img src={getSnapshotArtwork(latest.memory.to, latest.memory.isShiny)} alt={latest.memory.to.displayName} />
              ) : (
                <span className="missing-art">?</span>
              )}
            </div>
            <div className="journal-release-copy">
              <span className="section-kicker">Evolution memory</span>
              <h3>{getEvolutionMemoryName(latest.memory)} evolved into {latest.memory.to.displayName}.</h3>
              <p>{latest.memory.evolutionNotes || latest.memory.evolutionMethod || "A new stage of the journey began."}</p>
              <div className="release-preview-meta">
                <span>{formatDisplayDate(latest.memory.evolutionDate)}</span>
                {latest.memory.evolutionLocation && <span>{latest.memory.evolutionLocation}</span>}
              </div>
            </div>
            <NavLink to="/journal" className="release-preview-link">Read memory →</NavLink>
          </article>
        )
      ) : (
        <div className="journal-empty-card">
          <div className="journal-empty-icon">▤</div>
          <div>
            <h3>Your journey journal is still empty.</h3>
            <p>
              Meetings, Gym victories, travels, evolutions, farewells, and any
              other moment you want to remember can live here.
            </p>
          </div>
          <span className="coming-soon-pill">Your story starts here</span>
        </div>
      )}
    </section>
  );
}

function DashboardPage({
  trainer,
  ownedPokemon,
  party,
  releaseMemories,
  evolutionMemories,
  journalMemories,
  places,
  onEditProfile,
  onAddPokemon,
  onEditPokemon,
}: {
  trainer: TrainerProfile;
  ownedPokemon: OwnedPokemon[];
  party: OwnedPokemon[];
  releaseMemories: ReleaseMemory[];
  evolutionMemories: EvolutionMemory[];
  journalMemories: JournalEntry[];
  places: PokemonPlace[];
  onEditProfile: () => void;
  onAddPokemon: () => void;
  onEditPokemon: (pokemon: OwnedPokemon) => void;
}) {
  return (
    <>
      <PageHeader trainer={trainer} onAddPokemon={onAddPokemon} />

      <div className="dashboard-top-grid">
        <TrainerCard
          trainer={trainer}
          onEditProfile={onEditProfile}
          partnerCount={ownedPokemon.length}
          partyCount={party.length}
          memoryCount={
            releaseMemories.length +
            evolutionMemories.length +
            journalMemories.length
          }
        />
        <JourneyCard trainer={trainer} />
      </div>

      <PartySection
        party={party}
        onAddPokemon={onAddPokemon}
        onEditPokemon={onEditPokemon}
      />
      <PlacesPreview
        places={places}
        reserves={ownedPokemon.filter((pokemon) => pokemon.status === "reserve")}
      />
      <JournalPreview
        releaseMemories={releaseMemories}
        evolutionMemories={evolutionMemories}
        journalMemories={journalMemories}
      />
    </>
  );
}

function CollectionPokemonCard({
  pokemon,
  places,
  onEdit,
}: {
  pokemon: OwnedPokemon;
  places: PokemonPlace[];
  onEdit: () => void;
}) {
  const name = getCompanionName(pokemon);
  const currentPlace =
    pokemon.status === "party"
      ? "Travelling"
      : places.find((place) => place.id === pokemon.locationId)?.name ??
        "Awaiting a home";

  return (
    <article className="collection-card" style={getTypeStyle(pokemon.types)}>
      <div className="collection-card-art">
        <div className="collection-art-glow" />
        {getArtwork(pokemon) ? (
          <img src={getArtwork(pokemon)} alt={pokemon.displayName} />
        ) : (
          <span className="missing-art">?</span>
        )}
        <span className={`collection-status ${pokemon.status}`}>
          {currentPlace}
        </span>
      </div>

      <div className="collection-card-copy">
        <div className="collection-card-heading">
          <div>
            <small>
              #{String(pokemon.speciesId).padStart(4, "0")} · {pokemon.displayName}
            </small>
            <h3>{name}</h3>
          </div>
          {pokemon.isShiny && <span className="shiny-star">✦</span>}
        </div>

        <div className="pokemon-type-row collection-types">
          {pokemon.types.map((type) => (
            <span key={type}>{formatType(type)}</span>
          ))}
        </div>

        <p>
          {pokemon.meetingStory ||
            pokemon.flavorText ||
            `${name} is one of your companions.`}
        </p>

        <div className="collection-meta">
          <span>
            <strong>Met:</strong> {pokemon.metLocation || "Not recorded"}
          </span>
          <span>
            <strong>Nature:</strong> {pokemon.nature || "Not chosen"}
          </span>
          <span>
            <strong>Level:</strong> {pokemon.level ?? "Not recorded"}
          </span>
          <span>
            <strong>Ability:</strong> {pokemon.ability?.displayName || "Not recorded"}
          </span>
          <span className="collection-held-item">
            <strong>Held item:</strong>
            {pokemon.heldItem ? (
              <>
                <HeldItemIcon item={pokemon.heldItem} className="compact" />
                {pokemon.heldItem.displayName}
              </>
            ) : (
              "None"
            )}
          </span>
        </div>

        {pokemon.moves && pokemon.moves.length > 0 && (
          <div className="collection-move-list">
            {pokemon.moves.map((move) => (
              <span
                className="move-type-chip"
                style={getMoveTypeStyle(move.type)}
                key={move.apiName}
              >
                <small>{move.type ? formatType(move.type) : "Custom"}</small>
                {move.displayName}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        className="collection-open-button"
        type="button"
        onClick={onEdit}
      >
        Edit partner
      </button>
    </article>
  );
}

function PokemonPage({
  ownedPokemon,
  places,
  onAddPokemon,
  onEditPokemon,
}: {
  ownedPokemon: OwnedPokemon[];
  places: PokemonPlace[];
  onAddPokemon: () => void;
  onEditPokemon: (pokemon: OwnedPokemon) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "party" | "reserve">("all");

  const filteredPokemon = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return ownedPokemon.filter((pokemon) => {
      const matchesFilter = filter === "all" || pokemon.status === filter;
      const matchesQuery =
        !normalizedQuery ||
        pokemon.nickname.toLowerCase().includes(normalizedQuery) ||
        pokemon.displayName.toLowerCase().includes(normalizedQuery) ||
        pokemon.types.some((type) => type.includes(normalizedQuery));

      return matchesFilter && matchesQuery;
    });
  }, [filter, ownedPokemon, query]);

  return (
    <section className="collection-page">
      <header className="collection-page-header">
        <div>
          <span className="section-kicker">Your companions</span>
          <h1>My Pokémon</h1>
          <p>
            These are individuals in your journey—not entries in a checklist.
          </p>
        </div>
        <button className="primary-button" type="button" onClick={onAddPokemon}>
          <span>＋</span>
          Add a Pokémon
        </button>
      </header>

      <div className="collection-toolbar">
        <label className="collection-search">
          <span>⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search nickname, species, or type..."
          />
        </label>

        <div className="collection-filters" aria-label="Collection filter">
          {(["all", "party", "reserve"] as const).map((option) => (
            <button
              className={filter === option ? "active" : ""}
              type="button"
              onClick={() => setFilter(option)}
              key={option}
            >
              {option === "all"
                ? "All"
                : option === "party"
                  ? "Party"
                  : "Reserve"}
            </button>
          ))}
        </div>
      </div>

      {ownedPokemon.length === 0 ? (
        <CollectionEmptyState onAddPokemon={onAddPokemon} />
      ) : filteredPokemon.length === 0 ? (
        <div className="collection-no-results">
          <strong>No companions match this search.</strong>
          <p>Try another nickname, species, type, or filter.</p>
        </div>
      ) : (
        <div className="collection-grid">
          {filteredPokemon.map((pokemon) => (
            <CollectionPokemonCard
              pokemon={pokemon}
              places={places}
              onEdit={() => onEditPokemon(pokemon)}
              key={pokemon.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CollectionEmptyState({
  onAddPokemon,
}: {
  onAddPokemon: () => void;
}) {
  return (
    <div className="collection-empty-state">
      <div className="placeholder-icon compact-placeholder-icon">
        <div className="brand-mark large">
          <span />
        </div>
      </div>
      <span className="section-kicker">Your story starts here</span>
      <h2>Who was your first partner?</h2>
      <p>
        Search PokéAPI, choose a species and form, then give that individual a
        nickname, history, and personality.
      </p>
      <button className="primary-button" type="button" onClick={onAddPokemon}>
        <span>＋</span>
        Add your first Pokémon
      </button>
    </div>
  );
}

function PartyPage({
  party,
  reserves,
  onAddPokemon,
  onMoveToParty,
  onRelocatePokemon,
  onEditPokemon,
}: {
  party: OwnedPokemon[];
  reserves: OwnedPokemon[];
  onAddPokemon: () => void;
  onMoveToParty: (id: string) => void;
  onRelocatePokemon: (pokemon: OwnedPokemon) => void;
  onEditPokemon: (pokemon: OwnedPokemon) => void;
}) {
  const bySlot = new Map(party.map((pokemon) => [pokemon.partySlot, pokemon]));

  return (
    <section className="party-page">
      <header className="collection-page-header">
        <div>
          <span className="section-kicker">Physically travelling with you</span>
          <h1>Travelling party</h1>
          <p>
            The six slots represent who is beside you right now—not a battle
            calculation.
          </p>
        </div>
        <button className="primary-button" type="button" onClick={onAddPokemon}>
          <span>＋</span>
          Add a Pokémon
        </button>
      </header>

      <div className="party-manager-grid">
        {Array.from({ length: 6 }, (_, index) => {
          const slot = index + 1;
          const pokemon = bySlot.get(slot);

          return pokemon ? (
            <PokemonCard
              pokemon={pokemon}
              slot={slot}
              actionLabel="Send somewhere"
              onAction={() => onRelocatePokemon(pokemon)}
              onEdit={() => onEditPokemon(pokemon)}
              key={pokemon.id}
            />
          ) : (
            <EmptyPartySlot
              slot={slot}
              onAddPokemon={onAddPokemon}
              key={`party-page-empty-${slot}`}
            />
          );
        })}
      </div>

      <section className="reserve-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Not currently travelling</span>
            <h2>Reserve companions</h2>
          </div>
          <span className="reserve-count">{reserves.length} Pokémon</span>
        </div>

        {reserves.length === 0 ? (
          <div className="reserve-empty">
            <strong>No Pokémon are waiting in reserve.</strong>
            <p>
              Add a Pokémon without placing it in the party, or move a current
              companion out of a slot.
            </p>
          </div>
        ) : (
          <div className="reserve-grid">
            {reserves.map((pokemon) => (
              <PokemonCard
                pokemon={pokemon}
                actionLabel="Add to party"
                onAction={() => onMoveToParty(pokemon.id)}
                onEdit={() => onEditPokemon(pokemon)}
                actionDisabled={party.length >= 6}
                key={pokemon.id}
              />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

const UNASSIGNED_PLACE_KEY = "__unassigned__";

function PlacePokemonFaces({ pokemon }: { pokemon: OwnedPokemon[] }) {
  const visible = pokemon.slice(0, 4);

  return (
    <div className="place-pokemon-faces" aria-label={`${pokemon.length} Pokémon`}>
      {visible.map((companion) => {
        const artwork = getArtwork(companion);

        return (
          <span style={getTypeStyle(companion.types)} key={companion.id}>
            {artwork ? (
              <img src={artwork} alt="" />
            ) : (
              getCompanionName(companion)[0]
            )}
          </span>
        );
      })}
      {pokemon.length > visible.length && (
        <span className="place-face-overflow">+{pokemon.length - visible.length}</span>
      )}
    </div>
  );
}

function PlacesPage({
  places,
  reserves,
  partyCount,
  onCreatePlace,
  onEditPlace,
  onDeletePlace,
  onEditPokemon,
  onRelocatePokemon,
  onChoosePokemonForPlace,
}: {
  places: PokemonPlace[];
  reserves: OwnedPokemon[];
  partyCount: number;
  onCreatePlace: () => void;
  onEditPlace: (place: PokemonPlace) => void;
  onDeletePlace: (place: PokemonPlace) => void;
  onEditPokemon: (pokemon: OwnedPokemon) => void;
  onRelocatePokemon: (pokemon: OwnedPokemon) => void;
  onChoosePokemonForPlace: (locationId: string | null) => void;
}) {
  const [selectedKey, setSelectedKey] = useState(UNASSIGNED_PLACE_KEY);
  const sortedPlaces = [...places].sort((a, b) => a.name.localeCompare(b.name));
  const selectedPlace =
    selectedKey === UNASSIGNED_PLACE_KEY
      ? undefined
      : places.find((place) => place.id === selectedKey);

  useEffect(() => {
    if (
      selectedKey !== UNASSIGNED_PLACE_KEY &&
      !places.some((place) => place.id === selectedKey)
    ) {
      setSelectedKey(UNASSIGNED_PLACE_KEY);
    }
  }, [places, selectedKey]);

  const unassigned = reserves.filter((pokemon) => !pokemon.locationId);
  const selectedPokemon = selectedPlace
    ? reserves.filter((pokemon) => pokemon.locationId === selectedPlace.id)
    : unassigned;
  const assignedCount = reserves.length - unassigned.length;
  const selectedMeta = selectedPlace
    ? getPlaceKindMeta(selectedPlace.kind)
    : {
        label: "Unassigned reserve",
        icon: "◉",
        description:
          "A temporary list for partners who have not been given a meaningful home yet.",
      };

  return (
    <section className="places-page">
      <header className="collection-page-header places-page-header">
        <div>
          <span className="section-kicker">Beyond a lifeless PC box</span>
          <h1>Places</h1>
          <p>
            Create homes, laboratories, ranches, camps, and habitats where
            partners continue living while they are not travelling with you.
          </p>
        </div>
        <button className="primary-button" type="button" onClick={onCreatePlace}>
          <span>＋</span>
          Create a place
        </button>
      </header>

      <div className="places-summary-grid">
        <article>
          <span>⌖</span>
          <div>
            <strong>{places.length}</strong>
            <small>Custom places</small>
          </div>
        </article>
        <article>
          <span>♧</span>
          <div>
            <strong>{assignedCount}</strong>
            <small>Partners with a home</small>
          </div>
        </article>
        <article>
          <span>◉</span>
          <div>
            <strong>{unassigned.length}</strong>
            <small>Awaiting a home</small>
          </div>
        </article>
      </div>

      <section className="place-browser-section">
        <div className="section-heading place-browser-heading">
          <div>
            <span className="section-kicker">Your world</span>
            <h2>Saved locations</h2>
          </div>
          <span className="reserve-count">{reserves.length} reserve Pokémon</span>
        </div>

        <div className="place-browser-grid">
          <button
            className={
              selectedKey === UNASSIGNED_PLACE_KEY
                ? "place-browser-card active"
                : "place-browser-card"
            }
            type="button"
            onClick={() => setSelectedKey(UNASSIGNED_PLACE_KEY)}
          >
            <div className="place-browser-card-top">
              <span className="place-browser-icon">◉</span>
              <span className="place-browser-count">{unassigned.length}</span>
            </div>
            <h3>Awaiting a home</h3>
            <p>Reserve companions without an assigned location</p>
            <PlacePokemonFaces pokemon={unassigned} />
          </button>

          {sortedPlaces.map((place) => {
            const residents = reserves.filter(
              (pokemon) => pokemon.locationId === place.id,
            );
            const meta = getPlaceKindMeta(place.kind);

            return (
              <button
                className={
                  selectedKey === place.id
                    ? "place-browser-card active"
                    : "place-browser-card"
                }
                type="button"
                onClick={() => setSelectedKey(place.id)}
                key={place.id}
              >
                <div className="place-browser-card-top">
                  <span className="place-browser-icon">{meta.icon}</span>
                  <span className="place-browser-count">{residents.length}</span>
                </div>
                <h3>{place.name}</h3>
                <p>{getPlaceAddress(place) || meta.label}</p>
                <PlacePokemonFaces pokemon={residents} />
              </button>
            );
          })}

          <button
            className="place-browser-card create-place-browser-card"
            type="button"
            onClick={onCreatePlace}
          >
            <span className="create-place-plus">＋</span>
            <h3>Create another place</h3>
            <p>Build another part of your trainer's world</p>
          </button>
        </div>
      </section>

      <section className="selected-place-panel">
        <header className="selected-place-header">
          <div className="selected-place-identity">
            <span className="selected-place-icon">{selectedMeta.icon}</span>
            <div>
              <span className="section-kicker">
                {selectedPlace ? selectedMeta.label : "Temporary reserve"}
              </span>
              <h2>{selectedPlace?.name ?? "Awaiting a home"}</h2>
              <p>
                {selectedPlace
                  ? getPlaceAddress(selectedPlace) || "Location details not recorded"
                  : "Give these companions a home whenever you decide where they belong."}
              </p>
            </div>
          </div>

          <div className="selected-place-actions">
            {selectedPlace && (
              <>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => onEditPlace(selectedPlace)}
                >
                  Edit place
                </button>
                <button
                  className="place-delete-button"
                  type="button"
                  onClick={() => onDeletePlace(selectedPlace)}
                >
                  Delete
                </button>
              </>
            )}
            <button
              className="primary-button"
              type="button"
              onClick={() =>
                onChoosePokemonForPlace(selectedPlace?.id ?? null)
              }
            >
              <span>＋</span>
              Move a Pokémon here
            </button>
          </div>
        </header>

        {selectedPlace && (
          <div className="selected-place-story">
            <div>
              <strong>About this place</strong>
              <p>
                {selectedPlace.description ||
                  "No description has been written for this place yet."}
              </p>
            </div>
            <dl>
              <div>
                <dt>Caretaker</dt>
                <dd>{selectedPlace.caretaker || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd>{selectedPlace.notes || "No private notes"}</dd>
              </div>
            </dl>
          </div>
        )}

        <div className="selected-place-residents-heading">
          <div>
            <span className="section-kicker">Currently living here</span>
            <h3>{selectedPokemon.length} Pokémon</h3>
          </div>
          {partyCount >= 6 && (
            <span className="place-party-full-note">Party currently full</span>
          )}
        </div>

        {selectedPokemon.length === 0 ? (
          <div className="place-residents-empty">
            <span>{selectedMeta.icon}</span>
            <div>
              <strong>No Pokémon are here yet.</strong>
              <p>
                Move a reserve companion or someone from your party into this
                location.
              </p>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                onChoosePokemonForPlace(selectedPlace?.id ?? null)
              }
            >
              Choose a Pokémon
            </button>
          </div>
        ) : (
          <div className="reserve-grid place-residents-grid">
            {selectedPokemon.map((pokemon) => (
              <PokemonCard
                pokemon={pokemon}
                actionLabel="Move somewhere…"
                onAction={() => onRelocatePokemon(pokemon)}
                onEdit={() => onEditPokemon(pokemon)}
                key={pokemon.id}
              />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function JournalPage({
  releaseMemories,
  evolutionMemories,
  journalMemories,
  ownedPokemon,
  onCreateMemory,
  onEditMemory,
  onDeleteJournalMemory,
  onDeleteReleaseMemory,
  onEditRelease,
  onEditEvolution,
  onUndoEvolution,
}: {
  releaseMemories: ReleaseMemory[];
  evolutionMemories: EvolutionMemory[];
  journalMemories: JournalEntry[];
  ownedPokemon: OwnedPokemon[];
  onCreateMemory: () => void;
  onEditMemory: (memory: JournalEntry) => void;
  onDeleteJournalMemory: (memory: JournalEntry) => void;
  onDeleteReleaseMemory: (memory: ReleaseMemory) => void;
  onEditRelease: (memory: ReleaseMemory) => void;
  onEditEvolution: (memory: EvolutionMemory) => void;
  onUndoEvolution: (memory: EvolutionMemory) => void;
}) {
  const activePokemonIds = new Set(ownedPokemon.map((pokemon) => pokemon.id));
  const latestEvolutionByPokemon = new Map<string, EvolutionMemory>();

  for (const memory of evolutionMemories) {
    const current = latestEvolutionByPokemon.get(memory.pokemonId);
    if (!current || memory.createdAt > current.createdAt) {
      latestEvolutionByPokemon.set(memory.pokemonId, memory);
    }
  }

  const entries = [
    ...journalMemories.map((memory) => ({ kind: "journal" as const, memory })),
    ...releaseMemories.map((memory) => ({ kind: "release" as const, memory })),
    ...evolutionMemories.map((memory) => ({ kind: "evolution" as const, memory })),
  ].sort((a, b) => {
    const dateCompare = getMemoryTimelineDate(b.memory).localeCompare(
      getMemoryTimelineDate(a.memory),
    );
    return dateCompare || b.memory.createdAt.localeCompare(a.memory.createdAt);
  });

  return (
    <section className="journal-page">
      <header className="collection-page-header journal-page-header">
        <div>
          <span className="section-kicker">Your shared history</span>
          <h1>Journey journal</h1>
          <p>
            Record the whole adventure: meeting partners, beating Gyms,
            earning badges, battles, trips, evolutions, farewells, and the
            small moments that make the journey yours.
          </p>
        </div>
        <div className="journal-header-actions">
          <div className="journal-count-card">
            <strong>{entries.length}</strong>
            <span>{entries.length === 1 ? "Recorded memory" : "Recorded memories"}</span>
          </div>
          <button className="primary-button" type="button" onClick={onCreateMemory}>
            <span>＋</span> New journal entry
          </button>
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="collection-empty-state journal-empty-state">
          <div className="journal-empty-icon large">▤</div>
          <span className="section-kicker">No memories recorded</span>
          <h2>Start writing your Trainer story.</h2>
          <p>
            Add a Gym victory, a difficult battle, a trip to a new city, or
            anything else you want to remember.
          </p>
          <button className="primary-button" type="button" onClick={onCreateMemory}>
            <span>＋</span> Write the first entry
          </button>
        </div>
      ) : (
        <div className="release-memory-list">
          {entries.map((entry) => {
            if (entry.kind === "journal") {
              const memory = entry.memory;
              const meta = journalKindMeta[memory.kind];
              const leadPokemon = memory.pokemon[0];

              return (
                <article className="release-memory-card general-journal-card" key={`journal-${memory.id}`}>
                  <div className="general-journal-visual">
                    {leadPokemon && getJournalParticipantArtwork(leadPokemon) ? (
                      <div className="general-journal-pokemon-art" style={getTypeStyle(leadPokemon.types)}>
                        <div className="release-memory-glow" />
                        <img src={getJournalParticipantArtwork(leadPokemon)} alt={leadPokemon.displayName} />
                      </div>
                    ) : (
                      <div className={`general-journal-icon journal-kind-${memory.kind}`}>
                        {meta.icon}
                      </div>
                    )}
                  </div>

                  <div className="release-memory-content">
                    <div className="release-memory-heading">
                      <div>
                        <span className="release-memory-label general-memory-label">{meta.label}</span>
                        <h2>{memory.title}</h2>
                        {memory.kind === "pokemon-met" && leadPokemon && (
                          <p>#{String(leadPokemon.speciesId).padStart(4, "0")} · {leadPokemon.displayName}</p>
                        )}
                      </div>
                    </div>

                    <div className="release-memory-meta">
                      <span>{formatDisplayDate(memory.eventDate)}</span>
                      <span>{memory.location || "Location not recorded"}</span>
                    </div>

                    <div className="release-memory-story general-memory-story">
                      <strong>{memory.kind === "pokemon-met" ? "How we met" : "What happened"}</strong>
                      <p>{memory.description || "No notes recorded yet."}</p>
                    </div>

                    {memory.pokemon.length > 0 && (
                      <div className="journal-participant-row">
                        <strong>Pokémon involved</strong>
                        <div className="journal-participant-chips">
                          {memory.pokemon.map((participant) => (
                            <span className="journal-participant-chip" key={participant.originalPokemonId}>
                              {getJournalParticipantArtwork(participant) && (
                                <img src={getJournalParticipantArtwork(participant)} alt="" />
                              )}
                              {getJournalParticipantName(participant)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="release-memory-footer">
                      <span>{memory.kind === "pokemon-met" ? "Linked to this Pokémon's meeting story." : "Personal journal entry"}</span>
                      <div className="memory-action-row">
                        <button className="secondary-memory-button" type="button" onClick={() => onEditMemory(memory)}>Edit entry</button>
                        <button className="delete-memory-button" type="button" onClick={() => onDeleteJournalMemory(memory)}>Delete</button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            }

            if (entry.kind === "evolution") {
              const memory = entry.memory;
              const name = getEvolutionMemoryName(memory);
              const isLatest = latestEvolutionByPokemon.get(memory.pokemonId)?.id === memory.id;
              const canUndo = isLatest && activePokemonIds.has(memory.pokemonId);

              return (
                <article className="release-memory-card evolution-memory-card" style={getTypeStyle(memory.to.types)} key={`evolution-${memory.id}`}>
                  <div className="evolution-memory-art-pair">
                    <div className="release-memory-art compact-art before-art" style={getTypeStyle(memory.from.types)}>
                      <div className="release-memory-glow" />
                      {getSnapshotArtwork(memory.from, memory.isShiny) ? <img src={getSnapshotArtwork(memory.from, memory.isShiny)} alt={memory.from.displayName} /> : <span className="missing-art">?</span>}
                      <small>{memory.from.displayName}</small>
                    </div>
                    <span className="evolution-art-arrow">→</span>
                    <div className="release-memory-art compact-art after-art" style={getTypeStyle(memory.to.types)}>
                      <div className="release-memory-glow" />
                      {getSnapshotArtwork(memory.to, memory.isShiny) ? <img src={getSnapshotArtwork(memory.to, memory.isShiny)} alt={memory.to.displayName} /> : <span className="missing-art">?</span>}
                      <small>{memory.to.displayName}</small>
                    </div>
                  </div>
                  <div className="release-memory-content">
                    <div className="release-memory-heading"><div><span className="release-memory-label evolution-label">Evolution memory</span><h2>{name}</h2><p>{memory.from.displayName} → {memory.to.displayName}</p></div>{memory.isShiny && <span className="shiny-star">✦</span>}</div>
                    <div className="release-memory-meta"><span>{formatDisplayDate(memory.evolutionDate)}</span><span>{memory.evolutionLocation || "Location not recorded"}</span><span>{memory.to.formLabel}</span></div>
                    <div className="release-memory-story evolution-method-story"><strong>How the evolution happened</strong><p>{memory.evolutionMethod || "Method not recorded"}</p></div>
                    {memory.evolutionNotes && <div className="release-memory-story farewell"><strong>Evolution notes</strong><p>{memory.evolutionNotes}</p></div>}
                    <div className="release-memory-footer evolution-memory-footer">
                      <span>{canUndo ? "This is the latest evolution and can be undone." : activePokemonIds.has(memory.pokemonId) ? "Undo later stages first to return to this point." : "This companion is no longer active in your journey."}</span>
                      <div className="memory-action-row"><button className="secondary-memory-button" type="button" onClick={() => onEditEvolution(memory)}>Edit details</button>{canUndo && <button className="undo-evolution-button" type="button" onClick={() => onUndoEvolution(memory)}>Undo evolution</button>}</div>
                    </div>
                  </div>
                </article>
              );
            }

            const memory = entry.memory;
            const name = getReleaseMemoryName(memory);
            return (
              <article className="release-memory-card" style={getTypeStyle(memory.types)} key={`release-${memory.id}`}>
                <div className="release-memory-art"><div className="release-memory-glow" />{getReleaseMemoryArtwork(memory) ? <img src={getReleaseMemoryArtwork(memory)} alt={memory.displayName} /> : <span className="missing-art">?</span>}</div>
                <div className="release-memory-content">
                  <div className="release-memory-heading"><div><span className="release-memory-label">Released companion</span><h2>{name}</h2><p>#{String(memory.speciesId).padStart(4, "0")} · {memory.displayName}</p></div>{memory.isShiny && <span className="shiny-star">✦</span>}</div>
                  <div className="release-memory-meta"><span>{formatDisplayDate(memory.releaseDate)}</span><span>{memory.releaseLocation || "Location not recorded"}</span><span>Previously {memory.previousStatus === "party" ? "travelling" : "in reserve"}</span></div>
                  <div className="release-memory-story"><strong>Why they were released</strong><p>{memory.releaseReason}</p></div>
                  {memory.farewellNote && <div className="release-memory-story farewell"><strong>Farewell note</strong><p>{memory.farewellNote}</p></div>}
                  <div className="release-memory-footer"><span>Met at {memory.metLocation || "an unrecorded place"}</span><div className="memory-action-row"><button className="secondary-memory-button" type="button" onClick={() => onEditRelease(memory)}>Edit details</button><button className="delete-memory-button" type="button" onClick={() => onDeleteReleaseMemory(memory)}>Delete memory</button></div></div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
};

function PlaceholderPage({
  eyebrow,
  title,
  description,
  action,
}: PlaceholderPageProps) {
  return (
    <section className="placeholder-page">
      <div className="placeholder-orbit orbit-one" />
      <div className="placeholder-orbit orbit-two" />
      <div className="placeholder-icon">
        <div className="brand-mark large">
          <span />
        </div>
      </div>
      <span className="section-kicker">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
      <button className="primary-button" type="button" disabled>
        {action}
      </button>
      <small>The existing Trainer Profile data remains safely stored.</small>
    </section>
  );
}

function TrainerProfileModal({
  trainer,
  onClose,
}: {
  trainer: TrainerProfile;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: trainer.name,
    role: trainer.role,
    region: trainer.region,
    favoriteType: trainer.favoriteType,
    currentCity: trainer.currentCity,
    quote: trainer.quote,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useModalBodyLock(onClose, isSaving);

  const updateField = (
    field: keyof typeof formData,
    value: string,
  ) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const normalized = {
      name: formData.name.trim(),
      role: formData.role.trim(),
      region: formData.region.trim(),
      favoriteType: formData.favoriteType,
      currentCity: formData.currentCity.trim(),
      quote: formData.quote.trim(),
    };

    if (
      !normalized.name ||
      !normalized.role ||
      !normalized.region ||
      !normalized.currentCity ||
      !normalized.quote
    ) {
      setErrorMessage("Please complete every profile field.");
      return;
    }

    try {
      setIsSaving(true);
      await saveTrainerProfile(normalized);
      onClose();
    } catch (error) {
      console.error("Could not save trainer profile:", error);
      setErrorMessage(
        "The profile could not be saved. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <section
        className="profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
      >
        <div className="profile-modal-header">
          <div>
            <span className="section-kicker">Your trainer identity</span>
            <h2 id="profile-modal-title">Edit profile</h2>
            <p>These details remain stored only in this browser.</p>
          </div>

          <button
            className="modal-close-button"
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close profile editor"
          >
            ×
          </button>
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="profile-preview">
            <div className="trainer-avatar profile-preview-avatar">
              <span>{getInitials(formData.name)}</span>
              <div className="avatar-status" />
            </div>
            <div>
              <strong>{formData.name.trim() || "Your trainer name"}</strong>
              <span>
                {formData.role.trim() || "Your role"} ·{" "}
                {formData.region.trim() || "Your region"}
              </span>
            </div>
          </div>

          <div className="form-grid">
            <label className="form-field">
              <span>Trainer name</span>
              <input
                autoFocus
                type="text"
                value={formData.name}
                onChange={(event) => updateField("name", event.target.value)}
                maxLength={60}
                required
              />
            </label>

            <label className="form-field">
              <span>Role or occupation</span>
              <input
                type="text"
                value={formData.role}
                onChange={(event) => updateField("role", event.target.value)}
                placeholder="Trainer, ranger, researcher..."
                maxLength={70}
                required
              />
            </label>

            <label className="form-field">
              <span>Region</span>
              <input
                type="text"
                value={formData.region}
                onChange={(event) => updateField("region", event.target.value)}
                placeholder="Johto"
                maxLength={40}
                required
              />
            </label>

            <label className="form-field">
              <span>Favorite type</span>
              <select
                value={formData.favoriteType}
                onChange={(event) =>
                  updateField("favoriteType", event.target.value)
                }
              >
                {pokemonTypes.map((type) => (
                  <option value={type} key={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field form-field-full">
              <span>Current location</span>
              <input
                type="text"
                value={formData.currentCity}
                onChange={(event) =>
                  updateField("currentCity", event.target.value)
                }
                placeholder="Ecruteak City"
                maxLength={60}
                required
              />
            </label>

            <label className="form-field form-field-full">
              <span>Personal motto</span>
              <textarea
                value={formData.quote}
                onChange={(event) => updateField("quote", event.target.value)}
                rows={4}
                maxLength={220}
                required
              />
              <small>{formData.quote.length}/220 characters</small>
            </label>
          </div>

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="profile-form-footer">
            <div className="local-save-note">
              <span>✓</span>
              Saved with IndexedDB on this device
            </div>

            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save profile"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function useModalBodyLock(onClose: () => void, isBusy: boolean) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBusy, onClose]);
}

function getDefaultGender(genderRate: number): PokemonGender {
  if (genderRate === -1) {
    return "genderless";
  }

  if (genderRate === 8) {
    return "female";
  }

  if (genderRate === 0) {
    return "male";
  }

  return "unknown";
}

function getGenderOptions(genderRate: number) {
  if (genderRate === -1) {
    return [{ value: "genderless", label: "Genderless" }] as const;
  }

  if (genderRate === 8) {
    return [
      { value: "female", label: "Female" },
      { value: "unknown", label: "Not decided" },
    ] as const;
  }

  if (genderRate === 0) {
    return [
      { value: "male", label: "Male" },
      { value: "unknown", label: "Not decided" },
    ] as const;
  }

  return [
    { value: "unknown", label: "Not decided" },
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
  ] as const;
}


function PokemonPlaceModal({
  place,
  onClose,
  onSaved,
}: {
  place?: PokemonPlace;
  onClose: () => void;
  onSaved: (place: PokemonPlace) => void;
}) {
  const [name, setName] = useState(place?.name ?? "");
  const [kind, setKind] = useState<PokemonPlaceKind>(place?.kind ?? "home");
  const [region, setRegion] = useState(place?.region ?? "");
  const [locality, setLocality] = useState(place?.locality ?? "");
  const [caretaker, setCaretaker] = useState(place?.caretaker ?? "");
  const [description, setDescription] = useState(place?.description ?? "");
  const [notes, setNotes] = useState(place?.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useModalBodyLock(onClose, isSaving);

  const selectedKind = getPlaceKindMeta(kind);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage("Give this place a name.");
      return;
    }

    try {
      setIsSaving(true);
      const saved = await savePokemonPlace(
        {
          name,
          kind,
          region,
          locality,
          caretaker,
          description,
          notes,
        },
        place?.id,
      );
      onSaved(saved);
    } catch (error) {
      console.error("Could not save place:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "This place could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <section
        className="profile-modal place-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-editor-title"
      >
        <header className="profile-modal-header">
          <div>
            <span className="section-kicker">A home beyond the party</span>
            <h2 id="place-editor-title">
              {place ? "Edit place" : "Create a place"}
            </h2>
            <p>
              Describe where your Pokémon live and who looks after them while
              they are not travelling with you.
            </p>
          </div>
          <button
            className="modal-close-button"
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close place editor"
          >
            ×
          </button>
        </header>

        <form className="profile-form place-editor-form" onSubmit={handleSubmit}>
          <div className="place-editor-preview">
            <span>{selectedKind.icon}</span>
            <div>
              <strong>{name.trim() || "Your new place"}</strong>
              <small>
                {selectedKind.label}
                {getPlaceAddress({
                  id: "",
                  name: "",
                  kind,
                  region,
                  locality,
                  caretaker: "",
                  description: "",
                  notes: "",
                  createdAt: "",
                  updatedAt: "",
                })
                  ? ` · ${[locality, region].filter(Boolean).join(", ")}`
                  : ""}
              </small>
              <p>{selectedKind.description}</p>
            </div>
          </div>

          <div className="form-grid">
            <label className="form-field form-field-full">
              <span>Place name</span>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="My family's ranch, Professor Elm's lab..."
                maxLength={80}
                required
              />
            </label>

            <label className="form-field form-field-full">
              <span>Type of place</span>
              <select
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as PokemonPlaceKind)
                }
              >
                {placeKinds.map((entry) => (
                  <option value={entry.value} key={entry.value}>
                    {entry.icon} {entry.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Town, route, or specific location</span>
              <input
                type="text"
                value={locality}
                onChange={(event) => setLocality(event.target.value)}
                placeholder="New Bark Town, Route 42..."
                maxLength={80}
              />
            </label>

            <label className="form-field">
              <span>Region</span>
              <input
                type="text"
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                placeholder="Johto"
                maxLength={50}
              />
            </label>

            <label className="form-field form-field-full">
              <span>Caretaker or responsible person (optional)</span>
              <input
                type="text"
                value={caretaker}
                onChange={(event) => setCaretaker(event.target.value)}
                placeholder="My parents, Professor Oak, the Gym staff..."
                maxLength={100}
              />
            </label>

            <label className="form-field form-field-full">
              <span>Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What is this place like? What do the Pokémon do here?"
                rows={4}
                maxLength={500}
              />
              <small>{description.length}/500 characters</small>
            </label>

            <label className="form-field form-field-full">
              <span>Private notes (optional)</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Anything else you want to remember about this place..."
                rows={3}
                maxLength={350}
              />
              <small>{notes.length}/350 characters</small>
            </label>
          </div>

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="modal-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving
                ? "Saving place..."
                : place
                  ? "Save changes"
                  : "Create place"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function RelocatePokemonModal({
  pokemon,
  places,
  partyCount,
  initialLocationId,
  onClose,
  onMoved,
}: {
  pokemon: OwnedPokemon;
  places: PokemonPlace[];
  partyCount: number;
  initialLocationId?: string | null;
  onClose: () => void;
  onMoved: (pokemon: OwnedPokemon, destinationLabel: string) => void;
}) {
  const initialDestination = (() => {
    if (initialLocationId !== undefined) {
      return initialLocationId ? `place:${initialLocationId}` : "unassigned";
    }

    if (pokemon.status === "party") {
      return pokemon.lastLocationId
        ? `place:${pokemon.lastLocationId}`
        : "unassigned";
    }

    return pokemon.locationId ? `place:${pokemon.locationId}` : "unassigned";
  })();
  const [destination, setDestination] = useState(initialDestination);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const partyDisabled = pokemon.status !== "party" && partyCount >= 6;
  const name = getCompanionName(pokemon);
  const artwork = getArtwork(pokemon);

  useModalBodyLock(onClose, isSaving);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    try {
      setIsSaving(true);

      if (destination === "party") {
        if (partyDisabled) {
          throw new PartyFullError();
        }

        const updated = await movePokemonToParty(pokemon.id);

        if (!updated) {
          throw new Error("This Pokémon no longer exists in your journey.");
        }

        onMoved(updated, "your travelling party");
        return;
      }

      const locationId = destination.startsWith("place:")
        ? destination.slice("place:".length)
        : null;
      const updated = await movePokemonToLocation(pokemon.id, locationId);
      const place = locationId
        ? places.find((entry) => entry.id === locationId)
        : undefined;

      onMoved(updated, place?.name ?? "Awaiting a home");
    } catch (error) {
      console.error("Could not move Pokémon:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "This Pokémon could not be moved.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <section
        className="profile-modal relocate-pokemon-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="relocate-pokemon-title"
      >
        <header className="profile-modal-header">
          <div>
            <span className="section-kicker">Current whereabouts</span>
            <h2 id="relocate-pokemon-title">Move {name}</h2>
            <p>
              Decide whether this partner travels with you or lives at one of
              your saved locations.
            </p>
          </div>
          <button
            className="modal-close-button"
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close movement dialog"
          >
            ×
          </button>
        </header>

        <form className="profile-form relocate-pokemon-form" onSubmit={handleSubmit}>
          <div
            className="relocate-pokemon-summary"
            style={getTypeStyle(pokemon.types)}
          >
            <div>
              {artwork ? <img src={artwork} alt={pokemon.displayName} /> : <span>?</span>}
            </div>
            <section>
              <small>{pokemon.displayName}</small>
              <strong>{name}</strong>
              <p>
                {pokemon.status === "party"
                  ? "Currently travelling in your party"
                  : pokemon.locationId
                    ? `Currently at ${
                        places.find((place) => place.id === pokemon.locationId)
                          ?.name ?? "a saved place"
                      }`
                    : "Currently awaiting a home"}
              </p>
            </section>
          </div>

          <div className="relocation-options">
            <label
              className={
                partyDisabled
                  ? "relocation-option disabled"
                  : destination === "party"
                    ? "relocation-option active"
                    : "relocation-option"
              }
            >
              <input
                type="radio"
                name="destination"
                value="party"
                checked={destination === "party"}
                onChange={(event) => setDestination(event.target.value)}
                disabled={partyDisabled}
              />
              <span className="relocation-option-icon">✦</span>
              <span>
                <strong>Travelling party</strong>
                <small>
                  {partyDisabled
                    ? "All six party slots are occupied"
                    : "Physically travelling beside you"}
                </small>
              </span>
            </label>

            <label
              className={
                destination === "unassigned"
                  ? "relocation-option active"
                  : "relocation-option"
              }
            >
              <input
                type="radio"
                name="destination"
                value="unassigned"
                checked={destination === "unassigned"}
                onChange={(event) => setDestination(event.target.value)}
              />
              <span className="relocation-option-icon">◉</span>
              <span>
                <strong>Awaiting a home</strong>
                <small>Keep them in reserve without a fixed location</small>
              </span>
            </label>

            {places.map((place) => {
              const meta = getPlaceKindMeta(place.kind);
              const value = `place:${place.id}`;

              return (
                <label
                  className={
                    destination === value
                      ? "relocation-option active"
                      : "relocation-option"
                  }
                  key={place.id}
                >
                  <input
                    type="radio"
                    name="destination"
                    value={value}
                    checked={destination === value}
                    onChange={(event) => setDestination(event.target.value)}
                  />
                  <span className="relocation-option-icon">{meta.icon}</span>
                  <span>
                    <strong>{place.name}</strong>
                    <small>{getPlaceAddress(place) || meta.label}</small>
                  </span>
                </label>
              );
            })}
          </div>

          {places.length === 0 && (
            <p className="relocation-no-places">
              You have not created a custom place yet. The Pokémon can still
              join your party or remain unassigned.
            </p>
          )}

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="modal-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={isSaving}>
              {isSaving ? "Moving Pokémon..." : "Confirm destination"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ChoosePokemonForPlaceModal({
  targetLocationId,
  places,
  ownedPokemon,
  onClose,
  onMove,
}: {
  targetLocationId: string | null;
  places: PokemonPlace[];
  ownedPokemon: OwnedPokemon[];
  onClose: () => void;
  onMove: (pokemon: OwnedPokemon) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [movingId, setMovingId] = useState("");
  const targetPlace = targetLocationId
    ? places.find((place) => place.id === targetLocationId)
    : undefined;
  const targetName = targetPlace?.name ?? "Awaiting a home";
  const candidates = ownedPokemon.filter((pokemon) => {
    const alreadyThere =
      pokemon.status === "reserve" &&
      (targetLocationId
        ? pokemon.locationId === targetLocationId
        : !pokemon.locationId);
    const query = search.trim().toLowerCase();
    const matches =
      !query ||
      getCompanionName(pokemon).toLowerCase().includes(query) ||
      pokemon.displayName.toLowerCase().includes(query);

    return !alreadyThere && matches;
  });

  useModalBodyLock(onClose, Boolean(movingId));

  const handleMove = async (pokemon: OwnedPokemon) => {
    try {
      setMovingId(pokemon.id);
      await onMove(pokemon);
    } finally {
      setMovingId("");
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !movingId) {
          onClose();
        }
      }}
    >
      <section
        className="profile-modal choose-place-pokemon-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="choose-place-pokemon-title"
      >
        <header className="profile-modal-header">
          <div>
            <span className="section-kicker">Choose a resident</span>
            <h2 id="choose-place-pokemon-title">Move someone to {targetName}</h2>
            <p>
              Party Pokémon will leave their party slot. Reserve Pokémon will
              move from their previous location.
            </p>
          </div>
          <button
            className="modal-close-button"
            type="button"
            onClick={onClose}
            disabled={Boolean(movingId)}
            aria-label="Close Pokémon selector"
          >
            ×
          </button>
        </header>

        <div className="choose-place-pokemon-body">
          <label className="collection-search choose-place-search">
            <span>⌕</span>
            <input
              autoFocus
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by nickname or species..."
            />
          </label>

          {candidates.length === 0 ? (
            <div className="place-residents-empty choose-place-empty">
              <span>✓</span>
              <div>
                <strong>No available Pokémon match this search.</strong>
                <p>Everyone may already be at this location.</p>
              </div>
            </div>
          ) : (
            <div className="choose-place-pokemon-list">
              {candidates.map((pokemon) => {
                const artwork = getArtwork(pokemon);
                const currentPlace = pokemon.locationId
                  ? places.find((place) => place.id === pokemon.locationId)?.name
                  : undefined;

                return (
                  <article
                    className="choose-place-pokemon-card"
                    style={getTypeStyle(pokemon.types)}
                    key={pokemon.id}
                  >
                    <div className="choose-place-pokemon-art">
                      {artwork ? (
                        <img src={artwork} alt={pokemon.displayName} />
                      ) : (
                        <span>?</span>
                      )}
                    </div>
                    <div>
                      <small>{pokemon.displayName}</small>
                      <strong>{getCompanionName(pokemon)}</strong>
                      <p>
                        {pokemon.status === "party"
                          ? "Travelling party"
                          : currentPlace ?? "Awaiting a home"}
                      </p>
                    </div>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => void handleMove(pokemon)}
                      disabled={Boolean(movingId)}
                    >
                      {movingId === pokemon.id ? "Moving..." : "Move here"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function EditPokemonModal({
  pokemon,
  partyCount,
  places,
  evolutionHistory,
  onClose,
  onSaved,
  onRequestEvolution,
  onEditEvolution,
  onUndoEvolution,
  onRequestRelease,
}: {
  pokemon: OwnedPokemon;
  partyCount: number;
  places: PokemonPlace[];
  evolutionHistory: EvolutionMemory[];
  onClose: () => void;
  onSaved: (pokemon: OwnedPokemon) => void;
  onRequestEvolution: (pokemon: OwnedPokemon) => void;
  onEditEvolution: (memory: EvolutionMemory) => void;
  onUndoEvolution: (memory: EvolutionMemory) => void;
  onRequestRelease: (pokemon: OwnedPokemon) => void;
}) {
  const [nickname, setNickname] = useState(pokemon.nickname);
  const [gender, setGender] = useState<PokemonGender>(pokemon.gender);
  const [isShiny, setIsShiny] = useState(pokemon.isShiny);
  const [nature, setNature] = useState(pokemon.nature);
  const [level, setLevel] = useState(
    pokemon.level ? String(pokemon.level) : "",
  );
  const [abilityApiName, setAbilityApiName] = useState(
    pokemon.ability?.apiName ?? "",
  );
  const [heldItem, setHeldItem] = useState(
    pokemon.heldItem?.displayName ?? "",
  );
  const [moves, setMoves] = useState(() => fourMoveInputs(pokemon.moves));
  const [catalogEntry, setCatalogEntry] =
    useState<PokemonCatalogEntry | null>(null);
  const [itemOptions, setItemOptions] = useState<PokemonItemIndexEntry[]>([]);
  const [isLoadingLoadout, setIsLoadingLoadout] = useState(true);
  const [metDate, setMetDate] = useState(pokemon.metDate);
  const [metLocation, setMetLocation] = useState(pokemon.metLocation);
  const [meetingStory, setMeetingStory] = useState(pokemon.meetingStory);
  const [personalityNotes, setPersonalityNotes] = useState(
    pokemon.personalityNotes,
  );
  const [status, setStatus] = useState<OwnedPokemonStatus>(pokemon.status);
  const [locationId, setLocationId] = useState(
    pokemon.locationId ?? pokemon.lastLocationId ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useModalBodyLock(onClose, isSaving);

  useEffect(() => {
    let cancelled = false;

    const loadBattleOptions = async () => {
      setIsLoadingLoadout(true);

      const catalogPromise = (async () => {
        const speciesDetails = await fetchSpeciesDetails(pokemon.speciesApiName);
        return fetchPokemonForm(speciesDetails, pokemon.pokemonApiName);
      })();
      const [catalogResult, itemsResult] = await Promise.allSettled([
        catalogPromise,
        loadItemIndex(),
      ]);

      if (cancelled) {
        return;
      }

      if (catalogResult.status === "fulfilled") {
        setCatalogEntry(catalogResult.value);
      } else {
        console.error("Could not load ability and move options:", catalogResult.reason);
      }

      if (itemsResult.status === "fulfilled") {
        setItemOptions(itemsResult.value);
      } else {
        console.error("Could not load held-item suggestions:", itemsResult.reason);
      }

      setIsLoadingLoadout(false);
    };

    void loadBattleOptions();
    return () => {
      cancelled = true;
    };
  }, [pokemon.pokemonApiName, pokemon.speciesApiName]);

  const partyOptionDisabled = pokemon.status !== "party" && partyCount >= 6;
  const previewArtwork = isShiny
    ? pokemon.shinyArtwork || pokemon.artwork
    : pokemon.artwork;
  const displayName = nickname.trim() || pokemon.displayName;
  const sortedEvolutionHistory = [...evolutionHistory].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const latestEvolutionId = sortedEvolutionHistory[0]?.id;
  const availableAbilities =
    catalogEntry?.abilities ?? (pokemon.ability ? [pokemon.ability] : []);
  const availableMoves =
    catalogEntry?.moves ?? pokemon.moves ?? [];

  const handleMoveChange = (index: number, value: string) => {
    setMoves((current) =>
      current.map((move, moveIndex) => (moveIndex === index ? value : move)),
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    try {
      const parsedLevel = parsePokemonLevel(level);
      const selectedAbility = availableAbilities.find(
        (ability) => ability.apiName === abilityApiName,
      );
      setIsSaving(true);
      const selectedHeldItem = await resolveHeldItem(heldItem, itemOptions);
      const selectedMoves = await resolveMoves(moves, availableMoves);

      const updated = await updateOwnedPokemon(pokemon.id, {
        nickname: nickname.trim(),
        gender,
        isShiny,
        nature,
        level: parsedLevel,
        ability: selectedAbility,
        heldItem: selectedHeldItem,
        moves: selectedMoves,
        metDate,
        metLocation: metLocation.trim(),
        meetingStory: meetingStory.trim(),
        personalityNotes: personalityNotes.trim(),
        status,
        locationId: status === "reserve" ? locationId || null : locationId || null,
      });
      onSaved(updated);
    } catch (error) {
      console.error("Could not update Pokémon:", error);

      if (error instanceof PartyFullError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "This Pokémon could not be updated.",
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const genderOptions: { value: PokemonGender; label: string }[] = [
    { value: "unknown", label: "Not decided" },
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "genderless", label: "Genderless" },
  ];

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="profile-modal pokemon-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-pokemon-title"
      >
        <header className="profile-modal-header">
          <div>
            <span className="section-kicker">Individual partner</span>
            <h2 id="edit-pokemon-title">Edit {displayName}</h2>
            <p>
              Update this companion's personal details, evolution history, and
              current place in your journey.
            </p>
          </div>
          <button
            className="modal-close-button"
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close Pokémon editor"
          >
            ×
          </button>
        </header>

        <form className="profile-form pokemon-editor-form" onSubmit={handleSubmit}>
          <div
            className="selected-pokemon-preview edit-pokemon-preview"
            style={getTypeStyle(pokemon.types)}
          >
            <div className="selected-pokemon-art">
              <div className="selected-art-glow" />
              {previewArtwork ? (
                <img src={previewArtwork} alt={pokemon.displayName} />
              ) : (
                <span className="missing-art">?</span>
              )}
            </div>
            <div className="selected-pokemon-copy">
              <span>
                #{String(pokemon.speciesId).padStart(4, "0")} · {pokemon.genus}
              </span>
              <h3>{displayName}</h3>
              {nickname.trim() && <strong>{pokemon.displayName}</strong>}
              <div className="pokemon-type-row selected-types">
                {pokemon.types.map((type) => (
                  <span key={type}>{formatType(type)}</span>
                ))}
                {isShiny && <span className="shiny-tag">Shiny</span>}
              </div>
              <p>
                This is the companion's current evolutionary stage. Evolving
                creates a dated memory and can be undone from the latest stage.
              </p>
            </div>
          </div>

          <div className="form-grid pokemon-form-grid">
            <label className="form-field">
              <span>Nickname (optional)</span>
              <input
                autoFocus
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder={pokemon.displayName}
                maxLength={40}
              />
            </label>

            <label className="form-field">
              <span>Gender</span>
              <select
                value={gender}
                onChange={(event) =>
                  setGender(event.target.value as PokemonGender)
                }
              >
                {genderOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Nature (optional)</span>
              <select
                value={nature}
                onChange={(event) => setNature(event.target.value)}
              >
                {pokemonNatures.map((entry) => (
                  <option value={entry} key={entry || "none"}>
                    {entry || "Not chosen"}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Date met (optional)</span>
              <input
                type="date"
                value={metDate}
                onChange={(event) => setMetDate(event.target.value)}
              />
            </label>

            <label className="form-field form-field-full">
              <span>Where did you meet?</span>
              <input
                type="text"
                value={metLocation}
                onChange={(event) => setMetLocation(event.target.value)}
                placeholder="Eterna Forest, your hometown, an egg..."
                maxLength={80}
              />
            </label>

            <label className="form-field form-field-full">
              <span>How did you meet?</span>
              <textarea
                value={meetingStory}
                onChange={(event) => setMeetingStory(event.target.value)}
                placeholder="Write the beginning of your shared story..."
                rows={3}
                maxLength={420}
              />
              <small>{meetingStory.length}/420 characters</small>
            </label>

            <label className="form-field form-field-full">
              <span>Personality notes</span>
              <textarea
                value={personalityNotes}
                onChange={(event) => setPersonalityNotes(event.target.value)}
                placeholder="Protective, easily distracted, loves rain..."
                rows={3}
                maxLength={240}
              />
              <small>{personalityNotes.length}/240 characters</small>
            </label>
          </div>

          <PokemonLoadoutFields
            idPrefix={`edit-${pokemon.id}`}
            level={level}
            onLevelChange={setLevel}
            abilities={availableAbilities}
            abilityApiName={abilityApiName}
            onAbilityChange={setAbilityApiName}
            heldItem={heldItem}
            onHeldItemChange={setHeldItem}
            itemOptions={itemOptions}
            moves={moves}
            onMoveChange={handleMoveChange}
            moveOptions={availableMoves}
            isLoading={isLoadingLoadout}
          />

          <div className="pokemon-toggle-grid edit-pokemon-toggle-grid">
            <label className="pokemon-toggle-card">
              <input
                type="checkbox"
                checked={isShiny}
                onChange={(event) => setIsShiny(event.target.checked)}
              />
              <span className="toggle-visual" />
              <span>
                <strong>Shiny Pokémon</strong>
                <small>Use the shiny artwork when available</small>
              </span>
            </label>

            <label
              className={
                partyOptionDisabled
                  ? "pokemon-toggle-card disabled"
                  : "pokemon-toggle-card"
              }
            >
              <input
                type="checkbox"
                checked={status === "party"}
                onChange={(event) =>
                  setStatus(event.target.checked ? "party" : "reserve")
                }
                disabled={partyOptionDisabled}
              />
              <span className="toggle-visual" />
              <span>
                <strong>Travelling party</strong>
                <small>
                  {partyOptionDisabled
                    ? "Your six party slots are already occupied"
                    : status === "party"
                      ? "This partner is travelling with you"
                      : "This partner is currently in the PC / reserve"}
                </small>
              </span>
            </label>
          </div>

          {status === "reserve" && (
            <section className="pokemon-current-place-field">
              <div>
                <span className="section-kicker">Current home</span>
                <h3>Where is this partner staying?</h3>
                <p>
                  Choose a meaningful location, or leave them awaiting a home.
                </p>
              </div>
              <label className="form-field">
                <span>Assigned place</span>
                <select
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                >
                  <option value="">Awaiting a home / unassigned reserve</option>
                  {places.map((place) => (
                    <option value={place.id} key={place.id}>
                      {place.name}
                      {getPlaceAddress(place)
                        ? ` — ${getPlaceAddress(place)}`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}

          <section className="pokemon-evolution-zone">
            <div className="evolution-zone-heading">
              <div>
                <span className="section-kicker">Life milestones</span>
                <h3>Evolution history</h3>
                <p>
                  Record when, where, and how this partner evolved. PokéAPI
                  provides the official next stages; your notes provide the story.
                </p>
              </div>
              <button
                className="evolve-button"
                type="button"
                onClick={() => onRequestEvolution(pokemon)}
                disabled={isSaving}
              >
                Evolve Pokémon…
              </button>
            </div>

            {sortedEvolutionHistory.length === 0 ? (
              <div className="evolution-history-empty">
                <span>◇</span>
                <div>
                  <strong>No evolutions recorded yet</strong>
                  <p>The current stage will be preserved when the first evolution is added.</p>
                </div>
              </div>
            ) : (
              <div className="evolution-history-list">
                {sortedEvolutionHistory.map((memory) => (
                  <article className="evolution-history-entry" key={memory.id}>
                    <div className="evolution-history-transition">
                      <strong>{memory.from.displayName}</strong>
                      <span>→</span>
                      <strong>{memory.to.displayName}</strong>
                    </div>
                    <div className="evolution-history-meta">
                      <span>{formatDisplayDate(memory.evolutionDate)}</span>
                      {memory.evolutionLocation && <span>{memory.evolutionLocation}</span>}
                    </div>
                    <p>
                      {memory.evolutionMethod || "Evolution method not recorded"}
                    </p>
                    {memory.evolutionNotes && <blockquote>{memory.evolutionNotes}</blockquote>}
                    <div className="evolution-history-actions">
                      <button
                        className="secondary-memory-button"
                        type="button"
                        onClick={() => onEditEvolution(memory)}
                      >
                        Edit details
                      </button>
                      {memory.id === latestEvolutionId && (
                        <button
                          className="undo-evolution-button"
                          type="button"
                          onClick={() => onUndoEvolution(memory)}
                        >
                          Undo latest evolution
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="pokemon-danger-zone">
            <div>
              <strong>Release this Pokémon</strong>
              <p>
                The active companion will be removed, but you can preserve a
                farewell memory with the reason and location.
              </p>
            </div>
            <button
              className="danger-button"
              type="button"
              onClick={() => onRequestRelease(pokemon)}
              disabled={isSaving}
            >
              Release Pokémon…
            </button>
          </div>

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="profile-form-footer pokemon-editor-footer">
            <div className="local-save-note">
              <span>✓</span>
              Changes stay on this device in IndexedDB
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? "Saving changes..." : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function EvolvePokemonModal({
  pokemon,
  onClose,
  onEvolved,
}: {
  pokemon: OwnedPokemon;
  onClose: () => void;
  onEvolved: (pokemon: OwnedPokemon, memory: EvolutionMemory) => void;
}) {
  const [options, setOptions] = useState<EvolutionOption[]>([]);
  const [selectedOptionName, setSelectedOptionName] = useState("");
  const [targetSpecies, setTargetSpecies] =
    useState<PokemonSpeciesDetails | null>(null);
  const [targetForm, setTargetForm] = useState<PokemonCatalogEntry | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isLoadingTarget, setIsLoadingTarget] = useState(false);
  const [evolutionDate, setEvolutionDate] = useState(todayAsInputValue());
  const [evolutionLocation, setEvolutionLocation] = useState("");
  const [evolutionMethod, setEvolutionMethod] = useState("");
  const [evolutionNotes, setEvolutionNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useModalBodyLock(onClose, isSaving);

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      try {
        setIsLoadingOptions(true);
        setErrorMessage("");
        const availableOptions = await fetchEvolutionOptions(
          pokemon.speciesApiName,
        );

        if (cancelled) {
          return;
        }

        setOptions(availableOptions);

        if (availableOptions.length === 1) {
          const option = availableOptions[0];
          setSelectedOptionName(option.speciesApiName);
          setEvolutionMethod(option.suggestedMethod);
          setIsLoadingTarget(true);
          const selection = await fetchSpeciesSelection(option.speciesApiName);

          if (!cancelled) {
            setTargetSpecies(selection.species);
            setTargetForm(selection.form);
          }
        }
      } catch (error) {
        console.error("Could not load evolution options:", error);

        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Evolution options could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingOptions(false);
          setIsLoadingTarget(false);
        }
      }
    };

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, [pokemon.speciesApiName]);

  const selectEvolutionOption = async (speciesApiName: string) => {
    setSelectedOptionName(speciesApiName);
    setTargetSpecies(null);
    setTargetForm(null);
    setErrorMessage("");

    if (!speciesApiName) {
      setEvolutionMethod("");
      return;
    }

    const option = options.find(
      (entry) => entry.speciesApiName === speciesApiName,
    );
    setEvolutionMethod(option?.suggestedMethod ?? "");

    try {
      setIsLoadingTarget(true);
      const selection = await fetchSpeciesSelection(speciesApiName);
      setTargetSpecies(selection.species);
      setTargetForm(selection.form);
    } catch (error) {
      console.error("Could not load evolved form:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "That evolved form could not be loaded.",
      );
    } finally {
      setIsLoadingTarget(false);
    }
  };

  const handleFormChange = async (pokemonApiName: string) => {
    if (!targetSpecies) {
      return;
    }

    setErrorMessage("");

    try {
      setIsLoadingTarget(true);
      const form = await fetchPokemonForm(targetSpecies, pokemonApiName);
      setTargetForm(form);
    } catch (error) {
      console.error("Could not load evolution form:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "That form could not be loaded.",
      );
    } finally {
      setIsLoadingTarget(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!targetSpecies || !targetForm) {
      setErrorMessage("Choose the Pokémon's new evolutionary stage.");
      return;
    }

    if (!evolutionDate) {
      setErrorMessage("Choose the date this evolution happened.");
      return;
    }

    if (!evolutionMethod.trim()) {
      setErrorMessage("Record how this evolution happened.");
      return;
    }

    try {
      setIsSaving(true);
      const result = await evolveOwnedPokemon(pokemon.id, {
        targetSpecies,
        targetForm,
        evolutionDate,
        evolutionLocation,
        evolutionMethod,
        evolutionNotes,
      });
      onEvolved(result.pokemon, result.memory);
    } catch (error) {
      console.error("Could not evolve Pokémon:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "This evolution could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const currentArtwork = getArtwork(pokemon);
  const targetArtwork = targetForm
    ? pokemon.isShiny
      ? targetForm.shinyArtwork || targetForm.artwork
      : targetForm.artwork
    : "";

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="profile-modal evolution-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evolve-pokemon-title"
      >
        <header className="profile-modal-header evolution-modal-header">
          <div>
            <span className="section-kicker">New evolutionary stage</span>
            <h2 id="evolve-pokemon-title">
              Evolve {getCompanionName(pokemon)}
            </h2>
            <p>
              Choose an official next stage, then record when, where, and how
              this moment happened in your version of the journey.
            </p>
          </div>
          <button
            className="modal-close-button"
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close evolution form"
          >
            ×
          </button>
        </header>

        <form className="profile-form evolution-form" onSubmit={handleSubmit}>
          <div className="evolution-stage-preview">
            <div className="evolution-stage-card" style={getTypeStyle(pokemon.types)}>
              <span>Current stage</span>
              <div className="evolution-stage-art">
                <div className="selected-art-glow" />
                {currentArtwork ? (
                  <img src={currentArtwork} alt={pokemon.displayName} />
                ) : (
                  <span className="missing-art">?</span>
                )}
              </div>
              <strong>{pokemon.displayName}</strong>
              <small>{pokemon.formLabel}</small>
            </div>

            <div className="evolution-stage-arrow">→</div>

            <div
              className="evolution-stage-card target-stage-card"
              style={getTypeStyle(targetForm?.types ?? ["normal"])}
            >
              <span>New stage</span>
              <div className="evolution-stage-art">
                <div className="selected-art-glow" />
                {isLoadingTarget ? (
                  <div className="inline-loader" aria-label="Loading evolved form" />
                ) : targetArtwork ? (
                  <img src={targetArtwork} alt={targetForm?.displayName ?? "Evolution"} />
                ) : (
                  <span className="evolution-target-placeholder">?</span>
                )}
              </div>
              <strong>{targetForm?.displayName ?? "Choose an evolution"}</strong>
              <small>{targetForm?.formLabel ?? "Official PokéAPI chain"}</small>
            </div>
          </div>

          {isLoadingOptions ? (
            <div className="evolution-options-loading">
              <div className="inline-loader" />
              <span>Loading the official evolution chain…</span>
            </div>
          ) : options.length === 0 ? (
            <div className="evolution-final-stage">
              <span>◆</span>
              <div>
                <strong>No further evolution is listed for {pokemon.displayName}.</strong>
                <p>
                  PokéAPI considers this the final stage of its species chain.
                  Temporary transformations such as Mega Evolution are not
                  treated as permanent species evolution here.
                </p>
              </div>
            </div>
          ) : (
            <div className="form-grid pokemon-form-grid evolution-form-grid">
              <label className="form-field form-field-full">
                <span>Evolution target</span>
                <select
                  value={selectedOptionName}
                  onChange={(event) => void selectEvolutionOption(event.target.value)}
                  disabled={isSaving || isLoadingTarget}
                >
                  <option value="">Choose the next stage</option>
                  {options.map((option) => (
                    <option value={option.speciesApiName} key={option.speciesApiName}>
                      #{String(option.speciesId).padStart(4, "0")} · {option.displayName}
                    </option>
                  ))}
                </select>
              </label>

              {targetSpecies && targetSpecies.varieties.length > 1 && (
                <label className="form-field form-field-full">
                  <span>Evolved form or variety</span>
                  <select
                    value={targetForm?.apiName ?? ""}
                    onChange={(event) => void handleFormChange(event.target.value)}
                    disabled={isSaving || isLoadingTarget}
                  >
                    {targetSpecies.varieties.map((variety) => (
                      <option value={variety.apiName} key={variety.apiName}>
                        {variety.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="form-field">
                <span>Date evolved</span>
                <input
                  type="date"
                  value={evolutionDate}
                  onChange={(event) => setEvolutionDate(event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Where did it happen? (optional)</span>
                <input
                  type="text"
                  value={evolutionLocation}
                  onChange={(event) => setEvolutionLocation(event.target.value)}
                  placeholder="Bell Tower, Route 32, at home..."
                  maxLength={100}
                />
              </label>

              <label className="form-field form-field-full">
                <span>How did they evolve?</span>
                <textarea
                  value={evolutionMethod}
                  onChange={(event) => setEvolutionMethod(event.target.value)}
                  placeholder="Levelled up after protecting the team, used a Water Stone..."
                  rows={3}
                  maxLength={420}
                  required
                />
                <small>
                  PokéAPI's condition is suggested automatically, but this is your story. {evolutionMethod.length}/420
                </small>
              </label>

              <label className="form-field form-field-full">
                <span>Evolution notes (optional)</span>
                <textarea
                  value={evolutionNotes}
                  onChange={(event) => setEvolutionNotes(event.target.value)}
                  placeholder="How did everyone react? Did their personality or role in the group change?"
                  rows={4}
                  maxLength={700}
                />
                <small>{evolutionNotes.length}/700 characters</small>
              </label>
            </div>
          )}

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="profile-form-footer evolution-form-footer">
            <div className="local-save-note">
              <span>✓</span>
              The previous stage is kept in an evolution memory
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={
                  isSaving ||
                  isLoadingOptions ||
                  isLoadingTarget ||
                  options.length === 0 ||
                  !targetForm
                }
              >
                {isSaving ? "Saving evolution..." : "Record evolution"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function EditEvolutionMemoryModal({
  memory,
  onClose,
  onSaved,
}: {
  memory: EvolutionMemory;
  onClose: () => void;
  onSaved: (memory: EvolutionMemory) => void;
}) {
  const [evolutionDate, setEvolutionDate] = useState(memory.evolutionDate);
  const [evolutionLocation, setEvolutionLocation] = useState(
    memory.evolutionLocation,
  );
  const [evolutionMethod, setEvolutionMethod] = useState(
    memory.evolutionMethod,
  );
  const [evolutionNotes, setEvolutionNotes] = useState(memory.evolutionNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useModalBodyLock(onClose, isSaving);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!evolutionDate) {
      setErrorMessage("Choose the date this evolution happened.");
      return;
    }

    if (!evolutionMethod.trim()) {
      setErrorMessage("Record how this evolution happened.");
      return;
    }

    try {
      setIsSaving(true);
      const updated = await updateEvolutionMemory(memory.id, {
        evolutionDate,
        evolutionLocation,
        evolutionMethod,
        evolutionNotes,
      });
      onSaved(updated);
    } catch (error) {
      console.error("Could not update evolution memory:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "That evolution memory could not be updated.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="profile-modal edit-evolution-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-evolution-title"
      >
        <header className="profile-modal-header">
          <div>
            <span className="section-kicker">Evolution memory</span>
            <h2 id="edit-evolution-title">
              Edit {memory.from.displayName} → {memory.to.displayName}
            </h2>
            <p>
              Correct the date, place, method, or personal notes without
              changing the evolutionary stages themselves.
            </p>
          </div>
          <button
            className="modal-close-button"
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close evolution memory editor"
          >
            ×
          </button>
        </header>

        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="edit-evolution-summary">
            <strong>{getEvolutionMemoryName(memory)}</strong>
            <span>{memory.from.displayName}</span>
            <b>→</b>
            <span>{memory.to.displayName}</span>
          </div>

          <div className="form-grid pokemon-form-grid">
            <label className="form-field">
              <span>Date evolved</span>
              <input
                type="date"
                value={evolutionDate}
                onChange={(event) => setEvolutionDate(event.target.value)}
                required
              />
            </label>

            <label className="form-field">
              <span>Where did it happen? (optional)</span>
              <input
                type="text"
                value={evolutionLocation}
                onChange={(event) => setEvolutionLocation(event.target.value)}
                maxLength={100}
              />
            </label>

            <label className="form-field form-field-full">
              <span>How did they evolve?</span>
              <textarea
                value={evolutionMethod}
                onChange={(event) => setEvolutionMethod(event.target.value)}
                rows={3}
                maxLength={420}
                required
              />
              <small>{evolutionMethod.length}/420 characters</small>
            </label>

            <label className="form-field form-field-full">
              <span>Evolution notes (optional)</span>
              <textarea
                value={evolutionNotes}
                onChange={(event) => setEvolutionNotes(event.target.value)}
                rows={5}
                maxLength={700}
              />
              <small>{evolutionNotes.length}/700 characters</small>
            </label>
          </div>

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="profile-form-footer">
            <div className="local-save-note">
              <span>✓</span>
              The Pokémon's current form is not changed here
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button className="primary-button" type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save memory"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function JournalEntryModal({
  entry,
  ownedPokemon,
  onClose,
  onSaved,
}: {
  entry?: JournalEntry;
  ownedPokemon: OwnedPokemon[];
  onClose: () => void;
  onSaved: (entry: JournalEntry) => void;
}) {
  const isMeetingEntry = entry?.kind === "pokemon-met";
  const [kind, setKind] = useState<JournalEntryKind>(entry?.kind ?? "journey");
  const [title, setTitle] = useState(entry?.title ?? "");
  const [eventDate, setEventDate] = useState(entry?.eventDate ?? todayAsInputValue());
  const [location, setLocation] = useState(entry?.location ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [pokemonIds, setPokemonIds] = useState<string[]>(entry?.pokemonIds ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useModalBodyLock(onClose, isSaving);

  const togglePokemon = (id: string) => {
    if (isMeetingEntry) return;
    setPokemonIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    if (!title.trim()) { setErrorMessage("Give this memory a title."); return; }
    if (!eventDate) { setErrorMessage("Choose when this memory happened."); return; }

    try {
      setIsSaving(true);
      const saved = await saveJournalEntry({
        kind,
        title,
        eventDate,
        location,
        description,
        pokemonIds,
        sourcePokemonId: entry?.sourcePokemonId,
      }, entry?.id);
      onSaved(saved);
    } catch (error) {
      console.error("Could not save journal entry:", error);
      setErrorMessage(error instanceof Error ? error.message : "That journal entry could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="profile-modal journal-entry-modal" role="dialog" aria-modal="true" aria-labelledby="journal-entry-modal-title">
        <header className="profile-modal-header">
          <div>
            <span className="section-kicker">{entry ? "Edit a memory" : "Write your story"}</span>
            <h2 id="journal-entry-modal-title">{entry ? entry.title : "New journal entry"}</h2>
            <p>{isMeetingEntry ? "This entry is linked to the Pokémon's meeting details. Changes to the date, place, or story will update both." : "Record a Gym victory, badge, battle, trip, achievement, or any moment you want to remember."}</p>
          </div>
          <button className="modal-close-button" type="button" onClick={onClose} disabled={isSaving} aria-label="Close journal editor">×</button>
        </header>

        <form className="profile-form journal-entry-form" onSubmit={handleSubmit}>
          <div className="form-grid pokemon-form-grid">
            <label className="form-field">
              <span>Entry type</span>
              <select value={kind} onChange={(event) => setKind(event.target.value as JournalEntryKind)} disabled={isMeetingEntry}>
                {isMeetingEntry && <option value="pokemon-met">Pokémon meeting</option>}
                {!isMeetingEntry && <><option value="gym">Gym victory</option><option value="badge">Badge earned</option><option value="battle">Battle</option><option value="journey">Journey moment</option><option value="bond">Pokémon bond</option><option value="achievement">Achievement</option><option value="note">Journal note</option><option value="custom">Custom memory</option></>}
              </select>
            </label>
            <label className="form-field"><span>Date</span><input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} required /></label>
            <label className="form-field form-field-full"><span>Title</span><input type="text" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder={kind === "gym" ? "Defeated Whitney at Goldenrod Gym" : "Give this memory a name"} required /><small>{title.length}/120 characters</small></label>
            <label className="form-field form-field-full"><span>Where did it happen? (optional)</span><input type="text" value={location} onChange={(event) => setLocation(event.target.value)} maxLength={120} placeholder="Goldenrod Gym, Route 29, Ecruteak City..." /></label>
            <label className="form-field form-field-full"><span>{isMeetingEntry ? "How did you meet?" : "What happened?"}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={6} maxLength={1200} placeholder={kind === "gym" ? "How did the Gym challenge go? Who battled? What made it memorable?" : "Write the story of this moment..."} /><small>{description.length}/1200 characters</small></label>
          </div>

          {!isMeetingEntry && (
            <div className="journal-pokemon-picker">
              <div><span className="section-kicker">Pokémon involved</span><h3>Who was part of this memory?</h3><p>Optional — select as many of your current partners as you want.</p></div>
              {ownedPokemon.length === 0 ? <p className="journal-picker-empty">Add a Pokémon first if you want to attach companions to this entry.</p> : <div className="journal-pokemon-picker-grid">{ownedPokemon.map((pokemon) => { const selected = pokemonIds.includes(pokemon.id); return <button className={selected ? "journal-pokemon-option selected" : "journal-pokemon-option"} type="button" onClick={() => togglePokemon(pokemon.id)} key={pokemon.id}><span className="journal-pokemon-option-art" style={getTypeStyle(pokemon.types)}>{getArtwork(pokemon) && <img src={getArtwork(pokemon)} alt="" />}</span><span><strong>{getCompanionName(pokemon)}</strong><small>{pokemon.displayName}</small></span><b>{selected ? "✓" : "+"}</b></button>; })}</div>}
              {entry && entry.pokemon.some((participant) => !ownedPokemon.some((pokemon) => pokemon.id === participant.originalPokemonId)) && <p className="archived-participant-note">Released or otherwise archived Pokémon already attached to this memory will stay preserved when you save it.</p>}
            </div>
          )}

          {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
          <div className="profile-form-footer"><div className="local-save-note"><span>✓</span>{isMeetingEntry ? "Meeting details stay linked to the Pokémon profile" : "Saved to your local journey timeline"}</div><div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={isSaving}>Cancel</button><button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "Saving..." : entry ? "Save changes" : "Add to journal"}</button></div></div>
        </form>
      </section>
    </div>
  );
}

function EditReleaseMemoryModal({
  memory,
  onClose,
  onSaved,
}: {
  memory: ReleaseMemory;
  onClose: () => void;
  onSaved: (memory: ReleaseMemory) => void;
}) {
  const [releaseDate, setReleaseDate] = useState(memory.releaseDate);
  const [releaseLocation, setReleaseLocation] = useState(memory.releaseLocation);
  const [releaseReason, setReleaseReason] = useState(memory.releaseReason);
  const [farewellNote, setFarewellNote] = useState(memory.farewellNote);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  useModalBodyLock(onClose, isSaving);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setErrorMessage("");
    if (!releaseDate) { setErrorMessage("Choose the release date."); return; }
    if (!releaseReason.trim()) { setErrorMessage("Record why this Pokémon was released."); return; }
    try { setIsSaving(true); const saved = await updateReleaseMemory(memory.id, { releaseDate, releaseLocation, releaseReason, farewellNote }); onSaved(saved); }
    catch (error) { console.error("Could not update release memory:", error); setErrorMessage(error instanceof Error ? error.message : "That release memory could not be updated."); }
    finally { setIsSaving(false); }
  };

  return <div className="modal-backdrop" role="presentation"><section className="profile-modal" role="dialog" aria-modal="true"><header className="profile-modal-header"><div><span className="section-kicker">Farewell memory</span><h2>Edit {getReleaseMemoryName(memory)}'s release</h2><p>Correct the date, place, reason, or farewell note without restoring the Pokémon.</p></div><button className="modal-close-button" type="button" onClick={onClose} disabled={isSaving}>×</button></header><form className="profile-form" onSubmit={handleSubmit}><div className="form-grid pokemon-form-grid"><label className="form-field"><span>Date released</span><input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} required /></label><label className="form-field"><span>Release location</span><input type="text" value={releaseLocation} onChange={(e) => setReleaseLocation(e.target.value)} maxLength={120} /></label><label className="form-field form-field-full"><span>Why were they released?</span><textarea value={releaseReason} onChange={(e) => setReleaseReason(e.target.value)} rows={4} maxLength={700} required /></label><label className="form-field form-field-full"><span>Farewell note (optional)</span><textarea value={farewellNote} onChange={(e) => setFarewellNote(e.target.value)} rows={5} maxLength={900} /></label></div>{errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}<div className="profile-form-footer"><div className="local-save-note"><span>✓</span>The Pokémon remains released</div><div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={isSaving}>Cancel</button><button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save memory"}</button></div></div></form></section></div>;
}

function ReleasePokemonModal({
  pokemon,
  onClose,
  onReleased,
}: {
  pokemon: OwnedPokemon;
  onClose: () => void;
  onReleased: (memory: ReleaseMemory) => void;
}) {
  const [releaseDate, setReleaseDate] = useState(todayAsInputValue());
  const [releaseLocation, setReleaseLocation] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const [farewellNote, setFarewellNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const name = getCompanionName(pokemon);

  useModalBodyLock(onClose, isSaving);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!releaseDate) {
      setErrorMessage("Choose the date this Pokémon was released.");
      return;
    }

    if (!releaseReason.trim()) {
      setErrorMessage("Record why this Pokémon was released.");
      return;
    }

    try {
      setIsSaving(true);
      const memory = await releaseOwnedPokemon(pokemon.id, {
        releaseDate,
        releaseLocation,
        releaseReason,
        farewellNote,
      });
      onReleased(memory);
    } catch (error) {
      console.error("Could not release Pokémon:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "This Pokémon could not be released.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop release-modal-backdrop" role="presentation">
      <section
        className="profile-modal release-pokemon-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-pokemon-title"
      >
        <header className="profile-modal-header release-modal-header">
          <div>
            <span className="section-kicker danger-kicker">Farewell memory</span>
            <h2 id="release-pokemon-title">Release {name}?</h2>
            <p>
              {name} will leave your party or PC. A journal memory will remain
              until you delete it.
            </p>
          </div>
          <button
            className="modal-close-button"
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close release form"
          >
            ×
          </button>
        </header>

        <form className="profile-form release-pokemon-form" onSubmit={handleSubmit}>
          <div className="release-pokemon-summary" style={getTypeStyle(pokemon.types)}>
            <div className="release-summary-art">
              <div className="release-memory-glow" />
              {getArtwork(pokemon) ? (
                <img src={getArtwork(pokemon)} alt={pokemon.displayName} />
              ) : (
                <span className="missing-art">?</span>
              )}
            </div>
            <div>
              <small>{pokemon.displayName}</small>
              <strong>{name}</strong>
              <p>
                Their personal data is copied into the release memory before
                the active record is removed.
              </p>
            </div>
          </div>

          <div className="release-warning">
            <span>!</span>
            <p>
              This removes {name} from your active collection. Deleting the
              journal memory later will not restore the Pokémon.
            </p>
          </div>

          <div className="form-grid">
            <label className="form-field">
              <span>Date released</span>
              <input
                type="date"
                value={releaseDate}
                onChange={(event) => setReleaseDate(event.target.value)}
                required
              />
            </label>

            <label className="form-field">
              <span>Where were they released? (optional)</span>
              <input
                type="text"
                value={releaseLocation}
                onChange={(event) => setReleaseLocation(event.target.value)}
                placeholder="A forest, sanctuary, hometown..."
                maxLength={100}
              />
            </label>

            <label className="form-field form-field-full">
              <span>Why were they released?</span>
              <textarea
                autoFocus
                value={releaseReason}
                onChange={(event) => setReleaseReason(event.target.value)}
                placeholder="They wanted to protect their old colony, they were returning to the wild..."
                rows={4}
                maxLength={500}
                required
              />
              <small>{releaseReason.length}/500 characters</small>
            </label>

            <label className="form-field form-field-full">
              <span>Farewell note or what happens next (optional)</span>
              <textarea
                value={farewellNote}
                onChange={(event) => setFarewellNote(event.target.value)}
                placeholder="A final promise, how you said goodbye, whether you may meet again..."
                rows={3}
                maxLength={500}
              />
              <small>{farewellNote.length}/500 characters</small>
            </label>
          </div>

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="profile-form-footer">
            <div className="local-save-note release-save-note">
              <span>▤</span>
              A deletable journal memory will be created
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={onClose}
                disabled={isSaving}
              >
                Keep {name}
              </button>
              <button
                className="danger-primary-button"
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? "Creating farewell..." : `Release ${name}`}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function AddPokemonModal({
  partyCount,
  places,
  onClose,
  onSaved,
}: {
  partyCount: number;
  places: PokemonPlace[];
  onClose: () => void;
  onSaved: (pokemon: OwnedPokemon) => void;
}) {
  const [speciesIndex, setSpeciesIndex] = useState<
    PokemonSpeciesIndexEntry[]
  >([]);
  const [search, setSearch] = useState("");
  const [species, setSpecies] = useState<PokemonSpeciesDetails | null>(null);
  const [form, setForm] = useState<PokemonCatalogEntry | null>(null);
  const [isLoadingIndex, setIsLoadingIndex] = useState(true);
  const [isLoadingPokemon, setIsLoadingPokemon] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<PokemonGender>("unknown");
  const [isShiny, setIsShiny] = useState(false);
  const [nature, setNature] = useState("");
  const [level, setLevel] = useState("5");
  const [abilityApiName, setAbilityApiName] = useState("");
  const [heldItem, setHeldItem] = useState("");
  const [moves, setMoves] = useState(() => fourMoveInputs());
  const [itemOptions, setItemOptions] = useState<PokemonItemIndexEntry[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [metDate, setMetDate] = useState(todayAsInputValue());
  const [metLocation, setMetLocation] = useState("");
  const [meetingStory, setMeetingStory] = useState("");
  const [personalityNotes, setPersonalityNotes] = useState("");
  const [addToParty, setAddToParty] = useState(partyCount < 6);
  const [locationId, setLocationId] = useState("");

  useModalBodyLock(onClose, isSaving || isLoadingPokemon);

  useEffect(() => {
    let isCurrent = true;

    const load = async () => {
      try {
        setIsLoadingIndex(true);
        const index = await loadSpeciesIndex();

        if (isCurrent) {
          setSpeciesIndex(index);
        }
      } catch (error) {
        console.error("Could not load PokéAPI species index:", error);

        if (isCurrent) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "The PokéAPI species list could not be loaded.",
          );
        }
      } finally {
        if (isCurrent) {
          setIsLoadingIndex(false);
        }
      }
    };

    void load();

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    const loadItems = async () => {
      try {
        const items = await loadItemIndex();

        if (isCurrent) {
          setItemOptions(items);
        }
      } catch (error) {
        console.error("Could not load held-item suggestions:", error);
      } finally {
        if (isCurrent) {
          setIsLoadingItems(false);
        }
      }
    };

    void loadItems();
    return () => {
      isCurrent = false;
    };
  }, []);

  const searchResults = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    if (!normalized) {
      return speciesIndex.slice(0, 12);
    }

    const numericSearch = Number(normalized.replace(/^#/, ""));

    return speciesIndex
      .filter((entry) => {
        return (
          entry.displayName.toLowerCase().includes(normalized) ||
          entry.apiName.includes(normalized) ||
          (Number.isFinite(numericSearch) && entry.speciesId === numericSearch)
        );
      })
      .sort((a, b) => {
        const aExact =
          a.apiName === normalized ||
          a.displayName.toLowerCase() === normalized ||
          a.speciesId === numericSearch;
        const bExact =
          b.apiName === normalized ||
          b.displayName.toLowerCase() === normalized ||
          b.speciesId === numericSearch;

        if (aExact !== bExact) {
          return aExact ? -1 : 1;
        }

        return a.speciesId - b.speciesId;
      })
      .slice(0, 14);
  }, [search, speciesIndex]);

  const selectSpecies = async (entry: PokemonSpeciesIndexEntry) => {
    setErrorMessage("");
    setIsLoadingPokemon(true);
    setSpecies(null);
    setForm(null);
    setSearch(entry.displayName);

    try {
      const selection = await fetchSpeciesSelection(entry.apiName);
      setSpecies(selection.species);
      setForm(selection.form);
      setGender(getDefaultGender(selection.species.genderRate));
      setNickname("");
      setIsShiny(false);
      setNature("");
      setLevel("5");
      setAbilityApiName(getDefaultAbilityApiName(selection.form.abilities));
      setHeldItem("");
      setMoves(fourMoveInputs());
      setMetDate(todayAsInputValue());
      setMetLocation("");
      setMeetingStory("");
      setPersonalityNotes("");
      setAddToParty(partyCount < 6);
      setLocationId("");
    } catch (error) {
      console.error("Could not load Pokémon details:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "This Pokémon could not be loaded.",
      );
    } finally {
      setIsLoadingPokemon(false);
    }
  };

  const selectForm = async (pokemonApiName: string) => {
    if (!species) {
      return;
    }

    setErrorMessage("");
    setIsLoadingPokemon(true);

    try {
      const selectedForm = await fetchPokemonForm(species, pokemonApiName);
      setForm(selectedForm);
      setAbilityApiName(getDefaultAbilityApiName(selectedForm.abilities));
      setMoves(fourMoveInputs());
    } catch (error) {
      console.error("Could not load Pokémon form:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "This form could not be loaded.",
      );
    } finally {
      setIsLoadingPokemon(false);
    }
  };

  const handleMoveChange = (index: number, value: string) => {
    setMoves((current) =>
      current.map((move, moveIndex) => (moveIndex === index ? value : move)),
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!species || !form) {
      setErrorMessage("Choose a Pokémon species before saving.");
      return;
    }

    if (addToParty && partyCount >= 6) {
      setErrorMessage(
        "Your party is full. Save this Pokémon to the reserve instead.",
      );
      return;
    }

    try {
      const parsedLevel = parsePokemonLevel(level);
      const selectedAbility = form.abilities.find(
        (ability) => ability.apiName === abilityApiName,
      );
      setIsSaving(true);
      const selectedHeldItem = await resolveHeldItem(heldItem, itemOptions);
      const selectedMoves = await resolveMoves(moves, form.moves);

      const pokemon = await addOwnedPokemon({
        pokemonApiName: form.apiName,
        pokemonId: form.pokemonId,
        speciesId: species.speciesId,
        speciesApiName: species.apiName,
        displayName: form.displayName,
        formLabel: form.formLabel,
        types: form.types,
        artwork: form.artwork,
        shinyArtwork: form.shinyArtwork,
        sprite: form.sprite,
        genus: species.genus,
        flavorText: species.flavorText,
        nickname: nickname.trim(),
        gender,
        isShiny,
        nature,
        level: parsedLevel,
        ability: selectedAbility,
        heldItem: selectedHeldItem,
        moves: selectedMoves,
        metDate,
        metLocation: metLocation.trim(),
        meetingStory: meetingStory.trim(),
        personalityNotes: personalityNotes.trim(),
        addToParty,
        locationId: addToParty ? null : locationId || null,
      });

      onSaved(pokemon);
    } catch (error) {
      console.error("Could not save owned Pokémon:", error);

      if (error instanceof PartyFullError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "This Pokémon could not be saved locally. Please try again.",
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const previewArtwork = form
    ? isShiny
      ? form.shinyArtwork || form.artwork
      : form.artwork
    : "";

  return (
    <div
      className="modal-backdrop add-pokemon-backdrop"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isSaving &&
          !isLoadingPokemon
        ) {
          onClose();
        }
      }}
    >
      <section
        className="add-pokemon-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-pokemon-title"
      >
        <div className="profile-modal-header add-pokemon-header">
          <div>
            <span className="section-kicker">Create an individual partner</span>
            <h2 id="add-pokemon-title">Add a Pokémon</h2>
            <p>
              PokéAPI provides the species and artwork. You provide the life
              story.
            </p>
          </div>
          <button
            className="modal-close-button"
            type="button"
            onClick={onClose}
            disabled={isSaving || isLoadingPokemon}
            aria-label="Close Pokémon creator"
          >
            ×
          </button>
        </div>

        <form className="add-pokemon-form" onSubmit={handleSubmit}>
          <div className="pokemon-picker-column">
            <label className="pokemon-search-field">
              <span>Search by species name or National Dex number</span>
              <div>
                <span>⌕</span>
                <input
                  autoFocus
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSpecies(null);
                    setForm(null);
                  }}
                  placeholder="Try Torterra, Eevee, or #25..."
                  disabled={isLoadingIndex || isSaving}
                />
              </div>
            </label>

            <div className="species-result-panel">
              {isLoadingIndex ? (
                <div className="pokemon-picker-state">
                  <span className="loading-ring" />
                  <strong>Loading the PokéAPI index...</strong>
                  <p>This is cached locally after the first request.</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="pokemon-picker-state">
                  <strong>No species found.</strong>
                  <p>Check the spelling or try a National Dex number.</p>
                </div>
              ) : (
                <div className="species-result-list">
                  {searchResults.map((entry) => (
                    <button
                      className={
                        species?.apiName === entry.apiName
                          ? "species-result active"
                          : "species-result"
                      }
                      type="button"
                      onClick={() => void selectSpecies(entry)}
                      disabled={isLoadingPokemon || isSaving}
                      key={entry.apiName}
                    >
                      <span>#{String(entry.speciesId).padStart(4, "0")}</span>
                      <strong>{entry.displayName}</strong>
                      <small>→</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pokemon-details-column">
            {!species || !form ? (
              <div className="pokemon-selection-empty">
                {isLoadingPokemon ? (
                  <>
                    <span className="loading-ring large-loading-ring" />
                    <h3>Meeting this Pokémon...</h3>
                    <p>Loading its forms, types, and official artwork.</p>
                  </>
                ) : (
                  <>
                    <div className="brand-mark large">
                      <span />
                    </div>
                    <h3>Choose a species from the list.</h3>
                    <p>
                      Once selected, you can decide which form this individual
                      has and write who they are.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="selected-pokemon-preview" style={getTypeStyle(form.types)}>
                  <div className="selected-pokemon-art">
                    <div className="selected-art-glow" />
                    {previewArtwork ? (
                      <img src={previewArtwork} alt={form.displayName} />
                    ) : (
                      <span className="missing-art">?</span>
                    )}
                  </div>
                  <div className="selected-pokemon-copy">
                    <span>
                      #{String(species.speciesId).padStart(4, "0")} · {species.genus}
                    </span>
                    <h3>{nickname.trim() || form.displayName}</h3>
                    {nickname.trim() && <strong>{form.displayName}</strong>}
                    <div className="pokemon-type-row selected-types">
                      {form.types.map((type) => (
                        <span key={type}>{formatType(type)}</span>
                      ))}
                      {isShiny && <span className="shiny-tag">Shiny</span>}
                    </div>
                    <p>{species.flavorText}</p>
                  </div>
                </div>

                <div className="pokemon-personal-form">
                  {species.varieties.length > 1 && (
                    <label className="form-field form-field-full">
                      <span>Form or variety</span>
                      <select
                        value={form.apiName}
                        onChange={(event) => void selectForm(event.target.value)}
                        disabled={isLoadingPokemon || isSaving}
                      >
                        {species.varieties.map((variety) => (
                          <option value={variety.apiName} key={variety.apiName}>
                            {variety.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className="form-grid pokemon-form-grid">
                    <label className="form-field">
                      <span>Nickname (optional)</span>
                      <input
                        type="text"
                        value={nickname}
                        onChange={(event) => setNickname(event.target.value)}
                        placeholder={species.displayName}
                        maxLength={40}
                      />
                    </label>

                    <label className="form-field">
                      <span>Gender</span>
                      <select
                        value={gender}
                        onChange={(event) =>
                          setGender(event.target.value as PokemonGender)
                        }
                      >
                        {getGenderOptions(species.genderRate).map((option) => (
                          <option value={option.value} key={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="form-field">
                      <span>Nature (optional)</span>
                      <select
                        value={nature}
                        onChange={(event) => setNature(event.target.value)}
                      >
                        {pokemonNatures.map((entry) => (
                          <option value={entry} key={entry || "none"}>
                            {entry || "Not chosen"}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="form-field">
                      <span>Date met (optional)</span>
                      <input
                        type="date"
                        value={metDate}
                        onChange={(event) => setMetDate(event.target.value)}
                      />
                    </label>

                    <label className="form-field form-field-full">
                      <span>Where did you meet?</span>
                      <input
                        type="text"
                        value={metLocation}
                        onChange={(event) => setMetLocation(event.target.value)}
                        placeholder="Eterna Forest, your hometown, an egg..."
                        maxLength={80}
                      />
                    </label>

                    <label className="form-field form-field-full">
                      <span>How did you meet?</span>
                      <textarea
                        value={meetingStory}
                        onChange={(event) => setMeetingStory(event.target.value)}
                        placeholder="Write the beginning of your shared story..."
                        rows={3}
                        maxLength={420}
                      />
                      <small>{meetingStory.length}/420 characters</small>
                    </label>

                    <label className="form-field form-field-full">
                      <span>Personality notes</span>
                      <textarea
                        value={personalityNotes}
                        onChange={(event) =>
                          setPersonalityNotes(event.target.value)
                        }
                        placeholder="Protective, easily distracted, loves rain..."
                        rows={2}
                        maxLength={240}
                      />
                      <small>{personalityNotes.length}/240 characters</small>
                    </label>
                  </div>

                  <PokemonLoadoutFields
                    idPrefix={`add-${form.apiName}`}
                    level={level}
                    onLevelChange={setLevel}
                    abilities={form.abilities}
                    abilityApiName={abilityApiName}
                    onAbilityChange={setAbilityApiName}
                    heldItem={heldItem}
                    onHeldItemChange={setHeldItem}
                    itemOptions={itemOptions}
                    moves={moves}
                    onMoveChange={handleMoveChange}
                    moveOptions={form.moves}
                    isLoading={isLoadingItems}
                  />

                  <div className="pokemon-toggle-grid">
                    <label className="pokemon-toggle-card">
                      <input
                        type="checkbox"
                        checked={isShiny}
                        onChange={(event) => setIsShiny(event.target.checked)}
                      />
                      <span className="toggle-visual" />
                      <span>
                        <strong>Shiny Pokémon</strong>
                        <small>Use the official shiny artwork when available</small>
                      </span>
                    </label>

                    <label
                      className={
                        partyCount >= 6
                          ? "pokemon-toggle-card disabled"
                          : "pokemon-toggle-card"
                      }
                    >
                      <input
                        type="checkbox"
                        checked={addToParty}
                        onChange={(event) => setAddToParty(event.target.checked)}
                        disabled={partyCount >= 6}
                      />
                      <span className="toggle-visual" />
                      <span>
                        <strong>Add to travelling party</strong>
                        <small>
                          {partyCount >= 6
                            ? "Your party is already full"
                            : `${6 - partyCount} party slot${6 - partyCount === 1 ? "" : "s"} available`}
                        </small>
                      </span>
                    </label>
                  </div>

                  {!addToParty && (
                    <section className="add-pokemon-place-choice">
                      <div>
                        <span className="section-kicker">First home</span>
                        <h3>Where will this partner stay?</h3>
                        <p>
                          You can move them later from the Places page or their
                          individual profile.
                        </p>
                      </div>
                      <label className="form-field">
                        <span>Assigned place</span>
                        <select
                          value={locationId}
                          onChange={(event) => setLocationId(event.target.value)}
                        >
                          <option value="">Awaiting a home / unassigned reserve</option>
                          {places.map((place) => (
                            <option value={place.id} key={place.id}>
                              {place.name}
                              {getPlaceAddress(place)
                                ? ` — ${getPlaceAddress(place)}`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    </section>
                  )}
                </div>
              </>
            )}
          </div>

          {errorMessage && (
            <p className="form-error add-pokemon-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="add-pokemon-footer">
            <div className="local-save-note">
              <span>✓</span>
              PokéAPI data is cached in your local IndexedDB
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={onClose}
                disabled={isSaving || isLoadingPokemon}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={!species || !form || isSaving || isLoadingPokemon}
              >
                {isSaving ? "Saving partner..." : "Add to my journey"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function NotFoundPage() {
  return (
    <PlaceholderPage
      eyebrow="Lost on the route"
      title="Page not found"
      description="This path does not exist in your journey yet."
      action="Return home"
    />
  );
}

function AppShell() {
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [isPokemonCreatorOpen, setIsPokemonCreatorOpen] = useState(false);
  const [pokemonBeingEdited, setPokemonBeingEdited] =
    useState<OwnedPokemon | null>(null);
  const [pokemonBeingReleased, setPokemonBeingReleased] =
    useState<OwnedPokemon | null>(null);
  const [pokemonBeingEvolved, setPokemonBeingEvolved] =
    useState<OwnedPokemon | null>(null);
  const [evolutionMemoryBeingEdited, setEvolutionMemoryBeingEdited] =
    useState<EvolutionMemory | null>(null);
  const [isJournalEntryCreatorOpen, setIsJournalEntryCreatorOpen] = useState(false);
  const [journalEntryBeingEdited, setJournalEntryBeingEdited] =
    useState<JournalEntry | null>(null);
  const [releaseMemoryBeingEdited, setReleaseMemoryBeingEdited] =
    useState<ReleaseMemory | null>(null);
  const [placeEditorState, setPlaceEditorState] =
    useState<{ place?: PokemonPlace } | null>(null);
  const [pokemonBeingRelocated, setPokemonBeingRelocated] =
    useState<{
      pokemon: OwnedPokemon;
      initialLocationId?: string | null;
    } | null>(null);
  const [placePokemonPickerTarget, setPlacePokemonPickerTarget] =
    useState<{ locationId: string | null } | null>(null);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    void ensureTrainerProfile();
    void hydrateStoredLoadoutVisuals().catch((error) => {
      console.warn("Could not enrich existing item icons and move types:", error);
    });
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => setToastMessage(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const trainer =
    useLiveQuery(
      () => db.trainerProfiles.get(PRIMARY_TRAINER_ID),
      [],
    ) ?? DEFAULT_TRAINER;

  const ownedPokemon: OwnedPokemon[] =
    useLiveQuery(
      () => db.ownedPokemon.orderBy("createdAt").reverse().toArray(),
      [],
    ) ?? [];

  const releaseMemories: ReleaseMemory[] =
    useLiveQuery(
      () => db.releaseMemories.orderBy("createdAt").reverse().toArray(),
      [],
    ) ?? [];

  const evolutionMemories: EvolutionMemory[] =
    useLiveQuery(
      () => db.evolutionMemories.orderBy("createdAt").reverse().toArray(),
      [],
    ) ?? [];

  const journalMemories: JournalEntry[] =
    useLiveQuery(
      () => db.journalEntries.orderBy("eventDate").reverse().toArray(),
      [],
    ) ?? [];

  const places: PokemonPlace[] =
    useLiveQuery(
      () => db.pokemonPlaces.orderBy("name").toArray(),
      [],
    ) ?? [];

  const party = useMemo(
    () =>
      ownedPokemon
        .filter((pokemon) => pokemon.status === "party")
        .sort((a, b) => (a.partySlot ?? 99) - (b.partySlot ?? 99)),
    [ownedPokemon],
  );
  const reserves = useMemo(
    () => ownedPokemon.filter((pokemon) => pokemon.status === "reserve"),
    [ownedPokemon],
  );

  const handleMoveToParty = async (id: string) => {
    try {
      const pokemon = await movePokemonToParty(id);

      if (pokemon) {
        setToastMessage(`${getCompanionName(pokemon)} joined your party.`);
      }
    } catch (error) {
      if (error instanceof PartyFullError) {
        setToastMessage(error.message);
      } else {
        console.error("Could not move Pokémon to party:", error);
        setToastMessage("That Pokémon could not be moved.");
      }
    }
  };

  const handleDeletePlace = async (place: PokemonPlace) => {
    const residents = ownedPokemon.filter(
      (pokemon) =>
        pokemon.locationId === place.id ||
        pokemon.lastLocationId === place.id,
    ).length;
    const detail =
      residents > 0
        ? ` ${residents} Pokémon ${
            residents === 1 ? "is" : "are"
          } connected to this place and will become unassigned.`
        : "";
    const confirmed = window.confirm(
      `Delete ${place.name}?${detail} No Pokémon will be deleted.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const result = await deletePokemonPlace(place.id);
      setToastMessage(
        result.affectedPokemon > 0
          ? `${place.name} was deleted. ${result.affectedPokemon} Pokémon ${
              result.affectedPokemon === 1 ? "is" : "are"
            } now awaiting a home.`
          : `${place.name} was deleted.`,
      );
    } catch (error) {
      console.error("Could not delete place:", error);
      setToastMessage("That place could not be deleted.");
    }
  };

  const handleMovePokemonToSelectedPlace = async (
    pokemon: OwnedPokemon,
    locationId: string | null,
  ) => {
    try {
      const updated = await movePokemonToLocation(pokemon.id, locationId);
      const destination = locationId
        ? places.find((place) => place.id === locationId)?.name ??
          "the selected place"
        : "Awaiting a home";
      setPlacePokemonPickerTarget(null);
      setToastMessage(
        `${getCompanionName(updated)} moved to ${destination}.`,
      );
    } catch (error) {
      console.error("Could not move Pokémon to selected place:", error);
      setToastMessage(
        error instanceof Error
          ? error.message
          : "That Pokémon could not be moved.",
      );
    }
  };

  const handleDeleteJournalMemory = async (memory: JournalEntry) => {
    const confirmed = window.confirm(
      `Delete “${memory.title}” from the journal? This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await deleteJournalEntry(memory.id);
      setToastMessage(`“${memory.title}” was deleted from the journal.`);
    } catch (error) {
      console.error("Could not delete journal entry:", error);
      setToastMessage("That journal entry could not be deleted.");
    }
  };

  const handleDeleteMemory = async (memory: ReleaseMemory) => {
    const name = getReleaseMemoryName(memory);
    const confirmed = window.confirm(
      `Delete the release memory for ${name}? This cannot be undone and will not restore the Pokémon.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteReleaseMemory(memory.id);
      setToastMessage(`${name}'s release memory was deleted.`);
    } catch (error) {
      console.error("Could not delete release memory:", error);
      setToastMessage("That memory could not be deleted.");
    }
  };

  const handleUndoEvolution = async (memory: EvolutionMemory) => {
    const name = getEvolutionMemoryName(memory);
    const confirmed = window.confirm(
      `Undo ${name}'s evolution from ${memory.from.displayName} to ${memory.to.displayName}? The Pokémon will return to the previous stage and this evolution memory will be removed.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const result = await undoLatestEvolution(memory.pokemonId, memory.id);
      setPokemonBeingEdited(result.pokemon);
      setEvolutionMemoryBeingEdited(null);
      setToastMessage(
        `${name} returned to ${result.pokemon.displayName}. The latest evolution memory was removed.`,
      );
    } catch (error) {
      console.error("Could not undo evolution:", error);
      setToastMessage(
        error instanceof Error
          ? error.message
          : "That evolution could not be undone.",
      );
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        trainer={trainer}
        onEditProfile={() => setIsProfileEditorOpen(true)}
      />
      <MobileHeader
        trainer={trainer}
        onEditProfile={() => setIsProfileEditorOpen(true)}
      />

      <main className="main-content">
        <Routes>
          <Route
            path="/"
            element={
              <DashboardPage
                trainer={trainer}
                ownedPokemon={ownedPokemon}
                party={party}
                releaseMemories={releaseMemories}
                evolutionMemories={evolutionMemories}
                journalMemories={journalMemories}
                places={places}
                onEditProfile={() => setIsProfileEditorOpen(true)}
                onAddPokemon={() => setIsPokemonCreatorOpen(true)}
                onEditPokemon={setPokemonBeingEdited}
              />
            }
          />
          <Route
            path="/pokemon"
            element={
              <PokemonPage
                ownedPokemon={ownedPokemon}
                places={places}
                onAddPokemon={() => setIsPokemonCreatorOpen(true)}
                onEditPokemon={setPokemonBeingEdited}
              />
            }
          />
          <Route
            path="/party"
            element={
              <PartyPage
                party={party}
                reserves={reserves}
                onAddPokemon={() => setIsPokemonCreatorOpen(true)}
                onMoveToParty={(id) => void handleMoveToParty(id)}
                onRelocatePokemon={(pokemon) =>
                  setPokemonBeingRelocated({ pokemon })
                }
                onEditPokemon={setPokemonBeingEdited}
              />
            }
          />
          <Route
            path="/places"
            element={
              <PlacesPage
                places={places}
                reserves={reserves}
                partyCount={party.length}
                onCreatePlace={() => setPlaceEditorState({})}
                onEditPlace={(place) => setPlaceEditorState({ place })}
                onDeletePlace={(place) => void handleDeletePlace(place)}
                onEditPokemon={setPokemonBeingEdited}
                onRelocatePokemon={(pokemon) =>
                  setPokemonBeingRelocated({ pokemon })
                }
                onChoosePokemonForPlace={(locationId) =>
                  setPlacePokemonPickerTarget({ locationId })
                }
              />
            }
          />
          <Route
            path="/habitat"
            element={
              <HabitatPage
                ownedPokemon={ownedPokemon}
                places={places}
                onEditPokemon={setPokemonBeingEdited}
              />
            }
          />
          <Route
            path="/journal"
            element={
              <JournalPage
                releaseMemories={releaseMemories}
                evolutionMemories={evolutionMemories}
                journalMemories={journalMemories}
                ownedPokemon={ownedPokemon}
                onCreateMemory={() => setIsJournalEntryCreatorOpen(true)}
                onEditMemory={(memory) => setJournalEntryBeingEdited(memory)}
                onDeleteJournalMemory={(memory) => void handleDeleteJournalMemory(memory)}
                onDeleteReleaseMemory={(memory) => void handleDeleteMemory(memory)}
                onEditRelease={(memory) => setReleaseMemoryBeingEdited(memory)}
                onEditEvolution={(memory) => setEvolutionMemoryBeingEdited(memory)}
                onUndoEvolution={(memory) => void handleUndoEvolution(memory)}
              />
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map((item) => (
          <NavLink
            end={item.to === "/"}
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? "mobile-nav-link active" : "mobile-nav-link"
            }
          >
            <span>{item.icon}</span>
            <small>{item.label}</small>
          </NavLink>
        ))}
      </nav>

      {isProfileEditorOpen && (
        <TrainerProfileModal
          trainer={trainer}
          onClose={() => setIsProfileEditorOpen(false)}
        />
      )}

      {isPokemonCreatorOpen && (
        <AddPokemonModal
          partyCount={party.length}
          places={places}
          onClose={() => setIsPokemonCreatorOpen(false)}
          onSaved={(pokemon) => {
            setIsPokemonCreatorOpen(false);
            setToastMessage(
              `${getCompanionName(pokemon)} was added to your journey.`,
            );
          }}
        />
      )}

      {pokemonBeingEdited && (
        <EditPokemonModal
          pokemon={pokemonBeingEdited}
          partyCount={party.length}
          places={places}
          evolutionHistory={evolutionMemories.filter(
            (memory) => memory.pokemonId === pokemonBeingEdited.id,
          )}
          onClose={() => setPokemonBeingEdited(null)}
          onSaved={(pokemon) => {
            setPokemonBeingEdited(null);
            setToastMessage(`${getCompanionName(pokemon)} was updated.`);
          }}
          onRequestEvolution={(pokemon) => {
            setPokemonBeingEdited(null);
            setPokemonBeingEvolved(pokemon);
          }}
          onEditEvolution={(memory) => {
            setPokemonBeingEdited(null);
            setEvolutionMemoryBeingEdited(memory);
          }}
          onUndoEvolution={(memory) => void handleUndoEvolution(memory)}
          onRequestRelease={(pokemon) => {
            setPokemonBeingEdited(null);
            setPokemonBeingReleased(pokemon);
          }}
        />
      )}

      {placeEditorState && (
        <PokemonPlaceModal
          place={placeEditorState.place}
          onClose={() => setPlaceEditorState(null)}
          onSaved={(place) => {
            setPlaceEditorState(null);
            setToastMessage(
              `${place.name} was ${placeEditorState.place ? "updated" : "created"}.`,
            );
          }}
        />
      )}

      {pokemonBeingRelocated && (
        <RelocatePokemonModal
          pokemon={pokemonBeingRelocated.pokemon}
          places={places}
          partyCount={party.length}
          initialLocationId={pokemonBeingRelocated.initialLocationId}
          onClose={() => setPokemonBeingRelocated(null)}
          onMoved={(pokemon, destinationLabel) => {
            setPokemonBeingRelocated(null);
            setToastMessage(
              `${getCompanionName(pokemon)} moved to ${destinationLabel}.`,
            );
          }}
        />
      )}

      {placePokemonPickerTarget && (
        <ChoosePokemonForPlaceModal
          targetLocationId={placePokemonPickerTarget.locationId}
          places={places}
          ownedPokemon={ownedPokemon}
          onClose={() => setPlacePokemonPickerTarget(null)}
          onMove={(pokemon) =>
            handleMovePokemonToSelectedPlace(
              pokemon,
              placePokemonPickerTarget.locationId,
            )
          }
        />
      )}

      {isJournalEntryCreatorOpen && (
        <JournalEntryModal
          ownedPokemon={ownedPokemon}
          onClose={() => setIsJournalEntryCreatorOpen(false)}
          onSaved={(memory) => {
            setIsJournalEntryCreatorOpen(false);
            setToastMessage(`“${memory.title}” was added to your journal.`);
          }}
        />
      )}

      {journalEntryBeingEdited && (
        <JournalEntryModal
          entry={journalEntryBeingEdited}
          ownedPokemon={ownedPokemon}
          onClose={() => setJournalEntryBeingEdited(null)}
          onSaved={(memory) => {
            setJournalEntryBeingEdited(null);
            setToastMessage(`“${memory.title}” was updated.`);
          }}
        />
      )}

      {releaseMemoryBeingEdited && (
        <EditReleaseMemoryModal
          memory={releaseMemoryBeingEdited}
          onClose={() => setReleaseMemoryBeingEdited(null)}
          onSaved={(memory) => {
            setReleaseMemoryBeingEdited(null);
            setToastMessage(`${getReleaseMemoryName(memory)}'s farewell memory was updated.`);
          }}
        />
      )}

      {pokemonBeingEvolved && (
        <EvolvePokemonModal
          pokemon={pokemonBeingEvolved}
          onClose={() => setPokemonBeingEvolved(null)}
          onEvolved={(pokemon, memory) => {
            setPokemonBeingEvolved(null);
            setPokemonBeingEdited(pokemon);
            setToastMessage(
              `${getEvolutionMemoryName(memory)} evolved into ${memory.to.displayName}.`,
            );
          }}
        />
      )}

      {evolutionMemoryBeingEdited && (
        <EditEvolutionMemoryModal
          memory={evolutionMemoryBeingEdited}
          onClose={() => setEvolutionMemoryBeingEdited(null)}
          onSaved={(memory) => {
            setEvolutionMemoryBeingEdited(null);
            setToastMessage(
              `${getEvolutionMemoryName(memory)}'s evolution memory was updated.`,
            );
          }}
        />
      )}

      {pokemonBeingReleased && (
        <ReleasePokemonModal
          pokemon={pokemonBeingReleased}
          onClose={() => setPokemonBeingReleased(null)}
          onReleased={(memory) => {
            setPokemonBeingReleased(null);
            setToastMessage(
              `${getReleaseMemoryName(memory)} was released. The farewell was saved in your journal.`,
            );
          }}
        />
      )}

      {toastMessage && (
        <div className="app-toast" role="status">
          <span>✓</span>
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}
