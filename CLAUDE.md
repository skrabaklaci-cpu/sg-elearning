# SG E-Learning: gamifikált érettségi-felkészítő

Ingyenes, játékosított e-learning webapp középiskolásoknak a Studium Generale Alapítvány számára.
Hangulata boot.dev-szerű RPG: XP, szintek, napi streak, mentorkarakterek. A felület nyelve **magyar**.

## Környezet

- Vite + vanilla JS (ES modulok). UI-keretrendszer (React, Vue, Svelte, Lit stb.) **nem** használható.
  Futásidejű npm-függőséget csak indokolt esetben veszünk fel.
- Statikus build, GitHub Pages-re deployolva (`.github/workflows/deploy.yml`, push a `main`-re).
  A `vite.config.js`-ben `base: './'`, így a repó neve nem számít.
- A kész app egy Wix oldalon, **egyetlen, teljes magasságú HTML embed iframe-ben** fut.

```bash
npm run dev       # fejlesztői szerver: http://localhost:5173
npm run build     # statikus build a dist/ mappába
npm run preview   # a build kipróbálása
npm test          # Vitest (játéklogika, storage, tartalom-ellenőrzés)
npm run lint      # ESLint, a tárhely-szabályt is ellenőrzi
npm run sprites   # sprites/ → src/assets/sprites/ újragenerálása
```

Változtatás után: `npm run lint && npm test && npm run build`, majd ellenőrzés 375 px széles nézetben
és az `iframe-test.html`-ben.

## Mappastruktúra

```
sprites/                  nyers karakterképek (NEM kerülnek a buildbe)
scripts/build-sprites.mjs nyers képek → natív felbontású, átlátszó PNG + cellaméretek
iframe-test.html          csak dev: az appot telefonméretű, cross-site iframe-be ágyazza
.github/workflows/        deploy.yml: lint + teszt + build → GitHub Pages
src/
  main.js                 indítás: állapot betöltése, globális rétegek (szintlépés, toast), router
  router.js               hash-router: #/, #/map, #/lesson/:id
  config/                 játékmenet-beállítások (fejlesztő szerkeszti)
    emotions.js           érzelem → rácscella, esemény → érzelem
    characters.js         karakter → sprite sheet, cellaméret, portré-kivágás
    progression.js        XP-jutalmak, szintküszöbök, szintnevek, teljesítési arány
  data/                   TANANYAG, csak JSON (tartalomszerkesztő szerkeszti)
    characters.json       nevek, titulusok, reakció-mondatok eseményenként
    intro.json            a kalauz bemutatkozó párbeszéde
    math.json  history.json  economics.json   világ ("type": "world") + leckék + diák + kvízek
  content/index.js        a data/*.json betöltése és ellenőrzése (validateContent)
  storage/                AZ EGYETLEN hely, ahol tárhelyhez nyúlunk
    index.js              save / load / reset + adapterválasztás
    localStorageAdapter.js
    memoryAdapter.js      tartalék, ha a localStorage nem elérhető
  state/
    store.js              központi állapot, akciók, játékesemények, késleltetett mentés
    schema.js             alapállapot, sémaverzió, migráció
    progress.js           XP, szint, streak, feloldás (tiszta függvények)
  components/             <sg-*> custom elementek + a saját .css-fájljuk, icons.js (pixel-ikonok)
  screens/                StartScreen, MapScreen, LessonScreen + a saját .css-fájljuk
  styles/                 tokens.css (színek, betű, pixel-egység), base.css, pixel.css
  assets/fonts/           RocketSans (woff2)
  assets/sprites/         GENERÁLT PNG-k + sprites.json (kézzel ne szerkeszd)
  lib/                    dom.js (h(), richText()), date.js (helyi dátum), util.js
  **/*.test.js            Vitest-tesztek a tesztelt modul mellett
```

## Kötelező szabályok

### 1. Mentés csak a storage adapteren át

- Tárhelyhez (localStorage, sessionStorage, IndexedDB, cookie, később postMessage) **kizárólag**
  a `src/storage/` nyúlhat. Máshol ez tilos, és az ESLint is jelzi.
- A `src/storage/index.js` interfészét csak a `src/state/store.js` hívja:
  - `load(): Promise<State | null>`: `null`, ha nincs mentés, sérült, vagy a tárhely nem elérhető.
  - `save(state): Promise<void>`: soha nem dob kivételt.
  - `reset(): Promise<void>`
