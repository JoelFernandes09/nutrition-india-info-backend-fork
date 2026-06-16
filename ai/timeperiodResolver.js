'use strict';

const {
  getTimeperiods,
  getTimeperiodDefault,
  getTimeperiodIndicatorFamilies,
} = require('./metadataLoader');

const buildCatalog = () => {
  const periods = getTimeperiods();
  const timeperiodDefault = getTimeperiodDefault();
  const indicatorFamilies = getTimeperiodIndicatorFamilies();

  const TIMEPERIOD_IDS = Object.fromEntries(periods.map((tp) => [tp.name, tp.id]));
  const ID_TO_NAME = Object.fromEntries(periods.map((tp) => [String(tp.id), tp.name]));

  const ALIAS_TO_ID = new Map();
  const addAlias = (alias, id) => {
    const key = String(alias).toLowerCase().trim();
    if (key) ALIAS_TO_ID.set(key, id);
  };

  for (const tp of periods) {
    addAlias(tp.name, tp.id);
    addAlias(tp.name.replace(/\s+/g, ''), tp.id);
    addAlias(tp.name.toLowerCase(), tp.id);
    if (Array.isArray(tp.aliases)) {
      for (const alias of tp.aliases) addAlias(alias, tp.id);
    }
  }

  const idsByFamily = (family) =>
    periods
      .filter((tp) => tp.family === family)
      .map((tp) => tp.id)
      .sort((a, b) => b - a);

  const indicatorIdToFamily = new Map();
  for (const [family, ids] of Object.entries(indicatorFamilies || {})) {
    for (const indicatorId of ids || []) {
      indicatorIdToFamily.set(Number(indicatorId), family);
    }
  }

  const SRS_INDICATOR_IDS = new Set(indicatorFamilies?.srs || []);
  const CNNS_INDICATOR_IDS = new Set(indicatorFamilies?.cnns || []);
  const NSSO_INDICATOR_IDS = new Set(indicatorFamilies?.nsso || []);

  return {
    TIMEPERIOD_IDS,
    ID_TO_NAME,
    ALIAS_TO_ID,
    ALL_NFHS_IDS: idsByFamily('nfhs'),
    ALL_SRS_IDS: idsByFamily('srs'),
    ALL_CNNS_IDS: idsByFamily('cnns'),
    ALL_NSSO_IDS: idsByFamily('nsso'),
    ALL_CENSUS_IDS: idsByFamily('census'),
    DEFAULT_TIMEPERIOD_ID: timeperiodDefault?.id ?? 52,
    DEFAULT_TIMEPERIOD_NAME: timeperiodDefault?.name ?? 'NFHS6 2023-2024',
    SRS_INDICATOR_IDS,
    CNNS_INDICATOR_IDS,
    NSSO_INDICATOR_IDS,
    indicatorIdToFamily,
  };
};

let catalog = buildCatalog();

const refreshCatalog = () => {
  catalog = buildCatalog();
};

const getCatalog = () => catalog;

const getTimeperiodName = (id) => getCatalog().ID_TO_NAME[String(id)] || `Timeperiod ${id}`;

const resolveAliasToId = (hint) => {
  const { ID_TO_NAME, ALIAS_TO_ID } = getCatalog();
  if (hint == null || hint === '') return null;
  if (typeof hint === 'number' && Number.isFinite(hint)) return hint;
  const asNum = Number(hint);
  if (Number.isFinite(asNum) && ID_TO_NAME[String(asNum)]) return asNum;
  const key = String(hint).toLowerCase().trim();
  return ALIAS_TO_ID.get(key) ?? null;
};

const getIndicatorFamily = (indicatorId) => {
  const { indicatorIdToFamily } = getCatalog();
  return indicatorIdToFamily.get(Number(indicatorId)) || 'nfhs';
};

const getFamilyChain = (family) => {
  const c = getCatalog();
  if (family === 'srs') return c.ALL_SRS_IDS;
  if (family === 'cnns') return c.ALL_CNNS_IDS;
  if (family === 'nsso') return c.ALL_NSSO_IDS;
  if (family === 'census') return c.ALL_CENSUS_IDS;
  return c.ALL_NFHS_IDS;
};

