const SolrNode = require('solr-node');
const { dimensionMap } = require('./dataMapping');
const { getAreaById } = require('./metadataLoader');
const {
  getSubgroupId,
  computeSubgroupCoverage,
} = require('./subgroupResolver');
const {
  getTimeperiodName,
  resolveAliasToId,
  getCandidateChainForIndicators,
  deriveTimeperiodFromDocs,
  deriveTimeperiodFromRows,
  SRS_INDICATOR_IDS,
} = require('./timeperiodResolver');

const client = new SolrNode({
  host: process.env.SOLR_DOMAIN || 'localhost',
  port: '8983',
  core: process.env.SOLR_CORE || 'latest_13feb26',
  protocol: 'http',
});

const ALL_SUBGROUP_ID = 6;
const MAX_TOOL_ROWS = 30;
const MAX_BREAKDOWN_ROWS = 200;

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

const detectMetricIntent = (metric = '') => {
  const text = String(metric || '').toLowerCase();
  if (/\b(burden|count|number|numbers|total|population|raw|absolute|numeric)\b/.test(text)) {
    return 'burden';
  }
  return 'percentage';
};

const pickMetricValue = (doc, kind) => {
  const dv = parseNumeric(doc?.data_value);
  const dvn = parseNumeric(doc?.data_value_num);

  if (kind === 'burden') return dvn ?? dv;
  return dv ?? dvn;
};

const resolveRowUnit = (doc, seriesKind) => {
  if (seriesKind === 'burden') return 'burden';

  const solrUnit = typeof doc?.unit_name === 'string' ? doc.unit_name.trim() : '';
  const indicatorId = Number(doc?.indicator_id);

  if (SRS_INDICATOR_IDS.has(indicatorId)) {
    if (solrUnit && solrUnit !== '%') return solrUnit;
    return 'per 100,000 live births';
  }

  if (solrUnit && solrUnit !== '%' && !/%/.test(solrUnit)) return solrUnit;
  return '%';
};

const isBreakdownFilters = (filters = {}) => {
  const areaParent = toSafeNumber(filters.area_parent ?? filters.areaParent ?? filters.parent_area_id);
  const areaLevel = toSafeNumber(filters.area_level ?? filters.areaType ?? filters.area_type);
  return areaParent !== null && areaLevel !== null && areaLevel > 1;
};

