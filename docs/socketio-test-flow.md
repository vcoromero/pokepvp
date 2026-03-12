# Socket.IO Test Flow

This document describes how to manually test the PokePVP Socket.IO API using Postman (or similar tools). Postman does not support exporting Socket.IO collections, so this serves as a reference for reproducing the test flow.

## Prerequisites

- Server running at `http://localhost:8080` with `MONGODB_URI` configured
- MongoDB with clean data (or run `docker compose down -v && docker compose up -d` to reset)
- Postman with Socket.IO support

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

**Ack (success):**
```json
{
  "player": { "id": "<player_id>", "nickname": "PlayerOne", "lobbyId": "<lobby_id>" },
  "lobby": { "id": "<lobby_id>", "status": "waiting", "playerIds": ["<player_id>"], "readyPlayerIds": [], "createdAt": "<iso_date>" }
}
```

**Ack (error):** `{ "error": { "code": "ValidationError", "message": "..." } }` — e.g. missing or invalid nickname.

**Server emits:** `lobby_status` with `{ lobby, player }`

**Important:** The server stores `lobbyId` and `playerId` on the socket connection. All subsequent events (`assign_pokemon`, `ready`, `attack`) use this identity automatically — you do **not** need to send `lobbyId` or `playerId` again.

**Repeat for second player:** `{ "nickname": "PlayerTwo" }` — use a second Postman tab/window to simulate two clients.

---

### 2. rejoin_lobby (optional — after reconnect)

If the client **reconnects** (e.g. new tab, or socket dropped after switching apps), the new socket has no player context. Use `rejoin_lobby` to reattach this connection to the same player and lobby so you can continue with `assign_pokemon`, `ready`, or `attack` without starting over.

| Field | Value |
|-------|-------|
| **Event** | `rejoin_lobby` |
| **Payload** | `{ "playerId": "<player_id>", "lobbyId": "<lobby_id>" }` |

You must have obtained `playerId` and `lobbyId` from a previous successful `join_lobby` ack (or from your stored session). The player must belong to the lobby and the lobby must still be in `waiting`, `ready`, or `battling` (not `finished`).

**Ack (success):**
```json
{
  "player": { "id": "<player_id>", "nickname": "...", "lobbyId": "<lobby_id>" },
  "lobby": { "id": "<lobby_id>", "status": "waiting | ready | battling", "playerIds": [...], "readyPlayerIds": [], "createdAt": "..." }
}
```

**Ack (error):** `{ "error": { "code": "ValidationError|NotFoundError|ConflictError", "message": "..." } }` — e.g. missing playerId/lobbyId, player/lobby not found, player not in lobby, or lobby already finished.

**Server emits:** `lobby_status` with `{ lobby }`. The socket is joined to the lobby room and `socket.data.playerId` / `socket.data.lobbyId` are set, so subsequent `assign_pokemon`, `ready`, and `attack` work as usual.

**Test flow:** In Postman, complete `join_lobby` for one player and note the ack’s `player.id` and `lobby.id`. Disconnect the socket (or use a new tab), connect again, then emit `rejoin_lobby` with those ids. After a successful ack, you can send `attack` (if the battle was already in progress) or continue the flow from assign/ready.

---

### 3. assign_pokemon

Assigns a random team of 3 Pokémon to a player. Must be called once per player.

| Field | Value |
|-------|-------|
| **Event** | `assign_pokemon` |
| **Payload** | `{}` (empty object) |

The server identifies the player and lobby from the socket connection (set during `join_lobby`). No `lobbyId` or `playerId` needed in the payload.

**Ack (success):**
```json
{
  "team": {
    "id": "<team_id>",
    "lobbyId": "<lobby_id>",
    "playerId": "<player_id>",
    "pokemonIds": [1, 4, 7],
    "pokemonDetails": [
      { "pokemonId": 1, "name": "Bulbasaur", "sprite": "https://...", "type": ["Grass", "Poison"] },
      { "pokemonId": 4, "name": "Charmander", "sprite": "https://...", "type": ["Fire"] },
      { "pokemonId": 7, "name": "Squirtle", "sprite": "https://...", "type": ["Water"] }
    ]
  },
  "lobby": { "id": "<lobby_id>", "status": "waiting", "playerIds": [...], "readyPlayerIds": [], "createdAt": "..." }
}
```

