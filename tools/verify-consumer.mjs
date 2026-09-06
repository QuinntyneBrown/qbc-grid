/**
 * Builds the library, packs it, installs the tarball into a bare Angular application, and
 * drives that application in a browser.
 *
 * `L2-033` is proved by symptom rather than by inspection. A library that bundled Angular
 * instead of declaring it a peer gives the consumer a second runtime and an injector
 * error; a library that injected a service defined outside itself gives a null-injector
 * failure. Both appear as an application that does not render, so the check is that this
 * one does — with no router, no HTTP client, and no provider of its own.
 *
 * The workspace route cannot answer this. A path mapping resolves the library from source,
 * shares the workspace's own Angular, and would pass either way.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve('.');
const dist = join(root, 'dist', 'qbc-grid');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

console.log('Building and packing the library.');
run(npm, ['run', 'build:lib'], root);
run(npm, ['pack', '--pack-destination', root], dist);

const tarball = readdirSync(root).find((name) => /^qbc-grid-.*\.tgz$/.test(name));
if (tarball === undefined) throw new Error('No tarball was produced.');

const consumer = mkdtempSync(join(tmpdir(), 'qbc-consumer-'));
console.log(`Installing ${tarball} into a bare consumer at ${consumer}.`);

mkdirSync(join(consumer, 'src'), { recursive: true });
writeFileSync(
  join(consumer, 'package.json'),
  JSON.stringify(
    {
      name: 'qbc-grid-consumer',
      private: true,
      type: 'module',
      dependencies: {
        '@angular/common': '^21.2.0',
        '@angular/compiler': '^21.2.0',
        '@angular/core': '^21.2.0',
        '@angular/platform-browser': '^21.2.0',
        'qbc-grid': `file:${join(root, tarball).replace(/\\/g, '/')}`,
        rxjs: '~7.8.0',
        tslib: '^2.3.0',
        zone: 'npm:tslib@^2.3.0',
      },
      devDependencies: {
        '@angular/build': '^21.2.7',
        '@angular/cli': '^21.2.7',
        '@angular/compiler-cli': '^21.2.0',
        typescript: '~5.9.2',
      },
    },
    null,
    2,
  ),
);

writeFileSync(
  join(consumer, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        strict: true,
        skipLibCheck: true,
        isolatedModules: true,
        experimentalDecorators: true,
        importHelpers: true,
        target: 'ES2022',
        module: 'preserve',
      },
      angularCompilerOptions: { strictTemplates: true },
      include: ['src/**/*.ts'],
    },
    null,
    2,
  ),
);

writeFileSync(
  join(consumer, 'angular.json'),
  JSON.stringify(
    {
      version: 1,
      projects: {
        consumer: {
          projectType: 'application',
          root: '',
          sourceRoot: 'src',
          architect: {
            build: {
              builder: '@angular/build:application',
              options: {
                browser: 'src/main.ts',
                index: 'src/index.html',
                tsConfig: 'tsconfig.json',
              },
              configurations: { development: { optimization: false, sourceMap: true } },
              defaultConfiguration: 'development',
            },
          },
        },
      },
    },
    null,
    2,
  ),
);

writeFileSync(
  join(consumer, 'src', 'index.html'),
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Consumer</title></head><body><app-root></app-root></body></html>',
);

// No router, no HTTP client, no application provider of any kind.
writeFileSync(
  join(consumer, 'src', 'main.ts'),
  `import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { GridComponent, GridTile, GridTileTemplateDirective } from 'qbc-grid';

@Component({
  selector: 'app-root',
  imports: [GridComponent, GridTileTemplateDirective],
  template: \`
    <qbc-grid [layout]="layout()" [mode]="'edit'" (layoutChange)="layout.set($event)">
      <div *qbcGridTile="let tile">{{ tile.label }}</div>
    </qbc-grid>
  \`,
})
export class App {
  readonly layout = signal<readonly GridTile[]>([
    { id: 'one', x: 0, y: 0, cols: 3, rows: 2, label: 'One' },
    { id: 'two', x: 3, y: 0, cols: 3, rows: 2, label: 'Two' },
  ]);
}

bootstrapApplication(App).catch((error: unknown) => {
  document.body.setAttribute('data-bootstrap-error', String(error));
});
`,
);

run(npm, ['install', '--no-audit', '--no-fund'], consumer);
run(npm, ['exec', '--', 'ng', 'build', '--configuration', 'development'], consumer);

console.log(`\nThe packed library builds in a bare consumer. Output at ${join(consumer, 'dist')}`);
console.log('Consumer left in place for the browser check; remove it when finished.');
rmSync(join(root, tarball), { force: true });
writeFileSync(join(root, 'dist', 'consumer-path.txt'), consumer);
