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

**Current setup:** MongoDB can be run locally via **Docker Compose** (MongoDB 7 with auth and configurable port) or by using **MongoDB Atlas**; the app connects using the single `MONGODB_URI` in `.env`.

**Live deployment:** The backend is deployed on [Render](https://pokepvp.onrender.com); the database runs on **MongoDB Atlas**. Both the app and the database are hosted in the cloud.

## 🛠️ Scripts

- `npm run dev` — Start server with nodemon (hot reload)
- `npm test` — Run tests (Jest)
- `npm run test:watch` — Run tests in watch mode
- `npm run test:coverage` — Run tests with coverage report

## 🐳 Database: MongoDB (Docker or Atlas)

Persistence uses **MongoDB**. You can run it locally with **Docker Compose** or use **MongoDB Atlas** (cloud).

### Option A: Docker Compose (local MongoDB 7)

The project includes a **docker-compose.yml** that runs **MongoDB 7** with authentication:

- **Image:** `mongo:7`
- **Credentials:** user `pokepvp`, password from `MONGO_PASSWORD` (default: `devpassword`)
- **Port:** configurable via `MONGO_HOST_PORT` (default: `27017`)
- **Data:** persisted in a named volume `mongo-data`

**Steps:**

1. Copy `.env.example` to `.env` and set at least `PORT`, `POKEAPI_BASE_URL`, and `MONGODB_URI`.
2. For local Docker, use a URI with auth, e.g.  
   `MONGODB_URI=mongodb://pokepvp:devpassword@localhost:27017/pokepvp?authSource=admin`  
   (replace the port if you set `MONGO_HOST_PORT`).
3. Start MongoDB: `docker-compose up -d`
4. Start the backend: `npm run dev`

**If port 27017 is in use:** set `MONGO_HOST_PORT=27018` (or another free port) in `.env` and use the same port in `MONGODB_URI`, e.g. `mongodb://pokepvp:devpassword@localhost:27018/pokepvp?authSource=admin`.

### Option B: MongoDB Atlas (cloud)

You can connect to **MongoDB Atlas** instead of running Docker:

1. Create a cluster and database user in [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. In `.env`, set `MONGODB_URI` to your Atlas connection string, e.g.  
   `MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<db>?retryWrites=true&w=majority`
3. Do **not** start Docker for MongoDB; run only the backend: `npm run dev`.

The app uses a single `MONGODB_URI`; switch between local Docker and Atlas by changing that variable.

## 📚 Documentation

- **[docs/business-rules.md](docs/business-rules.md)** — Canonical business rules: catalog, team selection, lobby states, battle flow, damage formula, events, and persistence. Used by both backend and frontend.
- **[docs/architecture.md](docs/architecture.md)** — Backend architecture: hexagonal layout, event-driven communication, SOLID/Clean Code, and a layers diagram.
- **[docs/phased-plan.md](docs/phased-plan.md)** — Phased implementation plan: Stage 1 (minimal Express + PokeAPI proxy) through Stage 6 (full battle and events).
- **[docs/socketio-test-flow.md](docs/socketio-test-flow.md)** — Manual test flow for Socket.IO (join_lobby, rejoin_lobby, assign_pokemon, ready, attack, surrender) using Postman or similar.

**Note:** The `rejoin_lobby` event is **not part of the MVP**; it was added as an extra to improve UX when a player reconnects (e.g. after switching tabs or losing the socket connection), so they can reattach to the same lobby and continue the battle without starting over.

Similarly, the `surrender` event was added as an extra implementation (also outside the original project rules) to avoid excessively long battles, allowing a player to surrender only while the lobby is in `battling` state and quickly finish the match so both players can start a new lobby.

## ☁️ Deploy

The backend is already deployed on **Render** and available at: `https://pokepvp.onrender.com`.

## 🚀 Future improvements

Planned or possible enhancements:

- **Pokémon type effectiveness** — Use the attacker’s and defender’s **types** to adjust damage (e.g. Fire vs Grass = super effective, Water vs Fire = super effective, Electric vs Ground = no effect). This would extend the current flat formula (`Damage = Attack - Defense`) with a type chart so attacks can be super effective, not very effective, or have no effect on the defending Pokémon, following classic Pokémon type rules.

---

*This repository contains the backend only. The frontend (e.g. Flutter or React) is expected to connect to this API and real-time endpoint.*
