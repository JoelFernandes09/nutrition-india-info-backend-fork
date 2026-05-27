const SolrNode = require('solr-node');
const { dimensionMap, metricMap } = require('./dataMapping');

const client = new SolrNode({
  host: process.env.SOLR_DOMAIN || 'localhost',
  port: '8983',
  core: process.env.SOLR_CORE || 'latest_13feb26',
  protocol: 'http',
});

const ALL_SUBGROUP_ID = 6;
const NFHS5_ID = 24;
const MAX_TOOL_ROWS = 30;
const SUBGROUP_IDS = {
  all: 6,
  rural: 3,
  urban: 7,
  male: 15,
  female: 14,
  sc: 4,
  st: 5,
};

const INDICATOR_CATALOGUE = {
  Stunting: 12,
  Wasting: 19,
  Underweight: 17,
  'Low Birth Weight': 29,
  'Anemia (6-59 Months)': 26,
  'Anemia among adolescent girls 15-19 years': 1,
  'Low BMI in adolescent girls 15-19 years': 2,
  'Anemia among PW': 239,
  'Anemia among women 15-49 years': 71,
  'Low BMI in women 15-49 years': 72,
  MMR: 509,
  NMR: 366,
  IMR: 53,
  U5MR: 62,
  'Pregnant Women consuming IFA': 70,
  '4+ ANC': 77,
  'ANC (1st Trimester)': 76,
  'Institutional Deliveries': 75,
  'Postnatal Care': 514,
  'Pregnant Women receiving Supplementary Food': 57,
  'Lactating Mothers receiving Supplementary Food': 513,
  'Pregnant women visited at least once by ANM': 79,
  'Pregnant women visited at least once by ASHA': 80,
  'Exclusive Breastfeeding': 11,
  'Initiation of B.F in 1 hr.': 31,
  'Introducing Complementary Foods': 28,
  'Minimum Diet Diversity': 6,
  'Minimum Acceptable Diet (MAD)': 5,
  'Minimum Meal Frequency': 7,
  'Full Immunization': 23,
  'Vitamin A Supplementation (VAS)': 25,
  'Children with Fever': 510,
  'Children with ARI/Pneumonia': 14,
  'Children with Diarrhea': 15,
  'Treatment received for Fever': 511,
  'Treatment received for ARI/Pneumonia': 32,
  'Treatment received for Diarrhoea': 512,
  'Adolescent Pregnancy': 4,
  'Hand Wash': 417,
  'Improved Water': 51,
  'Improved Toilet': 42,
  'Clean Fuel': 361,
  'Child Faeces Disposal': 34,
  '10 Yrs.+ Women Education': 84,
  'Contraceptive Prevalence Rate (Family Planning)': 309,
  'Married women participated in household decisions': 83,
  'Women 15-49 years of age who have and use bank account': 86,
  'Households with access to banking services': 382,
  'Households with no assets': 39,
  'Households living in pucca houses': 40,
  'Households with access to electricity': 37,
  'Household Intake of Protein': 48,
  'Expenditure on Food': 47,
  'Expenditure on Cereal': 46,
};

const TIMEPERIOD_MAP = {
  nfhs5: 24,
  'nfhs 5': 24,
  '2019-20': 24,
  2019: 24,
  2020: 24,
  nfhs4: 20,
  'nfhs 4': 20,
  '2015-16': 20,
  2015: 20,
  2016: 20,
  nfhs3: 6,
  'nfhs 3': 6,
  '2005-06': 6,
  2005: 6,
  2006: 6,
  cnns: 23,
  '2016-18': 23,
  'srs 2022': 49,
  srs2022: 49,
  'srs 2020': 27,
  srs2020: 27,
  'srs 2018': 25,
  srs2018: 25,
  'census 2011': 11,
  2011: 11,
  'nsso 2022-2023': 33,
  'nsso 2022': 33,
};

