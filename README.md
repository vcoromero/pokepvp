<div align="center">

# 🎮 PokePVP — Backend ⚡

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat-square&logo=socket.io&logoColor=white)](https://socket.io)
[![Hexagonal](https://img.shields.io/badge/Architecture-Hexagonal-6C5CE7?style=flat-square)](.)
[![Event--driven](https://img.shields.io/badge/Design-Event--driven-00B894?style=flat-square)](.)

</div>

Backend for **PokePVP**: a lightweight PvP game where two players pick a team of 3 Pokémon from a catalog, join a lobby, and fight in real-time until one player wins.

## 🏗️ Architecture

This project is built with:

- **Hexagonal architecture (ports and adapters)** — Domain and business logic stay independent of frameworks and infrastructure. Use cases are the entry points; persistence, external APIs, and real-time messaging are pluggable adapters.
- **Event-driven design** — Battle and lobby flows emit domain events (e.g. battle started, turn resolved, Pokémon defeated). Adapters subscribe to these events and push updates to clients, keeping the core decoupled from transport details.
- **Real-time with Socket.IO** — Lobby and battles use **Socket.IO** for live updates: lobby status, battle start, turn results, and battle end. REST is used where appropriate (e.g. catalog, health).

The stack includes **Express**, **MongoDB**, and **Socket.IO**. For a full picture of layers, ports, and adapters, see [docs/architecture.md](docs/architecture.md). All six stages of the [phased plan](docs/phased-plan.md) are implemented (catalog, lobby, team selection, Socket.IO real-time, and full battle with turns, damage, and game end).

## 🛠️ Scripts

- `npm run dev` — Start server with nodemon (hot reload)
- `npm test` — Run tests (Jest)
- `npm run test:watch` — Run tests in watch mode
- `npm run test:coverage` — Run tests with coverage report

## 🐳 Running MongoDB (Docker Compose)

Persistence (Stage 3+) uses **MongoDB**. The repo provides a **Docker Compose** file that runs only MongoDB (the backend runs on your machine with `npm run dev`).

1. Copy `.env.example` to `.env` and set at least `PORT`, `POKEAPI_BASE_URL`, and `MONGODB_URI`.
2. Start MongoDB: `docker-compose up -d`
3. Start the backend: `npm run dev`

**Default:** MongoDB is exposed on host port **27017**. Use `MONGODB_URI=mongodb://localhost:27017/pokepvp` in your `.env`.

**If port 27017 is already in use** (e.g. you have another MongoDB container or service):

- In your `.env`, set a free host port, e.g. `MONGO_HOST_PORT=27018`.
- In the same `.env`, set the app to use that port: `MONGODB_URI=mongodb://localhost:27018/pokepvp`.
- Then run `docker-compose up -d`. The Compose file reads `MONGO_HOST_PORT` and maps that host port to MongoDB; the app connects via `MONGODB_URI`, so both must use the same port number.

## 📚 Documentation

- **[docs/business-rules.md](docs/business-rules.md)** — Canonical business rules: catalog, team selection, lobby states, battle flow, damage formula, events, and persistence. Used by both backend and frontend.
- **[docs/architecture.md](docs/architecture.md)** — Backend architecture: hexagonal layout, event-driven communication, SOLID/Clean Code, and a layers diagram.
- **[docs/phased-plan.md](docs/phased-plan.md)** — Phased implementation plan: Stage 1 (minimal Express + PokeAPI proxy) through Stage 6 (full battle and events).
- **[docs/socketio-test-flow.md](docs/socketio-test-flow.md)** — Manual test flow for Socket.IO (join_lobby, assign_pokemon, ready, attack) using Postman or similar.

## 🚀 Future improvements

Planned or possible enhancements:

- **Pokémon type effectiveness** — Use the attacker’s and defender’s **types** to adjust damage (e.g. Fire vs Grass = super effective, Water vs Fire = super effective, Electric vs Ground = no effect). This would extend the current flat formula (`Damage = Attack - Defense`) with a type chart so attacks can be super effective, not very effective, or have no effect on the defending Pokémon, following classic Pokémon type rules.

---

*This repository contains the backend only. The frontend (e.g. Flutter or React) is expected to connect to this API and real-time endpoint.*
