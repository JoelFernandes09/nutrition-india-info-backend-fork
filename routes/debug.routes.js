const express = require('express');
const SolrNode = require('solr-node');
const keys = require('../config/keys');
const http = require('http');

const router = express.Router();

// TODO: Remove debug routes after schema audit is complete

const DEFAULT_FACET_FIELDS = ['state', 'district', 'category', 'year'];
const MAX_LOG_LENGTH = 600;

const client = new SolrNode({
  host: keys.solr_domain,
  port: '8983',
  core: keys.solr_core,
  protocol: 'http',
});

const trimForLog = (payload) => {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (serialized.length <= MAX_LOG_LENGTH) {
    return serialized;
  }
  return `${serialized.slice(0, MAX_LOG_LENGTH)}... [trimmed]`;
};

const buildSolrBaseUrl = () => {
  const host = keys.solr_domain || '';
  const normalizedHost = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `http://${normalizedHost}:8983/solr/${keys.solr_core}`;
};

const fetchJson = async (url) =>
  new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            return reject(new Error(`Solr request failed with status ${response.statusCode}`));
          }
          try {
            return resolve(JSON.parse(data));
          } catch (error) {
            return reject(error);
          }
        });
      })
      .on('error', (error) => reject(error));
  });

const getSolrFieldNames = async () => {
  const schemaUrl = `${buildSolrBaseUrl()}/schema/fields?wt=json`;
  const schemaResult = await fetchJson(schemaUrl);
  const fields = Array.isArray(schemaResult.fields) ? schemaResult.fields : [];
  return fields.map((field) => field.name).filter(Boolean);
};

router.get('/solr/schema', async (req, res, next) => {
  try {
    console.log(`[debug] Request: ${req.method} ${req.originalUrl}`);
    const schemaUrl = `${buildSolrBaseUrl()}/schema/fields?wt=json`;
    const result = await fetchJson(schemaUrl);
    const fields = Array.isArray(result.fields) ? result.fields : [];
    console.log(`[debug] Solr schema response: ${trimForLog({ fieldCount: fields.length, sample: fields.slice(0, 3) })}`);
    return res.json({ fields });
  } catch (error) {
    return next(error);
  }
});

router.get('/solr/sample', async (req, res, next) => {
  try {
    console.log(`[debug] Request: ${req.method} ${req.originalUrl}`);
    const query = client
      .query()
      .q('*:*')
      .rows(20)
      .addParams({ wt: 'json', omitHeader: true });

    const result = await client.search(query);
    const docs = result?.response?.docs || [];
    console.log(`[debug] Solr sample response: ${trimForLog({ numFound: result?.response?.numFound, docsPreview: docs.slice(0, 2) })}`);
    return res.json({ docs, numFound: result?.response?.numFound || 0 });
  } catch (error) {
    return next(error);
  }
});

router.get('/solr/facets', async (req, res, next) => {
  try {
    console.log(`[debug] Request: ${req.method} ${req.originalUrl}`);
    const availableFields = await getSolrFieldNames();
    const facetFields = DEFAULT_FACET_FIELDS.filter((field) => availableFields.includes(field));
    const selectedFacetFields = facetFields.length ? facetFields : DEFAULT_FACET_FIELDS;

    const params = new URLSearchParams({
      q: '*:*',
      rows: '0',
      wt: 'json',
      facet: 'true',
      'facet.limit': '50',
      'facet.mincount': '1',
    });
    selectedFacetFields.forEach((field) => params.append('facet.field', field));

    const facetsUrl = `${buildSolrBaseUrl()}/select?${params.toString()}`;
    const result = await fetchJson(facetsUrl);
    const facetFieldsResult = result?.facet_counts?.facet_fields || {};
    console.log(`[debug] Solr facets response: ${trimForLog(facetFieldsResult)}`);

    return res.json({
      fields: selectedFacetFields,
      facets: facetFieldsResult,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
