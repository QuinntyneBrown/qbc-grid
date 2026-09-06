/**
 * Builds the token gallery: a static page showing every token in the catalogue with the
 * value it resolves to.
 *
 * The page is generated from the catalogue rather than written beside it, so a token added
 * to the design system appears in the gallery without anyone remembering to add it.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const here = import.meta.dirname;
const catalogue = resolve(here, '..', 'qbc-tokens.css');
const out = resolve(here, '..', 'dist');

const css = readFileSync(catalogue, 'utf8');
const root = css.replace(/@media[^{]*\{[\s\S]*?\n\}/g, '');
const tokens = [...root.matchAll(/(--qbc-[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => ({
  name,
  value: value.trim(),
}));

const groups = [
  ['Colour', (name) => name.startsWith('--qbc-color-')],
  ['Metric', (name) => /^--qbc-(space|radius|border-width|size)-/.test(name)],
  ['Expression', (name) => /^--qbc-(elevation|layer|duration|easing)-/.test(name)],
];

const escape = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const specimen = (token) => {
  if (token.name.startsWith('--qbc-color-')) {
    return `<span class="swatch" style="background: var(${token.name})"></span>`;
  }
  if (token.name.startsWith('--qbc-elevation-')) {
    return `<span class="swatch swatch--raised" style="box-shadow: var(${token.name})"></span>`;
  }
  if (/^--qbc-(space|size|border-width|radius)-/.test(token.name)) {
    return `<span class="bar" style="inline-size: calc(var(${token.name}) * 4)"></span>`;
  }
  return `<span class="value">${escape(token.value)}</span>`;
};

const sections = groups
  .map(([title, belongs]) => {
    const rows = tokens
      .filter((token) => belongs(token.name))
      .map(
        (token) => `      <tr>
        <td><code>${token.name}</code></td>
        <td class="specimen">${specimen(token)}</td>
        <td><code>${escape(token.value)}</code></td>
      </tr>`,
      )
      .join('\n');
    return `  <section>
    <h2>${title}</h2>
    <table>
      <thead><tr><th>Token</th><th>Specimen</th><th>Value</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </section>`;
  })
  .join('\n');

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>qbc design tokens</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="qbc-tokens.css">
  <style>
    body { margin: 0; padding: 32px; font: 14px/1.6 system-ui, sans-serif;
           background: #0b0e11; color: #e6edf3; }
    h1 { margin-block: 0 8px; }
    p.lede { margin-block: 0 32px; color: #97a3b0; max-inline-size: 60ch; }
    section { margin-block-end: 40px; }
    table { border-collapse: collapse; inline-size: 100%; max-inline-size: 900px; }
    th, td { text-align: start; padding: 8px 12px;
             border-block-end: 1px solid var(--qbc-color-border); }
    code { font: 13px/1.4 ui-monospace, monospace; }
    .swatch { display: inline-block; inline-size: 72px; block-size: 24px;
              border-radius: var(--qbc-radius-sm); border: 1px solid var(--qbc-color-border); }
    .swatch--raised { background: var(--qbc-color-surface-raised); }
    .bar { display: inline-block; block-size: 12px; background: var(--qbc-color-accent);
           border-radius: 2px; }
    .specimen { inline-size: 140px; }
  </style>
</head>
<body>
  <h1>qbc design tokens</h1>
  <p class="lede">
    The authoritative catalogue. A consumer depends on this file rather than copying its
    values, and every component stylesheet reads them as <code>var(--qbc-role)</code>.
    ${tokens.length} tokens.
  </p>
${sections}
</body>
</html>
`;

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.html'), page, 'utf8');
copyFileSync(catalogue, join(out, 'qbc-tokens.css'));
console.log(`Gallery built at ${join(out, 'index.html')} with ${tokens.length} tokens.`);
