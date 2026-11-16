// Benchmark: this repo's parse.js vs the real marked 18.1.3 on the
// practice set. Fast and marked are timed back-to-back inside every round
// so machine slowdowns affect both equally; the reported speedup is the
// median of the per-round ratios. Usage: node test/bench.mjs [rounds]
import { readFileSync } from 'node:fs';
import { parse as fastParse } from '../parse.js';
import { marked } from '../../../markdown-render-speed/markdown-render-speed-02-kit/baselines/vendor/marked/marked.esm.js';

const kit = new URL('../../../markdown-render-speed/markdown-render-speed-02-kit/', import.meta.url);
const cases = JSON.parse(readFileSync(new URL('practice/input/cases.json', kit), 'utf8'));
const docs = cases.filter((c) => c.id.startsWith('doc-'));
const specs = cases.filter((c) => !c.id.startsWith('doc-'));
const rounds = Number(process.argv[2] ?? 7);

function time(fn, list) {
  const t0 = performance.now();
  for (const c of list) fn(c.markdown);
  return performance.now() - t0;
}

console.log(`cases: ${cases.length} (${specs.length} spec, ${docs.length} docs, ${docs.reduce((a, c) => a + c.markdown.length, 0)} doc chars)`);

let bad = 0;
for (const c of cases) {
  if (fastParse(c.markdown) !== marked.parse(c.markdown)) bad++;
}
console.log('mismatches vs marked: ' + bad);

// warmup
time(fastParse, cases);
time((s) => marked.parse(s), cases);

function stats(name, list) {
  const ratios = [], fasts = [], markeds = [];
  for (let i = 0; i < rounds; i++) {
    const f = time(fastParse, list);
    const s = time((x) => marked.parse(x), list);
    fasts.push(f); markeds.push(s); ratios.push(s / f);
  }
  const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log(`${name}: fast ${med(fasts).toFixed(1)} ms  marked ${med(markeds).toFixed(1)} ms  speedup median ${med(ratios).toFixed(2)}x (ratios: ${ratios.map((r) => r.toFixed(2)).join(', ')})`);
}
stats('all 720 ', cases);
stats('40 docs ', docs);
stats('680 spec', specs);
