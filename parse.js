// parse.js — fast, byte-for-byte compatible drop-in for marked 18.1.3 (GFM defaults).
//
// Built by porting marked 18.1.3's exact algorithms (same rule regexes, same
// tokenizer decisions) and fusing inline tokenize+render so no inline token
// objects are ever allocated. Block structure still uses tokens because link
// reference definitions can appear after the paragraph that uses them, so
// inline rendering is deferred until the whole block pass is done — exactly
// like marked's inlineQueue.
//
// Entry point: export function parse(markdown) -> HTML string.
// This file is GENERATED from parse.template.js by injecting the rule regexes
// dumped from the vendored marked 18.1.3 source (see tools/gen-parse.mjs in
// the parent work dir). Do not hand-edit the RULES_DATA line.

const RULES_DATA = JSON.parse("{\"block\":{\"newline\":[\"^(?:[ \\\\t]*(?:\\\\n|$))+\",\"\"],\"code\":[\"^((?: {4}| {0,3}\\\\t)[^\\\\n]+(?:\\\\n(?:[ \\\\t]*(?:\\\\n|$))*)?)+\",\"\"],\"fences\":[\"^ {0,3}(`{3,}(?=[^`\\\\n]*(?:\\\\n|$))|~{3,})([^\\\\n]*)(?:\\\\n|$)(?:|([\\\\s\\\\S]*?)(?:\\\\n|$))(?: {0,3}(?:(?=`)\\\\1`*|(?=~)\\\\1~*) *(?=\\\\n|$)|$)\",\"\"],\"heading\":[\"^ {0,3}(#{1,6})(?=\\\\s|$)(.*)(?:\\\\n+|$)\",\"\"],\"hr\":[\"^ {0,3}((?:-[\\\\t ]*){3,}|(?:_[ \\\\t]*){3,}|(?:\\\\*[ \\\\t]*){3,})(?:\\\\n+|$)\",\"\"],\"blockquote\":[\"^( {0,3}> ?(?:(?![ \\\\t]*(?:\\\\n|$))(([^\\\\n]+(?:\\\\n(?! {0,3}((?:-[\\\\t ]*){3,}|(?:_[ \\\\t]*){3,}|(?:\\\\*[ \\\\t]*){3,})(?:\\\\n+|$)| {0,3}#{1,6}(?:\\\\s|$)| {0,3}>| {0,3}(?:`{3,}(?=[^`\\\\n]*(?:\\\\n|$))|~~~)[^\\\\n]*(?:\\\\n|$)| {0,3}(?:[*+-]|\\\\d{1,9}[.)])(?:[ \\\\t]|\\\\n|$)| {0,3}(?:<\\\\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: +|\\\\n|\\\\/?>)|<(?:(?:script|pre|style|textarea)(?:[\\\\s>]|$)|!--)|<\\\\?|<![A-Za-z]|<!\\\\[CDATA\\\\[)|[ \\\\t]+\\\\n)[^\\\\n]+)*))|[^\\\\n]*)(?:\\\\n|$))+\",\"\"],\"list\":[\"^( {0,3}(?:[*+-]|\\\\d{1,9}[.)]))([ \\\\t][^\\\\n]*?)?(?:\\\\n|$)\",\"\"],\"html\":[\"^ {0,3}(?:<(script|pre|style|textarea)[\\\\s>][\\\\s\\\\S]*?(?:<\\\\/\\\\1>[^\\\\n]*\\\\n*|$)|<!--(?:-?>|[\\\\s\\\\S]*?(?:-->|$))[^\\\\n]*(\\\\n+|$)|<\\\\?[\\\\s\\\\S]*?(?:\\\\?>[^\\\\n]*\\\\n*|$)|<![A-Z][\\\\s\\\\S]*?(?:>[^\\\\n]*\\\\n*|$)|<!\\\\[CDATA\\\\[[\\\\s\\\\S]*?(?:\\\\]\\\\]>[^\\\\n]*\\\\n*|$)|<\\\\/?(address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:[ \\\\t]+|\\\\n|\\\\/?>|$)[\\\\s\\\\S]*?(?:(?:\\\\n[ \\t]*)+\\\\n|$)|<(?!(?:script|pre|style|textarea)(?![a-z0-9-]))([a-z][a-z0-9-]*)(?: +[a-zA-Z:_][\\\\w.:-]*(?: *= *\\\"[^\\\"\\\\n]*\\\"| *= *'[^'\\\\n]*'| *= *[^\\\\s\\\"'=<>`]+)?)*? *\\\\/?>(?=[ \\\\t]*(?:\\\\n|$))[\\\\s\\\\S]*?(?:(?:\\\\n[ \\t]*)+\\\\n|$)|<\\\\/[a-z][a-z0-9-]*\\\\s*>(?=[ \\\\t]*(?:\\\\n|$))[\\\\s\\\\S]*?(?:(?:\\\\n[ \\t]*)+\\\\n|$))\",\"i\"],\"def\":[\"^ {0,3}\\\\[((?!\\\\s*\\\\])(?:\\\\\\\\[\\\\s\\\\S]|[^\\\\[\\\\]\\\\\\\\\\\\n]|\\\\n(?![ \\\\t]*\\\\n))+)\\\\]: *(?:\\\\n[ \\\\t]*)?([^<\\\\s][^\\\\s]*|<.*?>)(?:(?: +(?:\\\\n[ \\\\t]*)?| *\\\\n[ \\\\t]*)((?:\\\"(?:\\\\\\\\[\\\\s\\\\S]|[^\\\"\\\\\\\\])*\\\"|'(?:\\\\\\\\[\\\\s\\\\S]|[^'\\\\\\\\\\\\n]|\\\\n(?!\\\\n))*'|\\\\((?:\\\\\\\\[\\\\s\\\\S]|[^()\\\\\\\\])*\\\\))))? *(?:\\\\n+|$)\",\"\"],\"table\":[\"^ *([^\\\\n ].*)\\\\n {0,3}((?:\\\\| *)?:?-+:? *(?:\\\\| *:?-+:? *)*(?:\\\\| *)?)(?:\\\\n((?:(?! *\\\\n| {0,3}((?:-[\\\\t ]*){3,}|(?:_[ \\\\t]*){3,}|(?:\\\\*[ \\\\t]*){3,})(?:\\\\n+|$)| {0,3}#{1,6}(?:\\\\s|$)| {0,3}>|(?: {4}| {0,3}\\t)[^\\\\n]| {0,3}(?:`{3,}(?=[^`\\\\n]*(?:\\\\n|$))|~~~)[^\\\\n]*(?:\\\\n|$)| {0,3}(?:[*+-]|1[.)])[ \\\\t]| {0,3}(?:<\\\\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: +|\\\\n|\\\\/?>)|<(?:(?:script|pre|style|textarea)(?:[\\\\s>]|$)|!--)|<\\\\?|<![A-Za-z]|<!\\\\[CDATA\\\\[)).*(?:\\\\n|$))*)\\\\n*|$)\",\"\"],\"lheading\":[\"^(?! {0,3}(?:[*+-]|\\\\d{1,9}[.)]) |(?: {4}| {0,3}\\\\t)| {0,3}(?:`{3,}|~{3,})| {0,3}>| {0,3}#{1,6}(?:\\\\s|$)| {0,3}<[^\\\\n>]+>\\\\n| {0,3}\\\\|?(?:[:\\\\- ]*\\\\|)+[\\\\:\\\\- ]*\\\\n)((?:.|\\\\n(?!\\\\s*?\\\\n| {0,3}(?:[*+-]|\\\\d{1,9}[.)]) | {0,3}(?:`{3,}|~{3,})| {0,3}>| {0,3}#{1,6}(?:\\\\s|$)| {0,3}(?:(?:-[\\\\t ]*){3,}|(?:_[ \\\\t]*){3,}|(?:\\\\*[ \\\\t]*){3,})(?:\\\\n+|$)| {0,3}<[^\\\\n>]+>\\\\n| {0,3}\\\\|?(?:[:\\\\- ]*\\\\|)+[\\\\:\\\\- ]*\\\\n))+?)\\\\n {0,3}(=+|-+)[ \\\\t]*(?:\\\\n+|$)\",\"\"],\"paragraph\":[\"^([^\\\\n]+(?:\\\\n(?! {0,3}((?:-[\\\\t ]*){3,}|(?:_[ \\\\t]*){3,}|(?:\\\\*[ \\\\t]*){3,})(?:\\\\n+|$)| {0,3}#{1,6}(?:\\\\s|$)| {0,3}>| {0,3}(?:`{3,}(?=[^`\\\\n]*(?:\\\\n|$))|~~~)[^\\\\n]*(?:\\\\n|$)| {0,3}(?:[*+-]|1[.)])[ \\\\t]+[^ \\\\t\\\\n]| {0,3}(?:<\\\\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: +|\\\\n|\\\\/?>)|<(?:(?:script|pre|style|textarea)(?:[\\\\s>]|$)|!--)|<\\\\?|<![A-Za-z]|<!\\\\[CDATA\\\\[)| *([^\\\\n ].*)\\\\n {0,3}((?:\\\\| *)?:?-+:? *(?:\\\\| *:?-+:? *)*(?:\\\\| *)?)(?:\\\\n((?:(?! *\\\\n| {0,3}((?:-[\\\\t ]*){3,}|(?:_[ \\\\t]*){3,}|(?:\\\\*[ \\\\t]*){3,})(?:\\\\n+|$)| {0,3}#{1,6}(?:\\\\s|$)| {0,3}>|(?: {4}| {0,3}\\t)[^\\\\n]| {0,3}(?:`{3,}(?=[^`\\\\n]*(?:\\\\n|$))|~~~)[^\\\\n]*(?:\\\\n|$)| {0,3}(?:[*+-]|1[.)])[ \\\\t]| {0,3}(?:<\\\\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: +|\\\\n|\\\\/?>)|<(?:(?:script|pre|style|textarea)(?:[\\\\s>]|$)|!--)|<\\\\?|<![A-Za-z]|<!\\\\[CDATA\\\\[)).*(?:\\\\n|$))*)\\\\n*|$)|[ \\\\t]+\\\\n)[^\\\\n]+)*)\",\"\"],\"text\":[\"^[^\\\\n]+\",\"\"]},\"inline\":{\"escape\":[\"^\\\\\\\\([!\\\"#$%&'()*+,\\\\-./:;<=>?@\\\\[\\\\]\\\\\\\\^_`{|}~])\",\"\"],\"tag\":[\"^<!--(?:-?>|[\\\\s\\\\S]*?-->)|^<\\\\/[a-zA-Z][a-zA-Z0-9-]*\\\\s*>|^<[a-zA-Z][a-zA-Z0-9-]*(?:\\\\s+[a-zA-Z:_][\\\\w.:-]*(?:\\\\s*=\\\\s*\\\"[^\\\"]*\\\"|\\\\s*=\\\\s*'[^']*'|\\\\s*=\\\\s*[^\\\\s\\\"'=<>`]+)?)*?\\\\s*\\\\/?>|^<\\\\?[\\\\s\\\\S]*?\\\\?>|^<![a-zA-Z]+\\\\s[\\\\s\\\\S]*?>|^<!\\\\[CDATA\\\\[[\\\\s\\\\S]*?\\\\]\\\\]>\",\"\"],\"link\":[\"^!?\\\\[((?:\\\\[(?:\\\\[(?:\\\\\\\\[\\\\s\\\\S]|[^\\\\[\\\\]\\\\\\\\])*\\\\]|\\\\\\\\[\\\\s\\\\S]|[^\\\\[\\\\]\\\\\\\\])*\\\\]|\\\\\\\\[\\\\s\\\\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\\\\])|[^\\\\[\\\\]\\\\\\\\`])*?)\\\\]\\\\([ \\\\t\\\\n]*(<(?:\\\\\\\\.|[^\\\\n<>\\\\\\\\])+>|[^ \\\\t\\\\n\\\\x00-\\\\x1f]+|(?=\\\\)))(?:(?:[ \\\\t]+(?:\\\\n[ \\\\t]*)?|\\\\n[ \\\\t]*)(\\\"(?:\\\\\\\\[\\\\s\\\\S]|[^\\\"\\\\\\\\])*\\\"|'(?:\\\\\\\\[\\\\s\\\\S]|[^'\\\\\\\\])*'|\\\\((?:\\\\\\\\[\\\\s\\\\S]|[^)\\\\\\\\])*\\\\)))?[ \\\\t\\\\n]*\\\\)\",\"\"],\"reflink\":[\"^!?\\\\[((?:\\\\[(?:\\\\[(?:\\\\\\\\[\\\\s\\\\S]|[^\\\\[\\\\]\\\\\\\\])*\\\\]|\\\\\\\\[\\\\s\\\\S]|[^\\\\[\\\\]\\\\\\\\])*\\\\]|\\\\\\\\[\\\\s\\\\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\\\\])|[^\\\\[\\\\]\\\\\\\\`])*?)\\\\]\\\\[((?!\\\\s*\\\\])(?:\\\\\\\\[\\\\s\\\\S]|[^\\\\[\\\\]\\\\\\\\\\\\n]|\\\\n(?![ \\\\t]*\\\\n))+)\\\\]\",\"\"],\"nolink\":[\"^!?\\\\[((?!\\\\s*\\\\])(?:\\\\\\\\[\\\\s\\\\S]|[^\\\\[\\\\]\\\\\\\\\\\\n]|\\\\n(?![ \\\\t]*\\\\n))+)\\\\](?:\\\\[\\\\])?\",\"\"],\"emStrongLDelim\":[\"^(?:\\\\*+(?:((?!\\\\*)(?!~)[\\\\p{P}\\\\p{S}])|([^\\\\s*]))?)|^_+(?:((?!_)(?!~)[\\\\p{P}\\\\p{S}])|([^\\\\s_]))?\",\"u\"],\"emStrongRDelimAst\":[\"^[^_*]*?__[^_*]*?\\\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\\\*)(?!~)[\\\\p{P}\\\\p{S}](\\\\*+)(?=[\\\\s]|$)|(?:[^\\\\s\\\\p{P}\\\\p{S}]|~)(\\\\*+)(?!\\\\*)(?=(?!~)[\\\\s\\\\p{P}\\\\p{S}]|$)|(?!\\\\*)(?!~)[\\\\s\\\\p{P}\\\\p{S}](\\\\*+)(?=(?:[^\\\\s\\\\p{P}\\\\p{S}]|~))|[\\\\s](\\\\*+)(?!\\\\*)(?=(?!~)[\\\\p{P}\\\\p{S}])|(?!\\\\*)(?!~)[\\\\p{P}\\\\p{S}](\\\\*+)(?!\\\\*)(?=(?!~)[\\\\p{P}\\\\p{S}])|(?:[^\\\\s\\\\p{P}\\\\p{S}]|~)(\\\\*+)(?=(?:[^\\\\s\\\\p{P}\\\\p{S}]|~))\",\"gu\"],\"emStrongRDelimUnd\":[\"^[^_*]*?\\\\*\\\\*[^_*]*?_[^_*]*?(?=\\\\*\\\\*)|[^_]+(?=[^_])|(?!_)[\\\\p{P}\\\\p{S}](_+)(?=[\\\\s]|$)|[^\\\\s\\\\p{P}\\\\p{S}](_+)(?!_)(?=[\\\\s\\\\p{P}\\\\p{S}]|$)|(?!_)[\\\\s\\\\p{P}\\\\p{S}](_+)(?=[^\\\\s\\\\p{P}\\\\p{S}])|[\\\\s](_+)(?!_)(?=[\\\\p{P}\\\\p{S}])|(?!_)[\\\\p{P}\\\\p{S}](_+)(?!_)(?=[\\\\p{P}\\\\p{S}])\",\"gu\"],\"code\":[\"^(`+)([^`]|[^`][\\\\s\\\\S]*?[^`])\\\\1(?!`)\",\"\"],\"br\":[\"^( {2,}|\\\\\\\\)\\\\n(?!\\\\s*$)[ \\\\t]*\",\"\"],\"del\":[\"^(~~?)(?=[^\\\\s~])((?:\\\\\\\\[\\\\s\\\\S]|[^\\\\\\\\])*?(?:\\\\\\\\[\\\\s\\\\S]|[^\\\\s~\\\\\\\\]))\\\\1(?=[^~]|$)\",\"\"],\"delLDelim\":[\"^~~?(?:((?!~)[\\\\p{P}\\\\p{S}])|[^\\\\s~])\",\"u\"],\"delRDelim\":[\"^[^~]+(?=[^~])|(?!~)[\\\\p{P}\\\\p{S}](~~?)(?=[\\\\s]|$)|[^\\\\s\\\\p{P}\\\\p{S}](~~?)(?!~)(?=[\\\\s\\\\p{P}\\\\p{S}]|$)|(?!~)[\\\\s\\\\p{P}\\\\p{S}](~~?)(?=[^\\\\s\\\\p{P}\\\\p{S}])|[\\\\s](~~?)(?!~)(?=[\\\\p{P}\\\\p{S}])|(?!~)[\\\\p{P}\\\\p{S}](~~?)(?!~)(?=[\\\\p{P}\\\\p{S}])|[^\\\\s\\\\p{P}\\\\p{S}](~~?)(?=[^\\\\s\\\\p{P}\\\\p{S}])\",\"gu\"],\"autolink\":[\"^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\\\\s\\\\x00-\\\\x1f<>]*|[a-zA-Z0-9.!#$%&'*+/=?_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_]))>\",\"\"],\"url\":[\"^(?:mailto:[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\\\\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\\\\w-])|xmpp:[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\\\\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\\\\w-])(?:\\\\/[A-Za-z0-9@.]+)?)|^((?:[hH][tT][tT][pP][sS]?|[fF][tT][pP]):\\\\/\\\\/|www\\\\.)(?:[a-zA-Z0-9\\\\-]+\\\\.?)+[^\\\\s<]*|^[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\\\\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\\\\w-])\",\"\"],\"text\":[\"^(?:[^a-zA-Z0-9](?=(?:mailto|xmpp):)|(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\\\\n)|(?=[a-zA-Z0-9.!#$%&'*+\\\\/=?_`{\\\\|}~-]+@)|[\\\\s\\\\S]*?(?:(?=[\\\\\\\\<!\\\\[`*~_]|\\\\b_|[hH][tT][tT][pP][sS]?|[fF][tT][pP]:\\\\/\\\\/|(?<![^\\\\s*_~(])www\\\\.|$)|[^ ](?= {2,}\\\\n)|[^a-zA-Z0-9](?=(?:mailto|xmpp):)|[^a-zA-Z0-9.!#$%&'*+\\\\/=?_`{\\\\|}~-](?=[a-zA-Z0-9.!#$%&'*+\\\\/=?_`{\\\\|}~-]+@))))\",\"\"],\"_backpedal\":[\"(?:[^?!.,:;*_'\\\"~()&]+|\\\\([^)]*\\\\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'\\\"~)]+(?!$))+\",\"\"],\"reflinkSearch\":[\"!?\\\\[((?:[^\\\\[\\\\]\\\\\\\\`]*(?:\\\\[(?:\\\\[(?:\\\\\\\\[\\\\s\\\\S]|[^\\\\[\\\\]\\\\\\\\])*\\\\]|\\\\\\\\[\\\\s\\\\S]|[^\\\\[\\\\]\\\\\\\\])*\\\\]|\\\\\\\\[\\\\s\\\\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\\\\]))){0,999}?[^\\\\[\\\\]\\\\\\\\`]*?)\\\\]\\\\[((?!\\\\s*\\\\])(?:\\\\\\\\[\\\\s\\\\S]|[^\\\\[\\\\]\\\\\\\\]){1,999})\\\\]|!?\\\\[((?!\\\\s*\\\\])(?:\\\\\\\\[\\\\s\\\\S]|[^\\\\[\\\\]\\\\\\\\]){1,999})\\\\](?:\\\\[\\\\])?(?!\\\\()\",\"g\"],\"anyPunctuation\":[\"\\\\\\\\([\\\\p{P}\\\\p{S}])\",\"gu\"],\"anyPunctuationOutsideCode\":[\"(`+)(?:[^`]|[^`][\\\\s\\\\S]*?[^`])\\\\1(?!`)|`+|\\\\\\\\([\\\\p{P}\\\\p{S}])\",\"gu\"],\"blockSkip\":[\"\\\\[(?:[^\\\\[\\\\]`]|(?<a>`+)[^`]+\\\\k<a>(?!`))*?\\\\]\\\\((?:\\\\\\\\[\\\\s\\\\S]|[^\\\\\\\\\\\\(\\\\)]|\\\\((?:\\\\\\\\[\\\\s\\\\S]|[^\\\\\\\\\\\\(\\\\)])*\\\\))*\\\\)|(?<!`)()(?<b>`+)[^`]+\\\\k<b>(?!`)|<(?! )[^<>]*?>\",\"g\"],\"punctuation\":[\"^((?![*_])[\\\\s\\\\p{P}\\\\p{S}])\",\"u\"]}}");
const RB = {};
const RI = {};
for (const k of Object.keys(RULES_DATA.block)) RB[k] = new RegExp(RULES_DATA.block[k][0], RULES_DATA.block[k][1]);
for (const k of Object.keys(RULES_DATA.inline)) RI[k] = new RegExp(RULES_DATA.inline[k][0], RULES_DATA.inline[k][1]);

