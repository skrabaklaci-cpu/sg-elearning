#!/usr/bin/env node
// Nyers karakterképek (sprites/*.jpg|png) → natív felbontású, átlátszó hátterű 3×3-as PNG sprite sheet
// és cellaméretek (src/assets/sprites/sprites.json).
//
// A forrásképek nagy felbontású, „pixel art stílusú” képek: magenta háttér, rácsvonalak a cellák között,
// és egy-egy art-pixel kb. 8–10 képpontnyi, karakterenként eltérő mérettel. A szkript:
//   1. megkeresi a rácsvonalakat, és kivágja a 3×3 cellát,
//   2. Fourier-elemzéssel megbecsüli az art-pixelek méretét (pitch) és a rács eltolását (fázis),
//   3. minden art-pixelből a közepe mediánját veszi (így a JPEG-zaj és a szélek elmosódása kimarad),
//   4. a magenta hátteret átlátszóvá teszi, a cellákat egymáshoz igazítja,
//   5. rácsvonal nélküli sheetet ír ki.
//
// Használat:  npm run sprites               (minden kép)
//             npm run sprites -- guide      (csak a megadott karakter)
//             npm run sprites -- --preview  (nagyított előnézet a .sprite-preview/ mappába)
import sharp from 'sharp';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(ROOT, 'sprites');
const OUT_DIR = path.join(ROOT, 'src/assets/sprites');
const PREVIEW_DIR = path.join(ROOT, '.sprite-preview');
const MANIFEST = path.join(OUT_DIR, 'sprites.json');
const GRID = 3;

/**
 * Közös cellamagasság art-pixelben.
 *
 * A négy forráskép eltérő felbontású (egy art-pixel 7,7–9,8 képpont), ezért natív méretben a
 * karakterek azonos nagyításnál is különböző méretűek lennének: Zsófi cellája 82, Ferkóé 110
 * art-pixel magas volt. A mintavételi rácsot ehhez a közös magassághoz igazítjuk, a képarányt
 * megtartva, így minden karakter ugyanakkorának látszik. `null` = natív méret.
 */
const TARGET_CELL_HEIGHT = 108;

const args = process.argv.slice(2);
const wantPreview = args.includes('--preview');
const only = args.filter((a) => !a.startsWith('--'));

// ---------------------------------------------------------------------------------------------
// Képpont-segédek

/**
 * Háttér: átlátszó, vagy (JPEG-zajjal együtt) világos magenta. A sötét, magentás árnyalatok
 * (a rajz szilvaszínű körvonalai) NEM háttér, azok a rajz részei.
 */
function isBackground(r, g, b, a) {
  if (a < 128) return true;
  const lo = Math.min(r, b), hi = Math.max(r, b);
  return lo >= 110 && lo - g > 0.55 * lo && hi - lo < 0.35 * hi;
}

function loadRaw(file) {
  return sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => ({ data, width: info.width, height: info.height }));
}

function pixel(img, x, y) {
  const i = (y * img.width + x) * 4;
  const d = img.data;
  return [d[i], d[i + 1], d[i + 2], d[i + 3]];
}

// ---------------------------------------------------------------------------------------------
// 1. Rácsvonalak és cellák

/**
 * Visszaadja a 3 cella [start, end) tartományát az adott tengelyen.
 * Rácsvonal = olyan sor/oszlop, amiben alig van háttér, és ≥97%-a egyszínű sötét vagy világos.
 * (A karakterek ruhája is lehet egyszínű egy soron át, de sosem ≥97%-ban.)
 */
