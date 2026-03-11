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
| ARCH-1 | Anemic domain model — business logic in use cases | HIGH | Architecture | Pending |
| SOLID-1 | SocketHandler has 7 dependencies, mixed responsibilities | HIGH | SOLID | Pending |
| SEC-4 | Nickname without max length validation | MEDIUM | Security | Pending |
| SEC-5 | MongoDB without authentication in Docker | MEDIUM | Security | Pending |
| ~~SOLID-2~~ | ~~statusFromError duplicated across multiple files~~ | ~~MEDIUM~~ | ~~SOLID~~ | ✅ Resolved by ARCH-6 |
| ~~SOLID-3~~ | ~~Dependency wiring duplicated in index.js and app.js~~ | ~~MEDIUM~~ | ~~SOLID~~ | ✅ Resolved by ARCH-6 |
| ARCH-2 | PersistenceController bypasses use cases | MEDIUM | Architecture | Pending |
| PERF-4 | No graceful shutdown | MEDIUM | Performance | Pending |
| ~~CLEAN-1~~ | ~~Inconsistent error handling in controllers~~ | ~~MEDIUM~~ | ~~Clean Code~~ | ✅ Resolved by ARCH-6 |
| CLEAN-2 | mapRepositoryError has confusing throw pattern | LOW | Clean Code | Pending |
| CLEAN-3 | Inconsistent error import paths | LOW | Clean Code | Pending |
| CLEAN-4 | Excessive nested try-catch in socket handler | LOW | Clean Code | Pending |
| SEC-6 | Stack traces exposed in production logs | LOW | Security | Pending |
| ARCH-4 | Value objects not implemented | LOW | Architecture | Pending |
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

### SEC-4 — Nickname Without Max Length Validation [MEDIUM]

**Problem:** The player schema (`src/infrastructure/persistence/mongodb/schemas/player.schema.js`) has no `maxlength`. The use case (`src/application/use-cases/join-lobby.use-case.js`) validates non-empty but not max length. A malicious client could send extremely long nicknames.

**Recommended fix:**
- Add `maxlength: 30` to the Mongoose schema:
  ```javascript
  nickname: { type: String, required: true, maxlength: 30 },
  ```
- Add validation in `JoinLobbyUseCase.validateNickname()`:
  ```javascript
  if (trimmed.length > 30) {
    throw new ValidationError('nickname must be 30 characters or fewer');
  }
  ```

---

### SEC-5 — MongoDB Without Authentication in Docker [MEDIUM]

**Problem:** `docker-compose.yml` runs MongoDB without any user/password. The port is exposed on the host.

**Recommended fix:**
```yaml
services:
  mongo:
    image: mongo:7
    environment:
      MONGO_INITDB_ROOT_USERNAME: pokepvp
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD:-devpassword}
    ports:
      - "${MONGO_HOST_PORT:-27017}:27017"
    volumes:
      - mongo-data:/data/db
```
Update `.env.example`:
```
MONGODB_URI=mongodb://pokepvp:devpassword@localhost:27017/pokepvp?authSource=admin
```

---

### SEC-6 — Stack Traces Exposed in Production Logs [LOW]

**Problem:** `console.error(err)` in `src/app.js:80` and multiple `console.error` calls in `src/infrastructure/socket/socket.handler.js` log full stack traces regardless of environment.

**Recommended fix:**
- Condition log verbosity on `NODE_ENV`:
  ```javascript
  if (process.env.NODE_ENV === 'production') {
    console.error(`[${err.name}] ${err.message}`);
  } else {
    console.error(err);
  }
  ```
- Consider using a structured logger (e.g., `pino`) for production.

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

### ARCH-1 — Anemic Domain Model [HIGH]

**Problem:** Entities in `src/domain/entities/` are only JSDoc typedefs with exported constants. They have no behavior. All business logic lives in use cases:

