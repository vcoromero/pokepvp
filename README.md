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

The stack includes **Express**, **MongoDB**, and **Socket.IO**. For a full picture of layers, ports, and adapters, see the architecture doc below.

**Current implementation:** Stages 1 and 2 of the [phased plan](docs/phased-plan.md) are complete: minimal Express + PokeAPI proxy and hexagonal structure (domain ports, Pokémon use cases, CatalogController, PokeAPI adapter). Endpoints `GET /health`, `GET /catalog/list`, and `GET /catalog/list/:id` are available and tested. **Security:** Helmet (HTTP headers), CORS (configurable via `CORS_ORIGIN`). **Testing:** Jest + supertest (integration and unit tests). Bootstrap split into `index.js` (entry) and `app.js` (`createApp()` for testability).

## 🛠️ Scripts

- `npm run dev` — Start server with nodemon (hot reload)
- `npm test` — Run tests (Jest)
- `npm run test:watch` — Run tests in watch mode
- `npm run test:coverage` — Run tests with coverage report

## 📚 Documentation

- **[docs/business-rules.md](docs/business-rules.md)** — Canonical business rules: catalog, team selection, lobby states, battle flow, damage formula, events, and persistence. Used by both backend and frontend.
- **[docs/architecture.md](docs/architecture.md)** — Backend architecture: hexagonal layout, event-driven communication, SOLID/Clean Code, and a layers diagram.
- **[docs/phased-plan.md](docs/phased-plan.md)** — Phased implementation plan: Stage 1 (minimal Express + PokeAPI proxy) through Stage 6 (full battle and events).

## 🚀 Future improvements

Planned or possible enhancements:

- **Pokémon type effectiveness** — Use the attacker’s and defender’s **types** to adjust damage (e.g. Fire vs Grass = super effective, Water vs Fire = super effective, Electric vs Ground = no effect). This would extend the current flat formula (`Damage = Attack - Defense`) with a type chart so attacks can be super effective, not very effective, or have no effect on the defending Pokémon, following classic Pokémon type rules.

---

*This repository contains the backend only. The frontend (e.g. Flutter or React) is expected to connect to this API and real-time endpoint.*