// ---------------------------------------------------------------------------
// "other" rules (marked's T object) and small helpers
// ---------------------------------------------------------------------------
const BLOCK_TAG = 'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul';

// marked's D(): the list regex factories take R-1 (clamped to 0..3), not R.
function dMemo(fn) {
  const cache = [];
  return (t) => {
    const n = Math.max(0, Math.min(3, t - 1));
    let s = cache[n];
    if (!s) { s = fn(n); cache[n] = s; }
    return s;
  };
}

const OTHER = {
  codeRemoveIndent: /^(?: {0,3}\t| {1,4})/gm,
  outputLinkReplace: /\\([[\]])/g,
  indentCodeCompensation: /^(\s+)(?:```)/,
  beginningSpace: /^\s+/,
  endingHash: /#$/,
  startingSpaceChar: /^ /,
  endingSpaceChar: / $/,
  endingSpaceTabChar: /[ \t]$/,
  nonSpaceChar: /[^ ]/,
  newLineCharGlobal: /\n/g,
  tabCharGlobal: /\t/g,
  leadingSpaceTab: /^[ \t]+/,
  multipleSpaceGlobal: /\s+/g,
  blankLine: /^[ \t]*$/,
  doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
  blockquoteStart: /^ {0,3}>/,
  blockquoteSetextReplace: /\n {0,3}((?:=+|-+)[ \t]*)(?=\n|$)/g,
  blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
  blockquoteMarkerWhitespace: /^( {0,3}>)([ \t]+)/gm,
  listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
  listIsTask: /^\[[ xX]\][ \t]+\S/,
  listReplaceTask: /^\[[ xX]\][ \t]+/,
  listTaskCheckbox: /\[[ xX]\]/,
  anyLine: /\n.*\n/,
  hrefBrackets: /^<(.*)>$/,
  tableDelimiter: /[:|]/,
  tableAlignChars: /^\||\| *$/g,
  tableRowBlankLine: /\n[ \t]*$/,
  tableAlignRight: /^ *-+: *$/,
  tableAlignCenter: /^ *:-+: *$/,
  tableAlignLeft: /^ *:-+ *$/,
  startATag: /^<a /i,
  endATag: /^<\/a>/i,
  startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
  startAngleBracket: /^</,
  endAngleBracket: />$/,
  unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
  numericCharacterReference: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/,
  numericCharacterReferenceOrAmpersand: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  escapeTest: /[&<>"']/,
  escapeReplace: /[&<>"']/g,
  escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  percentDecode: /%25/g,
  findPipe: /\|/g,
  splitPipe: / \|/,
  slashPipe: /\\\|/g,
  carriageReturn: /\r\n|\r/g,
  notSpaceStart: /^\S*/,
  endingNewline: /\n$/,
  listItemRegex: (a) => new RegExp(`^( {0,3}${a})((?:[\t ][^\n]*)?(?:\n|$))`),
  nextBulletRegex: dMemo((a) => new RegExp(`^ {0,${a}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\n]*)?(?:\n|$))`)),
  hrRegex: dMemo((a) => new RegExp(`^ {0,${a}}((?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\\*[ \t]*){3,})(?:\n+|$)`)),
  fencesBeginRegex: dMemo((a) => new RegExp(`^ {0,${a}}(?:\`\`\`|~~~)`)),
  headingBeginRegex: dMemo((a) => new RegExp(`^ {0,${a}}#{1,6}(?:\\s|$)`)),
  htmlBeginRegex: dMemo((a) => new RegExp(`^ {0,${a}}(?:</?(?:${BLOCK_TAG})(?: +|$|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)`, 'i')),
  blockquoteBeginRegex: dMemo((a) => new RegExp(`^ {0,${a}}>`)),
};

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escChar = (c) => ESC_MAP[c];

