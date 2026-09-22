// Az arculati szabály gépi ellenőrzése: színkód csak a tokens.css-ben szerepelhet,
// és ott is csak a három arculati szín.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const TOKENS = join(SRC, 'styles', 'tokens.css');
const BRAND = ['#009edc', '#231f20', '#f0f0ff'];

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(css|js)$/.test(name) && !name.endsWith('.test.js') ? [path] : [];
  });
}

const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi;
const NAMED_COLOR = /:\s*(?:white|black|red|green|blue|gray|grey|yellow|orange|purple|pink)\b/gi;

describe('arculati színek', () => {
  it('a tokens.css csak a három arculati színt definiálja', () => {
    const hexes = readFileSync(TOKENS, 'utf8').match(/#[0-9a-f]{3,8}\b/gi) ?? [];
    expect(hexes.length).toBeGreaterThan(0);
    for (const hex of hexes) expect(BRAND).toContain(hex.toLowerCase());
  });

  it('máshol nincs színkód (csak a tokenek változói)', () => {
    const offenders = [];
    for (const file of files(SRC)) {
      if (file === TOKENS) continue;
      const text = readFileSync(file, 'utf8');
      for (const match of [...(text.match(COLOR_LITERAL) ?? []), ...(file.endsWith('.css') ? text.match(NAMED_COLOR) ?? [] : [])]) {
        offenders.push(`${relative(SRC, file)}: ${match}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
