const express = require('express');
const { runAgent } = require('../../ai/agent');
const { getAreas } = require('../../ai/metadataLoader');

const router = express.Router();
const MAX_QUERY_LENGTH = 400;

router.post('/query', async (req, res, next) => {
  try {
    const { query, responseMode, context: clientContext } = req.body;

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({
        error: '"query" is required and must be a non-empty string',
      });
    }

    const trimmed = query.trim();
    if (trimmed.length > MAX_QUERY_LENGTH) {
      return res.status(400).json({
        error: `Query must be at most ${MAX_QUERY_LENGTH} characters after trimming (got ${trimmed.length}).`,
      });
    }

    const options = {};
    if (responseMode != null) options.responseMode = responseMode;
    if (clientContext && typeof clientContext === 'object') {
      Object.assign(options, clientContext);
    }

    const result = await runAgent(trimmed, options);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/areas', async (req, res, next) => {
  try {
    const areas = getAreas()
      .map((a) => ({
        id: a.id,
        name: a.name,
        level: a.level,
      }))
      .filter((a) => Boolean(a.name))
      .sort((a, b) => {
        if (a.level !== b.level) return a.level - b.level;
        return a.name.localeCompare(b.name);
      });
    res.json({ areas });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
