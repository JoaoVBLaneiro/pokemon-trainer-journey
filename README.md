# 🌿 Trainer Journey

<p align="center">
  <b>Your Pokémon are more than six slots in a team.</b><br>
  Give every partner a home, a history, a personality, and a journey worth remembering.
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-20232a?logo=react&logoColor=61DAFB">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white">
  <img alt="PokéAPI" src="https://img.shields.io/badge/Data-PokéAPI-EF5350">
  <img alt="IndexedDB" src="https://img.shields.io/badge/Storage-IndexedDB-3c6e56">
</p>

---

## ✨ What is Trainer Journey?

**Trainer Journey** is a personal Pokémon trainer-life simulator and journal.

It isn't a competitive teambuilder, battle simulator, Living Dex tracker, or traditional Pokémon game.

The idea is much simpler:

> **What if the Pokémon you imagine owning actually felt like individual companions?**

Instead of simply saving *“a Blastoise”*, Trainer Journey lets you create **your Blastoise** — with its own nickname, story, personality, home, evolution history, moves, held item, memories, and place in your journey.

---

## 🎒 Your Pokémon. Your story.

Every Pokémon is treated as an **individual character**, not just a species entry.

You can record things such as:

* Nickname
* Gender
* Nature
* Shiny status
* Level
* Ability
* Held item
* Current moves
* Where and when you met
* How you met
* Personality
* Personal notes
* Current home
* Evolution history
* Important memories
* Release history

Two Pokémon of the same species can therefore have completely different lives.

---

## ⭐ Current features

### 🧑 Trainer Profile

Create your own Trainer identity with:

* Name
* Region
* Current location
* Trainer role
* Favorite type
* Personal motto
* Journey statistics

---

### 🔴 Travelling Party

Maintain a real six-Pokémon travelling party.

The party represents the Pokémon that are **physically travelling with your Trainer**, rather than simply being a battle configuration.

Pokémon can freely move between your party and their homes.

---

### 🏡 Places

Instead of sending every Pokémon into an anonymous PC box, you can create real places for them to live.

Examples include:

* Family home
* Professor's laboratory
* Ranch
* Day Care
* Pokémon Center
* Gym
* Training camp
* Natural habitat
* Traditional PC storage
* Custom locations

Each place can have its own:

* Region
* Town or route
* Caretaker
* Description
* Private notes
* Resident Pokémon

Deleting a location never deletes its Pokémon.

---

### 🧬 Evolution History

Evolution is treated as an **event in your Pokémon's life**.

When a Pokémon evolves, you can record:

* Previous species
* New species
* Date
* Location
* Evolution method
* What happened
* Personal notes

Branching evolutions are supported.

Changed your mind?

You can **undo the latest evolution** and restore the Pokémon's previous form.

---

### ⚔️ Moves & Abilities

Pokémon can have:

* A current level
* An ability
* Up to four moves
* A held item

Moves use colors based on their Pokémon type, making each Pokémon's current loadout easy to recognize.

Official abilities and moves are retrieved from PokéAPI.

---

### 🍎 Held Items

Held items retrieved from PokéAPI display their official item sprites.

Custom story items are also supported for journeys that go beyond game mechanics.

---

### 📖 Journey Journal

Important events can become memories in your Trainer's journal.

Evolution events and other major moments remain connected to the Pokémon involved, gradually creating a history of your journey.

---

### 🕊️ Releasing Pokémon

Sometimes a Pokémon's story ends with saying goodbye.

Trainer Journey lets you release a Pokémon while recording:

* Date
* Location
* Why it was released
* Farewell notes
* What happened afterward

The Pokémon leaves your active collection, but its story remains preserved as a journal memory.

Release memories can also be deleted independently.

---

## 🌎 Powered by PokéAPI