const buildFilterQueries = (filters = {}) => {
  const fq = [`subgroup_id:${ALL_SUBGROUP_ID}`];

  const state = toSafeString(filters.state);
  if (state) fq.push(`${dimensionMap.state || AREA_NAME_FIELD}:"${state}"`);

  const district = toSafeString(filters.district);
  if (district) fq.push(`${dimensionMap.district || AREA_NAME_FIELD}:"${district}"`);

  const subdistrict = toSafeString(filters.subdistrict);
  if (subdistrict) fq.push(`${dimensionMap.subdistrict || AREA_NAME_FIELD}:"${subdistrict}"`);

  const areaParent = toSafeNumber(filters.area_parent ?? filters.areaParent ?? filters.parent_area_id);
  const areaLevel = toSafeNumber(filters.area_level ?? filters.areaType ?? filters.area_type);
  const areaId = toSafeNumber(filters.area_id ?? filters.areaId);
  const hasParentDrilldown = areaParent !== null && areaLevel !== null;

  const area = toSafeString(filters.area);
  if (hasParentDrilldown) {
    if (areaParent !== null) fq.push(`${dimensionMap.area_parent || 'area_parent_id'}:${areaParent}`);
    if (areaLevel !== null) fq.push(`${dimensionMap.area_level || 'area_level'}:${areaLevel}`);
  } else if (areaId !== null) {
    fq.push(`area_id:${areaId}`);
  } else if (area) {
    fq.push(`${dimensionMap.area || AREA_NAME_FIELD}:"${area}"`);
    if (areaLevel !== null) fq.push(`${dimensionMap.area_level || 'area_level'}:${areaLevel}`);
  } else if (areaLevel !== null) {
    fq.push(`${dimensionMap.area_level || 'area_level'}:${areaLevel}`);
  }

  const subgroup = toSafeString(filters.subgroup);
  const subgroupId = getSubgroupId(subgroup);
  if (subgroupId != null) {
    fq[0] = `subgroup_id:${subgroupId}`;
  }
  const subgroups = Array.isArray(filters.subgroups)
    ? filters.subgroups.map((s) => toSafeString(s)).filter(Boolean)
    : [];
  const subgroupIds = subgroups.map((s) => getSubgroupId(s)).filter((id) => Number.isFinite(id));
  if (subgroupIds.length > 0) {
    fq[0] =
      subgroupIds.length === 1
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

const rowsFromDocs = (docs = [], metric = '', mode = 'comparison', options = {}) => {
  const subgroupComparison = options.subgroupComparison === true;
  const indicatorNames = new Set(docs.map((d) => d?.indicator_name).filter(Boolean));
  const multiIndicator = mode !== 'trend' && indicatorNames.size > 1;
  const subgroupNames = new Set(docs.map((d) => d?.subgroup_name).filter(Boolean));
  const multiSubgroup = mode !== 'trend' && subgroupNames.size > 1;
  const seriesKind = detectMetricIntent(metric);
  const map = new Map();

  docs.forEach((doc) => {
    const value = pickMetricValue(doc, seriesKind);
    if (value == null || Number.isNaN(value)) return;

    const area = doc?.[AREA_NAME_FIELD] != null ? String(doc[AREA_NAME_FIELD]).trim() : '';
    const indName = doc?.indicator_name != null ? String(doc.indicator_name).trim() : '';
    const subgroupName = doc?.subgroup_name != null ? String(doc.subgroup_name).trim() : '';
    const tp = doc?.timeperiod != null ? String(doc.timeperiod).trim() : '';
    const unit = resolveRowUnit(doc, seriesKind);

    let label;
    if (mode === 'trend') {
      if (multiIndicator && indName && tp) {
        label = `${tp} — ${indName}`;
      } else {
        label = tp || area || indName || 'value';
      }
    } else if (multiIndicator && indName) {
      const base = area ? `${area} - ${indName}` : indName;
      label = multiSubgroup && subgroupName ? `${base} - ${subgroupName}` : base;
    } else {
      const base = area || tp || indName || 'value';
      if (subgroupComparison && subgroupName) {
        label = subgroupName;
      } else if (multiSubgroup && subgroupName) {
        label = `${base} — ${subgroupName}`;
      } else {
        label = base;
      }
    }

    const dedupeKey =
      mode === 'trend'
        ? `${doc?.timeperiod_id ?? ''}|${label}|${unit}`
        : `${label}|${tp}|${unit}|${indName}|${subgroupName}`;

    map.set(dedupeKey, {
      label,
      value,
      unit,
      timeperiod: tp || '',
      timeperiod_id: Number.isFinite(Number(doc?.timeperiod_id)) ? Number(doc.timeperiod_id) : null,
      indicator: indName || '',
      subgroup: subgroupName || '',
      subgroup_id: Number.isFinite(Number(doc?.subgroup_id)) ? Number(doc.subgroup_id) : null,
    });
  });

  return Array.from(map.values());
};

const capRows = (rows, mode = 'comparison', options = {}) => {
  const isBreakdown = options.isBreakdown === true;
  const limit = isBreakdown ? MAX_BREAKDOWN_ROWS : MAX_TOOL_ROWS;

  if (!Array.isArray(rows) || rows.length === 0) return rows;
  if (rows.length <= limit) {
    if (mode === 'comparison') {
      return [...rows].sort((a, b) => b.value - a.value);
    }
    if (mode === 'trend') {
      return [...rows].sort((a, b) => (a.timeperiod_id || 0) - (b.timeperiod_id || 0));
    }
    return rows;
  }
  if (mode === 'trend') {
    const sorted = [...rows].sort((a, b) => (a.timeperiod_id || 0) - (b.timeperiod_id || 0));
    return sorted.length <= limit ? sorted : sorted.slice(-limit);
  }
  if (isBreakdown) {
    return [...rows].sort((a, b) => b.value - a.value).slice(0, limit);
  }
  return [...rows].sort((a, b) => b.value - a.value).slice(0, limit);
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

const docsCoverAllIndicators = (docs, indicatorIds) => {
  const found = new Set(
    docs
      .map((doc) => Number(doc?.indicator_id))
      .filter(Number.isFinite)
  );
  return indicatorIds.every((id) => found.has(id));
};

const fetchComparison = async ({
  indicators = [],
  timeperiodId,
  metric = '',
  filters = {},
}) => {
  const fqBase = buildFilterQueries(filters);
  const breakdown = isBreakdownFilters(filters);
  const rowLimit = breakdown ? 1000 : 200;
  const requestedSubgroups = Array.isArray(filters.requestedSubgroups)
    ? filters.requestedSubgroups
    : Array.isArray(filters.subgroups) && filters.subgroups.length > 0
      ? filters.subgroups
      : filters.subgroup
        ? [filters.subgroup]
        : [];
  const subgroupComparison = requestedSubgroups.length > 1;
  const allDocs = [];

  for (const { id } of indicators) {
    const fq = [...fqBase, `indicator_id:${id}`, `timeperiod_id:${timeperiodId}`];
    const cQuery = [
      `fl=${AREA_NAME_FIELD},indicator_id,indicator_name,timeperiod_id,timeperiod,unit_name,subgroup_name,subgroup_id,data_value,data_value_num`,
      ...fq.map((clause) => `fq=${clause}`),
      `omitHeader=true`,
      `q=*:*`,
      `rows=${rowLimit}`,
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

  const rows = rowsFromDocs(allDocs, metric, 'comparison', { subgroupComparison });
  const capped = capRows(rows, 'comparison', { isBreakdown: breakdown });
  const subgroupCoverage = computeSubgroupCoverage(requestedSubgroups, allDocs);
  return { rows: capped, docs: allDocs, subgroupCoverage };
};

const resolveTimeperiodByFetching = async ({
  indicators,
  fqBase,
  timeperiodHint,
  metric,
  filters,
}) => {
  const indicatorIds = indicators.map((i) => i.id);
  const preferredId = resolveAliasToId(timeperiodHint) || resolveAliasToId(String(timeperiodHint || '').trim());
  const chain = getCandidateChainForIndicators(indicatorIds, preferredId);

  console.log(
    `[Tools] Timeperiod candidates for indicators [${indicatorIds.join(', ')}]:`,
    chain.slice(0, 8).join(', ') + (chain.length > 8 ? '...' : '')
  );

  for (const tpId of chain) {
    const { rows, docs, subgroupCoverage } = await fetchComparison({
      indicators,
      timeperiodId: tpId,
      metric,
      filters,
    });

    if (rows.length === 0) continue;

    const coversAll = indicatorIds.length === 1 || docsCoverAllIndicators(docs, indicatorIds);
    if (!coversAll) continue;

    const timeperiod =
      deriveTimeperiodFromDocs(docs) ||
      deriveTimeperiodFromRows(rows) || {
        id: tpId,
        name: getTimeperiodName(tpId),
      };

    console.log(`[Tools] Resolved timeperiod from data: ${timeperiod.name} (id=${timeperiod.id})`);
    return { rows, timeperiod, subgroupCoverage };
  }

  return { rows: [], timeperiod: null, subgroupCoverage: computeSubgroupCoverage(filters.requestedSubgroups || filters.subgroups || [], []) };
};

const resolveWithBreakdownFallback = async (params = {}) => {
  const { filters = {}, ...rest } = params;
  let result = await resolveTimeperiodByFetching({ ...rest, filters });

  if (result.rows.length > 0 || !isBreakdownFilters(filters)) return result;

  const parentId = toSafeNumber(filters.area_parent ?? filters.areaParent ?? filters.parent_area_id);
  const breakdownLevel = toSafeNumber(filters.area_level ?? filters.areaType ?? filters.area_type);
  const parentArea = parentId != null ? getAreaById(parentId) : null;
  const fallbackLevel =
    breakdownLevel === 4 ? 3 : breakdownLevel === 3 ? 2 : breakdownLevel === 2 ? 1 : null;

  if (!parentArea?.name || fallbackLevel == null) return result;

  const fallbackFilters = { ...filters };
  delete fallbackFilters.area_parent;
  delete fallbackFilters.areaParent;
  delete fallbackFilters.parent_area_id;
  fallbackFilters.area = parentArea.name;
  fallbackFilters.area_level = fallbackLevel;

  console.log(
    `[Tools] Breakdown returned no rows; falling back to ${parentArea.name} (level ${fallbackLevel})`
  );

  return resolveTimeperiodByFetching({ ...rest, filters: fallbackFilters });
};

const getNutritionData = async (params = {}) => {
  const {
    indicators = [],
    mode = 'comparison',
    timeperiod = '',
    metric = '',
    filters = {},
  } = params;

  const fqBase = buildFilterQueries(filters);
  const resolved = resolveIndicators(indicators.length > 0 ? indicators : ['child nutrition']);
  const indicatorSet =
    resolved.length > 0
      ? resolved
      : [
          { name: 'Stunting', id: 12 },
          { name: 'Wasting', id: 19 },
          { name: 'Underweight', id: 17 },
        ];

  if (mode === 'trend') {
    const indicatorFq =
      indicatorSet.length === 1
        ? `indicator_id:${indicatorSet[0].id}`
        : `(${indicatorSet.map((i) => `indicator_id:${i.id}`).join(' OR ')})`;
    const requestedSubgroups = Array.isArray(filters.requestedSubgroups)
      ? filters.requestedSubgroups
      : Array.isArray(filters.subgroups) && filters.subgroups.length > 0
        ? filters.subgroups
        : filters.subgroup
          ? [filters.subgroup]
          : [];
    const subgroupComparison = requestedSubgroups.length > 1;
    const fq = [...buildFilterQueries(filters), indicatorFq];
    const cQuery = [
      `fl=${AREA_NAME_FIELD},indicator_id,indicator_name,timeperiod_id,timeperiod,unit_name,subgroup_name,subgroup_id,data_value,data_value_num`,
      ...fq.map((clause) => `fq=${clause}`),
      `omitHeader=true`,
      `q=*:*`,
      `rows=200`,
      `sort=timeperiod_id asc`,
    ].join('&');

    let docs = [];
    try {
      const result = await client.search(cQuery);
      docs = Array.isArray(result?.response?.docs) ? result.response.docs : [];
    } catch (err) {
      console.error(`[Tools] Solr timeperiod-comparison error:`, err.message);
    }

    const rows = capRows(
      rowsFromDocs(docs, metric, 'trend', { subgroupComparison }),
      'trend'
    );
    const subgroupCoverage = computeSubgroupCoverage(requestedSubgroups, docs);
    const timeperiodIds = [...new Set(rows.map((r) => r.timeperiod_id).filter(Number.isFinite))].sort(
      (a, b) => a - b
    );
    const earliest = timeperiodIds.length
      ? { id: timeperiodIds[0], name: rows.find((r) => r.timeperiod_id === timeperiodIds[0])?.timeperiod || getTimeperiodName(timeperiodIds[0]) }
      : null;
    const latest = timeperiodIds.length
      ? {
          id: timeperiodIds[timeperiodIds.length - 1],
          name:
            rows.find((r) => r.timeperiod_id === timeperiodIds[timeperiodIds.length - 1])?.timeperiod ||
            getTimeperiodName(timeperiodIds[timeperiodIds.length - 1]),
        }
      : null;

    let timeperiodName = 'Multiple timeperiods';
    if (latest?.name && earliest?.name && latest.name !== earliest.name) {
      timeperiodName = `${earliest.name} to ${latest.name}`;
    } else if (latest?.name) {
      timeperiodName = latest.name;
    }

    console.log(`[Tools] Timeperiod comparison: ${rows.length} rows across ${timeperiodIds.length} timeperiods`);

    return {
      rows,
      timeperiod: latest || earliest || { id: null, name: timeperiodName },
      subgroupCoverage,
    };
  }

  const { rows, timeperiod: resolvedTimeperiod, subgroupCoverage } = await resolveWithBreakdownFallback({
    indicators: indicatorSet,
    fqBase,
    timeperiodHint: timeperiod,
    metric,
    filters,
  });

  return {
    rows,
    timeperiod: resolvedTimeperiod,
    subgroupCoverage,
  };
};

module.exports = { getNutritionData };
