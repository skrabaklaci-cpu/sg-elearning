# Érettségi kaland: SG E-Learning

Ingyenes, játékosított érettségi-felkészítő webapp a Studium Generale Alapítvány számára.
Vite + vanilla JS, statikus build GitHub Pages-re, a Wix oldalon egy teljes magasságú iframe-ben fut.

A fejlesztési szabályok (arculat, mentés, tananyag, iframe) a [CLAUDE.md](CLAUDE.md)-ben vannak.

## Indítás

```bash
npm install
npm run dev          # http://127.0.0.1:5173
```

| Parancs | Mit csinál |
| --- | --- |
| `npm run dev` | fejlesztői szerver (telefonos teszthez a helyi hálózaton: `npm run dev -- --host`) |
| `npm run build` | statikus build a `dist/` mappába |
| `npm run preview` | a build kipróbálása |
| `npm test` | tesztek: játéklogika, mentés, tananyag-ellenőrzés, arculati színek |
| `npm run lint` | ESLint (tiltja a közvetlen tárhely-hívást a `src/storage/`-on kívül) |
| `npm run sprites` | a `sprites/` képeiből újragenerálja a sprite sheeteket (`-- --preview`: nagyított előnézet) |

Wix-szimuláció: `http://localhost:5173/iframe-test.html`. Az app itt cross-site iframe-ben fut,
ugyanúgy, mint a Wix oldalon.

## Tananyag szerkesztése

Minden tananyag a `src/data/` mappa JSON-fájljaiban van, kódot nem kell hozzá írni.
Mentés után a `npm test` jelzi, ha valami hibás (pl. nem létező helyes válasz vagy elírt érzelemnév).

- `math.json`, `history.json`, `economics.json`: egy-egy tárgy a leckéivel
  (a matek mind a 13 felkészítő témakört tartalmazza, a `Math/Slide PDFs` diasorai alapján)
- `characters.json`: a karakterek neve, titulusa és a reakció-mondataik
- `intro.json`: Csery bemutatkozása a kezdőképernyőn

Egy lecke felépítése:

```json
{
  "id": "math-01",
  "title": "A másodfokú egyenlet",
  "summary": "Rövid leírás a videó alá.",
  "video": { "youtubeId": "dQw4w9WgXcQ", "title": "A videó címe" },
  "slides": [
    { "title": "Dia címe", "body": "Szöveg…", "emotion": "thinking", "mentor": "A mentor megjegyzése (nem kötelező)" }
  ],
  "quiz": [
    { "question": "Kérdés?", "options": ["A", "B", "C", "D"], "answer": 1, "explanation": "Miért ez a jó válasz." }
  ]
}
```

- **Videó:** a `youtubeId` a YouTube-link `watch?v=` utáni 11 karaktere. Üresen hagyva a lecke
  „A videó hamarosan érkezik” kártyát mutat.
- **Kvíz:** 3–5 kérdés. Az `answer` a helyes válasz sorszáma **0-tól** számolva (az első válasz 0).
- **Szövegformázás:** `**félkövér**`, üres sor = új bekezdés, `• ` vagy `- ` kezdetű sor = felsorolás.
  HTML nem használható.
- **Érzelmek** (`emotion`): `neutral`, `happy`, `joyful`, `confident`, `thinking`, `surprised`,
  `sad`, `nervous`, `angry`.
- **Készülő lecke:** `{ "id": "math-02", "title": "…", "comingSoon": true }`. A leckelistában
  „Hamarosan” jelzéssel, zárva jelenik meg.

A leckék sorban nyílnak meg. A teljesítés feltétele a kvíz legalább 50%-os eredménye.
Az XP-jutalmak, a szintküszöbök, a szintnevek és a sorrendiség (`SEQUENTIAL_LESSONS`) a
`src/config/progression.js`-ben állíthatók.

## Képernyők

Kezdőképernyő (a kalauz köszöntője) → tárgyválasztó (matek, töri, közgazdaságtan) →
az adott tárgy leckelistája → lecke (videó, diák, kvíz, eredmény).

## Karakterek és sprite-ok

A `sprites/` mappában vannak a nyers, 3×3-as érzelemrácsok (guide, math, history, economics).
Az `npm run sprites` ezekből natív felbontású, átlátszó hátterű PNG-t készít a `src/assets/sprites/`
mappába: kivágja a cellákat, megkeresi a pixelrácsot, és eltávolítja a magenta hátteret.

A négy forráskép eltérő felbontású, ezért a szkript közös cellamagasságra hozza őket
(`TARGET_CELL_HEIGHT`): így minden karakter ugyanakkorának látszik a felületen.

Az érzelmek sorrendje a rácsban: `src/config/emotions.js` (`EMOTION_GRID`). Az is ott állítható
(`REACTIONS`), hogy melyik esemény (helyes válasz, hiba, szintlépés stb.) melyik arcot váltja ki.

## Mentés

Az állapot (XP, sorozat, leckék haladása) a `src/storage/index.js` adapterén át mentődik.
Jelenleg localStorage-ba, tartalékként memóriába, ha a böngésző az iframe-ben tiltja a tárhelyet.
A tervezett `wixAdapter` postMessage-dzsel küldi majd az adatot a Wix Velo kódnak.

## Deploy és Wix-beágyazás

1. GitHub-repó létrehozása, majd a `main` ágra push.
2. A repóban: **Settings → Pages → Source: GitHub Actions**. Minden push után a
   `.github/workflows/deploy.yml` lefuttatja a lintet, a teszteket és a buildet, majd kiteszi az oldalt.
3. Wix: **Embed Code → Embed a site**, a GitHub Pages címmel. Érdemes teljes szélességűre és teljes
   magasságúra húzni. Az app belül görget, és mobilon is kitölti az iframe-et.

## Betűtípus

A RocketSans woff2-fájljai (`src/assets/fonts/`) az arculati kézikönyv TTF-fájljaiból készültek
(400, 500, 700, 900-as vastagság), módosítás nélkül, csak tömörítve.