- **Damage formula** in `src/application/use-cases/process-attack.use-case.js:94`:
  ```javascript
  const damage = Math.max(1, (attackerDetail.attack ?? 0) - (defenderDetail.defense ?? 0));
  ```
- **First turn resolution** in `src/application/use-cases/start-battle.use-case.js:15-24`
- **Lobby full check** in `src/application/use-cases/join-lobby.use-case.js:22`
- **Both players ready check** in `src/application/use-cases/mark-ready.use-case.js:4-13`

In hexagonal architecture, the domain should contain the core business logic, not just data shapes.

**Recommended fix:**
- Create domain services:
  - `src/domain/services/damage-calculator.js` — encapsulate the damage formula
  - `src/domain/services/turn-resolver.js` — encapsulate first-turn logic
- Enrich entities with behavior methods:
  ```javascript
  // Example: Lobby entity as a class
  export class Lobby {
    constructor({ id, status, playerIds, readyPlayerIds, createdAt }) { ... }
    isFull() { return this.playerIds.length >= 2; }
    canJoin() { return this.status === 'waiting' && !this.isFull(); }
    isEveryoneReady() { return this.playerIds.every(id => this.readyPlayerIds.includes(id)); }
    addPlayer(playerId) { ... }
    markReady(playerId) { ... }
  }
  ```
- Use cases then delegate to entities and domain services instead of containing the logic themselves.

---

### ARCH-2 — PersistenceController Bypasses Use Cases [MEDIUM]

**Problem:** `src/infrastructure/http/persistence.controller.js` calls repositories directly (`this.lobbyRepository.save(...)`, `this.playerRepository.save(...)`) without going through use cases. This violates the hexagonal flow where input adapters should only interact with use cases.

The controller is not mounted in `src/app.js` (only its test exists), suggesting it's legacy code from Stage 3.

**Recommended fix:**
- If it's legacy/debug code: delete `persistence.controller.js` and `persistence.controller.test.js`.
- If it's needed for development: move it to a `dev-tools/` folder and guard it with `NODE_ENV !== 'production'`.

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

### ARCH-4 — Value Objects Not Implemented [LOW]

**Problem:** The architecture document (`docs/architecture.md`) mentions "value objects" but none exist. Candidates:
- `LobbyStatus` — enforce valid transitions (waiting -> ready -> battling -> finished)
- `Nickname` — encapsulate trim + length validation
- `Damage` — encapsulate the damage formula result
- `PokemonId` — type-safe wrapper for numeric IDs

**Recommended fix:** Start with `LobbyStatus` and `Nickname` as they provide the most validation value. These can be simple classes or factory functions with built-in validation.

---

## 4. SOLID Principles

### SOLID-1 — SocketHandler Has Too Many Responsibilities (SRP) [HIGH]

**Problem:** `src/infrastructure/socket/socket.handler.js` constructor receives 7 dependencies:
```javascript
constructor(
  joinLobbyUseCase,      // 1
  assignTeamUseCase,     // 2
  markReadyUseCase,      // 3
  startBattleUseCase,    // 4
  processAttackUseCase,  // 5
  realtimePort,          // 6
  lobbyRepository        // 7 — direct repo access
)
```

Additionally, `handleAttack` (lines 159-166) uses `lobbyRepository` directly to find the opponent, which should be part of a use case:
```javascript
const lobby = await this.lobbyRepository.findById(lobbyId);
const defenderPlayerId = (lobby.playerIds ?? []).find((id) => id !== attackerPlayerId);
```

**Recommended fix:**
- Move "find opponent" logic into `ProcessAttackUseCase` — the use case should accept only `{ lobbyId, attackerPlayerId }` and resolve the defender internally.
- Remove `lobbyRepository` from `SocketHandler` constructor (6 dependencies instead of 7).
- Consider splitting the handler into smaller handlers per event group if it grows further.

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

### PERF-4 — No Graceful Shutdown [MEDIUM]

**Problem:** `src/index.js` does not handle `SIGTERM` or `SIGINT`. When the process is killed (e.g., container restart), active Socket.IO connections and MongoDB operations are abruptly terminated.

