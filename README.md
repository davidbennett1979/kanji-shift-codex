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
- E: Toggle editor mode
- `[` / `]`: Cycle editor palette (when editor mode is on)
- Click: Place selected tile (editor)
- Right-click: Erase top tile in cell (editor)
- P: Export current level JSON to clipboard + console (editor)

## Current Prototype Features
- Grid-based movement and pushing
- Rule parsing (`[NOUN] は [PROPERTY]`) horizontal + vertical
- Expanded grammar: chained predicates (`... と ...`) and noun transforms (`[NOUN] は [NOUN]`)
- Active rules HUD panel
- Win condition (`WIN` on contact)
- Undo / Restart
- Fusion recipe demo: `火 + 山 -> 火山`
- Runtime-generated paper texture + synth SFX placeholders
- In-game level editor/debug mode (place/erase/export)
- 7 tutorial levels

## Notes
- This is a vertical-slice scaffold with placeholder visuals (Phaser shapes + kanji text).
- The simulation engine is renderer-agnostic and can be expanded independently of the UI.
