# Phased Plan — PokePVP

This plan is based on [architecture.md](architecture.md) and [business-rules.md](business-rules.md). The final backend will be hexagonal, with Express, MongoDB, and Socket.IO. Incremental stages are planned; the **first** is a simple Express structure with no architecture, only to consume the external Pokémon API.

**Current progress:** Stage 1 and Stage 2 complete. Next: Stage 3 (MongoDB and persistence).

---

## Stage 1 — Minimal Express + PokeAPI proxy (first deliverable) ✅ DONE

**Goal:** Minimal Express app running on port 8080, listening on `0.0.0.0`, exposing routes that query the external Pokémon API. No layers, no ports/adapters, no database or Socket.IO.

**External API (per business-rules):**

- Base URL: `https://pokemon-api-92034153384.us-central1.run.app/`
- `GET /list` — returns a list with at least `id` and `name`
- `GET /list/:id` — returns detail (id, name, type, hp, attack, defense, speed, sprite)

**Proposed structure (simple):**

```
pokepvp/
  package.json
  .env.example
  src/
    index.js          # bootstrap: Express, routes, listen(8080, '0.0.0.0')
    routes/
      catalog.js      # GET /catalog/list and GET /catalog/list/:id → proxy to external API
    services/         # optional and minimal: one function that fetches/calls the API
      pokeapi.js
```

**Stage 1 deliverables:**

- [x] `package.json` with Express and an HTTP client (native fetch in Node 18+). Scripts: `start`, `dev` (nodemon).
- [x] Environment variables: `PORT=8080`, `POKEAPI_BASE_URL=https://pokemon-api-92034153384.us-central1.run.app` (no hardcoded values per architecture).
- [x] **GET /catalog/list** route: proxy to `GET {POKEAPI_BASE_URL}/list`, return JSON to the client.
- [x] **GET /catalog/list/:id** route: proxy to `GET {POKEAPI_BASE_URL}/list/:id`, return JSON.
- [x] **GET /health**: `200` to verify the server is up.
- [x] Basic error handling: if the external API fails or returns 4xx/5xx, respond with an appropriate status and message (502, 503).

**Success criteria:** `npm run dev` starts the server on 8080; `GET http://localhost:8080/catalog/list` and `GET http://localhost:8080/catalog/list/1` return the same data as the external API (or a controlled error if the API is unavailable).

---

## Stage 2 — Introduce hexagonal structure (domain + catalog port) ✅ DONE

> **Detailed specification:** See [stage-2-spec.md](stage-2-spec.md) for folder structure, components, data flow, and implementation checklist.

- [x] Create folders: `domain/ports`, `domain/entities`, `application/use-cases`, `infrastructure/http` (controllers), `infrastructure/clients` (PokeAPI client), `infrastructure/mappers`, `infrastructure/persistence`. Ports live in **domain** (domain defines the contracts; infrastructure implements them).
- [x] Define the **catalog output port** (`domain/ports/catalog.port.js`): interface with `getList()` and `getById(id)`.
- [x] Implement the **output adapter** (`infrastructure/clients/pokeapi.adapter.js`) behind that port; custom errors in `infrastructure/errors/`.
- [x] **Naming (Option B):** API and port use **catalog** (routes `/catalog/list`, `CatalogPort`, `CatalogController`); use cases use **Pokémon** (`GetPokemonListUseCase`, `GetPokemonByIdUseCase`). Controllers call these use cases; use cases use the catalog port.
- [x] The Express app exposes the same routes (`/catalog/list`, `/catalog/list/:id`, `/health`); code reorganized into hexagonal layers. Verified with Bruno.

---

## Stage 3 — MongoDB and persistence