**Recommended fix:**
```javascript
function shutdown(server, io) {
  console.log('Shutting down gracefully...');
  io.close();
  server.close(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000); // force exit after 10s
}

process.on('SIGTERM', () => shutdown(server, io));
process.on('SIGINT', () => shutdown(server, io));
```

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

### CLEAN-2 — mapRepositoryError Has Confusing Pattern [LOW]

**Problem:** `src/infrastructure/persistence/mongodb/map-repository-error.js` always throws, but its name and usage suggest it might return:

```javascript
// lobby.mongo.repository.js:38-40
} catch (err) {
  mapRepositoryError(err); // always throws, but looks like it might silently return
}
```

**Recommended fix:**
- Rename to `throwMappedError(err)` to make intent explicit.
- Or add JSDoc `@returns {never}` annotation.

---

### CLEAN-3 — Inconsistent Error Import Paths [LOW]

**Problem:** Application errors (`ValidationError`, `NotFoundError`, `ConflictError`) are imported from two different paths:
- `src/application/errors/` (the source)
- `src/infrastructure/errors/` (re-exports the same classes)

This creates confusion about the canonical location.

**Recommended fix:**
- Each layer should import errors from its own layer or from the layer above (domain > application).
- Remove the re-exports from `src/infrastructure/errors/` for application-level errors.
- Infrastructure code that needs `ValidationError` should import from `../../application/errors/`.

---

### CLEAN-4 — Excessive Nested Try-Catch in Socket Handler [LOW]

**Problem:** The `ready` and `attack` event handlers in `src/infrastructure/socket/socket.handler.js` have deeply nested try-catch blocks:

```javascript
// Lines 34-46: ready handler
socket.on('ready', (payload, ack) => {
  this.handleReady(socket, payload, ack).catch((err) => {
    console.error('[ready] handler error', err?.stack ?? err);
    socket.emit('error', errorPayload(err));
    if (typeof ack === 'function') {
      try {           // nested try-catch for ack
        ack({ error: errorPayload(err) });
      } catch (ackErr) {
        console.error('[ready] ack error', ackErr);
      }
    }
  });
});
```

And `handleReady` itself (lines 110-140) has another full try-catch with its own nested try-catch for ack.

**Recommended fix:**
- Create a helper function for safe ack:
  ```javascript
  function safeAck(ack, payload) {
    if (typeof ack !== 'function') return;
    try { ack(payload); } catch (e) { console.error('ack error', e); }
  }
  ```
- Create a wrapper for socket event handlers:
  ```javascript
  function wrapHandler(handler) {
    return async (socket, payload, ack) => {
      try {
        await handler(socket, payload, ack);
      } catch (err) {
        console.error(err);
        socket.emit('error', errorPayload(err));
        safeAck(ack, { error: errorPayload(err) });
      }
    };
  }
  ```

---

## 8. Tests

### Current State

- **13 test files**, 91 tests passing (after ARCH-5, SEC-1, ARCH-6 resolutions)
- **Coverage thresholds** (jest.config.cjs): statements 80%, branches 44%, functions 80%, lines 80%
- Branch coverage at 44% indicates many untested code paths

### Suggested Improvements

- **Security tests:** Add tests for playerId spoofing scenarios (sending wrong playerId in payload).
- **Branch coverage:** Increase from 44% to at least 70% by testing edge cases in use cases (error paths, boundary conditions).
- **Integration tests:** Add full battle flow integration test (join -> assign -> ready -> battle -> win).
- **Performance tests:** Test behavior when external API is slow or unavailable (timeout scenarios).

---

## 9. Implementation Roadmap

### Stage A — Security Hardening (Priority: CRITICAL)

