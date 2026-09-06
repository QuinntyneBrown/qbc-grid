/**
 * Puts the token stylesheets where the demonstration application can serve them.
 *
 * The three token configurations are three routes, and a route can only load a file the
 * application serves. The overrides are generated from the installed catalogue rather than
 * written by hand, so a token added to the design system is overridden without anyone
 * remembering to add it here.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const catalogue = resolve('design-system/qbc-tokens.css');
const publicDir = resolve('src/e2e-app/public');

mkdirSync(publicDir, { recursive: true });
copyFileSync(catalogue, resolve(publicDir, 'qbc-tokens.css'));
execFileSync(
  process.execPath,
  ['design-system/tools/generate-overrides.mjs', catalogue, resolve(publicDir, 'tokens-overridden.css')],
  { stdio: 'inherit' },
);
console.log('Token stylesheets staged for the demonstration application.');
