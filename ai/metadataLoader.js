'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data-metadata');

const readJsonArray = (filename) => {
  const fp = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fp)) return [];
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const readJsonObject = (filename) => {
  const fp = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fp)) return null;
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
};

const areasCache = [];
const indicatorsCache = [];
const subgroupsCache = [];
const timeperiodsCache = {
  default: { id: 52, name: 'NFHS6 2023-2024' },
  indicatorFamilies: { srs: [509, 366, 53, 62], cnns: [515], nsso: [47, 46, 48] },
  periods: [],
};

const loadInto = (target, filename) => {
  const data = readJsonArray(filename);
  target.length = 0;
  for (const row of data) target.push(row);
};

const reloadMetadata = () => {
  loadInto(areasCache, 'areas.json');
  loadInto(indicatorsCache, 'indicators.json');
  loadInto(subgroupsCache, 'subgroups.json');

  const timeperiods = readJsonObject('timeperiods.json');
  if (timeperiods) {
    if (timeperiods.default) timeperiodsCache.default = timeperiods.default;
    if (timeperiods.indicatorFamilies) {
      timeperiodsCache.indicatorFamilies = timeperiods.indicatorFamilies;
    }
    if (Array.isArray(timeperiods.periods)) {
      timeperiodsCache.periods = timeperiods.periods;
    }
  }

  try {
    const { refreshCatalog } = require('./timeperiodResolver');
    refreshCatalog();
  } catch {
    // timeperiodResolver not loaded yet on first pass
  }
};

reloadMetadata();

const norm = (s) => String(s ?? '').trim().toLowerCase();

const INDIA_AREA_ID = 1;
const MIN_AREA_NAME_LEN = 3;

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getAreas = () => areasCache;

const getAreaById = (id) => {
  const num = Number(id);
  if (!Number.isFinite(num)) return null;
  return getAreas().find((a) => a.id === num) || null;
};

const getChildrenAreas = (parentId, childLevel = null) => {
  const pid = Number(parentId);
  if (!Number.isFinite(pid)) return [];
  return getAreas().filter((a) => {
    if (a.parent_id !== pid) return false;
    if (childLevel != null && a.level !== childLevel) return false;
    return true;
  });
};

const getIndicators = () => indicatorsCache;

const getSubgroups = () => subgroupsCache;

const getTimeperiods = () => timeperiodsCache.periods;

const getTimeperiodDefault = () => timeperiodsCache.default;

const getTimeperiodIndicatorFamilies = () => timeperiodsCache.indicatorFamilies;

const getTimeperiodById = (id) => {
  const num = Number(id);
  if (!Number.isFinite(num)) return null;
  return getTimeperiods().find((tp) => tp.id === num) || null;
};

const findTimeperiodByName = (name, opts = {}) => {
  const partial = opts.partial !== false;
  const q = norm(name);
  if (!q) return null;
  const list = getTimeperiods();

  const exact = list.find((tp) => norm(tp.name) === q);
  if (exact) return exact;
  if (!partial) return null;

  return (
    list.find((tp) => {
      if (norm(tp.name).includes(q) || q.includes(norm(tp.name))) return true;
      if (Array.isArray(tp.aliases)) {
        return tp.aliases.some((a) => norm(a) === q || norm(a).includes(q) || q.includes(norm(a)));
      }
      return false;
    }) || null
  );
};

const findAreaByName = (name, opts = {}) => {
  const partial = opts.partial !== false;
  const q = norm(name);
  if (!q) return null;
  const list = getAreas();
  const preferLevel = opts.preferLevel ?? null;

  const exactMatches = list.filter((a) => norm(a.name) === q);
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) {
    if (preferLevel != null) {
      return exactMatches.find((a) => a.level === preferLevel) || exactMatches[0];
    }
    return exactMatches.sort((a, b) => a.level - b.level)[0];
  }

  if (!partial) return null;

  const partialMatches = list.filter(
    (a) => norm(a.name).includes(q) || q.includes(norm(a.name))
  );
  if (partialMatches.length === 0) return null;
  if (preferLevel != null) {
    const atLevel = partialMatches.find((a) => a.level === preferLevel);
    if (atLevel) return atLevel;
  }
  return partialMatches.sort((a, b) => norm(b.name).length - norm(a.name).length)[0];
};

const dedupeAreaMatches = (matches) => {
  const sorted = [...matches].sort((a, b) => norm(b.name).length - norm(a.name).length);
  const kept = [];
  for (const area of sorted) {
    const name = norm(area.name);
    const overshadowed = kept.some((k) => {
      const kName = norm(k.name);
      return kName.length > name.length && kName.includes(name);
    });
    if (!overshadowed) kept.push(area);
  }
  return kept;
};

