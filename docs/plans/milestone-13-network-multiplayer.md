# Milestone 13: Network Multiplayer

**Goal:** Two players can play over the internet via WebSocket connection.

**Depends on:** Milestone 11 (AI Opponent — ensures full single-player game works first)

## Scope

### Network Architecture
- **WebSocket** replaces the original raw UDP sockets
- Client-server model: Player 1 hosts (authoritative), Player 2 connects
- Or: dedicated relay server for NAT traversal

### Message Protocol
Binary messages using TypedArrays (matching original `SerData` approach):

| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| PING / PONG | Both | Keepalive, latency measurement |
| START_MELEE | Host → Client | Game start signal |
| UPDATE_ENTITY | Both | Position, angle, velocity sync |
| SYNC_ENTITY | Host → Client | Full entity state (authoritative) |
| SYNC_MULTI_ENTITY | Host → Client | Batch entity sync |
| ADD_ENTITY | Host → Client | New bullet/snot spawned |
| EXPLODE_ENTITY | Host → Client | Entity destroyed |
| BULLET_HIT | Host → Client | Collision result |
| SYNC_WRAP | Host → Client | Wrap-around event |
| TIME_SYNC | Both | Clock synchronization |
| PLAYERS_ID | Host → Client | Map entity IDs to players |

### Entity Sync
- **Players** synced every 100ms (high priority)
- **Other entities** synced every 2000ms (low priority)
- Each sync message: `{ x, y, z, angle, accelVecX, accelVecY, accelVecZ }`
- Client interpolates between sync states using linear interpolation

### Latency Compensation
From original `CalcTemporalDistortion`:
1. Four-way time sync to measure round-trip latency
2. Client-side prediction for local player
3. Entity interpolation for remote entities
4. Temporal collision adjustment for swept-sphere detection

### Lobby System (simple)
- Host creates a game, gets a shareable URL or room code
- Client joins via URL/code
- WebSocket handshake establishes connection
- Both players confirm ready → game starts

### Signaling
Options:
1. **Simple relay server:** Node.js WebSocket server relays messages
2. **WebRTC data channel:** P2P with STUN/TURN for NAT traversal (lower latency, more complex)
3. **Third-party service:** e.g., Colyseus, Socket.io

### Message Size Budget
- Max message size: 1400 bytes (matching original)
- Max entities per message: 10
- Entity buffer limit: 1200 bytes per message

## Out of Scope
- More than 2 players
- Matchmaking system
- Anti-cheat
- Replay system
- Spectator mode

## Original C++ Reference
- `communication/RemoteMsg.h` — message type enum, binary format
- `communication/SerData.h/cpp` — binary serialization/deserialization
- `communication/CommController.h/cpp` — connection management
- `SceneMelee.cpp` — sync thresholds, temporal distortion, entity interpolation
