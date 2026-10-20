# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Asteroids clone in plain HTML5 Canvas + vanilla JavaScript. No dependencies, no bundler, no package.json, no tests, no linter. The README and in-game text are in Spanish; keep UI strings and comments in Spanish.

## Running

Open `index.html` in a browser, or serve locally with `npx serve .` (http://localhost:3000). There is no build step.

## Architecture

All game logic lives in `game.js` (loaded as a classic script by `index.html`, `'use strict'`). `index.html` only provides the 800x600 `<canvas id="canvas">`; `W`/`H` constants in `game.js` must match the canvas size.

- **Game loop**: `loop(ts)` → `update(dt)` → `draw()`, with `dt` in seconds, clamped to 0.05 to avoid tunneling after tab pauses. All motion/timers are dt-based.
- **State machine**: global `state` is `'playing' | 'dead' | 'gameover'`. `update()` branches on it at the top; `'dead'` is a 2s respawn pause (`deadTimer`) where asteroids/particles keep moving, `'gameover'` restarts via Space (`initGame()`). Game state is module-level `let` globals (`ship, bullets, asteroids, particles, score, lives, level`), reset in `initGame()`/`nextLevel()`.
- **Entities** (`Bullet`, `Asteroid`, `Ship`, `Particle`) are classes with `update(dt)`/`draw()` and a `dead` flag; dead entities are filtered out of their arrays each frame rather than spliced in place. Asteroids are created via `split()` into `newAsteroids` and concatenated after the bullet-collision pass.
- **World is toroidal**: positions wrap with `wrap(v, max)`. Particles are the exception (they don't wrap).
- **Collisions** are circle-based using `dist()` and each entity's `radius`; ship-vs-asteroid uses `a.radius * 0.82` as forgiveness. The ship is immune while `ship.invincible > 0` (it blinks in `Ship.draw`).
- **Asteroid sizes** are 1/2/3 and index the parallel arrays `RADII`, `SPEEDS`, `POINTS` (index 0 unused). Adding a size or tuning means updating all three.
- **Input**: `keys[code]` for held keys; `pressed(code)` for edge-triggered, consume-once presses (used for Space so shooting is one bullet per press, with a 0.2s cooldown in `Ship.tryShoot`).
- Rendering is vector-style: white strokes on black, redrawn fully every frame.