// marked's P(): escape, encode=true escapes & always, false leaves valid entities alone.
function esc(s, encode) {
  if (encode) {
    if (!OTHER.escapeTest.test(s)) return s;
    return s.replace(OTHER.escapeReplace, escChar);
  }
  if (!OTHER.escapeTestNoEncode.test(s)) return s;
  return s.replace(OTHER.escapeReplaceNoEncode, escChar);
}

// marked's Ie(): decode numeric character references; bare & becomes &amp;.
function decodeEntities(s) {
  if (!OTHER.numericCharacterReference.test(s)) return s;
  return s.replace(OTHER.numericCharacterReferenceOrAmpersand, (m, dec, hex) => {
    if (dec === undefined && hex === undefined) return '&amp;';
    const n = dec === undefined ? parseInt(hex, 16) : parseInt(dec, 10);
    if (n === 0 || n > 0x10FFFF || (n >= 0xD800 && n <= 0xDFFF)) return '\uFFFD';
    if (n === 38) return '&amp;';
    return String.fromCodePoint(n);
  });
}

// marked's he(): encodeURI, un-escaping %25; null when encodeURI throws.
function cleanUrl(href) {
  try { return encodeURI(href).replace(OTHER.percentDecode, '%'); } catch { return null; }
}

// marked's L(): strip a trailing run of ch (or of non-ch when invert).
function trimEnd(s, ch, invert) {
  const n = s.length;
  if (n === 0) return '';
  let c = 0;
  for (; c < n;) {
    const r = s.charAt(n - c - 1);
    if (r === ch && !invert) c++;
    else if (r !== ch && invert) c++;
    else break;
  }
  return s.slice(0, n - c);
}