const levenshteinDistance = (a, b) => {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[rows - 1][cols - 1];
};

const maxEditDistanceFor = (tokenLen) => {
  if (tokenLen <= 6) return 1;
  if (tokenLen <= 10) return 2;
  if (tokenLen <= 14) return 3;
  return Math.floor(tokenLen * 0.25);
};

const cleanLocationHint = (raw) => {
  return String(raw || '')
    .trim()
    .replace(/\s+(districts|states|subdistricts|comparison|comparision|compare|data|rate|wise|nfhs\d*).*$/i, '')
    .replace(/\s+in\s+(percentage|percent|pct|burden|numbers?|count|population).*$/i, '')
    .replace(/\s+(as\s+)?(a\s+)?(percentage|percent|pct)\b.*$/i, '')
    .trim();
};

const extractLocationHints = (query) => {
  const hints = [];
  const re = /\b(?:in|for|across|within|inside)\s+([a-z][a-z\s-]+)/gi;
  let match;
  while ((match = re.exec(query)) !== null) {
    const hint = cleanLocationHint(match[1]);
    if (hint.length >= MIN_AREA_NAME_LEN) hints.push(hint);
  }
  return hints;
};

const fuzzyMatchArea = (token, opts = {}) => {
  const q = norm(token);
  if (q.length < MIN_AREA_NAME_LEN) return null;

  const preferLevel = opts.preferLevel ?? null;
  const maxDist = maxEditDistanceFor(q.length);
  let best = null;
  let bestScore = Infinity;

  for (const area of getAreas()) {
    const name = norm(area.name);
    if (name.length < MIN_AREA_NAME_LEN) continue;
    if (Math.abs(name.length - q.length) > maxDist) continue;

    const dist = levenshteinDistance(q, name);
    if (dist > maxDist) continue;

    let score = dist;
    if (preferLevel != null && area.level !== preferLevel) score += 0.35;
    if (score < bestScore) {
      bestScore = score;
      best = area;
    }
  }

  return best;
};

const findAreasInQueryExact = (query) => {
  const q = norm(query);
  if (!q) return [];

  const sorted = [...getAreas()].sort((a, b) => norm(b.name).length - norm(a.name).length);
  const matches = [];

  for (const area of sorted) {
    const name = norm(area.name);
    if (name.length < MIN_AREA_NAME_LEN) continue;
    const pattern = new RegExp(`\\b${escapeRegex(name)}\\b`, 'i');
    if (pattern.test(q)) matches.push(area);
  }

  return dedupeAreaMatches(matches);
};

const findAreasInQuery = (query) => {
  const exact = findAreasInQueryExact(query);
  if (exact.length) return exact;

  const hints = extractLocationHints(query);
  const fuzzyMatches = [];

  for (const hint of hints) {
    const hintExact = findAreasInQueryExact(hint);
    if (hintExact.length) {
      fuzzyMatches.push(...hintExact);
      continue;
    }
    const fuzzy = fuzzyMatchArea(hint);
    if (fuzzy) {
      fuzzyMatches.push(fuzzy);
      continue;
    }
    for (const token of hint.split(/\s+/).filter((t) => t.length >= MIN_AREA_NAME_LEN)) {
      const tokenMatch = fuzzyMatchArea(token);
      if (tokenMatch) fuzzyMatches.push(tokenMatch);
    }
  }

  return dedupeAreaMatches(fuzzyMatches);
};

const detectBreakdownLevel = (qLower) => {
  if (/\b(sub[-\s]?districts|subdistricts|blocks|tehsils|talukas)\b/.test(qLower)) return 4;
  if (/\b(district[-\s]?wise|districts)\b/.test(qLower)) return 3;
  if (
    /\bstate[-\s]?wise\b/.test(qLower) ||
    /\ball\s+states\b/.test(qLower) ||
    /\b(compare|comparison|comparision|across|among)\s+states\b/.test(qLower) ||
    /\bstates\s+(comparison|compare|comparision|wise)\b/.test(qLower)
  ) {
    return 2;
  }
  return null;
};

const detectScopedComparisonLevel = (qLower, primary) => {
  if (!/\b(compar(?:e|ison|ision)|comparision)\b/.test(qLower)) return null;
  if (/\b(compare|comparison|comparision|across|among)\s+states\b/.test(qLower)) return null;
  if (!primary) return null;
  if (primary.level === 1) return 2;
  if (primary.level === 2) return 3;
  if (primary.level === 3) return 4;
  return null;
};

