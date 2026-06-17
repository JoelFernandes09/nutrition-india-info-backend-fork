'use strict';

const SUBGROUP_IDS = {
  All: 6,
  Rural: 3,
  Urban: 7,
  Male: 15,
  Female: 14,
  SC: 4,
  ST: 5,
};

const NAME_TO_ID = Object.fromEntries(
  Object.entries(SUBGROUP_IDS).map(([name, id]) => [name.toLowerCase(), id])
);

const ID_TO_NAME = Object.fromEntries(
  Object.entries(SUBGROUP_IDS).map(([name, id]) => [String(id), name])
);

const COMPARISON_SUBGROUPS = ['Rural', 'Urban', 'Male', 'Female', 'SC', 'ST'];

const SUBGROUP_DETECTORS = [
  { name: 'Rural', re: /\brural\b/i },
  { name: 'Urban', re: /\burban\b/i },
  { name: 'Male', re: /\b(male|men|boys?)\b/i },
  { name: 'Female', re: /\b(female|women|girls?)\b/i },
  { name: 'SC', re: /\bsc\b|scheduled\s+caste/i },
  { name: 'ST', re: /\bst\b|scheduled\s+tribe/i },
  { name: 'All', re: /\b(all\s+population|overall\s+population)\b/i },
];

const canonicalSubgroupName = (name) => {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return null;
  if (key === 'all') return 'All';
  if (NAME_TO_ID[key] != null) {
    return ID_TO_NAME[NAME_TO_ID[key]] || null;
  }
  return null;
};

const detectCompareAcrossSubgroups = (qLower) =>
  /\bacross\s+(different\s+)?subgroups?\b/.test(qLower) ||
  /\bsubgroups?\s+(comparison|compare|comparision|wise)\b/.test(qLower) ||
  /\b(compare|comparison|comparision)\b[\s\S]{0,80}\bsubgroups?\b/.test(qLower) ||
  /\bsubgroups?\b[\s\S]{0,40}\b(compare|comparison|comparision)\b/.test(qLower);

const detectExplicitPairs = (qLower) => {
  if (
    /\brural\b[\s\S]{0,24}\b(versus|vs\.?|and|&)\b[\s\S]{0,24}\burban\b/.test(qLower) ||
    /\burban\b[\s\S]{0,24}\b(versus|vs\.?|and|&)\b[\s\S]{0,24}\brural\b/.test(qLower)
  ) {
    return ['Rural', 'Urban'];
  }
  if (
    /\bmale\b[\s\S]{0,24}\b(versus|vs\.?|and|&)\b[\s\S]{0,24}\bfemale\b/.test(qLower) ||
    /\bfemale\b[\s\S]{0,24}\b(versus|vs\.?|and|&)\b[\s\S]{0,24}\bmale\b/.test(qLower) ||
    /\b(women|girls?)\b[\s\S]{0,24}\b(versus|vs\.?|and|&)\b[\s\S]{0,24}\b(men|boys?|male)\b/.test(qLower)
  ) {
    return ['Male', 'Female'];
  }
  if (
    /\bsc\b[\s\S]{0,24}\b(versus|vs\.?|and|&)\b[\s\S]{0,24}\bst\b/.test(qLower) ||
    /\bst\b[\s\S]{0,24}\b(versus|vs\.?|and|&)\b[\s\S]{0,24}\bsc\b/.test(qLower)
  ) {
    return ['SC', 'ST'];
  }
  return null;
};

const detectMentionedSubgroups = (qLower) => {
  const found = [];
  for (const { name, re } of SUBGROUP_DETECTORS) {
    if (re.test(qLower)) found.push(name);
  }
  return [...new Set(found)];
};

const parseSubgroupsFromQuery = (query = '') => {
  const qLower = String(query || '').toLowerCase();
  const result = {
    subgroup: null,
    subgroups: [],
    compareAcrossSubgroups: false,
    requestedSubgroups: [],
  };

  if (detectCompareAcrossSubgroups(qLower)) {
    result.compareAcrossSubgroups = true;
    result.subgroups = [...COMPARISON_SUBGROUPS];
    result.requestedSubgroups = [...COMPARISON_SUBGROUPS];
    return result;
  }

  const pair = detectExplicitPairs(qLower);
  if (pair?.length) {
    result.subgroups = pair;
    result.requestedSubgroups = pair;
    return result;
  }

  const betweenMatch = qLower.match(
    /\bbetween\s+(rural|urban|male|female|sc|st|all)\s+(?:and|&)\s+(rural|urban|male|female|sc|st|all)\b/i
  );
  if (betweenMatch) {
    const left = canonicalSubgroupName(betweenMatch[1]);
    const right = canonicalSubgroupName(betweenMatch[2]);
    if (left && right) {
      result.subgroups = [left, right];
      result.requestedSubgroups = [left, right];
      return result;
    }
  }

  const mentioned = detectMentionedSubgroups(qLower);
  if (mentioned.length > 1) {
    result.subgroups = mentioned;
    result.requestedSubgroups = mentioned;
    return result;
  }
  if (mentioned.length === 1) {
    result.subgroup = mentioned[0];
    result.requestedSubgroups = [mentioned[0]];
    return result;
  }

  return result;
};

const getSubgroupId = (name) => {
  const canonical = canonicalSubgroupName(name);
  if (!canonical) return null;
  return NAME_TO_ID[canonical.toLowerCase()] ?? null;
};

const getSubgroupName = (id) => ID_TO_NAME[String(id)] || null;

const computeSubgroupCoverage = (requestedNames = [], docs = []) => {
  const requested = [
    ...new Set(
      requestedNames.map((name) => canonicalSubgroupName(name)).filter(Boolean)
    ),
  ];
  if (!requested.length) {
    return { requested: [], found: [], missing: [] };
  }

  const foundIds = new Set(
    (Array.isArray(docs) ? docs : [])
      .map((doc) => Number(doc?.subgroup_id))
      .filter(Number.isFinite)
  );

  const found = requested.filter((name) => foundIds.has(getSubgroupId(name)));
  const missing = requested.filter((name) => !found.includes(name));

  return { requested, found, missing };
};

const formatMissingSubgroupsMessage = (coverage) => {
  if (!coverage?.missing?.length) return '';
  const list = coverage.missing.join(', ');
  return `No data available for ${list} subgroup${coverage.missing.length > 1 ? 's' : ''}.`;
};

module.exports = {
  SUBGROUP_IDS,
  COMPARISON_SUBGROUPS,
  canonicalSubgroupName,
  detectCompareAcrossSubgroups,
  detectExplicitPairs,
  parseSubgroupsFromQuery,
  getSubgroupId,
  getSubgroupName,
  computeSubgroupCoverage,
  formatMissingSubgroupsMessage,
};
