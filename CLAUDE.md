# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running

There is no build, no package manager, no tests. Open `index.html` in any browser (double-click works) to play. Reload the page to pick up edits to `game.js`.

High score persists in `localStorage` under the key `skateHighScore`.

## Architecture

Single-file HTML5 Canvas game. Two files only:

- `index.html` — canvas element + minimal styling + `<script src="game.js">`. No DOM beyond the canvas and a hint banner.
- `game.js` — entire game: state, input, physics, rendering, score, persistence.

It is a side-view endless-runner skateboarding game. The skater auto-runs right and the player jumps over cars.

### Coordinate model (important)

`player.x` is a **world-space** coordinate that grows without bound as the player auto-runs right. The player is rendered at a fixed *screen* position (`PLAYER_X = W * 0.2`) by computing `cameraX = player.x - PLAYER_X` and drawing everything at `worldX - cameraX`. Cars are also stored in world space.

When adding new world objects, follow this same convention: store world x, draw at `x - cameraX`.

### Parallax / repeating-background gotcha

Background layers (mountains, clouds) and the lane stripes are drawn by iterating over a range of indices and rendering one element per index. The index **must** be derived from the element's stable world position, not from a local loop counter, otherwise per-element variation (e.g. cloud height) will visibly shift as the camera scrolls and `i` aliases to a different visible element. See `drawBackground` in `game.js` for the pattern (`firstCloud = Math.floor(cloudParallax / cloudSpacing)`).

### Game state machine

`gameState` is one of `STATE_READY` / `STATE_PLAYING` / `STATE_GAMEOVER`. `update()` early-returns unless `PLAYING`, so the world freezes on the title and game-over screens. All input goes through `tryAction()` which dispatches based on state: start, restart (after a 500ms `RESTART_DELAY_MS` lockout from `gameOverAt`), or jump.

### Input

Any keydown (with `e.repeat` filtered so holding a key fires once) or `mousedown` calls `tryAction()`. Pure modifier keys are filtered. There is no per-frame key polling — jumps are triggered directly from the event handler, so adding new actions means extending `tryAction`, not adding to a `keys` map.

### Cars

Spawned ahead of the player by `spawnCarsIfNeeded` whenever `nextSpawnX < player.x + 1500`, despawned when more than 200px behind. Collision is AABB; jumping clears the car when `player.y < GROUND_Y - car.h`. A car is scored as "jumped" the first frame the player is horizontally over it AND above its roof — score increments are guarded by `car.jumped` so each car counts at most once. First collision calls `endGame()`.

### Tuning knobs

Most game feel lives in the constants at the top of `game.js`: `GRAVITY`, `JUMP_POWER`, `AUTO_SPEED`, `PLAYER_X`, `RESTART_DELAY_MS`, plus `nextSpawnX` increments inside `spawnCarsIfNeeded` for car density.