function findCellRanges(img, axis) {
  const len = axis === 'x' ? img.width : img.height;
  const other = axis === 'x' ? img.height : img.width;
  const gutter = new Array(len);
  for (let i = 0; i < len; i++) {
    let bg = 0, dark = 0, light = 0;
    for (let j = 0; j < other; j++) {
      const [r, g, b, a] = axis === 'x' ? pixel(img, i, j) : pixel(img, j, i);
      if (isBackground(r, g, b, a)) bg++;
      else if (r < 70 && g < 70 && b < 70) dark++;
      else if (r > 200 && g > 200 && b > 200) light++;
    }
    gutter[i] = bg / other < 0.01 && Math.max(dark, light) / other > 0.97;
  }

  const ranges = [];
  let start = -1;
  for (let i = 0; i <= len; i++) {
    const isGutter = i === len || gutter[i];
    if (!isGutter && start < 0) start = i;
    if (isGutter && start >= 0) {
      ranges.push([start, i]);
      start = -1;
    }
  }
  const cells = ranges.filter(([s, e]) => e - s > len / (GRID * 2));

  // Rácsvonal nélküli (tiszta) sheet: egyenlő részekre osztjuk.
  if (cells.length === 1 && cells[0][1] - cells[0][0] > len * 0.9) {
    const step = len / GRID;
    return Array.from({ length: GRID }, (_, k) => [Math.round(k * step), Math.round((k + 1) * step)]);
  }
  if (cells.length !== GRID) {
    throw new Error(`${axis} tengelyen ${cells.length} cellát találtam ${GRID} helyett: ${JSON.stringify(cells)}`);
  }
  // A rácsvonal melletti, JPEG-től elmosott képpontokat levágjuk.
  const inset = 2;
  return cells.map(([s, e]) => [s + (s > 0 ? inset : 0), e - (e < len ? inset : 0)]);
}

// ---------------------------------------------------------------------------------------------
// 2. Art-pixel méret (pitch) és fázis

/** Gradiens-energia profil: minden szomszédos oszlop- (vagy sor-) pár közti színkülönbség összege. */
function gradientProfile(img, rect, axis) {
  const [x0, x1, y0, y1] = rect;
  const out = [];
  if (axis === 'x') {
    for (let x = x0; x < x1 - 1; x++) {
      let e = 0;
      for (let y = y0; y < y1; y++) {
        const a = pixel(img, x, y), b = pixel(img, x + 1, y);
        e += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
      }
      out.push(e);
    }
  } else {
    for (let y = y0; y < y1 - 1; y++) {
      let e = 0;
      for (let x = x0; x < x1; x++) {
        const a = pixel(img, x, y), b = pixel(img, x, y + 1);
        e += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
      }
      out.push(e);
    }
  }
  const mean = out.reduce((s, v) => s + v, 0) / out.length;
  return out.map((v) => v - mean);
}

/** Komplex Fourier-együttható a megadott periódusnál. */
function fourier(signal, period) {
  let re = 0, im = 0;
  for (let i = 0; i < signal.length; i++) {
    const t = (2 * Math.PI * i) / period;
    re += signal[i] * Math.cos(t);
    im -= signal[i] * Math.sin(t);
  }
  return { re, im, mag: Math.hypot(re, im) };
}

/** A sheet összes cellájának spektrumát összegezve megkeresi a legerősebb periódust. */
function estimatePitch(profiles, lo = 4, hi = 20) {
  let best = lo, bestMag = -1;
  for (let p = lo; p <= hi; p += 0.01) {
    let mag = 0;
    for (const s of profiles) mag += fourier(s, p).mag;
    if (mag > bestMag) {
      bestMag = mag;
      best = p;
    }
  }
  return Math.round(best * 100) / 100;
}

/**
 * A profil i. eleme az (start+i) és (start+i+1) képpont közti határt írja le, azaz a start+i+1 koordinátát.
 * Visszaadja az első art-pixel-határ koordinátáját a cella elejétől mérve (0 ≤ φ < p).
 */
function estimatePhase(profile, pitch) {
  const { re, im } = fourier(profile, pitch);
  let phi = (-Math.atan2(im, re) * pitch) / (2 * Math.PI);
  phi = ((phi % pitch) + pitch) % pitch;
  return 1 + phi;
}

// ---------------------------------------------------------------------------------------------
// 3. Mintavétel

function median(values) {
  const s = values.slice().sort((a, b) => a - b);
  return s[s.length >> 1];
}