// marked's ge(): drop trailing blank lines, keeping at most one trailing \n.
function stripTrailingBlanks(a) {
  const e = a.split('\n');
  let t = e.length - 1;
  for (; t >= 0 && OTHER.blankLine.test(e[t]);) t--;
  return e.length - t <= 2 ? a : e.slice(0, t + 1).join('\n');
}

// marked's F(): normalize a link reference label.
function normLabel(a) {
  return a.trim().replace(OTHER.multipleSpaceGlobal, ' ').toLowerCase().toUpperCase().toLowerCase();
}

// marked's ke(): paren balance; -1 ok, -2 too many opens, else index of extra close.
function parenBalance(a, pair) {
  const open = pair[0], close = pair[1];
  if (a.indexOf(open) === -1 && a.indexOf(close) === -1) return -1;
  let t = 0;
  for (let n = 0; n < a.length; n++) {
    if (a[n] === '\\') n++;
    else if (a[n] === open) t++;
    else if (a[n] === close) { t--; if (t < 0) return n; }
  }
  return t > 0 ? -2 : -1;
}

// marked's J(): expand tabs to spaces.
function expandTabs(a, offset = 0) {
  let t = offset, n = '';
  for (const ch of a) {
    if (ch === '\t') { const r = 4 - (t % 4); n += ' '.repeat(r); t += r; }
    else { n += ch; t++; }
  }
  return n;
}

// marked's Dt(): remove the fence's indentation from fenced code lines.
function dedentFence(raw, content) {
  const n = raw.match(OTHER.indentCodeCompensation);
  if (n === null) return content;
  const s = n[1];
  return content.split('\n').map((r) => {
    const o = r.match(OTHER.beginningSpace);
    if (o === null) return r;
    return r.slice(Math.min(o[0].length, s.length));
  }).join('\n');
}

// marked's de(): split a table row into cells.
function splitTableRow(a, count) {
  const t = a.replace(OTHER.findPipe, (r, o, i) => {
    let l = false, p = o;
    for (; --p >= 0 && i[p] === '\\';) l = !l;
    return l ? '|' : ' |';
  });
  const n = t.split(OTHER.splitPipe);
  let s = 0;
  if (n[0].trim() || n.shift(), n.length > 0 && !n.at(-1)?.trim() && n.pop(), count) {
    if (n.length > count) n.splice(count);
    else for (; n.length < count;) n.push('');
  }
  for (; s < n.length; s++) n[s] = n[s].trim().replace(OTHER.slashPipe, '|');
  return n;
}

// marked's fe(): last possible emphasis/del closer positions in a (masked) src.
// Runs are maximal runs of the SAME char (a run of `*_*` is three runs, not one).
const EM_RUN_RE = /([*_~])\1*/g;
function fe(src) {
  const e = { '*': -1, '_': -1 };
  let t = -1;
  EM_RUN_RE.lastIndex = 0;
  let m;
  while ((m = EM_RUN_RE.exec(src)) !== null) {
    const r = m[1];
    const o = m.index === 0 ? '\n' : src[m.index - 1];
    if (o !== ' ' && o !== '\t' && o !== '\n' && o !== '\r' && o !== '\f') {
      if (r === '~') t = m.index; else e[r] = m.index;
    }
  }
  return { maskedSrc: src, lastEm: e, lastDel: t };
}

// Code-point length of a delimiter match (run of * _ ~ plus one trailing char:
// only the trailing char can be non-ASCII). Returns the run length.
function delimRunLen(match0) {
  const n = match0.length;
  if (n >= 2) {
    const hi = match0.charCodeAt(n - 2), lo = match0.charCodeAt(n - 1);
    if (hi >= 0xD800 && hi < 0xDC00 && lo >= 0xDC00 && lo < 0xE000) return n - 2;
  }
  return n - 1;
}

function lastEmCloser(ctx, masked, ch) {
  const top = ctx.maskStack.at(-1);
  if (top && top.maskedSrc === masked) return top.lastEm[ch];
  return fe(masked).lastEm[ch];
}
function lastDelCloser(ctx, masked) {
  const top = ctx.maskStack.at(-1);
  if (top && top.maskedSrc === masked) return top.lastDel;
  return fe(masked).lastDel;
}

// ---------------------------------------------------------------------------
// Inline lexer (fused tokenize + render). Returns HTML strings directly.
// mode is 'html' or 'text' (text = marked's TextRenderer, used for image alt).
// ---------------------------------------------------------------------------

// marked's Lexer.linkInText()
function linkInText(str, ctx) {
  if (!str.includes('[')) return false;
  const t = RI.link;
  for (const n of str.matchAll(RI.blockSkip)) {
    if (t.test(n[0]) && str.charAt(n.index - 1) !== '!') return true;
  }
  for (const n of str.matchAll(RI.reflinkSearch)) {
    const s = n[0], r = s.lastIndexOf('[');
    if (!(s.charAt(0) === '!' || !Object.hasOwn(ctx.links, normLabel(s.slice(r + 1, -1)))) && !(r > 1 && linkInText(s.slice(1, r - 1), ctx))) return true;
  }
  return false;
}

