// Diff harness: run this repo's parse.js over the practice set and compare
// byte-for-byte with practice/reference/expected.json (marked's own output).
// Usage: node test/check.mjs [max-to-show]
import { readFileSync } from 'node:fs';
import { parse } from '../parse.js';

const kit = new URL('../../../markdown-render-speed/markdown-render-speed-02-kit/', import.meta.url);
const cases = JSON.parse(readFileSync(new URL('practice/input/cases.json', kit), 'utf8'));
const expectedDoc = JSON.parse(readFileSync(new URL('practice/reference/expected.json', kit), 'utf8'));
const expected = expectedDoc.cases.map((c) => c.html);
const maxShow = Number(process.argv[2] ?? 10);

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return {
    i,
    aCtx: JSON.stringify(a.slice(Math.max(0, i - 80), i + 120)),
    bCtx: JSON.stringify(b.slice(Math.max(0, i - 80), i + 120)),
    aLen: a.length, bLen: b.length,
  };
}

let pass = 0;
const fails = [];
for (let i = 0; i < cases.length; i++) {
  let got;
  try {
    got = parse(cases[i].markdown);
  } catch (e) {
    got = 'THREW: ' + e.message;
  }
  if (got === expected[i]) pass++;
  else fails.push({ id: cases[i].id, i, md: cases[i].markdown, got, want: expected[i] });
}
console.log(`PASS ${pass}/${cases.length}  FAIL ${fails.length}`);
for (const f of fails.slice(0, maxShow)) {
  console.log('\n=== ' + f.id + ' (case ' + f.i + ') ===');
  if (f.md.length < 2000) {
    console.log('MD  : ' + JSON.stringify(f.md));
    console.log('GOT : ' + JSON.stringify(f.got));
    console.log('WANT: ' + JSON.stringify(f.want));
  } else {
    const d = firstDiff(f.got, f.want);
    console.log('MD len ' + f.md.length + ' first diff at ' + d.i + ' (got len ' + d.aLen + ', want len ' + d.bLen + ')');
    console.log('GOT : ...' + d.aCtx);
    console.log('WANT: ...' + d.bCtx);
  }
}
if (fails.length > maxShow) console.log(`\n... and ${fails.length - maxShow} more`);
process.exit(fails.length ? 1 : 0);