/** Egy cella art-pixeleinek középpontjai egy tengelyen: csak azok, amelyek közepe a cellába esik. */
function blockStarts(start, end, pitch, phase) {
  const starts = [];
  let b = start + phase;
  while (b - pitch + pitch / 2 >= start) b -= pitch;
  for (; b + pitch / 2 < end; b += pitch) {
    if (b + pitch / 2 >= start) starts.push(b);
  }
  return starts;
}

function sampleCell(img, rect, pitchX, pitchY, phaseX, phaseY) {
  const [x0, x1, y0, y1] = rect;
  const xs = blockStarts(x0, x1, pitchX, phaseX);
  const ys = blockStarts(y0, y1, pitchY, phaseY);
  const w = xs.length, h = ys.length;
  const out = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) {
    const ya = Math.max(y0, Math.ceil(ys[j] + pitchY * 0.25));
    const yb = Math.min(y1 - 1, Math.floor(ys[j] + pitchY * 0.75));
    for (let i = 0; i < w; i++) {
      const xa = Math.max(x0, Math.ceil(xs[i] + pitchX * 0.25));
      const xb = Math.min(x1 - 1, Math.floor(xs[i] + pitchX * 0.75));
      const rs = [], gs = [], bs = [];
      let bg = 0, n = 0;
      for (let y = ya; y <= yb; y++) {
        for (let x = xa; x <= xb; x++) {
          const [r, g, b, a] = pixel(img, x, y);
          n++;
          if (isBackground(r, g, b, a)) bg++;
          else {
            rs.push(r);
            gs.push(g);
            bs.push(b);
          }
        }
      }
      const o = (j * w + i) * 4;
      if (n === 0 || bg * 2 >= n) continue; // átlátszó marad
      out[o] = median(rs);
      out[o + 1] = median(gs);
      out[o + 2] = median(bs);
      out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

// ---------------------------------------------------------------------------------------------
// 4. Tisztítás és igazítás

/** Eltávolítja a háttérben maradt, legfeljebb `maxSize` art-pixelnyi foltokat (JPEG-maradványok). */
function removeSpecks(cell, maxSize = 3) {
  const { width: w, height: h, data } = cell;
  const seen = new Uint8Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || data[start * 4 + 3] === 0) continue;
    const stack = [start], blob = [];
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop();
      blob.push(p);
      const x = p % w, y = (p / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (!seen[q] && data[q * 4 + 3] !== 0) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    if (blob.length <= maxSize) for (const p of blob) data[p * 4 + 3] = 0;
  }
}

/**
 * Kitölti a legfeljebb `maxSize` art-pixelnyi, körbezárt átlátszó lyukakat (pl. a hajban átütő
 * háttér) a szomszédos képpontok mediánjával.
 */
function fillHoles(cell, maxSize = 4) {
  const { width: w, height: h, data } = cell;
  const seen = new Uint8Array(w * h);
  const isClear = (p) => data[p * 4 + 3] === 0;
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || !isClear(start)) continue;
    const stack = [start], region = [];
    let touchesBorder = false;
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop();
      region.push(p);
      const x = p % w, y = (p / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (!seen[q] && isClear(q)) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    if (touchesBorder || region.length > maxSize) continue;
    for (const p of region) {
      const x = p % w, y = (p / w) | 0;
      const rs = [], gs = [], bs = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = (ny * w + nx) * 4;
          if (data[q + 3] === 0) continue;
          rs.push(data[q]);
          gs.push(data[q + 1]);
          bs.push(data[q + 2]);
        }
      }
      if (rs.length === 0) continue;
      data[p * 4] = median(rs);
      data[p * 4 + 1] = median(gs);
      data[p * 4 + 2] = median(bs);
      data[p * 4 + 3] = 255;
    }
  }
}

/** A cella alakjának (alfa-maszk) egyezése a referenciával adott eltolásnál. */
function overlap(ref, cell, dx, dy, w, h) {
  let score = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x - dx, sy = y - dy;
      const a = x < ref.width && y < ref.height && ref.data[(y * ref.width + x) * 4 + 3] > 0;
      const b = sx >= 0 && sy >= 0 && sx < cell.width && sy < cell.height && cell.data[(sy * cell.width + sx) * 4 + 3] > 0;
      if (a && b) score++;
      else if (a !== b) score--;
    }
  }
  return score;
}