const TOPIC_ALIASES = {
  'child nutrition': ['Stunting', 'Wasting', 'Underweight'],
  'child malnutrition': ['Stunting', 'Wasting', 'Underweight'],
  malnutrition: ['Stunting', 'Wasting', 'Underweight'],
  anemia: ['Anemia (6-59 Months)', 'Anemia among adolescent girls 15-19 years', 'Anemia among women 15-49 years'],
  mortality: ['MMR', 'NMR', 'IMR', 'U5MR'],
  'child mortality': ['NMR', 'IMR', 'U5MR'],
  'maternal health': ['4+ ANC', 'Institutional Deliveries', 'Postnatal Care'],
  'antenatal care': ['4+ ANC', 'ANC (1st Trimester)', 'Pregnant Women consuming IFA'],
  'child feeding': ['Exclusive Breastfeeding', 'Minimum Diet Diversity', 'Minimum Acceptable Diet (MAD)'],
  breastfeeding: ['Exclusive Breastfeeding', 'Initiation of B.F in 1 hr.'],
  immunization: ['Full Immunization', 'Vitamin A Supplementation (VAS)'],
  wash: ['Improved Water', 'Improved Toilet', 'Hand Wash', 'Clean Fuel'],
  sanitation: ['Improved Water', 'Improved Toilet', 'Hand Wash'],
  'women nutrition': ['Anemia among women 15-49 years', 'Low BMI in women 15-49 years'],
  'adolescent nutrition': ['Anemia among adolescent girls 15-19 years', 'Low BMI in adolescent girls 15-19 years'],
  'food expenditure': ['Expenditure on Food', 'Expenditure on Cereal', 'Household Intake of Protein'],
  'household assets': [
    'Households with access to electricity',
    'Households living in pucca houses',
    'Households with no assets',
  ],
};

const AREA_NAME_FIELD = 'area_name';

const toSafeString = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/[^a-zA-Z0-9\s\-().]/g, '');
};

const toSafeNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
};

const isLikelyPercentage = (unitName = '', metric = '') => {
  const unit = String(unitName || '').toLowerCase();
  const metricText = String(metric || '').toLowerCase();
  return unit.includes('%') || unit.includes('percent') || /percent|percentage|rate|ratio/.test(metricText);
};

const parseNumeric = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (!cleaned) return null;
    const matched = cleaned.match(/-?\d+(\.\d+)?/);
    if (!matched) return null;
    const num = Number(matched[0]);
    return Number.isFinite(num) ? num : null;
  }
  return null;
};

const isTwoDigitPercentageValue = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return false;
  return Math.abs(value) < 100;
};

const detectMetricIntent = (metric = '') => {
  const text = String(metric || '').toLowerCase();
  if (/\b(percent|percentage|pct|share|rate|ratio)\b/.test(text)) return 'percentage';
  if (/\b(count|number|numbers|total|population|burden|raw|absolute)\b/.test(text)) return 'absolute';
  return 'auto';
};

const inferSeriesKind = (docs = [], metric = '') => {
  const intent = detectMetricIntent(metric);
  let pctSignals = 0;
  let absSignals = 0;
  for (const doc of docs) {
    const dvn = parseNumeric(doc?.data_value_num);
    const dv = parseNumeric(doc?.data_value);
    const unit = String(doc?.unit_name || '');

    if (isLikelyPercentage(unit, metric)) pctSignals += 2;
    if (dvn != null) {
      if (dvn <= 100) pctSignals += 1;
      if (dvn > 100) absSignals += 2;
    }
    if (dv != null) {
      if (dv <= 100) pctSignals += 1;
      if (dv > 100) absSignals += 1;
    }
  }
  if (intent === 'percentage') {
    return absSignals >= pctSignals + 2 ? 'absolute' : 'percentage';
  }
  if (intent === 'absolute') {
    return pctSignals >= absSignals + 2 ? 'percentage' : 'absolute';
  }
  return pctSignals >= absSignals ? 'percentage' : 'absolute';
};

const pickMetricValue = (doc, kind) => {
  const dvn = parseNumeric(doc?.data_value_num);
  const dv = parseNumeric(doc?.data_value);

  if (kind === 'percentage') {
    if (dv != null && dv <= 100) return dv;
    if (dvn != null && dvn <= 100) return dvn;
    return dv ?? dvn;
  }

  if (kind === 'absolute') {
    if (dvn != null && dvn > 100) return dvn;
    if (dv != null && dv > 100) return dv;
    return dvn ?? dv;
  }

  return dvn ?? dv;
};

