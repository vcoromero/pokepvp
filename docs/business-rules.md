# Business Rules — PokePVP

This document defines the canonical business rules for the application. It is implementation-agnostic and shall be used by both the backend (to implement behaviour) and the frontend (for validation, messages, and flow logic).

---

## 1. Pokémon Catalog

- The system shall retrieve the Pokémon catalog from an **external API**.
- **Base URL:** `https://pokemon-api-92034153384.us-central1.run.app/`
- **Endpoints:**
  - **List:** `GET /list` — returns a list of Pokémon with at least `id` and `name`.
  - **Detail:** `GET /list/:id` — returns full details for a single Pokémon.
- **Expected data model (detail):**
  - `id` (number)
  - `name` (string)
  - `type` (array of strings)
  - `hp`, `attack`, `defense`, `speed` (numbers)
  - `sprite` (string, URL)

---

## 2. Team Selection

- A player shall enter the lobby with a **trainer nickname only** (no other identity required at entry).
- Each player shall receive **exactly 3 Pokémon** assigned from the catalog.
- Assignment shall be **random** for each match.
- **Constraint:** No Pokémon may be repeated **between** the two players (each Pokémon in the match is assigned to exactly one player).
- A player shall be able to **confirm** that they are ready; the system shall not start the battle until both players have confirmed.

---

## 3. Lobby States

The lobby shall have exactly the following states:

| State      | Description |
|-----------|-------------|
| `waiting` | Two players are logged in; the system is waiting for both to mark themselves ready. |
| `ready`   | Both players have confirmed they are ready (battle may start). |
| `battling`| The battle has started and is in progress. |
| `finished`| The battle has ended and a winner has been declared. |

---

## 4. Battle Flow

- The battle shall **start automatically** when both players are in the **ready** state.
- **First turn:** The player whose **active Pokémon has the highest Speed** stat shall play first. If tied, the system shall define a deterministic rule (e.g. player order).
- **Subsequent turns:** Turns shall be **strictly sequential** — the player who did not attack in the previous turn shall attack next; only one attack may be processed at a time (turns alternate between the two players; Speed is not recalculated for later turns).
- Attacks shall be **triggered by the client** (e.g. a button); the client sends the action to the server.
- The server shall **process each attack atomically** before allowing the next turn (no concurrent turn processing).
- The system may use a **single lobby** that handles one match at a time (no requirement for multiple concurrent lobbies).

---

## 5. Damage and HP Calculation

- **Formula:**  
  `Damage = Attacker Attack - Defender Defense`
- If the result is **less than 1**, the damage shall be set to **1** (minimum damage rule).
- **HP update:**  
  `Defender Current HP = Defender Current HP - Damage`
- HP shall **never** go below **0**.

---

## 6. Defeat and Battle End

- When the defending Pokémon’s HP reaches **0**, that Pokémon is **defeated**.
- If the defending player has **another available Pokémon**, the next Pokémon shall **automatically** enter the battle (no client action required to “send” the next Pokémon).
- If the defending player has **no remaining Pokémon**, the battle shall **end** and the **winner** shall be **declared** (the attacking player wins).

---

## 7. Events (Client–Server Contract)

### Client → Server

| Event            | Purpose |
|------------------|--------|
| `join_lobby`     | Allows a player to enter the lobby (e.g. with nickname). |
| `assign_pokemon` | Requests assignment of the random Pokémon team for the player. |
| `ready`          | Indicates the player confirms their team and is ready to battle. If both are ready, lobby status becomes `battling` and server emits `battle_start`. |
| `attack`         | Indicates the player’s active Pokémon attacks the rival; server updates HP and emits `turn_result`. |

### Server → Client

| Event          | Purpose |
|----------------|--------|
| `lobby_status` | Synchronizes the current state of the lobby with all connected players. |
| `battle_start` | Signals that the battle has officially started (emitted when both players are ready). |
| `turn_result`  | Outcome of a single turn (e.g. damage dealt, remaining HP, and any defeat/switch). |
| `battle_end`   | Indicates that the battle has finished (e.g. with winner information). |

### Required Notifications

The system **must** notify players when:

- The battle starts.
- A turn result is resolved (including damage dealt and remaining HP).
- A Pokémon is defeated.
- A new Pokémon enters the battle.
- The battle ends and a winner is declared.

Additional notifications (e.g. turn changes, whose turn it is) are allowed and encouraged.

---

## 8. Persistence (Entities)

The following data shall be **persisted** (e.g. in MongoDB):

- **Player** — identity and association to lobby/team.
- **Lobby** — e.g. a single lobby allowing 2 players at a time.
- **Team selection** — which Pokémon are assigned to each player for the match.
- **Battle** — battle instance and link to lobby/players.
- **Pokémon state** — per Pokémon in the battle: current HP and defeated flag.
- **Battle status** — one of: `waiting`, `ready`, `battling`, `finished`.

---

*For backend architecture and technical design, see [architecture.md](architecture.md).*