Canonical Pokémon information comes from **[PokéAPI](https://pokeapi.co/)**, including:

* Species
* Forms and varieties
* Types
* Artwork
* Evolution chains
* Abilities
* Moves
* Items
* Item sprites

Frequently used API data is cached locally to reduce unnecessary requests and improve loading times.

---

## 💾 Local-first

Trainer Journey currently stores your journey directly in the browser using **IndexedDB**, managed through Dexie.

This includes:

```text
Trainer
├── Pokémon
│   ├── Identity
│   ├── Personality
│   ├── Moves
│   ├── Ability
│   ├── Held item
│   └── Evolution history
│
├── Party
├── Places
├── Memories
└── PokéAPI cache
```

Your data remains available after refreshing or closing the browser.

### ⚠️ Important

Trainer Journey currently has **no account or cloud synchronization system**.

That means:

```text
Desktop browser ≠ Phone browser
```

Each browser/device currently maintains its own local journey.

Export/import backups and eventual synchronization are planned features.

---

## 🚀 Running locally

### Requirements

* Node.js
* npm

Clone the repository:

```bash
git clone https://github.com/JoaoVBLaneiro/pokemon-trainer-journey.git
```

Enter the project:

```bash
cd pokemon-trainer-journey
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open the address shown by Vite.

Usually:

```text
http://localhost:5173/
```

---

## 📦 Production build

Create a production build with:

```bash
npm run build
```

Preview it locally with:

```bash
npm run preview
```

---

## 🌐 GitHub Pages

Trainer Journey is designed to be deployable as a static web app through GitHub Pages.

The hosted version can be accessed without running a local server:

**https://JoaoVBLaneiro.github.io/pokemon-trainer-journey/**

GitHub Actions automatically builds and deploys the project from the `main` branch.

---

## 🛠️ Tech stack

| Technology     | Purpose                           |
| -------------- | --------------------------------- |
| React          | User interface                    |
| TypeScript     | Application logic and type safety |
| Vite           | Development and production builds |
| React Router   | Client-side navigation            |
| Dexie          | IndexedDB database layer          |
| IndexedDB      | Local journey storage             |
| PokéAPI        | Canonical Pokémon data            |
| GitHub Actions | Automatic deployment              |
| GitHub Pages   | Static hosting                    |

---

## 🗺️ Roadmap

Some ideas planned for future versions:

* [ ] Export entire journey to a backup file
* [ ] Import an existing journey
* [ ] Pokémon relationship system
* [ ] Trainer relationships and recurring characters
* [ ] More detailed personality traits
* [ ] Pokémon friendship tracking
* [ ] Custom memory creation
* [ ] Journey timeline
* [ ] Regional travel history
* [ ] Badges and accomplishments
* [ ] Pokémon ribbons
* [ ] Poké Ball selection
* [ ] Pokémon status and mood
* [ ] Better individual Pokémon profile pages
* [ ] Trainer avatar customization
* [ ] Cloud synchronization
* [ ] Multiple Trainer save files
* [ ] Public/shareable Trainer profiles

---

## 💡 Philosophy

Trainer Journey deliberately avoids turning every feature into a game mechanic.

There is no requirement to grind experience, win battles, unlock species, or optimize stats.

If you imagine that you met a Bulbasaur years ago and it has been living at your family's house ever since, you can simply make that part of your story.

The goal is not to simulate Pokémon battles.

The goal is to simulate **having Pokémon**.

---

## ❤️ Why this exists

There are plenty of fantastic Pokémon tools for:

* Competitive teams
* Damage calculations
* Pokédex completion
* Collection tracking
* Battles

But very few focus on a different question:

> **“If I were actually a Pokémon Trainer, who would my Pokémon be?”**

Trainer Journey is being built around that question.

---

## ⚖️ Disclaimer

Trainer Journey is an **unofficial, non-commercial fan project**.

Pokémon and all related names, characters, artwork, and trademarks are property of Nintendo, Game Freak, Creatures Inc., and The Pokémon Company.

This project is not affiliated with, endorsed by, or sponsored by any of those companies.

Pokémon data is provided through PokéAPI.

---

<p align="center">
  <b>Every partner deserves more than a place in a box.</b> 🌿
</p>
