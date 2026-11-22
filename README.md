# crimson-tide-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Baroosb/crimson-tide-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Baroosb/crimson-tide-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Crimson Tide Bay** — an original open-world crime game in vanilla JavaScript and Canvas (zero libraries, zero assets, zero network), set on a golden-hour island of nine named districts. Play Ruy Calder, a wheelman working off a debt to the fixer Marisol Vega: the premise is a debt, not a rampage, and the bay remembers — REP earned from work raises every rate you are paid and unlocks heavier iron.

**By the numbers**
- **8 story missions** — a courier pickup, a three-crate collection, a staged car theft, a timed night-deposit run, a harbour pickup that brings the sirens down on you, a two-drop race against the clock, a cross-island medicine run, and an armoured-van finale — then endless courier work with distance-based fares.
- **A dispatch-panel HUD, like the real thing** — every police unit is named and tracked live: MARLIN 4 — PURSUIT — 26 m, MURO 1 — ROADBLOCK, HALCÓN 1 — SPOTLIGHT, TIBURÓN 3 — RAMMING, with radio chatter under the panel and a bust meter when the law gets its hands on you.
- **5-star wanted system with real escalation** — named pursuit units; at **2 stars** the Policía Municipal throws **roadblocks** across the street ahead of you; at **3 stars** a **helicopter** joins and its spotlight never lets the heat cool; at **4 stars** the rifles come out.
- **4 named weapons in tiers** — La Comadre (pistol), Vendaval-9 (SMG), Trueno 12 (pump shotgun, 6 pellets), Petardos (grenades) — unlocked as your REP grows (Nadie → Conocido → Respetado → Leyenda de la Bahía, up to +25% pay). Cars shot or crashed to zero **catch fire and explode**, and explosions chain.
- **2 street races** — Vuelta al Faro (the whole island in one loop) and Circuito Coral (two tight laps downtown) against rival drivers, with checkpoints, live positions and best times saved.
- **3 radio stations** sequenced live on WebAudio while you drive — Radio Marea 98.1, Fuga FM 104.7, Ola Serena 91.3. Engine, sirens, gunfire and explosions are synthesized too; there is not one audio file in the game.
- **Taller Calder** — stop at Tito's workshop in a car: $150 repairs it fully and resprays it, and the law quietly loses a star. A respray that clears heat is a system, not a skin.
- **A city dressed for the golden hour** — long violet south-east shadows, parapets and rooftop props (AC units, skylights, water tanks, pools), named storefronts, crosswalks, parking lots, beach umbrellas, palms, a lighthouse — and driving that leaves evidence: skid marks, off-road dust, impact sparks, muzzle smoke, screen shake.
- **Screens with breadth** — a poster title screen with **3 save slots**, a full island map with named districts, markers and story completion %, pause, DETENIDO and ELIMINADO screens with real consequences (fines, hospital bills). Saves go to localStorage and autosave.

Controls: WASD/arrows move and drive · Shift sprint · F enter/leave a car · mouse aim, click/hold shoot · Q / 1–4 / wheel swap weapon · R radio · G garage (at the Taller, in a car) · E talk / start race · M map · P pause.

## Run it

```sh
node serve.ts   # then open http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=5hnf181h&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
