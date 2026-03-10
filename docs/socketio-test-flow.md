# Socket.IO Test Flow

This document describes how to manually test the PokePVP Socket.IO API using Postman (or similar tools). Postman does not support exporting Socket.IO collections, so this serves as a reference for reproducing the test flow.

## Prerequisites

- Server running at `http://localhost:8080` with `MONGODB_URI` configured
- MongoDB with clean data (or run `docker compose down -v && docker compose up -d` to reset)
- Postman with Socket.IO support (or Bruno for REST API cross-verification)

## Connection

- **URL:** `http://localhost:8080`
- **Listeners:** Add these events to receive server messages (all are required for the full flow):
  - `lobby_status` — lobby updates after join, assign, ready
  - **`battle_start`** — sent once when both players are ready; **contains `battle.nextToActPlayerId`** (who attacks first). If you don't listen for this event, you won't see who goes first.
  - `turn_result` — after each valid attack
  - `battle_end` — when the battle is over
  - `error` — validation/conflict errors

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

Marks a player as ready. Both players must call this. When both are ready:

- Lobby `status` becomes `"ready"` and then transitions to `"battling"` internally.
- The server automatically starts the battle and emits a `battle_start` event with initial battle and Pokémon state.

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

**Response (ack):** Updated `lobby` with `readyPlayerIds` and `status: "ready"` when both are ready.

**Server emits:**

- `lobby_status` with `{ lobby }`
- `battle_start` with:

```json
{
  "battle": {
    "id": "<battle_id>",
    "lobbyId": "<lobby_id>",
    "winnerId": null,
    "nextToActPlayerId": "<player_id_who_attacks_first>"
  },
  "pokemonStates": [
    {
      "playerId": "<player_id>",
      "pokemonId": 1,
      "currentHp": 45,
      "defeated": false
    }
  ]
}
```

---

### 5. attack

Triggers a single attack from the current active Pokémon of the player whose turn it is.

| Field | Value |
|-------|-------|
| **Event** | `attack` |
| **Payload** | `{ "lobbyId": "<lobby_id>" }` |

Notes:

- **Same connection:** The server infers the attacker from the socket (`socket.data.playerId`). You must send `join_lobby`, then `assign_pokemon`, then `ready` **on the same Socket.IO connection** before sending `attack`. In Postman, use the same tab/window where you joined as that player; if you use a new tab or reconnect without joining, `attack` will fail with "This connection has no player context".
- Turn order: the **first turn** is decided by the initial active Pokémon's Speed (tiebreaker: playerId). **After that, turns alternate** — only the player who did not attack last may send the next `attack`.
- If it is **not** this player's turn, the server returns a `ConflictError` ("Not this player's turn").
- If the battle has not started or already finished, the server returns an error.

**Successful response (ack):** same shape as the `turn_result` event:

```json
{
  "battleId": "<battle_id>",
  "lobbyId": "<lobby_id>",
  "attacker": {
    "playerId": "<attacker_id>",
    "pokemonId": 1
  },
  "defender": {
    "playerId": "<defender_id>",
    "pokemonId": 4,
    "damage": 12,
    "previousHp": 30,
    "currentHp": 18,
    "defeated": false
  },
  "nextActivePokemon": {
    "playerId": "<player_who_switched>",
    "pokemonId": 5
  },
  "battleFinished": false,
  "nextToActPlayerId": "<player_id_who_attacks_next>"
}
```

`nextToActPlayerId` is present when the battle is not finished; it indicates who must send the next `attack`.

**Error response (ack + `error` event):**

```json
{
  "error": {
    "code": "ConflictError",
    "message": "Not this player's turn"
  }
}
```

---

## Server Events (Listen For)

| Event | When | Payload |
|-------|------|---------|
| `lobby_status` | After `join_lobby`, `assign_pokemon`, or `ready` | `{ lobby, player? }` |
| `error` | On validation, conflict, or server error | `{ code, message }` |
| `battle_start` | When both players are ready and the battle is initialized | `{ battle, pokemonStates }` — `battle` includes `nextToActPlayerId` (who attacks first) |
| `turn_result` | After each valid `attack` | Same as the `attack` ack; includes `nextToActPlayerId` when battle is not finished |
| `battle_end` | When a player has no remaining Pokémon | `{ battleId, lobbyId, winnerId }` |

---

## Full Test Sequence

1. Connect to `http://localhost:8080`
2. Add listeners: `lobby_status`, `battle_start`, `turn_result`, `battle_end`, `error`
3. **join_lobby** with `{ "nickname": "PlayerOne" }` → save `lobby.id` and `player.id`
4. (Optional) Open second tab, connect, **join_lobby** with `{ "nickname": "PlayerTwo" }` → save both `playerIds`
5. **assign_pokemon** for Player 1 → `{ lobbyId, playerId }`
6. **assign_pokemon** for Player 2 → `{ lobbyId, playerId }`
7. **ready** for Player 1
8. **ready** for Player 2 → lobby `status` becomes `"ready"`, server emits `battle_start` with initial battle state
9. Send **attack** events in turn order:
   - The **first** attack must come from the client whose initial active Pokémon has higher Speed (or lexicographically smaller `playerId` on tie) — this is the `nextToActPlayerId` in `battle_start`.
   - **After each attack**, the other player must attack next (turns alternate). Use `turn_result.nextToActPlayerId` to know whose turn it is.
   - Payload: `{ "lobbyId": "<lobby_id>" }`
   - Observe `turn_result` and, when appropriate, `battle_end` events

---

## Cross-Verification with Bruno (REST API)

You can verify state between Socket.IO steps using Bruno:

- `GET /lobby/active` — current active lobby
- `GET /lobby/:lobbyId` — lobby by ID

The REST API and Socket.IO share the same use cases and MongoDB, so data stays consistent.