/** Úgy tolja el a cellákat (±3 art-pixel), hogy a sziluettjük fedje az első (semleges) cellát. */
function alignCells(cells, w, h) {
  const ref = cells[0];
  return cells.map((cell, idx) => {
    if (idx === 0) return { dx: 0, dy: 0 };
    let best = { dx: 0, dy: 0, score: -Infinity };
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const score = overlap(ref, cell, dx, dy, w, h);
        if (score > best.score) best = { dx, dy, score };
      }
    }
    return { dx: best.dx, dy: best.dy };
  });
}

// ---------------------------------------------------------------------------------------------
// 5. Egy sheet feldolgozása

async function processSheet(file) {
  const img = await loadRaw(file);
  const cols = findCellRanges(img, 'x');
  const rows = findCellRanges(img, 'y');
  const rects = [];
  for (const [y0, y1] of rows) for (const [x0, x1] of cols) rects.push([x0, x1, y0, y1]);

  // Tiszta, natív felbontású forrás (kis cellák): nincs újramintavételezés.
  const native = cols[0][1] - cols[0][0] < 200;
  let pitchX = 1, pitchY = 1;
  let profilesX = [], profilesY = [];
  if (!native) {
    profilesX = rects.map((r) => gradientProfile(img, r, 'x'));
    profilesY = rects.map((r) => gradientProfile(img, r, 'y'));
    pitchX = estimatePitch(profilesX);
    pitchY = estimatePitch(profilesY);
  }

  // A rács kezdetét (fázist) mindig a valódi, natív osztásból számoljuk: a közös méretre igazítás
  // csak a lépésközt (pitch) változtatja, a rács így a rajz szélétől indul.
  const phases = rects.map((r, k) =>
    native ? { x: 0, y: 0 } : { x: estimatePhase(profilesX[k], pitchX), y: estimatePhase(profilesY[k], pitchY) },
  );

  let resampleFactor = 1;
  if (!native && TARGET_CELL_HEIGHT) {
    const sourceHeight = rows.reduce((sum, [y0, y1]) => sum + (y1 - y0), 0) / rows.length;
    resampleFactor = TARGET_CELL_HEIGHT / (sourceHeight / pitchY);
    pitchX /= resampleFactor;
    pitchY /= resampleFactor;
  }

  const cells = rects.map((r, k) =>
    native ? sampleCell(img, r, 1, 1, 0, 0) : sampleCell(img, r, pitchX, pitchY, phases[k].x, phases[k].y),
  );
  if (!native) {
    for (const c of cells) {
      removeSpecks(c);
      fillHoles(c);
    }
  }

  const fullW = Math.max(...cells.map((c) => c.width));
  const fullH = Math.max(...cells.map((c) => c.height));
  const shifts = alignCells(cells, fullW, fullH);
  const aligned = cells.map((cell, k) => shiftCell(cell, shifts[k], fullW, fullH));

  // Az igazítás (és az eltérő cellaméret) üres szélső sorokat/oszlopokat hagyhat. Mivel a mellképek
  // alul és oldalt kifutnak a cellából, ezeket minden cellából egyformán levágjuk.
  const crop = { left: 0, right: 0, bottom: 0 };
  for (const c of aligned) {
    crop.left = Math.max(crop.left, emptyEdge(c, 'left'));
    crop.right = Math.max(crop.right, emptyEdge(c, 'right'));
    crop.bottom = Math.max(crop.bottom, emptyEdge(c, 'bottom'));
  }
  const cellWidth = fullW - crop.left - crop.right;
  const cellHeight = fullH - crop.bottom;

  // Összerakás rácsvonal nélküli sheetté.
  const sheetW = cellWidth * GRID, sheetH = cellHeight * GRID;
  const sheet = new Uint8Array(sheetW * sheetH * 4);
  aligned.forEach((cell, k) => {
    const ox = (k % GRID) * cellWidth, oy = Math.floor(k / GRID) * cellHeight;
    for (let y = 0; y < cellHeight; y++) {
      for (let x = 0; x < cellWidth; x++) {
        const si = (y * fullW + x + crop.left) * 4, di = ((oy + y) * sheetW + ox + x) * 4;
        for (let c = 0; c < 4; c++) sheet[di + c] = cell.data[si + c];
      }
    }
  });

  return { sheet, sheetW, sheetH, cellWidth, cellHeight, pitchX, pitchY, shifts, crop, resampleFactor };
}

