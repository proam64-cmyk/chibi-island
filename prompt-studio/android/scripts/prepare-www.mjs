// Copies the static studio app into ./www for Capacitor. The server/ folder (and anything
// that could hold credentials) is never copied, so the APK/AAB contains no API keys.
import { cpSync, rmSync, mkdirSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..', '..');
const out = join(here, '..', 'www');
const INCLUDE = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons', 'tests/harness.js', 'tests/specs'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const item of INCLUDE) {
  const src = join(app, item);
  if (!existsSync(src)) throw new Error('missing ' + item);
  mkdirSync(dirname(join(out, item)), { recursive: true });
  cpSync(src, join(out, item), { recursive: true });
}

// Safety check: refuse to ship anything that looks like a secret.
const SECRET = /(sk-ant-[A-Za-z0-9_-]{8,}|ANTHROPIC_API_KEY\s*=|AIza[0-9A-Za-z_-]{20,})/;
let files = 0;
(function scan(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { scan(p); continue; }
    files++;
    if (/\.(html|js|css|json|webmanifest|svg)$/.test(name) && SECRET.test(readFileSync(p, 'utf8'))) {
      throw new Error('Possible secret found in ' + relative(out, p) + ' — aborting.');
    }
  }
})(out);
console.log('Prepared ' + files + ' files in ' + relative(process.cwd(), out) + ' (no secrets found).');