// marked's Lexer.#n(): mask links, punctuation and code so * _ ~ inside them
// cannot act as emphasis delimiters. Length-preserving by construction.
// The three replaces are skipped when their pattern cannot occur at all:
// reflinks need a defined link reference, code/punct masking needs ` or \,
// block-skipping needs ](, ` or <.
function maskSrc(src, ctx) {
  let t = src;
  if (ctx.hasLinks && src.includes('[')) {
    const re = RI.reflinkSearch;
    const s = (r) => {
      const o = r.lastIndexOf('[');
      if (!Object.hasOwn(ctx.links, normLabel(r.slice(o + 1, -1)))) return r;
      if (o > 1 && r.charAt(0) !== '!') {
        const i = r.slice(1, o - 1);
        if (linkInText(i, ctx)) return '[' + i.replace(re, s) + '][' + 'a'.repeat(r.length - o - 2) + ']';
      }
      return '[' + 'a'.repeat(r.length - 2) + ']';
    };
    t = t.replace(re, s);
  }
  if (src.includes('`') || src.includes('\\')) {
    t = t.replace(RI.anyPunctuationOutsideCode, (n, s, r) => r ? '+'.repeat(n.length) : s ? s + n.slice(s.length, -s.length).replace(/`/g, '+') + s : n);
  }
  if (src.includes('](') || src.includes('`') || src.includes('<')) {
    t = t.replace(RI.blockSkip, (n, s, r) => { const o = r ? r.length : 0; return n.slice(0, o) + '[' + 'a'.repeat(n.length - o - 2) + ']'; });
  }
  return t;
}

// marked's Be(): reject a link whose label contains a `<tag>` that runs past
// the end of the label.
function checkLabelAngle(src, label, offset) {
  if (!label.includes('<')) return false;
  for (let s = 0; s < label.length; s++) {
    if (label[s] === '\\') { s++; continue; }
    if (label[s] === '`') { const i = RI.code.exec(label.slice(s)); if (i) { s += i[0].length - 1; continue; } }
    if (label[s] !== '<') continue;
    const r = src.slice(offset + s);
    const o = RI.tag.exec(r) || RI.autolink.exec(r);
    if (o) { if (o[0].length > label.length - s) return true; s += o[0].length - 1; }
  }
  return false;
}

// marked's De() + link/image rendering, fused.
function buildLink(m, href, title, ctx, mode) {
  const isImage = m[0].charAt(0) === '!';
  const label = m[1].replace(OTHER.outputLinkReplace, '$1');
  const prevInLink = ctx.state.inLink, prevEmitted = ctx.state.linkEmitted, prevRaw = ctx.state.inRawBlock;
  ctx.state.inLink = true;
  ctx.state.linkEmitted = false;
  const inner = inlineToHtml(label, ctx, isImage ? 'text' : mode);
  const emittedInner = ctx.state.linkEmitted;
  ctx.state.linkEmitted = prevEmitted;
  ctx.state.inLink = prevInLink;
  if (!isImage) {
    if (emittedInner) { ctx.state.inRawBlock = prevRaw; return null; }
    ctx.state.linkEmitted = true;
  }
  // TextRenderer mode (image alt text): a link/image renders as its inner text.
  if (mode === 'text') return { raw: m[0], html: inner };
  if (isImage) {
    const cleaned = cleanUrl(href);
    if (cleaned === null) return { raw: m[0], html: esc(inner) };
    let o = `<img src="${esc(cleaned)}" alt="${esc(inner)}"`;
    if (title) o += ` title="${esc(title)}"`;
    return { raw: m[0], html: o + '>' };
  }
  const cleaned = cleanUrl(href);
  if (cleaned === null) return { raw: m[0], html: inner };
  let o = `<a href="${esc(cleaned)}"`;
  if (title) o += ` title="${esc(title)}"`;
  return { raw: m[0], html: o + '>' + inner + '</a>' };
}

function tokenizeLink(src, ctx, mode) {
  if (ctx.state.linkParenPossible === false) return null;
  const m = RI.link.exec(src);
  if (!m) return null;
  const n = m[0].charAt(0) === '!' ? 2 : 1;
  if (checkLabelAngle(src, m[1], n)) return null;
  const s = m[2].trim();
  if (OTHER.startAngleBracket.test(s)) {
    if (!OTHER.endAngleBracket.test(s)) return null;
    const l = trimEnd(s.slice(0, -1), '\\');
    if ((s.length - l.length) % 2 === 0) return null;
  } else {
    const l = parenBalance(m[2], '()');
    if (l === -2) return null;
    if (l > -1) {
      const h = (m[0].indexOf('!') === 0 ? 5 : 4) + m[1].length + l;
      m[2] = m[2].substring(0, l);
      m[0] = m[0].substring(0, h).trim();
      m[3] = '';
    }
  }
  const r = trimEnd(m[0].slice(0, -1), '\\');
  if ((m[0].length - r.length) % 2 === 0) return null;
  let href = m[2];
  let title = m[3] ? m[3].slice(1, -1) : '';
  href = href.trim();
  if (OTHER.startAngleBracket.test(href)) href = href.slice(1, -1);
  href = href && href.replace(RI.anyPunctuation, '$1');
  title = title && title.replace(RI.anyPunctuation, '$1');
  return buildLink(m, href, title, ctx, mode);
}

function tokenizeReflink(src, ctx, mode) {
  const m = RI.reflink.exec(src) || RI.nolink.exec(src);
  if (!m) return null;
  const n = m[0].charAt(0) === '!' ? 2 : 1;
  if (checkLabelAngle(src, m[1], n)) return null;
  const r = ctx.links[normLabel(m[2] || m[1])];
  if (!r) {
    const o = m[0].charAt(0);
    return { raw: o, html: o, plain: true };
  }
  return buildLink(m, r.href, r.title, ctx, mode);
}

function tokenizeEmStrong(src, masked, lastChar, ctx, mode) {
  let s = RI.emStrongLDelim.exec(src);
  if (!s || (!s[1] && !s[2] && !s[3] && !s[4])) return null;
  const r = s[0][0];
  const o = lastChar === r;
  // i is how far into the (masked) paragraph we have consumed; the mask is
  // length-preserving, so i is the offset of src within masked.
  const i = masked.length - src.length;
  let l = i;
  for (; l > 0 && masked[l - 1] === r;) l--;
  const sl = masked.slice(Math.max(0, l - 2), l);
  const p = sl === '' ? '' : (sl.length >= 2 && sl.charCodeAt(sl.length - 2) >= 0xD800 && sl.charCodeAt(sl.length - 2) < 0xDC00 && sl.charCodeAt(sl.length - 1) >= 0xDC00 && sl.charCodeAt(sl.length - 1) < 0xE000 ? sl.slice(-2) : sl.slice(-1));
  const h = p === '*' || p === '_' || !!RI.punctuation.exec(p);
  if (l < i) lastChar = p;
  const u = l < i ? h : !!RI.punctuation.exec(lastChar);
  if (s[4] && lastChar.match(OTHER.unicodeAlphaNumeric)) return null;
  const d = s[1] || s[3] || '';
  if (!d || !lastChar || u) {
    const k = delimRunLen(s[0]);
    let g, b, m = k, f = 0;
    const y = i - l + k;
    const R = !!p.trim() && (!!d || (r === '*' && !h));
    if (r !== '*' && r !== '_') return null;
    const A = r === '*' ? RI.emStrongRDelimAst : RI.emStrongRDelimUnd;
    const v = lastEmCloser(ctx, masked, r);
    const Q = i + k;
    if (v < Q) return null;
    const t = masked.slice(i + k);
    const ee = v - Q;
    for (A.lastIndex = 0; (s = A.exec(t)) !== null && !(s.index > ee);) {
      if (g = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !g) continue;
      if (b = g.length, s[3] || s[4]) { m += b; continue; }
      else if (s[5] || s[6] || R) {
        if (o && (s[5] || s[6])) break;
        if (y % 3 && !((y + b) % 3)) { f += b; continue; }
      }
      if (m -= b, m > 0) continue;
      b = Math.min(b, b + m + f);
      const te = s[0].codePointAt(0) > 0xFFFF ? 2 : 1;
      const M = src.slice(0, k + s.index + te + b);
      if (Math.min(k, b) % 2) {
        const U = M.slice(1, -1);
        return { raw: M, html: mode === 'text' ? inlineToHtml(U, ctx, mode) : '<em>' + inlineToHtml(U, ctx, mode) + '</em>' };
      }
      const ne = M.slice(2, -2);
      return { raw: M, html: mode === 'text' ? inlineToHtml(ne, ctx, mode) : '<strong>' + inlineToHtml(ne, ctx, mode) + '</strong>' };
    }
  }
  return null;
}

function tokenizeDel(src, masked, lastChar, ctx, mode) {
  let s = RI.delLDelim.exec(src);
  if (!s) return null;
  // marked: enter the body when the char after the opener is NOT punctuation,
  // or there is no previous char, or the previous char is punctuation.
  if (s[1] && lastChar && !RI.punctuation.exec(lastChar)) return null;
  const o = delimRunLen(s[0]);
  let i, l, p = o;
  const h = RI.delRDelim;
  const u = lastDelCloser(ctx, masked);
  const d = masked.length - src.length + o;
  if (u < d) return null;
  const t = masked.slice(masked.length - src.length + o);
  const k = u - d;
  for (h.lastIndex = 0; (s = h.exec(t)) !== null && !(s.index > k);) {
    if (i = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !i || (l = i.length, l !== o)) continue;
    if (s[3] || s[4]) { p += l; continue; }
    if (p -= l, p > 0) continue;
    l = Math.min(l, l + p);
    const g = s[0].codePointAt(0) > 0xFFFF ? 2 : 1;
    const b = src.slice(0, o + s.index + g + l);
    const mm = b.slice(o, -o);
    return { raw: b, html: mode === 'text' ? inlineToHtml(mm, ctx, mode) : '<del>' + inlineToHtml(mm, ctx, mode) + '</del>' };
  }
  return null;
}

function tokenizeEscape(src, ctx, mode) {
  const m = RI.escape.exec(src);
  if (!m) return null;
  return { raw: m[0], html: mode === 'text' ? m[1] : esc(m[1]) };
}

function tokenizeTag(src, ctx, mode) {
  const m = RI.tag.exec(src);
  if (!m) return null;
  if (!ctx.state.inLink && OTHER.startATag.test(m[0])) ctx.state.inLink = true;
  else if (ctx.state.inLink && OTHER.endATag.test(m[0])) ctx.state.inLink = false;
  if (!ctx.state.inRawBlock && OTHER.startPreScriptTag.test(m[0])) ctx.state.inRawBlock = true;
  else if (ctx.state.inRawBlock && OTHER.endPreScriptTag.test(m[0])) ctx.state.inRawBlock = false;
  return { raw: m[0], html: m[0] };
}

function tokenizeCodespan(src, ctx, mode) {
  const m = RI.code.exec(src);
  if (!m) return null;
  let n = m[2].replace(OTHER.newLineCharGlobal, ' ');
  const s = OTHER.nonSpaceChar.test(n);
  const r = OTHER.startingSpaceChar.test(n) && OTHER.endingSpaceChar.test(n);
  if (s && r) n = n.substring(1, n.length - 1);
  return { raw: m[0], html: mode === 'text' ? n : '<code>' + esc(n, true) + '</code>' };
}

function tokenizeBr(src, ctx, mode) {
  const m = RI.br.exec(src);
  if (!m) return null;
  return { raw: m[0], html: mode === 'text' ? '' : '<br>' };
}

// shared autolink/url rendering (marked's Renderer.link with autolink=true)
function renderAutolink(raw, text, href, ctx, mode) {
  if (mode === 'text') return { raw, html: text };
  const inner = esc(text, true);
  const cleaned = cleanUrl(href);
  if (cleaned === null) return { raw, html: inner };
  return { raw, html: `<a href="${esc(cleaned, true)}">${inner}</a>` };
}

function tokenizeAutolink(src, ctx, mode) {
  const m = RI.autolink.exec(src);
  if (!m) return null;
  let n, s;
  if (m[2] === '@') { n = m[1]; s = 'mailto:' + n; }
  else { n = m[1]; s = n; }
  return renderAutolink(m[0], n, s, ctx, mode);
}

function tokenizeUrl(src, ctx, mode) {
  const m = RI.url.exec(src);
  if (!m) return null;
  let n, s, raw;
  if (m[2] === '@') { n = m[0]; s = 'mailto:' + n; raw = m[0]; }
  else {
    let r;
    raw = m[0];
    do { r = raw; raw = RI._backpedal.exec(raw)?.[0] ?? ''; } while (r !== raw);
    n = raw;
    s = m[1] === 'www.' ? 'http://' + raw : raw;
  }
  return renderAutolink(raw, n, s, ctx, mode);
}

// Exact pre-check for "could the GFM url regex match here?" — its alternatives
// can only start with www. / http(s):// / ftp:// / mailto: / xmpp: / an email.
function mayBeUrl(s) {
  const c = s[0];
  if (c === 'w' && s.startsWith('www.')) return true;
  if (c === 'm' && s.startsWith('mailto:')) return true;
  if (c === 'x' && s.startsWith('xmpp:')) return true;
  if (c === 'h' || c === 'H' || c === 'f' || c === 'F') {
    const low = s.slice(0, 8).toLowerCase();
    if (low.startsWith('http://') || low.startsWith('https://') || low.startsWith('ftp://')) return true;
  }
  if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '.' || c === '_' || c === '+' || c === '-') {
    let j = 0;
    while (j < s.length) {
      const ch = s[j];
      if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch === '.' || ch === '_' || ch === '+' || ch === '-') j++;
      else break;
    }
    if (s[j] === '@') return true;
  }
  return false;
}

