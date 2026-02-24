# Multi-Ship Lives (Fleet System) Design

## Summary

P1 has a fleet consisting of all ships in CHARACTER_REGISTRY. Each time P1 dies, they return to the selection screen to pick their next ship (excluding already-used ones). The AI opponent that killed them persists. Game over only when P1 exhausts all ships.

## Game Flow

1. P1 selects first ship on selection screen → fights random AI opponent (unchanged)
2. **P1 wins** → gauntlet auto-advance to next random AI (unchanged)
3. **P1 loses** → explosion plays (1500ms delay) → check unused ships remaining
   - **Ships remaining** → return to selection screen with used ships greyed out → P1 picks next ship → re-fight same AI opponent (full health)
   - **No ships remaining** → game over, return to menu

## State Changes

### New state in main.ts
- `usedP1Ships: Set<string>` — ship IDs that P1 has already lost with
- `currentP2Def: CharacterDef | null` — already partially tracked, formalize to persist across P1 deaths

### Modified transitions
- On P1 death with ships remaining: `playing` → brief `gameOver` (explosion delay) → `selection`
- On P1 death with no ships remaining: `playing` → `gameOver` → `menu` (current behavior)
- On P1 win: unchanged (gauntlet auto-advance)

### Selection screen modifications
- Grey out / disable navigation to used ships
- Show remaining ship count (e.g., "2 ships remaining")
- Skip used ships when navigating with arrow keys

## What stays the same
- P1 win → gauntlet auto-advance
- All AI ships defeated → victory
- Explosion delay timing (1500ms)
- Selection screen controls (arrow keys + enter)
- No HUD changes during gameplay
- AI opponent roster tracking for gauntlet wins