| Task | IDs | Status |
|------|-----|--------|
| ~~Fix Socket.IO handlers to use socket.data identity~~ | ~~SEC-1~~ | ✅ Done |
| ~~Add REST authentication (token from join)~~ | ~~SEC-1~~ | ✅ Done |
| ~~Install and configure express-rate-limit~~ | ~~SEC-2~~ | ✅ Done |
| ~~Set express.json body size limit~~ | ~~SEC-3~~ | ✅ Done |
| Add nickname maxlength validation | SEC-4 | Pending |
| Add MongoDB authentication in Docker | SEC-5 | Pending |

### Stage B — Dead Code Removal and Architecture Refactoring (Priority: HIGH)

| Task | IDs | Status |
|------|-----|--------|
| ~~**Remove CatalogController, GetPokemonListUseCase, GetPokemonByIdUseCase** (6 files deleted, 2 updated)~~ | ~~ARCH-5~~ | ✅ Done |
| ~~**Remove LobbyController + session auth** (3 files deleted, 3 updated) — resolves SOLID-2, SOLID-3, CLEAN-1 in cascade~~ | ~~ARCH-6~~ | ✅ Done |
| Remove PersistenceController (legacy, 2 files deleted) | ARCH-2 | Pending |
| Simplify SocketHandler — move opponent logic to use case | SOLID-1 | Pending |
| ~~Convert PokeAPIAdapter to class with mapper, cache, and timeout (Anti-Corruption Layer)~~ | ~~ARCH-3, PERF-1, PERF-2, PERF-3~~ | ✅ Done |
| ~~Create Composition Root (container.js)~~ | ~~SOLID-3~~ | Resolved by ARCH-6 (no duplication remains) |
| ~~Centralize error mapping (error-mapper.js)~~ | ~~SOLID-2~~ | Resolved by ARCH-6 + ARCH-2 (single location remains) |

### Stage C — Domain Enrichment (Priority: HIGH)

| Task | IDs | Effort |
|------|-----|--------|
| Create domain services (damage-calculator, turn-resolver) | ARCH-1 | Medium |
| Enrich entities with behavior (Lobby, Battle classes) | ARCH-1 | High |
| Implement core value objects (LobbyStatus, Nickname) | ARCH-4 | Medium |

### Stage D — Performance Optimization (Priority: MEDIUM)

| Task | IDs | Status |
|------|-----|--------|
| ~~Parallel fetch in StartBattleUseCase~~ | ~~PERF-1~~ | ✅ Absorbed into ARCH-3 (Stage B) |
| ~~Add in-memory cache to PokeAPIAdapter~~ | ~~PERF-2~~ | ✅ Absorbed into ARCH-3 (Stage B) |
| ~~Add timeout to external fetch calls~~ | ~~PERF-3~~ | ✅ Absorbed into ARCH-3 (Stage B) |
| Implement graceful shutdown | PERF-4 | Pending |

### Stage E — Clean Code Polish (Priority: LOW)

| Task | IDs | Status |
|------|-----|--------|
| ~~Simplify controller error handling (delegate to middleware)~~ | ~~CLEAN-1~~ | ✅ Resolved by ARCH-6 |
| Rename mapRepositoryError | CLEAN-2 | Pending |
| Fix inconsistent error import paths | CLEAN-3 | Pending |
| Create socket handler wrapper for try-catch | CLEAN-4 | Pending |
| Condition log verbosity on NODE_ENV | SEC-6 | Pending |

### Stage F — Tests and Documentation (Priority: LOW)

| Task | IDs | Effort |
|------|-----|--------|
| Add security-related tests | Tests | Medium |
| Increase branch coverage to 70%+ | Tests | Medium |
| Update docs/architecture.md with changes | Docs | Low |
| Document scalability limitations | SCALE-1, SCALE-2 | Low |

---

## References

- [Express Best Practices — Production](https://expressjs.com/en/advanced/best-practice-performance)
- [Socket.IO v4 — Middlewares](https://socket.io/docs/v4/middlewares)
- [express-rate-limit — Quickstart](https://github.com/express-rate-limit/express-rate-limit)
- [Hexagonal Architecture — Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
