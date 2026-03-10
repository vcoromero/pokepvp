# Socket.IO Test Flow

This document describes how to manually test the PokePVP Socket.IO API using Postman (or similar tools). Postman does not support exporting Socket.IO collections, so this serves as a reference for reproducing the test flow.

## Prerequisites

- Server running at `http://localhost:8080` with `MONGODB_URI` configured
- MongoDB with clean data (or run `docker compose down -v && docker compose up -d` to reset)
- Postman with Socket.IO support (or Bruno for REST API cross-verification)

## Connection

- **URL:** `http://localhost:8080`
- **Listeners:** Add `lobby_status` and `error` to receive server events

## Event Flow (Client → Server)

### 1. join_lobby

Creates or joins an active lobby. First player creates a new lobby; second player joins it.

| Field | Value |
|-------|-------|
| **Event** | `join_lobby` |
| **Payload** | `{ "nickname": "PlayerOne" }` |

**Response (ack):** `{ player, lobby }` — player with `id`, `nickname`, `lobbyId`; lobby with `id`, `status`, `playerIds`, `readyPlayerIds`, `createdAt`

**Server emits:** `lobby_status` with `{ lobby, player }`

**Repeat for second player:** `{ "nickname": "PlayerTwo" }` — use a second Postman tab/window to simulate two clients.

---

### 2. assign_pokemon

Assigns a random team of 3 Pokémon to a player. Must be called once per player.

| Field | Value |
|-------|-------|
| **Event** | `assign_pokemon` |
| **Payload** | `{ "lobbyId": "<lobby_id>", "playerId": "<player_id>" }` |

**Example (Player 1):**
```json
{
  "lobbyId": "69afbab7d49bed3ab81f2c44",
  "playerId": "69afbab7d49bed3ab81f2c46"
}
```

**Example (Player 2):**
```json
{
  "lobbyId": "69afbab7d49bed3ab81f2c44",
  "playerId": "69afbb47d49bed3ab81f2c4b"
}
```

**Response (ack):** `{ id, lobbyId, playerId, pokemonIds }` — team with 3 catalog Pokémon IDs

**Server emits:** `lobby_status` with `{ lobby }`

---

### 3. ready

Marks a player as ready. Both players must call this. When both are ready, lobby `status` becomes `"ready"`.

| Field | Value |
|-------|-------|
| **Event** | `ready` |
| **Payload** | `{ "lobbyId": "<lobby_id>", "playerId": "<player_id>" }` |

**Example (Player 1):**
```json
{
  "lobbyId": "69afbab7d49bed3ab81f2c44",
  "playerId": "69afbab7d49bed3ab81f2c46"
}
```

**Example (Player 2):**
```json
{
  "lobbyId": "69afbab7d49bed3ab81f2c44",
  "playerId": "69afbb47d49bed3ab81f2c4b"
}
```

**Response (ack):** Updated `lobby` with `readyPlayerIds` and `status: "ready"` when both are ready

**Server emits:** `lobby_status` with `{ lobby }`

---

### 4. attack

Not implemented yet (Stage 6). Emitting this event returns an error.

| Field | Value |
|-------|-------|
| **Event** | `attack` |
| **Payload** | TBD (Stage 6) |

**Response:** `{ error: { code: "attack_not_available", message: "Attack not implemented yet (Stage 6)" } }`

---

## Server Events (Listen For)

| Event | When | Payload |
|-------|------|---------|
| `lobby_status` | After join_lobby, assign_pokemon, or ready | `{ lobby, player? }` |
| `error` | On validation, conflict, or server error | `{ code, message }` |
| `battle_start` | (Stage 6) When battle begins | TBD |
| `turn_result` | (Stage 6) After each attack | TBD |
| `battle_end` | (Stage 6) When battle ends | TBD |

---

## Full Test Sequence

1. Connect to `http://localhost:8080`
2. Add listeners: `lobby_status`, `error`
3. **join_lobby** with `{ "nickname": "PlayerOne" }` → save `lobby.id` and `player.id`
4. (Optional) Open second tab, connect, **join_lobby** with `{ "nickname": "PlayerTwo" }` → save both `playerIds`
5. **assign_pokemon** for Player 1 → `{ lobbyId, playerId }`
6. **assign_pokemon** for Player 2 → `{ lobbyId, playerId }`
7. **ready** for Player 1
8. **ready** for Player 2 → lobby `status` becomes `"ready"`

---

## Cross-Verification with Bruno (REST API)

You can verify state between Socket.IO steps using Bruno:

- `GET /lobby/active` — current active lobby
- `GET /lobby/:lobbyId` — lobby by ID

The REST API and Socket.IO share the same use cases and MongoDB, so data stays consistent.
