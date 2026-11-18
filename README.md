# Summit Maze

Satirische first-person doolhofgame (Three.js + Vite). Eet alle bolletjes op drie wereldtoppen en ontwijk Poetsin, Trumpf, Kim Jong-Oen en Rob Tetten.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # productiebuild in dist/
```

**Besturing:** WASD/pijltjes lopen · muis kijken (klik voor pointer lock) · ESC pauze · M geluid aan/uit · G graphics hoog/snel

## Structuur

| Bestand | Inhoud |
|---|---|
| `levels/level*.json` | Grids (`#` muur, `.` bolletje, `o` sanctiepakket, `M` spiegel, `P` speler, `1/2/3/4` monsters), thema en moeilijkheid |
| `src/main.js` | Game-loop, levels, levens, power-up, botsingen, schermen |
| `src/maze.js` | Grid parsen, 3D-opbouw, bolletjes, tijdelijke (geannexeerde) muren, zichtlijn |
| `src/pathfinding.js` | A* op het grid |
| `src/player.js` | First-person camera, WASD, muis, botsing met muren |
| `src/minimap.js` | Minimap met fog of war, monsters alleen als ze in zicht zijn |
| `src/mirrors.js` | Reflector-spiegels (max. 4 tegelijk actief), zicht via spiegel |
| `src/projectiles.js` | Kims projectielen, terugkaatsen op spiegels, verdoving |
| `src/monsters/base.js` | Gedeelde monsterlogica: grid-beweging, schrik/opgegeten/verdoofd, alertheid |
| `src/monsters/poetsin.js` · `trumpf.js` · `kim.js` · `rob.js` | Figuur, gedrag en quotes per monster |
| `src/hud.js` · `src/audio.js` | HUD/overlays · Web Audio-geluiden |
| `src/effects.js` | Sterrenhemel, zwevend stof, paddenstoelwolk bij botsende monsters |

## Een level toevoegen

Zet een nieuw `levels/level4.json` neer met dezelfde velden. Levels worden op bestandsnaam gesorteerd geladen. De rand moet uit `#`/`M` bestaan en alle open cellen moeten vanaf `P` bereikbaar zijn.

## Rob Tetten en de eco-zone

Rob (`4` in het grid) probeert je de pas af te snijden: hij mikt op een cel een paar stappen vóór je in plaats van op jezelf. Om de `ecoInterval` seconden legt hij een eco-zone neer (straal 2 cellen, max. 2 tegelijk) die `ecoDuration` seconden blijft liggen. Ben je dichtbij, dan legt hij hem op zijn eigen plek, anders op een kruispunt vlak bij jou. In de zone loop je op `ecoSlow` × je normale snelheid. Monsters hebben er geen last van. Die drie waarden staan per level in `difficulty`.

## Diplomatieke incidenten

Botsen twee monsters, dan volgt er een paddenstoelwolk (16 eenheden hoog, dus boven de muren uit te zien), een schokgolf, een dreun en schuddend beeld; hoe dichterbij, hoe heftiger. Beide monsters staan 5 seconden zwartgeblakerd stil en zijn dan ongevaarlijk. Daarna zijn ze 12 seconden immuun voor een nieuwe botsing (`CRASH_STUN` / `CRASH_COOLDOWN` in `src/main.js`).

## Graphics

Bloom (UnrealBloomPass), ACES-tonemapping, open sterrenhemel in de levelkleuren, zwevend stof, contactschaduwen en een vignet. Hapert het: druk **G** om bloom en stof uit te zetten.