- Az interfész **aszinkron**, mert a későbbi `wixAdapter` postMessage-dzsel, válaszra várva dolgozik.
  Ne írj olyan kódot, ami szinkron mentésre számít.
- Cross-site iframe-ben (Wix) a localStorage tiltott lehet: már a `window.localStorage` elérése is
  dobhat. Minden hozzáférés try/catch-ben van; hiba esetén memóriás tartalékra váltunk.
  Az app üres vagy sérült mentésből is hibátlanul indul.
- Az állapot JSON-szerializálható (dátum `YYYY-MM-DD` vagy ISO string, nincs Date, Map, függvény),
  és van `version` mezője. Sémaváltozáskor migráció a `src/state/schema.js`-ben; a betöltött
  adatot mindig az alapállapottal egyesítjük.
- Származtatott adatot nem mentünk (pl. a szintet az XP-ből számoljuk).

### 2. Tananyag csak JSON-ból

- Minden tananyag (világok, leckék, videók, diák, kvízek) és karakterszöveg (nevek, párbeszédek,
  reakciók) a `src/data/*.json` fájlokban van. A kódban nincs tananyag-szöveg; a UI-feliratok
  (gombok, címkék) maradhatnak a komponensekben.
- A JSON-okat a `src/content/index.js` tölti be (`import.meta.glob`) és ellenőrzi. Teszt is fut
  rájuk, így hibás tartalom (pl. nem létező helyes válasz vagy érzelemnév) nem jut ki deployra.
- A szövegekben nincs HTML. Tartalmat `innerHTML`-lel beszúrni tilos; `textContent` vagy `h()`.
- Új lecke = JSON-szerkesztés. Kódot csak új feladattípushoz kell írni.

### 3. Arculat

- Színek **kizárólag**: `#009EDC` (SG Blue), `#231F20` (Process Black), `#F0F0FF` („Sprite”),
  és csak a `src/styles/tokens.css` változóin át (`--sg-blue`, `--sg-black`, `--sg-light` és a
  belőlük kevert `--sg-*` árnyalatok). Máshol hex/rgb/hsl szín nem szerepelhet; ezt a
  `src/styles/palette.test.js` ellenőrzi. Átlátszóság vagy keverés csak e háromból (`color-mix`);
  köztes tónus helyett inkább pixel-dither mintát használj.
- Kontraszt: kék alapon mindig fekete szöveg (a világos szöveg kéken nem elég olvasható);
  világos alapon a kék szöveg helyett `--sg-blue-dark`.
- Nincs zöld/piros „helyes/hibás”: a visszajelzést ikon, szöveg és a mentor érzelme adja.
  Kivétel csak a karakter-sprite-ok és a YouTube-lejátszó saját színei.
- Betű: RocketSans (`src/assets/fonts/`, woff2), fallback `system-ui, sans-serif`.
  Külső betű- vagy CDN-kérés nincs.
- Pixel art UI: lépcsős sarkok, a `--px` egység többszöröseiben mért keretek, nincs
  `border-radius`, nincs elmosott árnyék. Animációk lehetőleg `steps()` időzítéssel.

### 4. Karakterek és sprite-ok

- Négy karakter: `guide` (fő kalauz), valamint `math`, `history`, `economics` (a tárgyi világok mentorai).
- Minden sprite sheet 3×3-as rács, soronként balról jobbra olvasva, mind a négyben azonos
  érzelemsorrenddel. A sorrendet a `src/config/emotions.js` `EMOTION_GRID` tömbje rögzíti.
  A kód mindig érzelemnevet használ, cellaindexet soha.
- Hogy melyik esemény (helyes válasz, hiba, szintlépés stb.) melyik érzelmet váltja ki, azt az
  `emotions.js` `REACTIONS` objektuma adja meg. Ne drótozd be a komponensekbe.
- Megjelenítés: `<sg-character character="math" emotion="happy">` (`src/components/Character.js`),
  CSS `background-position`-nel, `image-rendering: pixelated`-del, **csak egész számú nagyítással**
  (1×, 2×, 3×; `scale="auto"` = a legnagyobb egész, ami befér). Tört méretezés tilos, beleértve
  a tört `transform: scale()`-t, a %-os vagy `object-fit`-es méretezést.