const buildFilterQueries = (filters = {}) => {
  const fq = [`subgroup_id:${ALL_SUBGROUP_ID}`];

  const state = toSafeString(filters.state);
  if (state) fq.push(`${dimensionMap.state || AREA_NAME_FIELD}:"${state}"`);

  const district = toSafeString(filters.district);
  if (district) fq.push(`${dimensionMap.district || AREA_NAME_FIELD}:"${district}"`);

  const subdistrict = toSafeString(filters.subdistrict);
  if (subdistrict) fq.push(`${dimensionMap.subdistrict || AREA_NAME_FIELD}:"${subdistrict}"`);

  const area = toSafeString(filters.area);
  if (area) fq.push(`${dimensionMap.area || AREA_NAME_FIELD}:"${area}"`);

  const areaParent = toSafeNumber(filters.area_parent ?? filters.areaParent ?? filters.parent_area_id);
  if (areaParent !== null) fq.push(`${dimensionMap.area_parent || 'area_parent_id'}:${areaParent}`);

  const areaLevel = toSafeNumber(filters.area_level ?? filters.areaType ?? filters.area_type);
  if (areaLevel !== null) fq.push(`${dimensionMap.area_level || 'area_level'}:${areaLevel}`);

  const subgroup = toSafeString(filters.subgroup).toLowerCase();
  if (subgroup && SUBGROUP_IDS[subgroup] != null) {
    fq[0] = `subgroup_id:${SUBGROUP_IDS[subgroup]}`;
  }
  const subgroups = Array.isArray(filters.subgroups)
    ? filters.subgroups.map((s) => toSafeString(s).toLowerCase()).filter(Boolean)
    : [];
  const subgroupIds = subgroups.map((s) => SUBGROUP_IDS[s]).filter((id) => Number.isFinite(id));
  if (subgroupIds.length > 0) {
    fq[0] = subgroupIds.length === 1
      ? `subgroup_id:${subgroupIds[0]}`
      : `(${subgroupIds.map((id) => `subgroup_id:${id}`).join(' OR ')})`;
  }

  const year = filters.year;
  if (typeof year === 'number') {
    fq.push(`${dimensionMap.year || 'timeperiod'}:*${year}*`);
  } else if (typeof year === 'string' && year.trim() !== '') {
    const yearString = toSafeString(year);
    if (yearString) {
      if (!Number.isNaN(Number(yearString))) {
        fq.push(`${dimensionMap.year || 'timeperiod'}:*${yearString}*`);
      } else {
        fq.push(`${dimensionMap.year || 'timeperiod'}:"${yearString}"`);
      }
    }
  }

  return fq;
};

const rowsFromDocs = (docs = [], metricField = 'data_value_num', metric = '', mode = 'comparison') => {
  const indicatorNames = new Set(docs.map((d) => d?.indicator_name).filter(Boolean));
  const multiIndicator = mode !== 'trend' && indicatorNames.size > 1;
  const subgroupNames = new Set(docs.map((d) => d?.subgroup_name).filter(Boolean));
  const multiSubgroup = mode !== 'trend' && subgroupNames.size > 1;
  const seriesKind = inferSeriesKind(docs, metric);
  const map = new Map();

  docs.forEach((doc) => {
    const hintedMetric = parseNumeric(doc?.[metricField]);
    const inferredMetric = pickMetricValue(doc, seriesKind);
    const value = hintedMetric ?? inferredMetric;
    if (value == null || Number.isNaN(value)) return;

    const area = doc?.[AREA_NAME_FIELD] != null ? String(doc[AREA_NAME_FIELD]).trim() : '';
    const indName = doc?.indicator_name != null ? String(doc.indicator_name).trim() : '';
    const subgroupName = doc?.subgroup_name != null ? String(doc.subgroup_name).trim() : '';
    const tp = doc?.timeperiod != null ? String(doc.timeperiod).trim() : '';
    const unitRaw = doc?.unit_name;
    let unit = typeof unitRaw === 'string' ? unitRaw.trim() : '';
    const isPctByValueShape = isTwoDigitPercentageValue(value);
    const pctBySeries = seriesKind === 'percentage' && isPctByValueShape;
    const pctByUnit = isLikelyPercentage(unit, metric) && isPctByValueShape;
    const shouldShowPercentage = pctBySeries || pctByUnit;
    if (shouldShowPercentage && !unit) unit = '%';
    if (!shouldShowPercentage && unit === '%') unit = '';

    let label;
    if (mode === 'trend') {
      label = tp || area || indName || 'value';
    } else if (multiIndicator && indName) {
      const base = area ? `${area} — ${indName}` : indName;
      label = multiSubgroup && subgroupName ? `${base} — ${subgroupName}` : base;
    } else {
      const base = area || tp || indName || 'value';
      const baseWithSubgroup = multiSubgroup && subgroupName ? `${base} — ${subgroupName}` : base;
      label = shouldShowPercentage ? `${baseWithSubgroup} (%)` : baseWithSubgroup;
    }

    const dedupeKey =
      mode === 'trend'
        ? `${doc?.timeperiod_id ?? ''}|${label}|${unit}`
        : `${label}|${tp}|${unit}|${indName}|${subgroupName}`;

    map.set(dedupeKey, {
      label,
      value,
      unit: unit || '',
      timeperiod: tp || '',
    });
  });

  return Array.from(map.values());
};