// marked's Lexer.inlineTokens + #e + #t, fused with rendering.
function inlineToHtml(src, ctx, mode) {
  const prev = ctx.state.linkParenPossible;
  ctx.state.linkParenPossible = prev && src.includes(')');
  try {
    let masked = src;
    if (src.includes('*') || src.includes('_') || src.includes('~')) masked = maskSrc(src, ctx);
    ctx.maskStack.push(fe(masked));
    try {
      return inlineInner(src, masked, ctx, mode);
    } finally {
      ctx.maskStack.pop();
    }
  } finally {
    ctx.state.linkParenPossible = prev;
  }
}

function inlineInner(src, masked, ctx, mode) {
  let out = '';
  let lastWasText = false;
  let lastChar = '';
  let guard = Infinity;
  while (src.length > 0) {
    if (src.length < guard) guard = src.length;
    else throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
    if (!lastWasText) lastChar = '';
    lastWasText = false;
    const c = src[0];
    let res = null;
    if (c === '\\') {
      res = tokenizeEscape(src, ctx, mode) || tokenizeBr(src, ctx, mode);
    } else if (c === '<') {
      res = tokenizeTag(src, ctx, mode) || tokenizeAutolink(src, ctx, mode);
    } else if (c === '[' || c === '!') {
      res = tokenizeLink(src, ctx, mode) || tokenizeReflink(src, ctx, mode);
    } else if (c === '*' || c === '_') {
      res = tokenizeEmStrong(src, masked, lastChar, ctx, mode);
    } else if (c === '`') {
      res = tokenizeCodespan(src, ctx, mode);
    } else if (c === ' ') {
      res = tokenizeBr(src, ctx, mode);
    } else if (c === '~') {
      res = tokenizeDel(src, masked, lastChar, ctx, mode);
    }
    // marked tries url after all of the above (for any first char, e.g. an
    // email starting with `_` after emStrong fails), gated only by !inLink.
    if (!res && !ctx.state.inLink && mayBeUrl(src)) {
      res = tokenizeUrl(src, ctx, mode);
    }
    if (res) {
      src = src.substring(res.raw.length);
      out += res.html;
      continue;
    }
    // --- text (marked's own GFM text regex; a manual scanner measured ~2% slower) ---
    const t = RI.text.exec(src);
    if (!t) throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
    src = src.substring(t[0].length);
    const inRaw = ctx.state.inRawBlock;
    const text = inRaw ? t[0] : decodeEntities(t[0]);
    out += mode === 'text' ? text : (inRaw ? text : esc(text));
    if (t[0].slice(-1) !== '_') lastChar = t[0].slice(-1);
    lastWasText = true;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Block lexer (marked's Lexer.blockTokens + Tokenizer block methods).
// Tokens keep an inline queue entry `q` ({src, html}) instead of inline tokens.
// ---------------------------------------------------------------------------

function inline(src, ctx) {
  const q = { src, html: '' };
  ctx.queue.push(q);
  return q;
}

function tokenizeSpace(src) {
  const t = RB.newline.exec(src);
  if (t && t[0].length > 0) return { type: 'space', raw: t[0] };
  return null;
}

function tokenizeCode(src) {
  const t = RB.code.exec(src);
  if (!t) return null;
  const raw = stripTrailingBlanks(t[0]);
  return { type: 'code', raw, text: raw.replace(OTHER.codeRemoveIndent, '') };
}

function tokenizeFences(src) {
  const t = RB.fences.exec(src);
  if (!t) return null;
  return { type: 'code', raw: t[0], lang: t[2] ? t[2].trim().replace(RI.anyPunctuation, '$1') : t[2], text: dedentFence(t[0], t[3] || '') };
}

function tokenizeHeading(src, ctx) {
  const t = RB.heading.exec(src);
  if (!t) return null;
  let n = t[2].trim();
  if (OTHER.endingHash.test(n)) {
    const s = trimEnd(n, '#');
    if (!s || OTHER.endingSpaceTabChar.test(s)) n = s.trim();
  }
  return { type: 'heading', raw: trimEnd(t[0], '\n'), depth: t[1].length, text: n, q: inline(n, ctx) };
}

function tokenizeHr(src) {
  const t = RB.hr.exec(src);
  if (!t) return null;
  return { type: 'hr', raw: trimEnd(t[0], '\n') };
}

function tokenizeBlockquote(src, ctx) {
  const t = RB.blockquote.exec(src);
  if (!t) return null;
  let n = trimEnd(t[0], '\n').split('\n');
  let s = '', r = '';
  const o = [];
  for (; n.length > 0;) {
    let i = false;
    const l = [];
    let p;
    for (p = 0; p < n.length; p++) {
      if (OTHER.blockquoteStart.test(n[p])) { l.push(n[p]); i = true; }
      else if (!i) l.push(n[p]);
      else break;
    }
    n = n.slice(p);
    const h = l.join('\n');
    const u = h.replace(OTHER.blockquoteMarkerWhitespace, (g, b, m) => b + expandTabs(m, b.length))
      .replace(OTHER.blockquoteSetextReplace, '\n    $1')
      .replace(OTHER.blockquoteSetextReplace2, '');
    s = s ? `${s}\n${h}` : h;
    r = r ? `${r}\n${u}` : u;
    const d = ctx.state.top;
    ctx.state.top = true;
    blockTokens(u, ctx, o, true);
    ctx.state.top = d;
    if (n.length === 0) break;
    const k = o.at(-1);
    if (k?.type === 'code' || k?.type === 'heading' || k?.type === 'hr' || k?.type === 'html' || k?.type === 'table') break;
    if (k?.type === 'blockquote') {
      const g = k, b = n.join('\n');
      const m = g.raw + '\n' + b.replace(OTHER.blockquoteSetextReplace2, '');
      const f = tokenizeBlockquote(m, ctx);
      o[o.length - 1] = f;
      const y = m.substring(f.raw.length).replace(/^\n/, '');
      const R = y ? y.split('\n').length : 0;
      const A = R ? n.slice(0, -R) : n;
      if (A.length > 0) s = `${s}\n${A.join('\n')}`;
      r = r.substring(0, r.length - g.text.length) + f.text;
      n = n.slice(A.length);
      if (n.length > 0 && OTHER.blockquoteStart.test(n[0])) continue;
      break;
    } else if (k?.type === 'list') {
      const g = k, b = g.raw + '\n' + n.join('\n');
      const m = tokenizeList(b, ctx);
      o[o.length - 1] = m;
      const f = m.raw.length > g.raw.length ? b.slice(g.raw.length + 1, m.raw.length).split('\n').length : 0;
      if (f > 0) {
        const y = n.slice(0, f).join('\n');
        s = `${s}\n${y}`;
        r = `${r}\n${y}`;
      }
      n = n.slice(f);
      continue;
    }
  }
  return { type: 'blockquote', raw: s, tokens: o, text: r };
}

// First-char dispatch for the six list-interruption regexes (all are
// `^ {0,N}MARKER...`, spaces only). Returns true if any of them matches.
// With all=false, only fences/heading/html/hr are tested (the `m` check in
// marked's list loop omits blockquote and next-bullet).
function lineBreaks(line, N, re, all = true) {
  let s = 0;
  while (s < line.length && line[s] === ' ') s++;
  if (s > N) return false;
  const c = line[s];
  if (c === '`' || c === '~') return re.fences.test(line);
  if (c === '#') return re.heading.test(line);
  if (c === '<') return re.html.test(line);
  if (c === '>') return all && re.blockquote.test(line);
  if (c === '*' || c === '+' || c === '-') return (all && re.bullet.test(line)) || re.hr.test(line);
  if (c === '_') return re.hr.test(line);
  if (c >= '0' && c <= '9') return all && re.bullet.test(line);
  return false;
}

function tokenizeList(src, ctx) {
  let t = RB.list.exec(src);
  if (!t) return null;
  const orig = src;
  let e = src;
  const consumed = () => orig.length - e.length;
  const bullet = t[1].trim();
  const ordered = bullet.length > 1;
  const listTok = { type: 'list', raw: '', ordered, start: ordered ? +bullet.slice(0, -1) : '', loose: false, items: [] };
  const r = ordered ? `\\d{1,9}\\${bullet.slice(-1)}` : `\\${bullet}`;
  const l = OTHER.listItemRegex(r);
  let p = false;
  for (; e;) {
    let u = false, d = '';
    if (!(t = l.exec(e)) || RB.hr.test(e)) break;
    const k = consumed();
    e = e.substring(t[0].length);
    const g = t[2].endsWith('\n') ? t[2].slice(0, -1) : t[2];
    const b = t[1].length;
    let m = g.replace(OTHER.leadingSpaceTab, (v) => expandTabs(v, b));
    const nl0 = e.indexOf('\n');
    let f = nl0 === -1 ? e : e.slice(0, nl0);
    const y0 = !m.trim();
    let R = 0;
    let y = y0;
    if (y) R = b + 1;
    else { R = m.search(OTHER.nonSpaceChar); R = R > 4 ? 1 : R; d = m.slice(R); R += b; }
    if (y && OTHER.blankLine.test(f)) { e = e.substring(f.length + 1); u = true; }
    if (!u) {
      const N = Math.max(0, Math.min(3, R - 1));
      const re = {
        fences: OTHER.fencesBeginRegex(R), heading: OTHER.headingBeginRegex(R),
        html: OTHER.htmlBeginRegex(R), blockquote: OTHER.blockquoteBeginRegex(R),
        bullet: OTHER.nextBulletRegex(R), hr: OTHER.hrRegex(R),
      };
      for (; e;) {
        const nl = e.indexOf('\n');
        const U = nl === -1 ? e : e.slice(0, nl);
        let Z;
        f = U;
        Z = (U[0] === ' ' || U[0] === '\t') ? U.replace(OTHER.leadingSpaceTab, (me) => expandTabs(me)) : U;
        if (lineBreaks(f, N, re)) break;
        // first non-space char of Z, and whether the line is blank
        let zns = 0;
        while (zns < Z.length && Z[zns] === ' ') zns++;
        if (zns >= R || zns === Z.length) d += '\n' + Z.slice(R);
        else {
          if (y || m.replace(OTHER.tabCharGlobal, '    ').search(OTHER.nonSpaceChar) >= 4 || lineBreaks(m, N, re, false)) break;
          const qe = /^ {0,3}(?:=+|-+) *$/.test(f) && RB.lheading.test(`${m}\n${f}`) ? `    ${Z.replace(/^ {0,3}/, '')}` : f;
          d += '\n' + qe;
        }
        y = zns === Z.length;
        e = e.substring(U.length + 1);
        m = Z.slice(R);
      }
    }
    const A = orig.slice(k, consumed());
    if (!listTok.loose) {
      if (p) listTok.loose = true;
      else if (OTHER.doubleBlankLine.test(A)) p = true;
    }
    listTok.items.push({ type: 'list_item', raw: A, task: OTHER.listIsTask.test(d), loose: false, text: d, tokens: [] });
  }
  const h = listTok.items.at(-1);
  if (h) { h.raw = h.raw.trimEnd(); h.text = h.text.trimEnd(); }
  else return null;
  listTok.raw = orig.slice(0, consumed()).trimEnd();
  for (const u of listTok.items) {
    ctx.state.top = false;
    u.tokens = blockTokens(u.text, ctx, [], false);
    if (!listTok.loose) {
      const dd = u.tokens.filter((g) => g.type === 'space');
      const kk = dd.length > 0 && dd.some((g) => OTHER.anyLine.test(g.raw));
      listTok.loose = kk;
    }
  }
  for (const u of listTok.items) {
    const dd = u.tokens[0];
    if (u.task && (dd?.type === 'text' || dd?.type === 'paragraph')) {
      u.text = u.text.replace(OTHER.listReplaceTask, '');
      dd.raw = dd.raw.replace(OTHER.listReplaceTask, '');
      dd.text = dd.text.replace(OTHER.listReplaceTask, '');
      for (let g = ctx.queue.length - 1; g >= 0; g--) {
        if (OTHER.listIsTask.test(ctx.queue[g].src)) { ctx.queue[g].src = ctx.queue[g].src.replace(OTHER.listReplaceTask, ''); break; }
      }
      const kk = OTHER.listTaskCheckbox.exec(u.raw);
      if (kk) {
        const g = { type: 'checkbox', raw: kk[0] + ' ', checked: kk[0] !== '[ ]' };
        u.checked = g.checked;
        if (listTok.loose) {
          if (u.tokens[0] && ['paragraph', 'text'].includes(u.tokens[0].type) && u.tokens[0].q) {
            u.tokens[0].raw = g.raw + u.tokens[0].raw;
            u.tokens[0].text = g.raw + u.tokens[0].text;
            u.tokens[0].prefix = checkboxHtml(g);
          } else {
            u.tokens.unshift({ type: 'paragraph', raw: g.raw, text: g.raw, q: { src: '', html: checkboxHtml(g) } });
          }
        } else {
          u.tokens.unshift(g);
        }
      }
    } else if (u.task) {
      u.task = false;
    }
  }
  if (listTok.loose) {
    for (const u of listTok.items) {
      u.loose = true;
      for (const dd of u.tokens) if (dd.type === 'text') dd.type = 'paragraph';
    }
  }
  return listTok;
}

function checkboxHtml(g) {
  return '<input ' + (g.checked ? 'checked="" ' : '') + 'disabled="" type="checkbox"> ';
}

function tokenizeHtml(src) {
  const t = RB.html.exec(src);
  if (!t) return null;
  const n = stripTrailingBlanks(t[0]);
  return { type: 'html', block: true, raw: n, pre: t[1] === 'pre' || t[1] === 'script' || t[1] === 'style', text: n };
}

function tokenizeDef(src) {
  const t = RB.def.exec(src);
  if (!t) return null;
  if (!OTHER.startAngleBracket.test(t[2]) && parenBalance(t[2], '()') !== -1) return null;
  const tag = normLabel(t[1]);
  const href = t[2] ? t[2].replace(OTHER.hrefBrackets, '$1').replace(RI.anyPunctuation, '$1') : '';
  const title = t[3] ? t[3].substring(1, t[3].length - 1).replace(RI.anyPunctuation, '$1') : t[3];
  return { type: 'def', tag, raw: trimEnd(t[0], '\n'), href, title };
}

function tokenizeTable(src, ctx) {
  const t = RB.table.exec(src);
  if (!t || !OTHER.tableDelimiter.test(t[2])) return null;
  const headerCells = splitTableRow(t[1]);
  const aligns = t[2].replace(OTHER.tableAlignChars, '').split('|');
  const rows = t[3]?.trim() ? t[3].replace(OTHER.tableRowBlankLine, '').split('\n') : [];
  const tok = { type: 'table', raw: trimEnd(t[0], '\n'), header: [], align: [], rows: [] };
  if (headerCells.length === aligns.length) {
    for (const a of aligns) {
      tok.align.push(OTHER.tableAlignRight.test(a) ? 'right' : OTHER.tableAlignCenter.test(a) ? 'center' : OTHER.tableAlignLeft.test(a) ? 'left' : null);
    }
    for (let i = 0; i < headerCells.length; i++) {
      tok.header.push({ text: headerCells[i], q: inline(headerCells[i], ctx), header: true, align: tok.align[i] });
    }
    for (const row of rows) {
      tok.rows.push(splitTableRow(row, tok.header.length).map((cell, p) => ({ text: cell, q: inline(cell, ctx), header: false, align: tok.align[p] })));
    }
    return tok;
  }
  return null;
}

function tokenizeLheading(src, ctx) {
  const t = RB.lheading.exec(src);
  if (!t) return null;
  const n = t[1].trim();
  return { type: 'heading', raw: trimEnd(t[0], '\n'), depth: t[2].charAt(0) === '=' ? 1 : 2, text: n, q: inline(n, ctx) };
}

function tokenizeParagraph(src, ctx) {
  const t = RB.paragraph.exec(src);
  if (!t) return null;
  const n = t[1].charAt(t[1].length - 1) === '\n' ? t[1].slice(0, -1) : t[1];
  return { type: 'paragraph', raw: t[0], text: n, q: inline(n, ctx) };
}

function tokenizeText(src, ctx) {
  const t = RB.text.exec(src);
  if (!t) return null;
  return { type: 'text', raw: t[0], text: t[0], q: inline(t[0], ctx) };
}

// Cheap necessary-condition gates so the expensive block regexes are only
// tried where they could possibly match.
function blockGate(src, kind) {
  let i = 0;
  while (src[i] === ' ' && i < 3) i++;
  const c = src[i];
  switch (kind) {
    case 'space': return c === ' ' || c === '\t' || c === '\n' || c === undefined;
    case 'code': {
      let j = 0;
      while (src[j] === ' ') j++;
      return j >= 4 || src[j] === '\t';
    }
    case 'fences': return i <= 3 && (src.startsWith('```', i) || src.startsWith('~~~', i));
    case 'heading': return i <= 3 && c === '#';
    case 'hr': return i <= 3 && (c === '-' || c === '_' || c === '*');
    case 'blockquote': return i <= 3 && c === '>';
    case 'list': return i <= 3 && (c === '*' || c === '+' || c === '-' || (c >= '0' && c <= '9'));
    case 'html': return i <= 3 && c === '<';
    case 'def': return i <= 3 && c === '[';
    case 'table': {
      const nl = src.indexOf('\n');
      if (nl === -1) return false;
      const line2 = src.slice(nl + 1, src.indexOf('\n', nl + 1) === -1 ? undefined : src.indexOf('\n', nl + 1));
      return /^ {0,3}(?:\| *)?:?-+:? *(?:\| *:?-+:? *)*(?:\| *)?$/.test(line2);
    }
    case 'lheading': {
      // A setext underline can only sit inside the current block (up to the
      // next blank line). Bounding the scan keeps this from sweeping the
      // whole remaining document on every paragraph.
      const blank = /\n[ \t]*\n/.exec(src);
      const region = blank ? src.slice(0, blank.index + 1) : src;
      return /\n {0,3}(=+|-+) *(?:\n|$)/.test(region);
    }
    default: return true;
  }
}

function blockTokens(src, ctx, tokens, nested) {
  let guard = Infinity;
  for (; src;) {
    if (src.length < guard) guard = src.length;
    else throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
    let r;
    if (blockGate(src, 'space') && (r = tokenizeSpace(src))) {
      src = src.substring(r.raw.length);
      const i = tokens.at(-1);
      if (r.raw.length === 1 && i !== undefined) i.raw += '\n'; else tokens.push(r);
      continue;
    }
    if (blockGate(src, 'code') && (r = tokenizeCode(src))) {
      src = src.substring(r.raw.length);
      const i = tokens.at(-1);
      if (i?.type === 'paragraph' || i?.type === 'text') {
        i.raw += (i.raw.endsWith('\n') ? '' : '\n') + r.raw;
        i.text += '\n' + r.text;
        i.q.src = i.text;
      } else tokens.push(r);
      continue;
    }
    if (blockGate(src, 'fences') && (r = tokenizeFences(src))) { src = src.substring(r.raw.length); tokens.push(r); continue; }
    if (blockGate(src, 'heading') && (r = tokenizeHeading(src, ctx))) { src = src.substring(r.raw.length); tokens.push(r); continue; }
    if (blockGate(src, 'hr') && (r = tokenizeHr(src))) { src = src.substring(r.raw.length); tokens.push(r); continue; }
    if (blockGate(src, 'blockquote') && (r = tokenizeBlockquote(src, ctx))) { src = src.substring(r.raw.length); tokens.push(r); continue; }
    if (blockGate(src, 'list') && (r = tokenizeList(src, ctx))) { src = src.substring(r.raw.length); tokens.push(r); continue; }
    if (blockGate(src, 'html') && (r = tokenizeHtml(src))) { src = src.substring(r.raw.length); tokens.push(r); continue; }
    if (blockGate(src, 'def') && (r = tokenizeDef(src))) {
      src = src.substring(r.raw.length);
      const i = tokens.at(-1);
      if (i?.type === 'paragraph' || i?.type === 'text') {
        i.raw += (i.raw.endsWith('\n') ? '' : '\n') + r.raw;
        i.text += '\n' + r.raw;
        i.q.src = i.text;
      } else {
        if (!ctx.links[r.tag]) ctx.links[r.tag] = { href: r.href, title: r.title };
        ctx.hasLinks = true;
        tokens.push(r);
      }
      continue;
    }
    if (blockGate(src, 'table') && (r = tokenizeTable(src, ctx))) { src = src.substring(r.raw.length); tokens.push(r); continue; }
    if (blockGate(src, 'lheading') && (r = tokenizeLheading(src, ctx))) { src = src.substring(r.raw.length); tokens.push(r); continue; }
    if (ctx.state.top && (r = tokenizeParagraph(src, ctx))) {
      const i = tokens.at(-1);
      if (nested && i?.type === 'paragraph') {
        i.raw += (i.raw.endsWith('\n') ? '' : '\n') + r.raw;
        i.text += '\n' + r.text;
        ctx.queue.pop();
        i.q.src = i.text;
      } else tokens.push(r);
      nested = false;
      src = src.substring(r.raw.length);
      continue;
    }
    if (r = tokenizeText(src, ctx)) {
      src = src.substring(r.raw.length);
      const i = tokens.at(-1);
      if (i?.type === 'text') {
        i.raw += (i.raw.endsWith('\n') ? '' : '\n') + r.raw;
        i.text += '\n' + r.text;
        ctx.queue.pop();
        i.q.src = i.text;
      } else tokens.push(r);
      continue;
    }
    if (src) throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
  }
  ctx.state.top = true;
  return tokens;
}

// ---------------------------------------------------------------------------
// Renderer (marked's Parser + Renderer, over the fused tokens)
// ---------------------------------------------------------------------------

function renderTableCell(cell) {
  const tag = cell.header ? 'th' : 'td';
  return (cell.align ? `<${tag} align="${cell.align}">` : `<${tag}>`) + cell.q.html + `</${tag}>\n`;
}

function renderTokens(tokens) {
  let out = '';
  for (const tok of tokens) {
    switch (tok.type) {
      case 'space': break;
      case 'hr': out += '<hr>\n'; break;
      case 'heading': out += `<h${tok.depth}>${tok.q.html}</h${tok.depth}>\n`; break;
      case 'code': {
        const s = (tok.lang || '').match(OTHER.notSpaceStart)?.[0];
        const r = tok.text ? tok.text.replace(OTHER.endingNewline, '') + '\n' : '';
        out += s
          ? `<pre><code class="language-${esc(s)}">${esc(r, true)}</code></pre>\n`
          : `<pre><code>${esc(r, true)}</code></pre>\n`;
        break;
      }
      case 'table': {
        let h = '';
        for (const c of tok.header) h += renderTableCell(c);
        const thead = `<tr>\n${h}</tr>\n`;
        let s = '';
        for (const row of tok.rows) {
          let n = '';
          for (const c of row) n += renderTableCell(c);
          s += `<tr>\n${n}</tr>\n`;
        }
        if (s) s = `<tbody>${s}</tbody>`;
        out += `<table>\n<thead>\n${thead}</thead>\n${s}</table>\n`;
        break;
      }
      case 'blockquote': out += `<blockquote>\n${renderTokens(tok.tokens)}</blockquote>\n`; break;
      case 'list': {
        let s = '';
        for (const item of tok.items) s += `<li>${renderTokens(item.tokens)}</li>\n`;
        const tag = tok.ordered ? 'ol' : 'ul';
        const start = tok.ordered && tok.start !== 1 ? ` start="${tok.start}"` : '';
        out += `<${tag}${start}>\n${s}</${tag}>\n`;
        break;
      }
      case 'checkbox': out += checkboxHtml(tok); break;
      case 'html': out += tok.text; break;
      case 'def': break;
      case 'paragraph': out += `<p>${tok.prefix || ''}${tok.q.html}</p>\n`; break;
      case 'text': out += (tok.prefix || '') + tok.q.html; break;
      default: throw new Error('Token with "' + tok.type + '" type was not found.');
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Entry point: marked-compatible parse(markdown)
// ---------------------------------------------------------------------------

export function parse(markdown) {
  if (typeof markdown !== 'string') {
    throw new Error('marked(): input parameter is of type ' + Object.prototype.toString.call(markdown) + ', string expected');
  }
  const ctx = {
    links: Object.create(null),
    hasLinks: false,
    queue: [],
    state: { inLink: false, inRawBlock: false, linkEmitted: false, linkParenPossible: true, top: true },
    maskStack: [],
  };
  const src = markdown.replace(OTHER.carriageReturn, '\n');
  const tokens = blockTokens(src, ctx, [], false);
  for (const q of ctx.queue) {
    ctx.state.inRawBlock = false;
    q.html = inlineToHtml(q.src, ctx, 'html');
  }
  return renderTokens(tokens);
}

export default parse;