- A nyers képek (`sprites/`) nem kerülnek a buildbe. Az `npm run sprites` állítja elő belőlük a
  natív felbontású, átlátszó hátterű PNG-ket és a cellaméreteket (`src/assets/sprites/`).
  A generált fájlokat commitoljuk, kézzel nem szerkesztjük. Csere után nézd át az
  `npm run sprites -- --preview` kimenetét (`.sprite-preview/`).
- A jelenlegi forrásképek JPG-k (magenta háttér, rácsvonalak), és karakterenként eltérő a
  pixelsűrűségük, ezért a natív cellaméret is eltér (kb. 57–71 × 82–110 px). A kódban soha ne
  feltételezz fix cellaméretet: mindig a `CHARACTERS[id].cellWidth/cellHeight` a mérvadó.
- Új vagy cserélt sprite ideális formája: PNG, átlátszó (vagy egyszínű `#FF00FF`) háttér,
  rácsvonal nélküli 3×3 rács, natív pixelméretben (vagy annak pontos egész többszörösében).

### 5. Iframe és mobil

- Mobile-first, 360 px szélességtől. Érintési célterület legalább 44×44 px.
  Széles kijelzőn a tartalom középre kerül, legfeljebb kb. 720 px szélesen.
- Az app kitölti az iframe-et (`html, body, #app { height: 100% }`) és **belül görget**;
  a szülőoldal görgetésére nem számítunk.
- Hash-alapú routing (`#/map`, `#/lesson/:id`): a GitHub Pages nem ad SPA-fallbacket, és
  iframe-ben is ez a megbízható.
- Tilos: `alert`/`confirm`/`prompt`, `window.top` navigáció, `target="_top"`.
  Külső link: `target="_blank" rel="noopener"`.
- YouTube: `youtube-nocookie.com`, és csak kattintásra töltődik be (előtte saját, arculati
  lejátszókártya). A felhasználók kiskorúak: adatvédelem és teljesítmény miatt is.
  Analitika vagy más külső kérés csak külön döntés után kerülhet be.
- Iframe-teszt: `http://localhost:5173/iframe-test.html`. Az iframe `127.0.0.1`-ről tölt, így
  cross-site környezetben (tárhely-tiltás, particionálás) is kipróbálható az app.

### 6. Akadálymentesség

- Valódi `<button>` elemek, jól látható fókuszkeret (`--sg-blue`), `prefers-reduced-motion` betartása.
- A karakter `role="img"` + `aria-label` (pl. „Kalauz, mosolyog”); a beszédbuborék és a
  kvíz-visszajelzés `aria-live="polite"`.
- `<html lang="hu">`, magyar tipográfia („idézőjel”, – gondolatjel).

## Kódkonvenciók

- Azonosítók, fájlnevek, route-ok angolul; kommentek és dokumentáció magyarul; a felület magyar.
- Újrahasznosítható komponens = custom element `sg-` előtaggal, light DOM-mal (Shadow DOM nélkül,
  hogy a globális pixel-stílusok érvényesüljenek), a saját CSS-fájlját importálva. Bemenet
  attribútum vagy property, kimenet `CustomEvent`. Takarítás (ResizeObserver, időzítők,
  feliratkozások) a `disconnectedCallback`-ben.
- Képernyő (`src/screens/`) = függvény, ami a gyökérbe renderel, és ha kell, takarító függvényt ad vissza.
- DOM-ot a `h()` segéddel építünk (`src/lib/dom.js`); JSON-szöveget a `richText()` formáz.
- Az állapotot csak a store akcióin át módosítjuk. A játéklogika (XP, szint, streak, feloldás)
  tiszta függvény a `src/state/progress.js`-ben, unit teszttel. A store játékeseményeket ad
  (`xp`, `levelup`, `streak`, `lesson-complete`); a felület ezekre animál.
- Minden játékszabály-szám (XP-jutalmak, szintküszöbök, szintnevek) a `src/config/progression.js`-ben.
- Streak: a készülék helyi naptári napja szerint (`src/lib/date.js`). Aktív nap = legalább egy
  befejezett tanulási lépés (elindított videó, végignézett diasor vagy befejezett kvíz).
  Kihagyott nap után a sorozat újraindul.

## Tervben (még nincs kész)

- `src/storage/wixAdapter.js`: postMessage-dzsel küldi az állapotot a Wix Velo kódnak
  (`$w('#html1').onMessage`), kérés–válasz azonosítóval és időkorláttal, hiba esetén helyi
  tartalékkal. Az adapter interfésze (save/load/reset) nem változik.
