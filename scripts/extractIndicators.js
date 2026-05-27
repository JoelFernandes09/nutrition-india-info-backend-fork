'use strict';

/**
 * STEP 1: No indicators.json in repo — generate from Solr (grouped by indicator_id).
 */

const fs = require('fs');
const path = require('path');
const { search } = require('./_solrScriptClient');

const OUT_DIR = path.join(__dirname, '..', 'data-metadata');
const OUT_FILE = path.join(OUT_DIR, 'indicators.json');

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function pickName(doc) {
  if (doc.indicator_name && String(doc.indicator_name).trim()) return String(doc.indicator_name).trim();
  if (doc.indicator_short_name && String(doc.indicator_short_name).trim()) {
    return String(doc.indicator_short_name).trim();
  }
  return doc.indicator_id != null ? `Indicator ${doc.indicator_id}` : '';
}

async function main() {
  const cQuery = [
    'fl=indicator_id,indicator_name,indicator_short_name',
    'group.field=indicator_id',
    'group.main=true',
    'group=true',
    'omitHeader=true',
    'q=*:*',
    'rows=5000',
    'sort=indicator_id asc',
  ].join('&');

  const result = await search(cQuery);
  let docs = Array.isArray(result?.response?.docs) ? result.response.docs : [];

  if (!docs.length && result?.grouped?.indicator_id?.groups) {
    docs = result.grouped.indicator_id.groups
      .map((g) => (Array.isArray(g?.doclist?.docs) ? g.doclist.docs[0] : null))
      .filter(Boolean);
  }

  const seen = new Set();
  const rows = [];
  for (const d of docs) {
    const id = toNum(d.indicator_id);
    if (id === null || seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      name: pickName(d),
      aliases: [],
    });
  }

  rows.sort((a, b) => a.id - b.id);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(rows, null, 2), 'utf8');
  console.log(`[extractIndicators] Wrote ${rows.length} rows → ${OUT_FILE}`);
}

main().catch((e) => {
  console.error('[extractIndicators] Failed:', e.message || e);
  process.exit(1);
});
