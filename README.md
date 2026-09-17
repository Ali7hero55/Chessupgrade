# Chess — offline, single-file chess game

A complete chess game in **one self-contained HTML file**. No build step, no dependencies,
no network access. Open `chess.html` in any browser and play.

---

## Contents

```
chess.html              The entire game (969 KB, everything inline)
README.md               This file — architecture and how to work on it
assets/
  icon.png              512x512 app icon
  chess-icon.ico        multi-size icon (16..256) for desktop shortcuts
  pieces/               12 chess piece sprites extracted from a reference image
                        naming: w/b + k/q/r/b/n/p  e.g. wk.png = white king
previews/               rendered previews (see "Previews" below)
tests/                  node + jsdom smoke tests
```

---

## Running it

Just open `chess.html` — it works from `file://` with no server.

Two caveats when running from a local file:
- Some browsers block `localStorage` for `file://` pages. Player profiles, game history and
  settings then do not persist. The app detects this and shows a warning.
- Data is tied to the browser (and sometimes the file path). Moving the file may not carry
  profiles across browsers.

Serving over `http://localhost` avoids both.

---

## Architecture

Everything lives inline in `chess.html`:

- `<style>` — all CSS
- `<body>` — five screens: `#s-home`, `#s-game`, `#s-hist` (history), `#s-replay`, `#s-edit` (editor)
- `<script>` — the whole application, in this order:

| # | Section | What's in it |
|---|---------|--------------|
| 1 | Embedded sounds | `SND_B64` (11 base64 WAVs), `SFX` playback |
| 2 | Piece art | shape maps, `SETS`, `GRADS`, `buildDefs()`, `pieceSVG(type,color,set)` |
| 3 | Board themes | `THEMES`, `applyTheme()` |
| 4 | Chess engine | movegen, legality, SAN, evaluation, search |
| 5 | App core | `APP` state, `render()`, drag & drop, clocks, `applyMove()` |
| 6 | Move quality | `BOOK_LINES`, `attackers`, `sacrificeValue`, `classifyMove` |
| 7 | Screens | `showScreen`, home, setup, history, replay, editor, fullscreen |
| 8 | Init | `init()` — called at the very end |

### Key globals

| Name | Purpose |
|------|---------|
| `APP` | all UI + game state (mode, clocks, selection, settings) |
| `st` | the current position — the mutable engine state |
| `PROF` | player profiles (name, ELO, W/D/L) persisted in `localStorage` |
| `SETS` | piece sets: `casual`, `3d`, `classic`, `neon` |
| `SHAPES`, `SHAPES2`, `SHAPE_SETS` | piece shape functions per set |
| `THEMES` | board colour themes |
| `BOARDS` | registry of board DOM elements (`board`, `repBoard`, `edBoard`) |

### Board indexing — important

```
index 0..63,  0 = a8 (top-left from White's view),  63 = h1
row = i >> 3   (0 = rank 8)
col = i & 7    (0 = file a)
piece strings are two chars: 'wp' = white pawn, 'bk' = black king
```

### Engine API

```
parseFen(fen) -> state           pseudo(st,color) -> moves      legalMoves(st) -> moves
makeMove(st,m) -> undo           undoMove(st,m,undo)             inCheck(st,color)
toSAN(st,m,legal) -> string      gameStatus(st) -> {over,...}   evaluate(st) -> centipawns
searchRoot(st,depth) -> {move,score,completed}                  botMove(st, level)
```

A move object looks like:
`{from, to, piece, cap, capSq, promo, castle, epFlag, dbl}`

### Rendering model

`render()` is the single source of truth for the board. It:
1. reads the position and recomputes `APP.legal`
2. rebuilds each square's classes (selection, last move, hints, check, move-quality mark)
3. rewrites a square's inner HTML only when the piece there changes
4. refreshes the player strips, clocks, move list and evaluation

**Board flipping:** the whole board is rotated with CSS (`transform: rotate(180deg)`) and each
square's `.inner` layer counter-rotates so pieces and labels stay upright. Because of that,
coordinate labels are attached to each square by **its own true coordinates** — never by visual
position. (This was a real bug once: doing it by visual position moved every label to the wrong
square on flip.)

**Move animation:** a floating clone is created in a fixed-position layer and animated with the
Web Animations API from the source square's rect to the target's. The destination piece is hidden
until the flight lands. Knights get an arcing path.

---

## Feature summary

- Full rules: castling, en passant, promotion, plus checkmate / stalemate / 50-move / threefold /
  insufficient material
- Three piece sets + one classic (Casual 3D, 3D Glossy, Classic, Neon), six board themes
- Embedded sound pack (11 WAVs, base64) — move, capture, castle, check, checkmate, promote,
  win, lose, start, illegal, low-time tick
- Time controls (bullet → rapid, unlimited, custom) with real clocks, increment and flag
- One built-in computer opponent with Easy / Normal / Hard
- Player profiles: name, ELO, W/D/L. 2-player games rate both sides (win +8, draw +1, loss −4)
- Board editor: place/remove pieces, side to move, castling rights, FEN import/export
- Game history with replay (step through any finished game)
- Move classification: Brilliant / Great / Book / Blunder, with a board highlight and a badge
- Fullscreen mode that hides the chrome and enlarges the board, with a win-chance bar
- Drag & drop and click-to-move, undo, hint, resign, draw offer, flip, fullscreen

