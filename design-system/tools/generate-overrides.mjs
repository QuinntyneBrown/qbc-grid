/**
 * Generates a stylesheet that redefines every token in the catalogue to a value distinct
 * from its default.
 *
 * It reads the installed token file rather than a list of its own, because a list
 * maintained beside the catalogue is a list that stops matching it — and the criterion
 * this serves asserts that nothing retains a library default, which a stale list would
 * quietly stop checking.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = process.argv[2] ?? resolve('design-system/qbc-tokens.css');
const destination = process.argv[3] ?? resolve('src/e2e-app/tokens-overridden.css');

const css = readFileSync(source, 'utf8');

/*
 * Declarations inside a media block are left alone. The reduced-motion rule zeroes the two
 * duration tokens, and overriding those would let a theme defeat a preference the operator
 * expressed — which is the wrong way round.
 */
const withoutMediaBlocks = css.replace(/@media[^{]*\{[\s\S]*?\n\}/g, '');
const declarations = [...withoutMediaBlocks.matchAll(/(--qbc-[a-z0-9-]+)\s*:\s*([^;]+);/g)];

/** A value distinct from the default, and still valid for the property it stands in. */
function derive(token, value) {
  const original = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(original)) {
    // Rotate the channels, which changes the colour without inventing a new format.
    return `#${original.slice(5, 7)}${original.slice(1, 3)}${original.slice(3, 5)}`;
  }
  if (/^-?\d+(\.\d+)?m?s$/.test(original)) {
    const unit = original.endsWith('ms') ? 'ms' : 's';
    return `${Number.parseFloat(original) + (unit === 'ms' ? 40 : 1)}${unit}`;
  }
  if (/^-?\d+(\.\d+)?px$/.test(original)) return `${Number.parseFloat(original) + 3}px`;
  if (/^-?\d+(\.\d+)?$/.test(original)) return `${Number.parseFloat(original) + 7}`;
  if (token.includes('elevation')) return '0 3px 9px rgb(0 0 0 / 0.7)';
  if (token.includes('easing')) return 'cubic-bezier(0.4, 0, 0.6, 1)';
  return original;
}

const overrides = declarations
  .map(([, token, value]) => `  ${token}: ${derive(token, value)};`)
  .join('\n');

const unchanged = declarations.filter(([, token, value]) => derive(token, value) === value.trim());
if (unchanged.length > 0) {
  console.error(`These tokens were not moved: ${unchanged.map(([, token]) => token).join(', ')}`);
  process.exit(1);
}

mkdirSync(dirname(destination), { recursive: true });
writeFileSync(
  destination,
  `/* Generated from ${source}. Every token moved, so a value that does not move is a literal. */\n:root {\n${overrides}\n}\n`,
  'utf8',
);
console.log(`Overrode ${declarations.length} tokens into ${destination}`);