/** A cellát eltolja, és egységes w×h méretű pufferbe teszi. */
function shiftCell(cell, { dx, dy }, w, h) {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x - dx, sy = y - dy;
      if (sx < 0 || sy < 0 || sx >= cell.width || sy >= cell.height) continue;
      const si = (sy * cell.width + sx) * 4, di = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) out[di + c] = cell.data[si + c];
    }
  }
  return { width: w, height: h, data: out };
}

/**
 * Hány sor/oszlop „üres” az adott szélen: oldalt a teljesen átlátszó oszlopok,
 * alul azok a sorok, amelyeknek kevesebb mint a fele látható (a mellkép alja kifutó kell legyen).
 */
function emptyEdge(cell, side) {
  const { width: w, height: h, data } = cell;
  const opaque = (x, y) => data[(y * w + x) * 4 + 3] > 0;
  let n = 0;
  if (side === 'bottom') {
    for (let y = h - 1; y >= 0; y--, n++) {
      let count = 0;
      for (let x = 0; x < w; x++) if (opaque(x, y)) count++;
      if (count * 2 >= w) break;
    }
    return n;
  }
  for (let i = 0; i < w; i++, n++) {
    const x = side === 'left' ? i : w - 1 - i;
    let any = false;
    for (let y = 0; y < h && !any; y++) any = opaque(x, y);
    if (any) break;
  }
  return n;
}

// ---------------------------------------------------------------------------------------------

async function main() {
  const files = (await readdir(SRC_DIR))
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .filter((f) => only.length === 0 || only.includes(path.parse(f).name));
  if (files.length === 0) throw new Error(`Nincs feldolgozható kép: ${SRC_DIR}`);

  await mkdir(OUT_DIR, { recursive: true });
  const manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : { sheets: {} };

  for (const f of files) {
    const id = path.parse(f).name;
    const r = await processSheet(path.join(SRC_DIR, f));
    const png = sharp(Buffer.from(r.sheet), { raw: { width: r.sheetW, height: r.sheetH, channels: 4 } });
    await png.clone().png({ compressionLevel: 9, palette: true, colours: 128, dither: 0, effort: 10 }).toFile(path.join(OUT_DIR, `${id}.png`));

    manifest.sheets[id] = {
      file: `${id}.png`,
      columns: GRID,
      rows: GRID,
      cellWidth: r.cellWidth,
      cellHeight: r.cellHeight,
    };
    console.log(
      `${id.padEnd(10)} cella ${r.cellWidth}×${r.cellHeight}  sheet ${r.sheetW}×${r.sheetH}  ` +
        `közös méretre ×${r.resampleFactor.toFixed(2)}  ` +
        `eltolások ${r.shifts.map((s) => `${s.dx},${s.dy}`).join(' ')}  ` +
        `vágás b${r.crop.left} j${r.crop.right} a${r.crop.bottom}`,
    );

    if (wantPreview) {
      await mkdir(PREVIEW_DIR, { recursive: true });
      const scale = 4;
      for (const [name, background] of [['light', '#F0F0FF'], ['dark', '#231F20']]) {
        await sharp(path.join(OUT_DIR, `${id}.png`))
          .resize({ width: r.sheetW * scale, kernel: 'nearest' })
          .flatten({ background })
          .toFile(path.join(PREVIEW_DIR, `${id}@${scale}x-${name}.png`));
      }
    }
  }

  const sorted = Object.fromEntries(Object.entries(manifest.sheets).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(MANIFEST, JSON.stringify({ generatedBy: 'scripts/build-sprites.mjs', sheets: sorted }, null, 2) + '\n');
  console.log(`Kész: ${path.relative(ROOT, OUT_DIR)}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
