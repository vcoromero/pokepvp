# Code Review — PokePVP Backend

Full code review of the PokePVP backend project evaluating hexagonal architecture compliance, SOLID principles, clean code practices, security, performance, and scalability.

**Date:** 2026-03-10
**Scope:** All source code under `src/`, configuration files, Docker setup, and tests.

---

## Table of Contents

1. [Priority Summary](#1-priority-summary)
2. [Security](#2-security)
3. [Hexagonal Architecture](#3-hexagonal-architecture)
4. [SOLID Principles](#4-solid-principles)
5. [Performance](#5-performance)
6. [Scalability](#6-scalability)
7. [Clean Code](#7-clean-code)
8. [Tests](#8-tests)
9. [Implementation Roadmap](#9-implementation-roadmap)

---

## 1. Priority Summary

| ID | Finding | Severity | Section | Status |
|----|---------|----------|---------|--------|
| ~~ARCH-5~~ | ~~CatalogController + its use cases are dead code (test-only)~~ | ~~HIGH~~ | ~~Architecture~~ | ✅ Resolved |
| ~~SEC-1~~ | ~~No player authentication/authorization~~ | ~~CRITICAL~~ | ~~Security~~ | ✅ Resolved |
| ~~SEC-2~~ | ~~No rate limiting on REST endpoints~~ | ~~MEDIUM~~ | ~~Security~~ | ✅ Resolved |
| ~~SEC-3~~ | ~~express.json() without body size limit~~ | ~~MEDIUM~~ | ~~Security~~ | ✅ Resolved |
| ~~ARCH-3~~ | ~~PokeAPIAdapter lacks mapper, cache, and timeout (Anti-Corruption Layer)~~ | ~~HIGH~~ | ~~Architecture~~ | ✅ Resolved |
| ~~PERF-1~~ | ~~N+1 sequential calls to external API~~ | ~~HIGH~~ | ~~Performance~~ | ✅ Absorbed into ARCH-3 |
| ~~PERF-2~~ | ~~No cache for external Pokémon API~~ | ~~HIGH~~ | ~~Performance~~ | ✅ Absorbed into ARCH-3 |
| ~~PERF-3~~ | ~~No timeout on external HTTP calls~~ | ~~MEDIUM~~ | ~~Performance~~ | ✅ Absorbed into ARCH-3 |
| ~~ARCH-6~~ | ~~LobbyController is redundant — all game flow is Socket.IO~~ | ~~HIGH~~ | ~~Architecture~~ | ✅ Resolved |
| ~~ARCH-1~~ | ~~Anemic domain model — business logic in use cases~~ | ~~HIGH~~ | ~~Architecture~~ | ✅ Resolved |
| ~~SOLID-1~~ | ~~SocketHandler has 7 dependencies, mixed responsibilities~~ | ~~HIGH~~ | ~~SOLID~~ | ✅ Resolved |
| ~~SEC-4~~ | ~~Nickname without max length validation~~ | ~~MEDIUM~~ | ~~Security~~ | ✅ Resolved |
| ~~SEC-5~~ | ~~MongoDB without authentication in Docker~~ | ~~MEDIUM~~ | ~~Security~~ | ✅ Resolved |
| ~~SOLID-2~~ | ~~statusFromError duplicated across multiple files~~ | ~~MEDIUM~~ | ~~SOLID~~ | ✅ Resolved by ARCH-6 |
| ~~SOLID-3~~ | ~~Dependency wiring duplicated in index.js and app.js~~ | ~~MEDIUM~~ | ~~SOLID~~ | ✅ Resolved by ARCH-6 |
| ~~ARCH-2~~ | ~~PersistenceController bypasses use cases~~ | ~~MEDIUM~~ | ~~Architecture~~ | ✅ Resolved |
| ~~PERF-4~~ | ~~No graceful shutdown~~ | ~~MEDIUM~~ | ~~Performance~~ | ✅ Resolved |
| ~~CLEAN-1~~ | ~~Inconsistent error handling in controllers~~ | ~~MEDIUM~~ | ~~Clean Code~~ | ✅ Resolved by ARCH-6 |
| ~~CLEAN-2~~ | ~~mapRepositoryError has confusing throw pattern~~ | ~~LOW~~ | ~~Clean Code~~ | ✅ Resolved |
| ~~CLEAN-3~~ | ~~Inconsistent error import paths~~ | ~~LOW~~ | ~~Clean Code~~ | ✅ Resolved |
| ~~CLEAN-4~~ | ~~Excessive nested try-catch in socket handler~~ | ~~LOW~~ | ~~Clean Code~~ | ✅ Resolved by SOLID-1 |
| ~~SEC-6~~ | ~~Stack traces exposed in production logs~~ | ~~LOW~~ | ~~Security~~ | ✅ Resolved |
| ~~ARCH-4~~ | ~~Value objects not implemented~~ | ~~LOW~~ | ~~Architecture~~ | ✅ Resolved |
| SCALE-1 | Socket.IO without adapter for horizontal scaling | LOW (for MVP) | Scalability | Pending |
| SCALE-2 | findActive() returns only one lobby | LOW (for MVP) | Scalability | Pending |

---

## 2. Security

### ~~SEC-1~~ — No Player Authentication/Authorization [CRITICAL] ✅ Resolved

**Resolution:**
- **Socket.IO:** `handleAssignPokemon` and `handleReady` now use `socket.data.playerId` and `socket.data.lobbyId` instead of payload values (same pattern as `handleAttack`). Explicit validation rejects events from connections without player context.
- **REST:** The REST lobby endpoints were removed entirely (see ARCH-6). The session auth module (`InMemoryLobbySessionAuth`) was also removed since it only existed to protect those REST endpoints. All game flow now goes through Socket.IO, where identity is enforced via `socket.data`.

**Tests updated:** `socket.handler.test.js`, `app.integration.test.js`, `socketio.integration.test.js`.

---

### ~~SEC-2~~ — No Rate Limiting on REST Endpoints [MEDIUM] ✅ Resolved

**Resolution:**
- Installed `express-rate-limit` as a dependency.
- Applied a global limiter in `src/app.js`: 100 requests per 15 minutes per IP (`standardHeaders: 'draft-8'`, `legacyHeaders: false`).
- The specific `/lobby/join` stricter limiter was removed when the REST lobby endpoints were deleted (ARCH-6). The global limiter remains for `/health` and any future REST endpoints.

---

### ~~SEC-3~~ — express.json() Without Body Size Limit [MEDIUM] ✅ Resolved

**Resolution:** Changed `express.json()` to `express.json({ limit: '10kb' })` in `src/app.js`.

---

### ~~SEC-4~~ — Nickname Without Max Length Validation [MEDIUM] ✅ Resolved

**Resolution:**
- Added `maxlength: 30` to `src/infrastructure/persistence/mongodb/schemas/player.schema.js`.
- Added `trimmed.length > 30` check in `JoinLobbyUseCase.validateNickname()` — throws `ValidationError('nickname must be 30 characters or fewer')`.
- Added 2 tests: rejects 31-char nickname, accepts exactly 30-char nickname.

---

### ~~SEC-5~~ — MongoDB Without Authentication in Docker [MEDIUM] ✅ Resolved

**Resolution:**
- Added `MONGO_INITDB_ROOT_USERNAME: pokepvp` and `MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD:-devpassword}` to `docker-compose.yml`.
- Updated `.env.example` with auth connection string: `mongodb://pokepvp:devpassword@localhost:27018/pokepvp?authSource=admin`.
- Added `MONGO_PASSWORD=devpassword` to `.env.example`.

**Note:** Existing volumes must be recreated for auth to take effect: `docker compose down -v && docker compose up -d`.

---

### ~~SEC-6~~ — Stack Traces Exposed in Production Logs [LOW] ✅ Resolved

**Resolution:**
- `src/app.js` error middleware: logs `[${err.name}] ${err.message}` in production, full `err` otherwise.
- `src/infrastructure/socket/socket.handler.js`: extracted `logError(eventName, err)` function — logs `[eventName] [err.name] err.message` in production, full stack otherwise.
- A structured logger (e.g., `pino`) can be added later as an enhancement.

---

## 3. Hexagonal Architecture

### ~~ARCH-5~~ — CatalogController and Its Use Cases Are Dead Code [HIGH] ✅ Resolved

**Resolution:**

**Files deleted (6 files):**
- `src/infrastructure/http/catalog.controller.js`
- `src/infrastructure/http/__tests__/catalog.controller.test.js`
- `src/application/use-cases/get-pokemon-list.use-case.js`
- `src/application/use-cases/__tests__/get-pokemon-list.use-case.test.js`
- `src/application/use-cases/get-pokemon-by-id.use-case.js`
- `src/application/use-cases/__tests__/get-pokemon-by-id.use-case.test.js`

**Files updated (2 files):**
- `src/app.js` — removed imports of `GetPokemonListUseCase`, `GetPokemonByIdUseCase`, `CatalogController`, and the `/catalog` route mounting.
- `src/__tests__/app.integration.test.js` — removed `GET /catalog/list`, `GET /catalog/list/:id`, and error middleware test blocks that depended on catalog routes.

**What stayed (not affected):**
- `src/domain/ports/catalog.port.js` — the port interface, used by other use cases
- `src/infrastructure/clients/pokeapi.adapter.js` — the adapter, used by `AssignTeamUseCase`, `StartBattleUseCase`, `ProcessAttackUseCase`

---

### ~~ARCH-6~~ — LobbyController Is Redundant — All Game Flow Is Socket.IO [HIGH] ✅ Resolved

**Resolution:**

Removed `LobbyController` and all REST lobby endpoints. All game flow now goes exclusively through Socket.IO as defined in `docs/business-rules.md` Section 7.

**Files deleted (3 files):**
- `src/infrastructure/http/lobby.controller.js` — the REST controller
- `src/infrastructure/http/__tests__/lobby.controller.test.js` — its tests
- `src/infrastructure/auth/lobby-session-auth.js` — the session auth module (only existed for REST)

**Files updated (3 files):**
- `src/app.js` — removed all lobby-related imports, use case wiring, repository instantiation, `LobbyController` route mounting, `/lobby/join` rate limiter, and `InMemoryLobbySessionAuth`. The `createApp()` function now takes no arguments and returns a minimal Express app: helmet, cors, `express.json({ limit: '10kb' })`, global rate limiter, `/health` endpoint, and error middleware. The `statusFromError` function was simplified to `err.status ?? 500`.
- `src/__tests__/app.integration.test.js` — removed all `/lobby/*` test blocks and mock setup. Only `/health` and 404 tests remain.
- `src/__tests__/socketio.integration.test.js` — updated `createApp()` call (no longer passes options).

**Cascade effects resolved:**
- **SOLID-2** ✅ `statusFromError` now only exists in the `app.js` global middleware — simplified to `err.status ?? 500`.
- **SOLID-3** ✅ `app.js` no longer creates use cases or repositories. All wiring happens exclusively in `index.js`.
- **CLEAN-1** ✅ No REST controllers with game logic remain. The double try-catch pattern is gone.
- **SEC-1** (REST portion) ✅ Session auth layer removed — no REST endpoints to protect.
- **SEC-2** (specific limiter) ✅ `/lobby/join` rate limiter removed. Global limiter remains.

---

### ~~ARCH-1~~ — Anemic Domain Model [HIGH] ✅ Resolved

**Resolution:**

Enriched the domain layer with behavior-rich entities and domain services. Use cases now delegate business logic to the domain.

**New files created (2 domain services):**
- `src/domain/services/damage-calculator.js` — `calculateDamage(attackStat, defenseStat)` encapsulates `Math.max(1, attack - defense)`.
- `src/domain/services/turn-resolver.js` — `resolveFirstTurn({ speedA, speedB, playerIdA, playerIdB, pokemonIdA, pokemonIdB })` encapsulates first-turn resolution with Speed + deterministic tiebreakers.

**Entity enriched (1 file rewritten):**
- `src/domain/entities/lobby.entity.js` — converted from JSDoc typedef + constants to a full `Lobby` class with:
  - `Lobby.from(plain)` — factory from plain objects (returns `null` for null input)
  - `isFull()`, `canJoin()`, `canAssignTeams()`, `hasPlayer(playerId)` — query methods
  - `addPlayer(playerId)`, `markReady(playerId)`, `withStatus(newStatus)` — immutable state transitions (return new Lobby instances)
  - `isAlreadyReady(playerId)`, `isEveryoneReady()` — readiness checks
  - `toPlain()` — serializes back to a plain object for repository persistence

**Use cases updated (5 files):**
- `join-lobby.use-case.js` — uses `Nickname` value object + `Lobby.from()`, `lobby.canJoin()`, `lobby.addPlayer()`, `lobby.toPlain()`
- `mark-ready.use-case.js` — uses `Lobby.from()`, `lobby.hasPlayer()`, `lobby.isAlreadyReady()`, `lobby.markReady()`, `lobby.isEveryoneReady()`, `lobby.withStatus()`
- `assign-team.use-case.js` — uses `Lobby.from()`, `lobby.canAssignTeams()`, `lobby.hasPlayer()`
- `process-attack.use-case.js` — uses `calculateDamage()` from domain service
- `start-battle.use-case.js` — uses `resolveFirstTurn()` from domain service

**New tests (4 test files, 36 new tests):**
- `src/domain/entities/__tests__/lobby.entity.test.js` — 22 tests covering all Lobby methods
- `src/domain/value-objects/__tests__/nickname.test.js` — 6 tests (see ARCH-4)
- `src/domain/services/__tests__/damage-calculator.test.js` — 4 tests
- `src/domain/services/__tests__/turn-resolver.test.js` — 4 tests

**Existing tests:** All 80 existing tests pass without modification — the refactor is fully backward-compatible.

---

### ~~ARCH-2~~ — PersistenceController Bypasses Use Cases [MEDIUM] ✅ Resolved

**Resolution:**

Deleted as legacy code. The controller was never mounted in `src/app.js` — only its test existed.

**Files deleted (2 files):**
- `src/infrastructure/http/persistence.controller.js`
- `src/infrastructure/http/__tests__/persistence.controller.test.js`

This also removed the last consumer of the `statusFromError` / `sendError` pattern outside `app.js`, and the last consumer of the re-exported application errors from `infrastructure/errors/` (enabling CLEAN-3).

---

### ~~ARCH-3~~ — PokeAPIAdapter Lacks Mapper (Anti-Corruption Layer) and Is a Static Object [HIGH] ✅ Resolved

**Resolution:**

Refactored `src/infrastructure/clients/pokeapi.adapter.js` from a plain object literal to a proper class. This also absorbs PERF-1, PERF-2, and PERF-3.

**What changed:**
- **Class-based adapter:** `PokeAPIAdapter` is now a class instantiated with `new PokeAPIAdapter(baseUrl, options)`. Constructor receives `baseUrl` explicitly (no more `process.env` reads at call time). Consistent with other adapters (repositories, SocketIOAdapter).
- **Mapper (Anti-Corruption Layer):** Internal `mapPokemonDetail()` and `mapPokemonListItem()` functions translate external API responses into a stable domain-controlled shape `{ id, name, hp, attack, defense, speed }`. External field renames no longer affect use cases.
- **In-memory cache (PERF-2 absorbed):** Both `getList()` and `getById()` cache results with a 10-minute TTL. Sequential calls in `StartBattleUseCase` become microsecond lookups (PERF-1 absorbed).
- **Timeout (PERF-3 absorbed):** All `fetch()` calls use `AbortSignal.timeout(5000)`. Timeouts are wrapped as `ThirdPartyApiFailedError` with status 504.
- **Wiring updated:** `src/app.js` and `src/index.js` now instantiate `new PokeAPIAdapter(process.env.POKEAPI_BASE_URL)`.
- **New tests:** `src/infrastructure/clients/__tests__/pokeapi.adapter.test.js` — covers mapping, caching, and timeout behavior.

---

### ~~ARCH-4~~ — Value Objects Not Implemented [LOW] ✅ Resolved

**Resolution:**

Implemented the `Nickname` value object, which provides the most immediate validation value. Lobby status transitions are now enforced through the enriched `Lobby` entity class (see ARCH-1).

**New file created:**
- `src/domain/value-objects/nickname.js` — `Nickname` class that encapsulates:
  - Type validation (must be a non-null string)
  - Trimming whitespace
  - Non-empty check
  - Max length validation (30 characters)
  - `toString()` for convenient string coercion

**Use case updated:**
- `join-lobby.use-case.js` — replaced inline `validateNickname()` method with `new Nickname(nickname)` construction. Validation errors are identical.

**New tests:**
- `src/domain/value-objects/__tests__/nickname.test.js` — 6 tests covering valid input, trimming, null, non-string, empty, and max length.

**Note:** `LobbyStatus` as a separate value object was not needed — the `Lobby` entity class already enforces valid state through its behavior methods (`canJoin()`, `canAssignTeams()`, `withStatus()`). Additional value objects (`Damage`, `PokemonId`) can be added as needed.

---

## 4. SOLID Principles

### ~~SOLID-1~~ — SocketHandler Has Too Many Responsibilities (SRP) [HIGH] ✅ Resolved

**Resolution:**

Reduced SocketHandler from 7 to 6 dependencies by removing `lobbyRepository`. Also eliminated excessive nested try-catch (CLEAN-4) in the same refactor.

**Changes to `ProcessAttackUseCase`:**
- Signature changed from `execute({ lobbyId, attackerPlayerId, defenderPlayerId })` to `execute({ lobbyId, attackerPlayerId })`.
- The use case already fetches the lobby internally — it now resolves the defender from `lobby.playerIds` instead of receiving it from the handler.
- Added validation: throws `ValidationError('No opponent in this lobby')` when attacker is alone.

**Changes to `AssignTeamUseCase`:**
- Now returns `{ team, lobby }` instead of just the team. The use case already fetches the lobby for validation, so this is zero-cost and lets the handler notify `lobby_status` without needing its own repository access.

**Changes to `SocketHandler`:**
- Removed `lobbyRepository` from constructor (6 dependencies instead of 7).
- Created `safeAck(ack, payload)` — wraps ack calls in try-catch to prevent serialization errors from crashing the handler.
- Created `wrapHandler(fn, eventName)` — async wrapper that catches all errors, emits `error` event, and calls `safeAck` with the error payload. Each handler now simply returns its ack payload or throws.
- Extracted `requirePlayerContext(socket)` — shared validation for `assign_pokemon`, `ready`, and `attack` events.
- All nested try-catch blocks eliminated (CLEAN-4 resolved).

**Changes to `index.js`:**
- Removed `repositories.lobbyRepository` from `SocketHandler` constructor call.

**Tests:** 13 test files, 93 tests passing (up from 91 — added "attacker alone in lobby" and "no player context on assign" tests).

---

### ~~SOLID-2~~ — statusFromError Duplicated Across Multiple Files (OCP/DRY) [MEDIUM] ✅ Resolved by ARCH-6

**Resolution:** After removing CatalogController (ARCH-5) and LobbyController (ARCH-6), the error-to-HTTP-status mapping only exists in the `app.js` global middleware, simplified to `err.status ?? 500`. No duplication remains. PersistenceController (ARCH-2) still has its own copy, but it's unmounted legacy code.

---

### ~~SOLID-3~~ — Dependency Wiring Duplicated (DRY) [MEDIUM] ✅ Resolved by ARCH-6

**Resolution:** After removing LobbyController (ARCH-6), `app.js` no longer creates use cases or repositories. All wiring happens exclusively in `index.js` for Socket.IO. Duplication is fully resolved without needing a Composition Root.

---

## 5. Performance

### ~~PERF-1~~ — N+1 Sequential Calls to External API *(Absorbed into ARCH-3)* ✅ Resolved

> Resolved by adding in-memory cache to the adapter. With cache, sequential calls become microsecond lookups. See ARCH-3 resolution above.

---

### ~~PERF-2~~ — No Cache for External Pokémon API *(Absorbed into ARCH-3)* ✅ Resolved

> Resolved as part of the adapter refactor. Cache with 10-minute TTL is included in the new `PokeAPIAdapter` class. See ARCH-3 resolution above.

---

### ~~PERF-3~~ — No Timeout on External HTTP Calls *(Absorbed into ARCH-3)* ✅ Resolved

> Resolved as part of the adapter refactor. `AbortSignal.timeout(5000)` is included in all `fetch()` calls. See ARCH-3 resolution above.

---

### ~~PERF-4~~ — No Graceful Shutdown [MEDIUM] ✅ Resolved

**Resolution:**
- Added `shutdown(signal)` function in `src/index.js` that:
  1. Closes Socket.IO (`io.close()`)
  2. Closes the HTTP server (`server.close()`)
  3. Closes the MongoDB connection (`mongoose.connection.close()`)
  4. Force-exits after 10 seconds if cleanup hangs
- Registered `process.on('SIGTERM')` and `process.on('SIGINT')` handlers.

---

## 6. Scalability

### SCALE-1 — Socket.IO Without Adapter for Horizontal Scaling [LOW for MVP]

**Problem:** Socket.IO stores room and connection state in memory. If the server scales to multiple instances (behind a load balancer), events won't reach all clients because rooms are local to each instance.

**Recommended fix (when needed):**
- Use `@socket.io/redis-adapter` to share state across instances.
- Document this requirement in the architecture docs for future scaling.

### SCALE-2 — findActive() Returns Only One Lobby [LOW for MVP]

**Problem:** `lobbyRepository.findActive()` returns a single lobby (the most recent non-finished one). This limits the system to one concurrent game.

**Recommended fix (when needed):**
- Implement a matchmaking queue or allow `findActive` to return multiple lobbies.
- For now, document this as an intentional MVP limitation.

---

## 7. Clean Code

### ~~CLEAN-1~~ — Inconsistent Error Handling in Controllers [MEDIUM] ✅ Resolved by ARCH-6

**Resolution:** After removing CatalogController (ARCH-5) and LobbyController (ARCH-6), no REST controllers with game logic remain. The double try-catch + `sendError()` + `.catch(next)` pattern is gone. Only the global error middleware in `app.js` handles errors.

---

### ~~CLEAN-2~~ — mapRepositoryError Has Confusing Pattern [LOW] ✅ Resolved

**Resolution:**

Renamed `mapRepositoryError` → `throwMappedError` to make the always-throws intent explicit.

**Files updated (7 files):**
- `src/infrastructure/persistence/mongodb/map-repository-error.js` — function renamed
- `src/infrastructure/persistence/mongodb/adapters/lobby.mongo.repository.js` — import + call updated
- `src/infrastructure/persistence/mongodb/adapters/player.mongo.repository.js` — import + call updated
- `src/infrastructure/persistence/mongodb/adapters/team.mongo.repository.js` — import + call updated
- `src/infrastructure/persistence/mongodb/adapters/battle.mongo.repository.js` — import + call updated
- `src/infrastructure/persistence/mongodb/adapters/pokemon-state.mongo.repository.js` — import + call updated
- `src/infrastructure/persistence/mongodb/__tests__/map-repository-error.test.js` — all references updated

---

### ~~CLEAN-3~~ — Inconsistent Error Import Paths [LOW] ✅ Resolved

**Resolution:**

Removed the 3 re-export files from `src/infrastructure/errors/` for application-level errors. All infrastructure code now imports directly from `src/application/errors/`.

**Files deleted (3 files):**
- `src/infrastructure/errors/Validation.error.js` — was `export { ValidationError } from '../../application/errors/...'`
- `src/infrastructure/errors/NotFound.error.js` — same pattern
- `src/infrastructure/errors/Conflict.error.js` — same pattern

**Files updated (2 files):**
- `src/infrastructure/persistence/mongodb/map-repository-error.js` — imports changed from `../../errors/` to `../../../application/errors/`
- `src/infrastructure/persistence/mongodb/__tests__/map-repository-error.test.js` — imports changed from `../../../errors/` to `../../../../application/errors/`

**What remains in `src/infrastructure/errors/`:**
- `InvalidConfig.error.js` — infrastructure-native error (not a re-export)
- `ThirdPartyApiFailed.error.js` — infrastructure-native error (not a re-export)

---

### ~~CLEAN-4~~ — Excessive Nested Try-Catch in Socket Handler [LOW] ✅ Resolved by SOLID-1

**Resolution:** Implemented `safeAck()` and `wrapHandler()` utilities as part of the SOLID-1 refactor. All nested try-catch blocks removed. Each handler now returns its ack payload or throws, and the wrapper handles all error routing uniformly. See SOLID-1 resolution above for details.

---

## 8. Tests

### Current State

- **16 test files**, 124 tests passing (after all resolutions through Stage F)
- **Coverage:** statements 89%, branches 80%, functions 95%, lines 89%
- Branch coverage improved from 44% to **80%** (was 76% before Stage F security tests)

### Resolved Improvements

- **Security tests** ✅ — Added 8 tests covering lobbyId spoofing prevention (`assign_pokemon`, `ready`), missing player context, missing lobbyId, and safeAck resilience.
- **Branch coverage** ✅ — Increased from 44% to 80% through domain layer tests (ARCH-1) and targeted security/edge case tests (Stage F).
- **Start battle idempotency** ✅ — Added tests for "already battling" path and "battle with winner" edge case.

### Remaining Suggestions

- **Integration tests:** Add full battle flow integration test (join -> assign -> ready -> battle -> win).
- **Performance tests:** Test behavior when external API is slow or unavailable (timeout scenarios).
- **Mongoose schemas:** Currently at 0% coverage — these are declarative definitions and low-value to test directly.

---

## 9. Implementation Roadmap

### Stage A — Security Hardening (Priority: CRITICAL)

| Task | IDs | Status |
|------|-----|--------|
| ~~Fix Socket.IO handlers to use socket.data identity~~ | ~~SEC-1~~ | ✅ Done |
| ~~Add REST authentication (token from join)~~ | ~~SEC-1~~ | ✅ Done |
| ~~Install and configure express-rate-limit~~ | ~~SEC-2~~ | ✅ Done |
| ~~Set express.json body size limit~~ | ~~SEC-3~~ | ✅ Done |
| ~~Add nickname maxlength validation~~ | ~~SEC-4~~ | ✅ Done |
| ~~Add MongoDB authentication in Docker~~ | ~~SEC-5~~ | ✅ Done |

### Stage B — Dead Code Removal and Architecture Refactoring (Priority: HIGH)

| Task | IDs | Status |
|------|-----|--------|
| ~~**Remove CatalogController, GetPokemonListUseCase, GetPokemonByIdUseCase** (6 files deleted, 2 updated)~~ | ~~ARCH-5~~ | ✅ Done |
| ~~**Remove LobbyController + session auth** (3 files deleted, 3 updated) — resolves SOLID-2, SOLID-3, CLEAN-1 in cascade~~ | ~~ARCH-6~~ | ✅ Done |
| ~~Remove PersistenceController (legacy, 2 files deleted)~~ | ~~ARCH-2~~ | ✅ Done |
| ~~Simplify SocketHandler — move opponent logic to use case, create wrapHandler/safeAck (CLEAN-4)~~ | ~~SOLID-1, CLEAN-4~~ | ✅ Done |
| ~~Convert PokeAPIAdapter to class with mapper, cache, and timeout (Anti-Corruption Layer)~~ | ~~ARCH-3, PERF-1, PERF-2, PERF-3~~ | ✅ Done |
| ~~Create Composition Root (container.js)~~ | ~~SOLID-3~~ | Resolved by ARCH-6 (no duplication remains) |
| ~~Centralize error mapping (error-mapper.js)~~ | ~~SOLID-2~~ | Resolved by ARCH-6 + ARCH-2 (single location remains) |

### Stage C — Domain Enrichment (Priority: HIGH)

| Task | IDs | Status |
|------|-----|--------|
| ~~Create domain services (damage-calculator, turn-resolver)~~ | ~~ARCH-1~~ | ✅ Done |
| ~~Enrich entities with behavior (Lobby class with isFull, canJoin, etc.)~~ | ~~ARCH-1~~ | ✅ Done |
| ~~Implement Nickname value object~~ | ~~ARCH-4~~ | ✅ Done |

### Stage D — Performance Optimization (Priority: MEDIUM)

| Task | IDs | Status |
|------|-----|--------|
| ~~Parallel fetch in StartBattleUseCase~~ | ~~PERF-1~~ | ✅ Absorbed into ARCH-3 (Stage B) |
| ~~Add in-memory cache to PokeAPIAdapter~~ | ~~PERF-2~~ | ✅ Absorbed into ARCH-3 (Stage B) |
| ~~Add timeout to external fetch calls~~ | ~~PERF-3~~ | ✅ Absorbed into ARCH-3 (Stage B) |
| ~~Implement graceful shutdown~~ | ~~PERF-4~~ | ✅ Done |

### Stage E — Clean Code Polish (Priority: LOW)

| Task | IDs | Status |
|------|-----|--------|
| ~~Simplify controller error handling (delegate to middleware)~~ | ~~CLEAN-1~~ | ✅ Resolved by ARCH-6 |
| ~~Rename mapRepositoryError → throwMappedError~~ | ~~CLEAN-2~~ | ✅ Done |
| ~~Fix inconsistent error import paths~~ | ~~CLEAN-3~~ | ✅ Done |
| ~~Create socket handler wrapper for try-catch~~ | ~~CLEAN-4~~ | ✅ Resolved by SOLID-1 |
| ~~Condition log verbosity on NODE_ENV~~ | ~~SEC-6~~ | ✅ Done |

### Stage F — Tests and Documentation (Priority: LOW)

| Task | IDs | Status |
|------|-----|--------|
| ~~Add security-related tests (spoofing, auth, safeAck)~~ | ~~Tests~~ | ✅ Done (8 new tests) |
| ~~Increase branch coverage to 80%~~ | ~~Tests~~ | ✅ Done (44% → 80%) |
| ~~Update docs/architecture.md with all changes~~ | ~~Docs~~ | ✅ Done |
| ~~Document scalability limitations~~ | ~~SCALE-1, SCALE-2~~ | ✅ Done (in architecture.md §10) |

---

## References

- [Express Best Practices — Production](https://expressjs.com/en/advanced/best-practice-performance)
- [Socket.IO v4 — Middlewares](https://socket.io/docs/v4/middlewares)
- [express-rate-limit — Quickstart](https://github.com/express-rate-limit/express-rate-limit)
- [Hexagonal Architecture — Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
