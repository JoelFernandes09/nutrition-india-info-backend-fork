'use strict';

/**
 * STEP 1: No areas.json in repo — generate from Solr (same pattern as routes/api url_4d).
 * Supports Solr queries elsewhere; does not replace them.
 */

const fs = require('fs');
const path = require('path');
const { search } = require('./_solrScriptClient');

const OUT_DIR = path.join(__dirname, '..', 'data-metadata');
const OUT_FILE = path.join(OUT_DIR, 'areas.json');

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function main() {
  const cQuery = [
    'fl=area_id,area_parent_id,area_name,area_level',
    'group.field=area_id',
    'group.main=true',
    'group=true',
    'omitHeader=true',
    'q=*:*',
    'rows=10000',
    'sort=area_id asc',
  ].join('&');

  const result = await search(cQuery);
  let docs = Array.isArray(result?.response?.docs) ? result.response.docs : [];

  if (!docs.length && result?.grouped?.area_id?.groups) {
    docs = result.grouped.area_id.groups
      .map((g) => (Array.isArray(g?.doclist?.docs) ? g.doclist.docs[0] : null))
      .filter(Boolean);
  }

  const rows = docs
    .map((d) => {
      const id = toNum(d.area_id);
      if (id === null) return null;
      const parent = toNum(d.area_parent_id);
      return {
        id,
        name: typeof d.area_name === 'string' ? d.area_name : String(d.area_name ?? ''),
        level: toNum(d.area_level) ?? 0,
        parent_id: parent === null ? null : parent,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.id - b.id);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(rows, null, 2), 'utf8');
  console.log(`[extractAreas] Wrote ${rows.length} rows → ${OUT_FILE}`);
}

main().catch((e) => {
  console.error('[extractAreas] Failed:', e.message || e);
  process.exit(1);
});
