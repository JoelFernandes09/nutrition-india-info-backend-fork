'use strict';

/**
 * Shared Solr client for extraction scripts (dotenv + keys + env fallbacks).
 * Does not replace runtime Solr usage in routes/tools.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SolrNode = require('solr-node');
const keys = require('../config/keys');

const host = keys.solr_domain || process.env.SOLR_DOMAIN || 'localhost';
const core = keys.solr_core || process.env.SOLR_CORE || 'latest_13feb26';

const client = new SolrNode({
  host,
  port: '8983',
  core,
  protocol: 'http',
});

const search = (cQuery) =>
  new Promise((resolve, reject) => {
    client.search(cQuery, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

module.exports = { client, host, core, search };
