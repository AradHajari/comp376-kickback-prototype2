# Kickback

Recover three blue signal flags, then return to the evacuation jeep on the left. WASD or arrows move, the mouse aims, and holding click or Space fires the rifle. Every shot pushes the soldier backwards. R restarts; P pauses. Sound is optional. A three-step briefing and a 3–2–1 countdown precede the mission.

Blue-band soldier: the player, carrying a rifle. Red-band soldiers: enemies with knives; contact costs a heart. Enemies stay alive after attacking. New enemies enter away from the player, with a warning first.

Design question: Will players deliberately shoot into empty space to use recoil as a way to travel?

This is a separate exploration prototype. It tests movement through recoil, while Ping tested scans as decoys. The course asks for distinct exploration hypotheses; it does not require Prototype 2 to continue Prototype 1. Planned iteration begins in Week 9 after the team selects a group exploration game.

The field and sprites use native WebGL. `engine.js` contains movement, recoil, collision, flags, shots and enemy routing. `renderer.js` draws the field and sprite sheet; `game.js` handles input and the briefing/countdown. Lettering uses a second canvas.

The original pixel artwork is in `assets/sprites.svg`: soldiers, rifle, knife, flag, sandbags and jeep. One small 128 × 96 sprite texture is loaded once, and fixed terrain is uploaded once. No engine, external libraries, large images, accounts or analytics. Completed runs are kept locally in `window.kickbackRuns` for playtest notes.

Serve the folder with `python3 -m http.server 8766`, then visit http://localhost:8766. The hosting ZIP has index.html at its root and can be uploaded as an HTML game on itch.io.

AI assistance was used for code, SVG art and drafts. Review the source, hypothesis and course rules before submitting.
