/**
 * Serves the bare consumer's build and drives it, which is what proves `L2-033`.
 *
 * A bundled Angular gives a second runtime and an injector error; a service injected from
 * outside the library gives a null-injector failure. Both show up as an application that
 * does not render, so this asks whether it renders, whether it drags, and whether the
 * console stayed quiet.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from '@playwright/test';

const consumer = readFileSync('dist/consumer-path.txt', 'utf8').trim();
const root = join(consumer, 'dist', 'consumer', 'browser');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = createServer((request, response) => {
  const name = request.url === '/' ? '/index.html' : request.url.split('?')[0];
  const file = join(root, name);
  if (!existsSync(file)) {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  response.end(readFileSync(file));
});

await new Promise((resolve) => server.listen(4399, resolve));
console.log('Serving', root, '->', readdirSync(root).join(', '));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const problems = [];
page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`console: ${message.text()}`);
});

await page.goto('http://localhost:4399/', { waitUntil: 'networkidle' });

const bootstrapError = await page.evaluate(() =>
  document.body.getAttribute('data-bootstrap-error'),
);
const tiles = await page.locator('[data-qbc-tile]').count();
const handles = await page.locator('[data-qbc-handle]').count();

// A drag, a resize, and a keyboard command, each with no provider registered anywhere.
const box = await page.locator('[data-qbc-tile="one"]').boundingBox();
await page.mouse.move(box.x + 4, box.y + 4);
await page.mouse.down();
await page.mouse.move(box.x + 4 + box.width * 2, box.y + 4, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(150);
const draggedTo = await page
  .locator('[data-qbc-tile="one"]')
  .evaluate((element) => getComputedStyle(element).getPropertyValue('--qbc-tile-x').trim());

await page.locator('[data-qbc-tile="two"]').focus();
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(150);
const movedTo = await page
  .locator('[data-qbc-tile="two"]')
  .evaluate((element) => getComputedStyle(element).getPropertyValue('--qbc-tile-y').trim());

await browser.close();
server.close();

const failures = [];
if (bootstrapError !== null) failures.push(`bootstrap failed: ${bootstrapError}`);
if (tiles !== 2) failures.push(`expected 2 tiles, rendered ${tiles}`);
if (handles !== 2) failures.push(`expected 2 handles in edit mode, found ${handles}`);
if (draggedTo === '0') failures.push('the drag did not move the tile');
if (movedTo === '0') failures.push('the keyboard command did not move the tile');
failures.push(...problems);

if (failures.length > 0) {
  console.error('The installed consumer failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Rendered ${tiles} tiles, dragged one to column ${draggedTo}, moved one to row ${movedTo}.`);
console.log('No injector error, no console error, and no provider registered.');
