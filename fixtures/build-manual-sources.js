#!/usr/bin/env node
/**
 * build-manual-sources.js — turn docs/manuals/*.md into the citation registry.
 *
 * Each manual carries front matter (docId, platform, title, publisher, url, verified,
 * checked, file) and numbered section headings:
 *
 *     ## 3. modifier-set-columns — Modifiers travel as one Y/N column per set
 *
 * The first paragraph under a heading becomes that section's **excerpt**, i.e. the exact
 * text a workflow citation resolves to in the verifier, the UI tooltip and the run record.
 * The manual file is therefore the single source of truth for both prose and evidence, and
 * a section that exists only in the registry (or only in the manual) is a build error.
 *
 *   node fixtures/build-manual-sources.js            # write server/sources.manuals.generated.js
 *   node fixtures/build-manual-sources.js --check     # exit 1 if the generated file is stale
 */
const fs = require('fs');
const path = require('path');

const MANUAL_DIR = path.join(__dirname, '..', 'docs', 'manuals');
const OUT = path.join(__dirname, '..', 'server', 'sources.manuals.generated.js');
const CHECK = process.argv.includes('--check');
const HEADING = /^## \d+\.\s+([a-z0-9-]+)\s+—\s+(.+)$/;

/** minimal front matter: `key: value` and `key: >` folded blocks */
function parseFrontMatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0].trim() !== '---') throw new Error('manual must start with a --- front matter block');
  const meta = {};
  let i = 1;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') break;
    const m = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!m) throw new Error(`front matter: unparseable line ${i + 1}: ${line}`);
    const [, key, inline] = m;
    if (inline.trim() === '>') {                       // folded block: consume indented lines
      const parts = [];
      while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1])) parts.push(lines[++i].trim());
      meta[key] = parts.join(' ').replace(/\s+/g, ' ');
    } else {
      meta[key] = inline.trim().replace(/^["'](.*)["']$/, '$1');
    }
  }
  if (i >= lines.length) throw new Error('front matter block never closed with ---');
  return { meta, bodyIdx: i + 1 };
}

/** strip inline markdown so excerpts read as sentences, not source */
function plain(md) {
  return md
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstParagraph(bodyLines, from) {
  const out = [];
  let started = false;
  for (let i = from; i < bodyLines.length; i++) {
    const l = bodyLines[i];
    if (/^#{1,6}\s/.test(l)) break;                    // next section: nothing citable here
    const blank = !l.trim();
    const skip = blank || l.startsWith('|') || l.startsWith('>');   // tables/quotes are not prose
    if (!started) { if (skip) continue; started = true; }           // look past a leading table
    else if (skip) break;                                          // paragraph ends there
    out.push(l.trim());
  }
  let text = plain(out.join(' '));
  if (text.length > 300) {                            // keep it citable: cut at a sentence end
    const head = text.slice(0, 300);
    const stop = Math.max(head.lastIndexOf('. '), head.lastIndexOf('; '));
    text = stop > 120 ? head.slice(0, stop + 1) : head.replace(/,?\s[^ ]*$/, '') + ' …';
  }
  if (text && !/[.!?…]$/.test(text)) text = text.replace(/[,;:]\s*$/, '') + '.';
  return text;
}

function parseManual(file) {
  const raw = fs.readFileSync(path.join(MANUAL_DIR, file), 'utf8');
  const { meta, bodyIdx } = parseFrontMatter(raw);
  const lines = raw.split(/\r?\n/).slice(bodyIdx);
  for (const key of ['docId', 'platform', 'title', 'publisher', 'url', 'verified', 'file']) {
    if (!meta[key]) throw new Error(`${file}: front matter missing "${key}"`);
  }
  const sections = {};
  let headings = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(HEADING);
    if (!m) continue;
    const [, key, headingTitle] = m;
    headings++;
    if (sections[key]) throw new Error(`${file}: duplicate section key "${key}"`);
    const excerpt = firstParagraph(lines, i + 1);
    if (!excerpt || excerpt.length < 40) {
      throw new Error(`${file}: section "${key}" has no citable opening paragraph (need >=40 chars)`);
    }
    sections[key] = excerpt;
  }
  if (headings < 5) throw new Error(`${file}: only ${headings} numbered sections (need >=5)`);
  return {
    id: meta.docId,
    doc: {
      title: meta.title,
      publisher: meta.publisher,
      url: meta.url,
      verified: meta.verified,
      checked: meta.checked || '',
      platform: meta.platform,
      manual: meta.file,
      sections,
    },
  };
}

function build() {
  const files = fs.readdirSync(MANUAL_DIR).filter(f => f.endsWith('.md') && f !== 'README.md').sort();
  if (!files.length) throw new Error(`no manuals found in ${MANUAL_DIR}`);
  const docs = {};
  const report = [];
  for (const f of files) {
    const { id, doc } = parseManual(f);
    if (docs[id]) throw new Error(`duplicate docId "${id}" (${f})`);
    docs[id] = doc;
    report.push(`${f} → ${id} (${Object.keys(doc.sections).length} sections)`);
  }
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, '');
  const body =
`/**
 * sources.manuals.generated.js — GENERATED, DO NOT EDIT.
 * Derived from docs/manuals/*.md by fixtures/build-manual-sources.js (that script and those
 * files are the source of truth; edit a manual, then re-run the builder).
 * Regenerated: ${stamp}
 *   ${report.join('\n *   ')}
 */

const MANUAL_SOURCES = ${JSON.stringify(docs, null, 2)};

module.exports = MANUAL_SOURCES;
`;
  return { docs, body, report };
}

const { docs, body } = build();
const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
// ignore the regenerated timestamp line when checking for drift
const strip = s => s.replace(/^ \* Regenerated:.*$/m, '');
if (CHECK) {
  if (strip(current) !== strip(body)) {
    console.error('STALE: server/sources.manuals.generated.js does not match docs/manuals/*.md');
    console.error('       run: node fixtures/build-manual-sources.js');
    process.exit(1);
  }
  console.log(`up to date: ${Object.keys(docs).length} manual docs, ` +
    `${Object.values(docs).reduce((n, d) => n + Object.keys(d.sections).length, 0)} sections`);
  process.exit(0);
}
fs.writeFileSync(OUT, body);
const secs = Object.values(docs).reduce((n, d) => n + Object.keys(d.sections).length, 0);
console.log(`wrote server/sources.manuals.generated.js — ${Object.keys(docs).length} docs, ${secs} sections`);
for (const f of fs.readdirSync(MANUAL_DIR).filter(f => f.endsWith('.md') && f !== 'README.md').sort()) {
  const { id, doc } = parseManual(f);
  console.log(`  ${f.padEnd(20)} ${id.padEnd(22)} ${Object.keys(doc.sections).length} sections`);
}
