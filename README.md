# Yamb 🎲

The classic Balkan dice game, as a fast static web app.

Built for the two most dedicated Yamb players I know — my parents — who were
playing it on a server running on my PC and politely refusing to let me ever
turn that PC off. Now it runs entirely in the browser instead.

**Play it:** works on any phone or desktop, no install, no account. After the
first visit it works fully offline, and you can add it to your home screen
like a regular app. Games autosave, so a phone call mid-turn loses nothing.

## Features

- Full Yamb scoresheet: Down / Free / Up / Call (najava) / Manual columns
- Live score previews on every playable cell, and an explanation when a cell isn't playable
- Undo for misclicks
- Offline-first PWA, installable on iOS and Android

## Tech

No framework, no build step — plain ES modules.

- `game.js` — pure game engine (rules, scoring, undo/redo), no DOM
- `ui.js` — rendering and input
- `test.js` — engine test suite (`node test.js`)