**Ack (error):** `{ "error": { "code": "ConflictError", "message": "..." } }` — e.g. not enough available Pokémon, or lobby not waiting.

**Server emits:** `lobby_status` with `{ lobby }`

---

### 4. ready

Marks a player as ready. Both players must call this. When both are ready:

- Lobby `status` becomes `"ready"` and then transitions to `"battling"` internally.
- The server automatically starts the battle and emits a `battle_start` event with initial battle and Pokémon state.

| Field | Value |
|-------|-------|
| **Event** | `ready` |
| **Payload** | `{}` (empty object) |

The server identifies the player and lobby from the socket connection (set during `join_lobby`). No `lobbyId` or `playerId` needed in the payload.

**Ack (success):**
```json
{
  "lobby": {
    "id": "<lobby_id>",
    "status": "waiting | ready",
    "playerIds": ["<p1>", "<p2>"],
    "readyPlayerIds": ["<p1>", "<p2>"],
    "createdAt": "<iso_date>"
  }
}
```
When both players have sent `ready`, the second ack has `status: "ready"`. The server then starts the battle and emits `battle_start` (no extra ack for that).

**Ack (error):** `{ "error": { "code": "ConflictError", "message": "..." } }` — e.g. lobby full, or player not in lobby.

**Server emits:**

- `lobby_status` with `{ lobby }`
- **`battle_start`** (when both are ready) with:

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
      "id": "<state_id>",
      "battleId": "<battle_id>",
      "playerId": "<player_id>",
      "pokemonId": 1,
      "currentHp": 45,
      "defeated": false,
      "name": "Bulbasaur",
      "sprite": "https://...",
      "type": ["Grass", "Poison"]
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

- **Same connection or rejoin:** The server infers the attacker from the socket (`socket.data.playerId`). You must either send `join_lobby`, then `assign_pokemon`, then `ready` **on the same Socket.IO connection** before sending `attack`, or (after a reconnect) send `rejoin_lobby` with `{ playerId, lobbyId }` to restore context, then you can send `attack`. If you use a new tab or reconnect without joining or rejoining, `attack` will fail with "This connection has no player context".
- Turn order: the **first turn** is decided by the initial active Pokémon's Speed (tiebreaker: playerId). **After that, turns alternate** — only the player who did not attack last may send the next `attack`.
- If it is **not** this player's turn, the server returns a `ConflictError` ("Not this player's turn").
- If the battle has not started or already finished, the server returns an error.

**Ack (success):** same shape as the `turn_result` event. The server also emits `turn_result` to the room; the ack is the same payload.

```json
{
  "battleId": "<battle_id>",
  "lobbyId": "<lobby_id>",
  "attacker": {
    "playerId": "<attacker_id>",
    "pokemonId": 1,
    "name": "Bulbasaur",
    "sprite": "https://..."
  },
  "defender": {
    "playerId": "<defender_id>",
    "pokemonId": 4,
    "name": "Charmander",
    "sprite": "https://...",
    "damage": 12,
    "previousHp": 30,
    "currentHp": 18,
    "defeated": false
  },
  "nextActivePokemon": {
    "playerId": "<player_who_switched>",
    "pokemonId": 5,
    "name": "Squirtle",
    "sprite": "https://..."
  },
  "battleFinished": false,
  "nextToActPlayerId": "<player_id_who_attacks_next>"
}
```

- `nextToActPlayerId` is present when the battle is not finished; it indicates who must send the next `attack`.
- When a Pokémon is defeated and there is a next one, `nextActivePokemon.pokemonId`, `name`, and `sprite` are set; otherwise `pokemonId` is `null` and name/sprite are empty (e.g. when the battle ends).

**Ack (error):** On validation or conflict the server emits `error` and the ack receives:

```json
{
  "error": {
    "code": "ConflictError",
    "message": "Not this player's turn"
  }
}
```
Other possible codes: `ValidationError`, `NotFoundError`.

---

---

### 6. surrender (extra feature)

This event lets a player **give up** the current battle to avoid excessively long matches (for example, when damage is very low and HP is very high). It was added as an **extra implementation**, not part of the original project rules (similar to `rejoin_lobby`).

- A player can only surrender when the lobby is in **`battling`** state.
- The surrendering player **automatically loses**; the opponent is declared the winner.
- Pokémon states are **not** modified (their HP/defeated flags stay as they were at the moment of surrender).

