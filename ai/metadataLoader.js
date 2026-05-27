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

const areasCache = [];
const indicatorsCache = [];
const subgroupsCache = [];

const loadInto = (target, filename) => {
  const data = readJsonArray(filename);
  target.length = 0;
  for (const row of data) target.push(row);
};

const reloadMetadata = () => {
  loadInto(areasCache, 'areas.json');
  loadInto(indicatorsCache, 'indicators.json');
  loadInto(subgroupsCache, 'subgroups.json');
};

reloadMetadata();

const norm = (s) => String(s ?? '').trim().toLowerCase();

const getAreas = () => areasCache;

const getIndicators = () => indicatorsCache;

const getSubgroups = () => subgroupsCache;

const findAreaByName = (name, opts = {}) => {
  const partial = opts.partial !== false;
  const q = norm(name);
  if (!q) return null;
  const list = getAreas();
  const exact = list.find((a) => norm(a.name) === q);
  if (exact) return exact;
  if (!partial) return null;
  return list.find((a) => norm(a.name).includes(q) || q.includes(norm(a.name))) || null;
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
  getAreas,
  getIndicators,
  getSubgroups,
  reloadMetadata,
  findAreaByName,
  findIndicatorByName,
  findSubgroup,
};
