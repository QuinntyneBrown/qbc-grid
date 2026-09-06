import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const catalogue = resolve(import.meta.dirname, '..', 'qbc-tokens.css');
const css = readFileSync(catalogue, 'utf8');

const root = css.replace(/@media[^{]*\{[\s\S]*?\n\}/g, '');
const tokens = [...root.matchAll(/(--qbc-[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => ({
  name,
  value: value.trim(),
}));

test('every token carries a value', () => {
  assert.ok(tokens.length > 0, 'the catalogue is empty');
  for (const { name, value } of tokens) {
    assert.notEqual(value, '', `${name} has no value`);
  }
});

test('no token is declared twice at the root', () => {
  const names = tokens.map((token) => token.name);
  assert.equal(new Set(names).size, names.length, 'a token is declared more than once');
});

test('the catalogue groups colour, metric, and expression tokens', () => {
  const groups = {
    colour: tokens.filter((token) => token.name.startsWith('--qbc-color-')),
    metric: tokens.filter((token) =>
      /^--qbc-(space|radius|border-width|size)-/.test(token.name),
    ),
    expression: tokens.filter((token) =>
      /^--qbc-(elevation|layer|duration|easing)-/.test(token.name),
    ),
  };
  for (const [group, members] of Object.entries(groups)) {
    assert.ok(members.length > 0, `the ${group} group is empty`);
  }
  assert.equal(
    groups.colour.length + groups.metric.length + groups.expression.length,
    tokens.length,
    'a token belongs to no group',
  );
});

test('an operator asking for reduced motion gets no duration', () => {
  const reduced = css.match(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\n\}/);
  assert.ok(reduced, 'the catalogue carries no reduced-motion rule');
  for (const duration of tokens.filter((token) => token.name.startsWith('--qbc-duration-'))) {
    assert.match(
      reduced[0],
      new RegExp(String.raw`${duration.name}\s*:\s*0`),
      `${duration.name} is not zeroed under reduced motion`,
    );
  }
});

test('the override generator moves every token it is given', () => {
  const destination = join(mkdtempSync(join(tmpdir(), 'qbc-tokens-')), 'overrides.css');
  execFileSync(
    process.execPath,
    [resolve(import.meta.dirname, 'generate-overrides.mjs'), catalogue, destination],
    { stdio: 'pipe' },
  );
  const overrides = readFileSync(destination, 'utf8');

  for (const { name, value } of tokens) {
    const moved = overrides.match(new RegExp(String.raw`${name}\s*:\s*([^;]+);`));
    assert.ok(moved, `${name} is not overridden`);
    assert.notEqual(
      moved[1].trim(),
      value,
      `${name} was overridden with the value it already had, so a literal would hide behind it`,
    );
  }
});

test('the generator leaves the reduced-motion rule alone', () => {
  const destination = join(mkdtempSync(join(tmpdir(), 'qbc-tokens-')), 'overrides.css');
  execFileSync(
    process.execPath,
    [resolve(import.meta.dirname, 'generate-overrides.mjs'), catalogue, destination],
    { stdio: 'pipe' },
  );
  const overrides = readFileSync(destination, 'utf8');
  // A theme that could move the zeroed durations would defeat a preference the operator
  // expressed, which is the wrong way round.
  assert.equal(overrides.match(/--qbc-duration-fast/g)?.length, 1);
});