- Define **persistence ports** (repositories) for: Player, Lobby, Team selection, Battle, Pokémon state (per [architecture.md](architecture.md) and [business-rules.md](business-rules.md)).
- Implement **MongoDB adapters** for those repositories (schemas, basic indexes).
- Configuration via environment variables (e.g. `MONGODB_URI`).
- Lobby/battle use cases (Stage 4) will depend on these ports; in this stage you can expose minimal REST routes or tests that verify read/write.

---

## Stage 4 — Lobby and team flow (REST or basic Socket.IO)

- **Use cases:** Join lobby (nickname), Assign team (3 random Pokémon, no duplicates between players), Mark ready.
- Lobby state transitions: `waiting` → `ready` when both players confirm.
- Can start with REST (POST/GET) for join, assign, ready and then replace or complement with Socket.IO in Stage 5.
- Business rules: same catalog as in business-rules; random teams; no duplicate Pokémon between the two players.

---

## Stage 5 — Socket.IO and real-time events

- Integrate Socket.IO on the server (same port 8080 or path `/socket.io`).
- **Real-time output port**: interface to notify (e.g. `notifyLobbyStatus`, `notifyBattleStart`, etc.).
- **Socket.IO adapter** that implements that port (rooms per lobby, emit to clients).
- Map client → server events: `join_lobby`, `assign_pokemon`, `ready`, `attack`.
- Emit server → client events: `lobby_status`, `battle_start`, `turn_result`, `battle_end` per business-rules.

---

## Stage 6 — Battle: turns, damage, and game end

- **Use cases:** Start battle (when lobby is `ready`), Process attack (atomic), Resolve defeat, End battle.
- Damage formula: `Damage = Attacker Attack - Defender Defense`; minimum 1; HP never below 0.
- Turn order: higher Speed first; tie with a deterministic rule.
- Domain events (e.g. `BattleStarted`, `TurnResolved`, `PokemonDefeated`, `BattleEnded`) and Socket.IO adapter subscription to emit to clients.
- Persist battle state and each Pokémon state (current HP, defeated).

---

## Dependency diagram (final vision)

```mermaid
flowchart LR
  subgraph stage1 [Stage 1]
    Express[Express]
    PokeAPI[PokeAPI HTTP]
    Express --> PokeAPI
  end

  subgraph stage2 [Stage 2]
    Routes[Routes]
    UseCase[Catalog Use Case]
    Port[Catalog Port]
    Adapter[HTTP Adapter]
    Routes --> UseCase
    UseCase --> Port
    Port --> Adapter
    Adapter --> PokeAPI
  end

  subgraph stage3 [Stage 3]
    RepoPort[Repo Ports]
    Mongo[MongoDB Adapters]
    RepoPort --> Mongo
  end

  subgraph stages46 [Stages 4-6]
    LobbyUC[Lobby Use Cases]
    BattleUC[Battle Use Cases]
    SocketAdapter[Socket.IO Adapter]
    LobbyUC --> RepoPort
    BattleUC --> RepoPort
    BattleUC --> Port
    LobbyUC --> RealtimePort[Realtime Port]
    BattleUC --> RealtimePort
    RealtimePort --> SocketAdapter
  end
```

---

## Summary

| Stage | Content | Status |
| ----- | ------- | ------ |
| **1** | Minimal Express, routes `/catalog/list`, `/catalog/list/:id`, `/health`, proxy to PokeAPI, config via env. | ✅ Done |
| **2** | Hexagonal structure: domain, catalog port, HTTP adapter, Pokémon use cases (Option B naming). | ✅ Done |
| **3** | Repository ports and MongoDB implementations. | Pending |
| **4** | Lobby and team assignment (use cases + REST or Socket.IO). | Pending |
| **5** | Socket.IO, real-time port, lobby/battle events. | Pending |
| **6** | Full battle: turns, damage, defeat, game end and events. | Pending |

**Stage 1** is deliberately flat (no domain/ports/adapters folders) to quickly validate Express and integration with the PokeAPI; from Stage 2 onward the architecture described in [architecture.md](architecture.md) is introduced.
