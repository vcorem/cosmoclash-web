# Opening Screen & Main Menu Design

**Goal:** Add a logo splash and main menu before character selection, matching the original C++ game flow.

**Flow:** Logo splash (5s) → Main menu (background art + "Play") → Character selection → Melee → Game over → Main menu

## Logo Splash
- Full-screen `logo.jpg` (PixtaZy Presents) on white/cream background
- 1000ms fade-in, 3000ms hold, 1000ms fade-out (matches original SceneMenu timing)
- Click or keypress skips immediately to main menu

## Main Menu
- Full-screen `main-bk.jpg` as background (CosmoClash artwork with ships and sun)
- Single "Play" button centered near bottom
- Space-themed styling (glow, matching SelectionUI aesthetic)

## State Flow
`GameState`: `'logo' | 'menu' | 'selection' | 'playing' | 'gameOver'`

Game over returns to main menu (not selection), matching original's flow back to ST_MENU.

## Implementation Approach
- HTML/CSS overlays for logo and menu (same pattern as HUD/SelectionUI)
- No Three.js rendering during logo/menu states — just HTML on dark/image background
- New files: `src/ui/LogoSplash.ts`, `src/ui/MainMenu.ts`, CSS files
- Modify `main.ts` to add logo/menu states before selection