const capRows = (rows, mode = 'comparison') => {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  if (rows.length <= MAX_TOOL_ROWS) {
    if (mode === 'comparison') {
      return [...rows].sort((a, b) => b.value - a.value);
    }
    return rows;
  }
  if (mode === 'trend') {
    return rows.slice(-MAX_TOOL_ROWS);
  }
  return [...rows].sort((a, b) => b.value - a.value).slice(0, MAX_TOOL_ROWS);
};

const resolveIndicators = (names) => {
  const resolved = [];
  const seen = new Set();

  const add = (name, id) => {
    if (!seen.has(id)) {
      seen.add(id);
      resolved.push({ name, id });
    }
  };

  for (const raw of names) {
    const lower = raw.toLowerCase().trim();

    if (TOPIC_ALIASES[lower]) {
      TOPIC_ALIASES[lower].forEach((alias) => {
        if (INDICATOR_CATALOGUE[alias]) add(alias, INDICATOR_CATALOGUE[alias]);
      });
      continue;
    }

    const exactKey = Object.keys(INDICATOR_CATALOGUE).find((k) => k.toLowerCase() === lower);
    if (exactKey) {
      add(exactKey, INDICATOR_CATALOGUE[exactKey]);
      continue;
    }

    const fuzzyKey = Object.keys(INDICATOR_CATALOGUE).find(
      (k) => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase())
    );
    if (fuzzyKey) {
      add(fuzzyKey, INDICATOR_CATALOGUE[fuzzyKey]);
      continue;
    }

    console.warn(`[Tools] Could not resolve indicator: "${raw}"`);
  }

  return resolved;
};

const fetchComparison = async ({
  indicators = [],
  timeperiodId,
  metric = '',
  filters = {},
}) => {
  const metricField = metricMap[String(metric || '').toLowerCase()] || 'data_value_num';
  const fqBase = buildFilterQueries(filters);
  const allDocs = [];

  for (const { id } of indicators) {
    const fq = [...fqBase, `indicator_id:${id}`, `timeperiod_id:${timeperiodId}`];
    const cQuery = [
      `fl=${AREA_NAME_FIELD},indicator_name,timeperiod,unit_name,subgroup_name,subgroup_id,data_value,data_value_num`,
      ...fq.map((clause) => `fq=${clause}`),
      `omitHeader=true`,
      `q=*:*`,
      `rows=200`,
    ].join('&');

    try {
      const result = await client.search(cQuery);
      if (Array.isArray(result?.response?.docs)) {
        allDocs.push(...result.response.docs);
      }
    } catch (err) {
      console.error(`[Tools] Solr comparison query failed for indicator ${id}:`, err.message);
    }
  }

  const rows = rowsFromDocs(allDocs, metricField, metric, 'comparison');
  return capRows(rows, 'comparison');
};

const fetchTrend = async (indicator, metric = '', filters = {}) => {
  const metricField = metricMap[String(metric || '').toLowerCase()] || 'data_value_num';
  const fq = [...buildFilterQueries(filters), `indicator_id:${indicator.id}`];
  const cQuery = [
    `fl=${AREA_NAME_FIELD},timeperiod_id,timeperiod,unit_name,subgroup_name,subgroup_id,data_value,data_value_num`,
    ...fq.map((clause) => `fq=${clause}`),
    `omitHeader=true`,
    `q=*:*`,
    `rows=50`,
    `sort=timeperiod_id asc`,
  ].join('&');

  try {
    const result = await client.search(cQuery);
    const docs = Array.isArray(result?.response?.docs) ? result.response.docs : [];
    const rows = rowsFromDocs(docs, metricField, metric, 'trend');
    return capRows(rows, 'trend');
  } catch (err) {
    console.error(`[Tools] Solr trend error for "${indicator.name}":`, err.message);
    return [];
  }
};

const getNutritionData = async (params = {}) => {
  const {
    indicators = [],
    mode = 'comparison',
    timeperiod = '',
    metric = '',
    filters = {},
  } = params;

  const tpId = TIMEPERIOD_MAP[timeperiod.toLowerCase().trim()] || NFHS5_ID;
  const resolved = resolveIndicators(indicators.length > 0 ? indicators : ['child nutrition']);

  if (resolved.length === 0) {
    console.warn('[Tools] Indicator resolution returned nothing — falling back to child nutrition defaults');
    return fetchComparison({
      indicators: [
        { name: 'Stunting', id: 12 },
        { name: 'Wasting', id: 19 },
        { name: 'Underweight', id: 17 },
      ],
      timeperiodId: NFHS5_ID,
      metric,
      filters,
    });
  }

  if (mode === 'trend') {
    return fetchTrend(resolved[0], metric, filters);
  }

  return fetchComparison({
    indicators: resolved,
    timeperiodId: tpId,
    metric,
    filters,
  });
};

module.exports = { getNutritionData };