| Field | Value |
|-------|-------|
| **Event** | `surrender` |
| **Payload** | `{ "lobbyId": "<lobby_id>" }` *(optional; the server also infers the lobby from the socket context and will reject a mismatching lobbyId)* |

**Ack (success):**

```json
{
  "battleId": "<battle_id>",
  "lobbyId": "<lobby_id>",
  "winnerId": "<opponent_player_id>",
  "loserId": "<surrendering_player_id>",
  "reason": "surrender",
  "lobby": {
    "id": "<lobby_id>",
    "status": "finished",
    "playerIds": ["<p1>", "<p2>"],
    "readyPlayerIds": ["<p1>", "<p2>"],
    "createdAt": "<iso_date>"
  }
}
```

**Ack (error):** `{ "error": { "code": "ValidationError|ConflictError|NotFoundError", "message": "..." } }` — e.g. player not in lobby, lobby not found, or lobby is not in `battling` state.

**Server emits:** `battle_end` with a payload that includes at least:

```json
{
  "battleId": "<battle_id>",
  "lobbyId": "<lobby_id>",
  "winnerId": "<opponent_player_id>",
  "loserId": "<surrendering_player_id>",
  "reason": "surrender"
}
```

This allows clients to distinguish between a normal victory (all opponent Pokémon defeated) and a victory by surrender, and immediately show appropriate UI or offer to start a new lobby.

---

## Ack summary (Client → Server)

| Event | Ack (success) | Ack (error) |
|-------|----------------|-------------|
| `join_lobby` | `{ player, lobby }` | `{ error: { code, message } }` |
| `rejoin_lobby` | `{ player, lobby }` | `{ error: { code, message } }` |
| `assign_pokemon` | `{ team, lobby }` — `team` has `pokemonIds` and `pokemonDetails` (name, sprite, type per Pokémon) | `{ error: { code, message } }` |
| `ready` | `{ lobby }` — includes `readyPlayerIds`, `status` ("waiting" or "ready") | `{ error: { code, message } }` |
| `attack` | Same as `turn_result` payload (attacker, defender, nextActivePokemon with name/sprite; damage, HP; nextToActPlayerId; battleFinished) | `{ error: { code, message } }` |
| `surrender` | `{ battleId, lobbyId, winnerId, loserId, reason, lobby }` | `{ error: { code, message } }` |

If the client does not pass an ack callback, the server still emits `error` on failure but there is no callback to receive the error payload.

---

## Server Events (Listen For)

| Event | When | Payload |
|-------|------|---------|
| `lobby_status` | After `join_lobby`, `rejoin_lobby`, `assign_pokemon`, or `ready` | `{ lobby, player? }` |
| `error` | On validation, conflict, or server error | `{ code, message }` |
| `battle_start` | When both players are ready and the battle is initialized | `{ battle, pokemonStates }` — `battle` includes `nextToActPlayerId`; each state has `name`, `sprite`, `type` |
| `turn_result` | After each valid `attack` | Same as the `attack` ack; includes attacker/defender/nextActivePokemon with name/sprite |
| `battle_end` | When a player has no remaining Pokémon **or when a player surrenders (extra feature)** | `{ battleId, lobbyId, winnerId, loserId?, reason? }` |

---

## Full Test Sequence

1. Connect to `http://localhost:8080`
2. Add listeners: `lobby_status`, `battle_start`, `turn_result`, `battle_end`, `error`
3. **join_lobby** with `{ "nickname": "PlayerOne" }` → save `lobby.id` and `player.id` from the ack
4. (Second tab) Connect, **join_lobby** with `{ "nickname": "PlayerTwo" }` → save both `playerIds`
5. **assign_pokemon** with `{}` on Player 1's connection
6. **assign_pokemon** with `{}` on Player 2's connection
7. **ready** with `{}` on Player 1's connection
8. **ready** with `{}` on Player 2's connection → lobby `status` becomes `"ready"`, server emits `battle_start` with initial battle state
9. Send **attack** events in turn order:
   - The **first** attack must come from the client whose `playerId` matches `battle_start.battle.nextToActPlayerId`
   - **After each attack**, the other player must attack next (turns alternate). Use `turn_result.nextToActPlayerId` to know whose turn it is.
   - Payload: `{ "lobbyId": "<lobby_id>" }`
   - Observe `turn_result` and, when appropriate, `battle_end` events