const pickPrimaryArea = (matches, breakdownLevel) => {
  if (!matches.length) return null;

  const byName = new Map();
  for (const area of matches) {
    const key = norm(area.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(area);
  }

  const resolved = [];
  for (const group of byName.values()) {
    if (group.length === 1) {
      resolved.push(group[0]);
      continue;
    }
    if (breakdownLevel === 4) {
      resolved.push(group.find((a) => a.level === 3) || group.sort((a, b) => a.level - b.level)[0]);
    } else if (breakdownLevel === 3) {
      resolved.push(group.find((a) => a.level === 2) || group.sort((a, b) => a.level - b.level)[0]);
    } else {
      resolved.push(group.sort((a, b) => a.level - b.level)[0]);
    }
  }

  return resolved.sort((a, b) => norm(b.name).length - norm(a.name).length)[0];
};

const resolveParentForBreakdown = (breakdownLevel, primary) => {
  if (breakdownLevel === 2) {
    if (primary?.level === 1) return primary;
    if (primary?.level === 2) return getAreaById(INDIA_AREA_ID);
    return getAreaById(INDIA_AREA_ID);
  }

  if (breakdownLevel === 3) {
    if (primary?.level === 2) return primary;
    if (primary?.level === 3) return getAreaById(primary.parent_id);
    return null;
  }

  if (breakdownLevel === 4) {
    if (primary?.level === 3) return primary;
    if (primary?.level === 4) return getAreaById(primary.parent_id);
    if (primary?.level === 2) return null;
    return null;
  }

  return null;
};

const resolveAreaContextFromQuery = (query = '') => {
  const q = String(query || '');
  const qLower = q.toLowerCase();
  const result = {};

  const matches = findAreasInQuery(q);
  let breakdownLevel = detectBreakdownLevel(qLower);
  const primary = pickPrimaryArea(matches, breakdownLevel);

  if (breakdownLevel == null) {
    breakdownLevel = detectScopedComparisonLevel(qLower, primary);
  }

  if (breakdownLevel != null) {
    const breakdownLabels = { 2: 'state', 3: 'district', 4: 'subdistrict' };
    result.breakdown = breakdownLabels[breakdownLevel];

    const parent = resolveParentForBreakdown(breakdownLevel, primary);
    if (parent && Number.isFinite(parent.id)) {
      result.area_parent = parent.id;
      result.area_level = breakdownLevel;
      result.area_parent_name = parent.name;
      if (primary?.id) result.area_id = primary.id;
    }
    return result;
  }

  if (primary) {
    result.area_id = primary.id;
    result.area = primary.name;
    result.area_level = primary.level;
  }

  return result;
};

const findIndicatorByName = (name, opts = {}) => {
  const partial = opts.partial !== false;
  const q = norm(name);
  if (!q) return null;
  const list = getIndicators();

  const matchRow = (row) => {
    if (norm(row.name) === q) return true;
    if (Array.isArray(row.aliases) && row.aliases.some((a) => norm(a) === q)) return true;
    return false;
  };

  const exact = list.find(matchRow);
  if (exact) return exact;
  if (!partial) return null;

  return (
    list.find((row) => {
      if (norm(row.name).includes(q) || q.includes(norm(row.name))) return true;
      if (Array.isArray(row.aliases)) {
        return row.aliases.some((a) => norm(a).includes(q) || q.includes(norm(a)));
      }
      return false;
    }) || null
  );
};

const findSubgroup = (name, opts = {}) => {
  const partial = opts.partial !== false;
  const q = norm(name);
  if (!q) return null;
  const list = getSubgroups();
  const exact = list.find((s) => norm(s.name) === q);
  if (exact) return exact;
  if (!partial) return null;
  return list.find((s) => norm(s.name).includes(q) || q.includes(norm(s.name))) || null;
};

module.exports = {
  get areas() {
    return areasCache;
  },
  get indicators() {
    return indicatorsCache;
  },
  get subgroups() {
    return subgroupsCache;
  },
  get timeperiods() {
    return timeperiodsCache.periods;
  },
  getAreas,
  getIndicators,
  getSubgroups,
  getTimeperiods,
  getTimeperiodDefault,
  getTimeperiodIndicatorFamilies,
  getTimeperiodById,
  findTimeperiodByName,
  reloadMetadata,
  findAreaByName,
  findAreasInQuery,
  getAreaById,
  getChildrenAreas,
  resolveAreaContextFromQuery,
  findIndicatorByName,
  findSubgroup,
};