const getCandidateChainForIndicators = (indicatorIds = [], preferredId = null) => {
  const c = getCatalog();
  const ids = indicatorIds.map((i) => (typeof i === 'object' ? i.id : i)).filter(Number.isFinite);
  if (!ids.length) return c.ALL_NFHS_IDS;

  const families = [...new Set(ids.map(getIndicatorFamily))];
  let base;

  if (families.length === 1) {
    base = getFamilyChain(families[0]);
  } else {
    const combined = new Set();
    for (const family of families) {
      getFamilyChain(family).forEach((id) => combined.add(id));
    }
    base = [...combined].sort((a, b) => b - a);
  }

  const resolvedPreferred = preferredId != null ? resolveAliasToId(preferredId) ?? preferredId : null;
  if (resolvedPreferred != null && base.includes(resolvedPreferred)) {
    return base.slice(base.indexOf(resolvedPreferred));
  }

  return base;
};

const deriveTimeperiodFromDocs = (docs = []) => {
  if (!Array.isArray(docs) || docs.length === 0) return null;

  let best = null;
  for (const doc of docs) {
    const id = Number(doc?.timeperiod_id);
    if (!Number.isFinite(id)) continue;
    const solrName = typeof doc?.timeperiod === 'string' ? doc.timeperiod.trim() : '';
    const name = solrName || getTimeperiodName(id);
    if (!best || id > best.id) {
      best = { id, name };
    }
  }

  return best;
};

const deriveTimeperiodFromRows = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const names = [...new Set(rows.map((r) => r?.timeperiod).filter(Boolean))];
  if (names.length === 1) {
    const name = names[0];
    const id = resolveAliasToId(name) || null;
    return { id, name };
  }
  if (names.length > 1) {
    return { id: null, name: names.join(', ') };
  }
  return null;
};

const parseTimeperiodFromQuery = (query = '') => {
  const q = String(query || '').toLowerCase();
  const { ALIAS_TO_ID } = getCatalog();

  const patterns = [
    /\bsrs[\s-]?2024\b/,
    /\bsrs[\s-]?2023\b/,
    /\bsrs[\s-]?2022\b/,
    /\bsrs[\s-]?2021\b/,
    /\bsrs[\s-]?2020\b/,
    /\bsrs[\s-]?2019\b/,
    /\bsrs[\s-]?2018\b/,
    /\bnfhs[\s-]?6\b/,
    /\b2023[\s-]?(?:24|2024)\b/,
    /\b23[\s-]24\b/,
    /\bnfhs[\s-]?5\b/,
    /\b2019[\s-]?(?:20|2020)\b/,
    /\b19[\s-]20\b/,
    /\bnfhs[\s-]?4\b/,
    /\b2015[\s-]?(?:16|2016)\b/,
    /\b15[\s-]16\b/,
    /\bnfhs[\s-]?3\b/,
    /\b2005[\s-]?(?:06|2006)\b/,
    /\bcnns\b/,
    /\b2016[\s-]18\b/,
    /\bnsso[\s-]?2022\b/,
    /\b2022[\s-]23\b/,
    /\bcensus[\s-]?2011\b/,
    /\bcensus[\s-]?2001\b/,
  ];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (match) {
      const id = resolveAliasToId(match[0].replace(/\s+/g, ' ').trim());
      if (id) return { id, name: getTimeperiodName(id), hint: match[0] };
    }
  }

  for (const [alias, id] of ALIAS_TO_ID.entries()) {
    if (alias.length < 4) continue;
    const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(q)) {
      return { id, name: getTimeperiodName(id), hint: alias };
    }
  }

  return null;
};

module.exports = {
  get TIMEPERIOD_IDS() {
    return getCatalog().TIMEPERIOD_IDS;
  },
  get DEFAULT_TIMEPERIOD_ID() {
    return getCatalog().DEFAULT_TIMEPERIOD_ID;
  },
  get DEFAULT_TIMEPERIOD_NAME() {
    return getCatalog().DEFAULT_TIMEPERIOD_NAME;
  },
  get SRS_INDICATOR_IDS() {
    return getCatalog().SRS_INDICATOR_IDS;
  },
  refreshCatalog,
  getTimeperiodName,
  resolveAliasToId,
  getCandidateChainForIndicators,
  getIndicatorFamily,
  deriveTimeperiodFromDocs,
  deriveTimeperiodFromRows,
  parseTimeperiodFromQuery,
};
