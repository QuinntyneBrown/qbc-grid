/**
 * Renders the PlantUML sources under docs/detailed-designs to the PNGs the READMEs
 * embed. Pass paths to render a subset; pass nothing to render every source.
 *
 *   node tools/render-diagrams.mjs
 *   node tools/render-diagrams.mjs docs/detailed-designs/**\/c4-component.puml
 *
 * The jar is cached beside the repository rather than committed. Set PLANTUML_JAR to
 * point at an existing one.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const VERSION = '1.2025.4';
const CACHE = resolve('node_modules/.cache/plantuml');
const JAR = process.env.PLANTUML_JAR ?? join(CACHE, `plantuml-${VERSION}.jar`);

function ensureJar() {
  if (existsSync(JAR)) return JAR;
  mkdirSync(dirname(JAR), { recursive: true });
  const url = `https://github.com/plantuml/plantuml/releases/download/v${VERSION}/plantuml-${VERSION}.jar`;
  console.log(`Fetching PlantUML ${VERSION}`);
  execFileSync('curl', ['-sSL', '-o', JAR, url], { stdio: 'inherit' });
  return JAR;
}

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.puml') ? [full] : [];
  });
}

const sources = process.argv.slice(2).length
  ? process.argv.slice(2)
  : walk('docs/detailed-designs');

if (sources.length === 0) {
  console.error('No PlantUML sources found.');
  process.exit(1);
}

const jar = ensureJar();
for (const source of sources) {
  execFileSync('java', ['-jar', jar, '-tpng', '-o', resolve(dirname(source)), source], {
    stdio: 'inherit',
  });
}
console.log(`Rendered ${sources.length} diagram${sources.length === 1 ? '' : 's'}.`);