---

## How to add a new piece set

1. Write a shape map: `type -> function returning an SVG string`, using the tokens
   - `%H%` strong specular opacity, `%H2%` soft sheen, `%E%` edge colour, `%S%` sphere gradient
2. Add gradient stops to `GRADS`
3. Add an entry to `SETS`:
   ```js
   myset: { label: 'My Set',
            w: { g:'gradWhite', edge:'#888', h:.7, h2:.35 },
            b: { g:'gradBlack', edge:'#000', h:.6, h2:.3 } }
   ```
4. Register the shape map in `SHAPE_SETS`
5. It appears in the Pieces picker automatically (`Object.keys(SETS)` drives it)

## How to use the extracted piece sprites

`assets/pieces/*.png` are 12 transparent PNGs (~140x230). To use them as a piece set, base64 them
into the file and render them as `<img>` instead of SVG:
```js
const IMG = { wk:'data:image/png;base64,...', /* ... */ };
// in render(): '<img class="piece-img" src="' + IMG[p[0]+p[1]] + '">'
```
Scale every piece by the **same** factor so their relative sizes stay correct.

---

## Known issues / next steps

1. **The white pieces in `assets/pieces/` are reconstructed, not extracted.** The originals sat on
   cream squares in the reference image, and ivory-on-cream has almost no contrast, so no matting
   approach could separate them. The current whites reuse the black pieces' alpha with the material
   remapped to ivory — slightly flatter. Fix: obtain the white pieces on a dark/transparent
   background and re-extract. The black pieces ARE pixel-accurate.
2. **The in-game "Casual 3D" set is hand-drawn**, not the real reference models. `previews/`
   shows several iterations of the attempt.
3. **No Stockfish.** The engine is a plain alpha-beta with quiescence and piece-square tables, with
   iterative deepening and a time budget. It plays maybe club level, not superhuman.
4. The move-classification thresholds are heuristic. `classifyMove()` requires both searches to
   complete before labelling, specifically so a truncated search can't invent a fake blunder.

---

## Tests

`tests/` holds node + jsdom smoke tests. They need jsdom:

```bash
npm install jsdom
node tests/smoke.test.js
# if jsdom is installed elsewhere:
NODE_PATH=/path/to/node_modules node tests/smoke.test.js
```

They cover: the engine (perft), board rendering, all screens, drag/drop, promotion, checkmate,
clocks/flags, profiles + persistence across a "reload", board flipping, move classification,
the win-chance bar and fullscreen.

---

## Notable bugs already fixed (don't reintroduce these)

| Bug | Cause | Fix |
|-----|-------|-----|
| Coordinate labels jumped to the wrong squares when the board flipped | labels were positioned by **visual** position | attach them by each square's **true** coordinates; the CSS rotation handles the rest |
| A piece stayed semi-transparent after an aborted drag | inline `style.opacity` was set on drag start and the element was reused, so it was never cleared | drive the lift with a **state flag + CSS class**, and clear it on drop/abort |
| The computer sometimes moved after you started a new game | a pending `setTimeout` from the previous game | **generation counter** (`APP.gen`) - stale timers bail out |
| Only some legal moves appeared highlighted | hint dots were near-black and invisible on the near-black dark squares | per-square-colour contrast: white markers on dark squares |
| A flattened/duplicated block of functions | a bad patch duplicated several function definitions | verify with a function inventory before shipping |
| False "blunder" labels on good moves | a truncated search reported a bogus score | `classifyMove` requires **both searches to complete** and the position to be unchanged |
| Fullscreen looked cramped | the sidebar stole width and the eval bar was hidden with it | `body.fs` hides the chrome and sizes the board to the viewport, plus a win-chance bar above the board |

---

## Previews

| File | What it shows |
|------|---------------|
| `ingame_preview.png` | the extracted pieces on a mock-up of the real game board |
| `board_preview.png` | the opening position rendered with the game's own code |
| `pieces_preview.png` | all four built-in piece sets side by side |
| `extracted_pieces.png` | the 12 sprites in `assets/pieces/` |
| `reference_board.png`, `reference_zoom.png` | the reference art this was matched against |
| `shapes_only.png`, `shapes_angled.png` | silhouette iterations (shape, then camera angle) |
| `models_3d.png`, `model_v4.png`, `pieces_casual3d.png` | earlier hand-drawn 3D attempts |

---

## Notes for an AI coder picking this up

- The whole app is one `<script>`. Function declarations hoist so their order is flexible, but the
  `const`/`let` globals (`APP`, `SETS`, `PROF`, `st`) must exist before any function *runs*. `init()`
  at the very end is what starts everything.
- Do not add external `<script src>` or fetch anything — the whole point is that it works offline
  as a single file.
- When editing, keep the file as one unit. Splitting it breaks the desktop-shortcut workflow.
- Test with the engine's perft before touching move generation: start position must give
  20 / 400 / 8902 / 197281.
