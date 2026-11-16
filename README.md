# fast-marked — a faster drop-in replacement for `marked`

A JavaScript Markdown renderer that produces **byte-for-byte the same HTML as
`marked` 18.1.3** (default options: GFM on, breaks off, pedantic off, async
off) while running **~1.3× faster** on large documents.

Built for the make.fun bounty
[Make Markdown rendering faster](https://make.fun/bounty/markdown-render-speed-02)
($250, 20 places).

## Files

| File | What it is |
|---|---|
| `parse.js` | The renderer. `parse(markdown)` → HTML string. Dependency-free ES module. |
| `main.ts` | The harness driver the competition runs (`node /bot/main.ts`). Reads `/input/cases.json`, writes `/output/html.json`. |
| `package.json` | `{ "name": "fast-marked", "type": "module", "main": "parse.js", "license": "MIT" }` |
| `LICENSE` | MIT, copyright 2026 Sandiawan Kielo Dale. |
| `test/check.mjs` | Correctness: diffs `parse.js` against the practice set's expected HTML (720 cases). |
| `test/bench.mjs` | Benchmark: `parse.js` vs the real `marked` 18.1.3, median of N rounds. |
| `test/fuzz.mjs` | Differential fuzz: random Markdown-ish documents vs real `marked`. |
| `test/fuzz-docs.mjs` | Mutation fuzz: real practice READMEs with random edits vs real `marked`. |

## How it works

A faithful port of marked 18.1.3's Lexer / Tokenizer / Parser algorithms —
the same block and inline regexes, the same decisions — with the token
objects removed and inline tokenizing fused with rendering:

- **No inline token objects.** marked builds a token tree and then renders
  it; this renderer emits HTML strings directly while scanning, which also
  removes a whole allocation-heavy pass.
- **Deferred inline rendering.** Block lexing runs first (link reference
  definitions can appear after the paragraph that uses them), and inline
  rendering is queued until block lexing finishes — exactly like marked.
- **A length-preserving mask** hides `*` / `_` / `~` that sit inside code
  spans, links, tags, or escapes, so emphasis/delimiter scanning sees the
  same "closers" marked sees. The mask's three regex replaces are skipped
  unless the paragraph actually contains the characters that make them
  necessary.
- **Memoized list regexes** with marked's own `max(0, min(3, t-1))`
  transform, and a first-character dispatch in the list inner loop so each
  line is tested against only the block-start regexes whose marker could
  follow.
- **Bounded setext-heading gate**: the `=+` / `-+` check is only run on the
  slice up to the next blank line, not over the rest of the document.
- **Cheaper delimiter runs**: emphasis/delimiter run lengths are computed
  without spreading strings into arrays (only the trailing code point can
  be non-ASCII), and the emphasis-mask scan uses a same-character run
  regex `([*_~])\1*`.
- **First-character dispatch** in the inline loop, plus an exact pre-check
  (`mayBeUrl`) so the URL regex is only attempted where it could match.

Things that were tried and **reverted** because they measured slower or
equal: a manual text-token scanner replacing the GFM text regex (A/B:
~2% slower than the regex — the regex is a single pass; the scanner did
four). The text token therefore still uses marked's own text regex.

## Correctness

Verified against the real `marked` 18.1.3 (vendored in the competition kit):

- Practice set: **720/720 byte-identical** (`node test/check.mjs`), and
  **720/720 via the real driver** (`node entry/main.ts` with
  `MAKEFUN_INPUT_DIR`/`MAKEFUN_OUTPUT_DIR` set to the practice input,
  compared against `practice/reference/expected.json`).
- Differential fuzz: **0 mismatches** across ~1,200 random Markdown-ish
  documents (3 seeds) and 150 mutated real READMEs.

This includes marked's quirks, not just CommonMark: link reference
definitions do not interrupt paragraphs, tables can, nested links resolve
innermost-first, `mailto:www.example.com` is *not* a link while
`mailto:a@b.c` is, `~~del~~` allows spaces, and an email starting with
`_` is linked after emphasis fails.

## Benchmark (practice set, this machine)

```
node test/bench.mjs 9
cases: 720 (680 spec, 40 docs, 2,846,479 doc chars)
mismatches vs marked: 0
all 720 : fast 2178.8 ms  marked 2421.7 ms  speedup median 1.09x (noisy; see below)
40 docs : fast 1610.8 ms  marked 2015.1 ms  speedup median 1.31x (ratios 1.16–1.79, all 9 rounds > 1)
680 spec: fast 6.4 ms     marked 8.8 ms     speedup median 1.24x
```

The 40 generated READMEs dominate the score (~99% of CPU time), so the
**docs speedup of ~1.3×** is the number that matters. Timings on this
shared VM are noisy; the docs ratio was above 1.0 in every round.

## Submitting (exact steps)

1. **Rebuild inside a recorded harness session.** This entry was built by
   hand, and the competition only pays for entries built inside a sealed
   recording made with the kit's `record` command (Claude Code, Codex,
   Muse app, Superbot, Gemini CLI, …). A handed-over build is ranked but
   takes **no paid place**. Re-run the same build steps inside
   `node cli/makefun.mjs record …` and keep the transcript.
2. **Create a public GitHub repo** owned by your own GitHub account,
   created after the competition opens, with an OSI-approved license, and
   put `parse.js` and `main.ts` in the repo root. (Or submit a source
   bundle if you have no GitHub account.)
3. **Link a Solana wallet** to your make.fun account for payouts (USDC).
4. **Submit before the deadline**: Tue 17 Nov 2026 03:30 WIB
   (Mon 16 Nov 2026 20:30 UTC). Max 10 submissions/day, 20 total; the
   last submission before the deadline is final. The final test set is
   drawn from the first drand round at/after 2026-11-16 20:40 UTC
   (round 34019412), 10 minutes after the deadline.
5. Check locally first:
   `node cli/makefun.mjs grade-local --kit . --bot <repo> --driver docker`
   (needs Docker; not available on this machine — verified instead with
   the driver run above and `node test/check.mjs`).

## License

MIT — see `LICENSE`.
