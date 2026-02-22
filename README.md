# Kanji Shift (Prototype)

Browser puzzle prototype inspired by *Baba Is You*, using Japanese character blocks for rule sentences and kanji fusion.

## Stack
- Phaser 3
- TypeScript
- Vite

## Run
```bash
npm install
npm run dev
```

## Controls
- Arrow keys / WASD: Move
- Z: Undo
- R: Restart level
- N: Next tutorial level
- `~` / `` ` ``: Toggle debug overlay text on tiles

## Current Prototype Features
- Grid-based movement and pushing
- Rule parsing (`[NOUN] は [PROPERTY]`) horizontal + vertical
- Active rules HUD panel
- Win condition (`WIN` on contact)
- Undo / Restart
- Fusion recipe demo: `火 + 山 -> 火山`
- 5 tutorial levels

## Notes
- This is a vertical-slice scaffold with placeholder visuals (Phaser shapes + kanji text).
- The simulation engine is renderer-agnostic and can be expanded independently of the UI.
