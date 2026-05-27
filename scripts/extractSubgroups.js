'use strict';

/**
 * STEP 1: No subgroups.json in repo — generate from Solr (grouped by subgroup_id).
 */

const fs = require('fs');
const path = require('path');
const { search } = require('./_solrScriptClient');

const OUT_DIR = path.join(__dirname, '..', 'data-metadata');
const OUT_FILE = path.join(OUT_DIR, 'subgroups.json');

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function main() {
  const cQuery = [
    'fl=subgroup_id,subgroup_name',
    'group.field=subgroup_id',
    'group.main=true',
    'group=true',
    'omitHeader=true',
    'q=*:*',
    'rows=500',
    'sort=subgroup_id asc',
  ].join('&');

  const result = await search(cQuery);
  let docs = Array.isArray(result?.response?.docs) ? result.response.docs : [];

  if (!docs.length && result?.grouped?.subgroup_id?.groups) {
    docs = result.grouped.subgroup_id.groups
      .map((g) => (Array.isArray(g?.doclist?.docs) ? g.doclist.docs[0] : null))
      .filter(Boolean);
  }

  const seen = new Set();
  const rows = [];
  for (const d of docs) {
    const id = toNum(d.subgroup_id);
    if (id === null || seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      name: typeof d.subgroup_name === 'string' ? d.subgroup_name : String(d.subgroup_name ?? ''),
    });
  }

  rows.sort((a, b) => a.id - b.id);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(rows, null, 2), 'utf8');
  console.log(`[extractSubgroups] Wrote ${rows.length} rows → ${OUT_FILE}`);
}

main().catch((e) => {
  console.error('[extractSubgroups] Failed:', e.message || e);
  process.exit(1);
});
