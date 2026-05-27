'use strict';

const OpenAI = require('openai');
const { getNutritionData } = require('./tools');
const { findAreaByName, findSubgroup } = require('./metadataLoader');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const FALLBACK = { chart: null, insights: ['Unable to process request'] };

const ALLOWED_CHART_TYPES = new Set(['bar', 'line', 'pie', 'area', 'donut', 'radar', 'radialBar', 'composed']);
const DEFAULT_TOKEN_BUDGET = Number(process.env.AI_MAX_TOKENS_PER_REQUEST) || 2000;

const INTENT_PROMPT = `
You are a query parser for an India nutrition data dashboard.

Given a user question, extract query parameters and return ONLY valid JSON:

{
  "indicators": [],
  "mode": "comparison",
  "timeperiod": ""
}

Rules:
- "indicators": array of indicator names or broad topic keywords from the query.
  Prefer broad topic terms when they apply:
  "child nutrition", "child malnutrition", "malnutrition",
  "anemia", "mortality", "child mortality",
  "maternal health", "antenatal care", "child feeding", "breastfeeding",
  "immunization", "wash", "sanitation",
  "women nutrition", "adolescent nutrition",
  "food expenditure", "household assets"
  Otherwise use specific names like: "Stunting", "IMR", "MMR", "4+ ANC"
- "mode": use "trend" ONLY when the query asks about change over time for ONE indicator.
  Use "comparison" for everything else.
- "timeperiod": if a survey round is mentioned use its key: "nfhs5", "nfhs4", "nfhs3",
  "cnns", "srs 2022", "srs 2020", "census 2011", "nsso 2022".
  Leave empty string if not mentioned.
`.trim();

const buildAnalysisPrompt = (chartTypeInstruction) =>
  `
You are a data analyst AI for an India nutrition dashboard.

You will receive a user question and a JSON payload with "meta" and "data".
The "data" array contains REAL survey rows. Use ONLY those values — do not invent or alter numbers.

Return ONLY valid JSON in exactly this format:

{
  "chart": {
    "type": "bar | line | area | pie | donut | radar | radialBar | composed",
    "data": [],
    "xKey": "",
    "yKey": ""
  },
  "insights": []
}

Rules:
- Copy each source row into "chart.data" with the same keys: "label" (string), "value" (number), "unit" (string), "timeperiod" (string).
- Set "xKey" to "label" and "yKey" to "value" unless a pie/donut layout clearly needs name vs value (still use keys present on each object).
- "unit" and "timeperiod" may be empty strings on rows; preserve them.
- "insights" must be an array of short strings with genuine observations from the numbers provided.
- ${chartTypeInstruction ?? 'Choose the most appropriate chart type for the data'}
- Supported types: bar, line, area, pie, donut, radar, radialBar, composed
`.trim();


const isValidChartDataPoint = (point) => {
  if (!point || typeof point !== 'object') return false;
  if (typeof point.label !== 'string') return false;
  if (typeof point.value !== 'number' || Number.isNaN(point.value)) return false;
  return true;
};

const isValidOutput = (output) => {
  if (!output || typeof output !== 'object') return false;
  if (!output.chart || typeof output.chart !== 'object') return false;
  if (typeof output.chart.type !== 'string' || !ALLOWED_CHART_TYPES.has(output.chart.type)) return false;
  if (!Array.isArray(output.chart.data) || output.chart.data.length === 0) return false;
  if (typeof output.chart.xKey !== 'string' || typeof output.chart.yKey !== 'string') return false;
  if (!output.chart.data.every(isValidChartDataPoint)) return false;
  if (!Array.isArray(output.insights)) return false;
  if (!output.insights.every((s) => typeof s === 'string')) return false;
  return true;
};

const logUsage = (label, usage) => {
  if (!usage || typeof usage !== 'object') {
    console.log(`[AI Agent] ── ${label} tokens: n/a`);
    return;
  }
  const p = usage.prompt_tokens ?? usage.input_tokens;
  const c = usage.completion_tokens ?? usage.output_tokens;
  const t = usage.total_tokens;
  console.log(
    `[AI Agent] ── ${label} tokens: prompt=${p ?? 'n/a'} completion=${c ?? 'n/a'} total=${t ?? 'n/a'}`
  );
};

const toUsageSummary = (usage) => {
  if (!usage || typeof usage !== 'object') return { prompt: 0, completion: 0, total: 0 };
  const prompt = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0) || 0;
  const completion = Number(usage.completion_tokens ?? usage.output_tokens ?? 0) || 0;
  const total = Number(usage.total_tokens ?? prompt + completion) || 0;
  return { prompt, completion, total };
};

const usageTotals = (parts = []) => {
  return parts.reduce(
    (acc, part) => ({
      prompt: acc.prompt + (part?.prompt || 0),
      completion: acc.completion + (part?.completion || 0),
      total: acc.total + (part?.total || 0),
    }),
    { prompt: 0, completion: 0, total: 0 }
  );
};

const withTokenMeta = (data, tokenParts = {}, allowed = DEFAULT_TOKEN_BUDGET) => {
  const overall = usageTotals(Object.values(tokenParts));
  const remaining = Math.max(allowed - overall.total, 0);
  const pctUsed = allowed > 0 ? Number(((overall.total / allowed) * 100).toFixed(1)) : null;
  return {
    ...data,
    meta: {
      ...(data.meta || {}),
      tokens: {
        ...tokenParts,
        overall: {
          spent: overall.total,
          allowed,
          remaining,
          pctUsed,
        },
      },
    },
  };
};

const detectMetricFromQuery = (query = '') => {
  const q = String(query || '').toLowerCase();
  if (/\b(percent|percentage|pct|share|rate|ratio)\b/.test(q)) return 'percentage';
  if (/\b(count|number|numbers|total|population|burden|absolute|raw)\b/.test(q)) return 'absolute';
  return '';
};

const inferContextFromQuery = (query = '') => {
  const q = String(query || '');
  const qLower = q.toLowerCase();
  const inferred = {};

  const area = findAreaByName(q, { partial: true });
  if (area?.name) {
    inferred.area_id = area.id;
    inferred.area = area.name;
    if (area.level != null) inferred.area_level = area.level;
  }

  const isDistrictWise = /\bdistrict[-\s]?wise\b|\bdistricts?\b/.test(qLower);
  if (isDistrictWise) {
    inferred.breakdown = 'district';
    if (area?.level === 2 && Number.isFinite(area.id)) {
      inferred.area_parent = area.id;
      inferred.area_level = 3;
      delete inferred.area;
    }
  }

  const subgroups = [];
  const hasRural = /\brural\b/.test(qLower);
  const hasUrban = /\burban\b/.test(qLower);
  if (hasRural) subgroups.push('Rural');
  if (hasUrban) subgroups.push('Urban');
  if (!hasRural && !hasUrban && /\bfemale\b|\bwomen\b|\bgirls?\b/.test(qLower)) subgroups.push('Female');
  if (!hasRural && !hasUrban && /\bmale\b|\bmen\b|\bboys?\b/.test(qLower)) subgroups.push('Male');
  if (/\bsc\b|scheduled caste/.test(qLower)) subgroups.push('SC');
  if (/\bst\b|scheduled tribe/.test(qLower)) subgroups.push('ST');

  if (subgroups.length > 1) {
    inferred.subgroups = Array.from(new Set(subgroups));
  } else if (subgroups.length === 1) {
    inferred.subgroup = subgroups[0];
  }

  return inferred;
};

const detectIndicatorHintsFromQuery = (query = '') => {
  const q = String(query || '').toLowerCase();
  if (/\b(anemia|anaemia)\b/.test(q) && /\b(women|female|15-49)\b/.test(q)) {
    return ['Anemia among women 15-49 years'];
  }
  if (/\bfull immunization\b/.test(q)) {
    return ['Full Immunization'];
  }
  return [];
};

const resolveContext = (context = {}) => {
  const next = {};
  if (typeof context !== 'object' || !context) return next;

  const areaInput = String(context.area || '').trim();
  if (areaInput) {
    const matchedArea = findAreaByName(areaInput, { partial: true });
    next.area = matchedArea?.name || areaInput;
    if (matchedArea?.level != null) next.area_level = matchedArea.level;
  }

  const subgroupInput = String(context.subgroup || '').trim();
  if (subgroupInput) {
    const matchedSubgroup = findSubgroup(subgroupInput, { partial: true });
    next.subgroup = matchedSubgroup?.name || subgroupInput;
  }

  const timeperiodInput = String(context.timeperiod || '').trim();
  if (timeperiodInput) next.timeperiod = timeperiodInput;

  const focusTopics = Array.isArray(context.focusTopics) ? context.focusTopics : [];
  if (focusTopics.length > 0) {
    next.focusTopics = focusTopics.map((t) => String(t || '').trim()).filter(Boolean).slice(0, 6);
  }

  return next;
};

const extractIntent = async (query) => {
  try {
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: INTENT_PROMPT },
        { role: 'user', content: query },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 150,
      temperature: 0.1,
    });
    logUsage('intent usage', res.usage);
    return { intent: JSON.parse(res.choices[0].message.content), usage: toUsageSummary(res.usage) };
  } catch (err) {
    console.error('[AI Agent] ── intent extraction failed:', err.message);
    return { intent: null, usage: toUsageSummary(null) };
  }
};

const parseAnalysisJson = async (messages, maxTokens) => {
  const tryParseJson = (content) => {
    if (!content || typeof content !== 'string') return null;
    try {
      return JSON.parse(content);
    } catch {
      const first = content.indexOf('{');
      const last = content.lastIndexOf('}');
      if (first !== -1 && last !== -1 && last > first) {
        const candidate = content.slice(first, last + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          return null;
        }
      }
      return null;
    }
  };

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    response_format: { type: 'json_object' },
    max_tokens: maxTokens,
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content ?? '';
  logUsage('analysis usage', response.usage);

  const parsed = tryParseJson(content);
  if (parsed) {
    return { output: parsed, content, usage: response.usage };
  }

  const retryMessages = [
    ...messages,
    {
      role: 'user',
      content:
        'Return ONLY valid minified JSON. Keep insights to maximum 3 short bullets. Do not include any prose outside JSON.',
    },
  ];
  const retry = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: retryMessages,
    response_format: { type: 'json_object' },
    max_tokens: Math.max(maxTokens, 1200),
    temperature: 0.1,
  });
  const retryContent = retry.choices[0]?.message?.content ?? '';
  logUsage('analysis retry usage', retry.usage);
  const retryParsed = tryParseJson(retryContent);
  if (!retryParsed) {
    throw new Error('Unable to parse analysis JSON after retry');
  }
  return { output: retryParsed, content: retryContent, usage: retry.usage };
};

const runAgent = async (userQuery, rawContext = {}) => {
  const queryLen = userQuery.length;
  console.log(`[AI Agent] ── query length: ${queryLen}`);
  console.log('[AI Agent] ── query:', userQuery);

  const chartTypeMatch = userQuery.match(/You MUST use chart type "([^"]+)"\./);
  const chartTypeInstruction = chartTypeMatch
    ? `You MUST set chart type to exactly "${chartTypeMatch[1]}" — no exceptions`
    : null;
  const cleanQuery = userQuery.replace(/\s*You MUST use chart type "[^"]+"\./, '').trim();
  const metricHint = detectMetricFromQuery(cleanQuery);

  const context = { ...inferContextFromQuery(cleanQuery), ...resolveContext(rawContext) };
  const { intent, usage: intentUsage } = await extractIntent(cleanQuery);
  const indicatorHints = detectIndicatorHintsFromQuery(cleanQuery);
  console.log('[AI Agent] ── intent:', JSON.stringify(intent));
  if (Object.keys(context).length > 0) {
    console.log('[AI Agent] ── context:', JSON.stringify(context));
  }

  let solrData = null;
  if (intent) {
    try {
      const result = await getNutritionData({
        indicators: indicatorHints.length > 0 ? indicatorHints : (intent.indicators || []),
        mode: intent.mode || 'comparison',
        timeperiod: context.timeperiod || intent.timeperiod || '',
        metric: metricHint,
        filters: {
          area: context.area || '',
          area_level: context.area_level,
          area_parent: context.area_parent,
          subgroup: context.subgroup || '',
          subgroups: context.subgroups || [],
        },
      });
      if (Array.isArray(result) && result.length > 0) {
        solrData = result;
      }
    } catch (err) {
      console.error('[AI Agent] ── solr fetch failed:', err.message);
    }
  }

  const rowCount = Array.isArray(solrData) ? solrData.length : 0;
  console.log(`[AI Agent] ── solr row count: ${rowCount}`);

  let maxTokens = 600;
  if (rowCount < 10) maxTokens = 500;
  if (rowCount > 20) maxTokens = 800;
  if (rowCount > 30) maxTokens = 1200;
  if (rowCount > 60) maxTokens = 1500;

  const payload = solrData
    ? {
        meta: {
          rowCount,
          source: 'solr',
          note: 'Aggregated survey data',
          context,
        },
        data: solrData,
      }
    : null;

  const userMessage = payload
    ? `${cleanQuery}\n\nSurvey payload:\n${JSON.stringify(payload)}`
    : cleanQuery;

  try {
    const messages = [
      { role: 'system', content: buildAnalysisPrompt(chartTypeInstruction) },
      { role: 'user', content: userMessage },
    ];

    const { output, content, usage } = await parseAnalysisJson(messages, maxTokens);
    const responseSize = typeof content === 'string' ? content.length : 0;
    console.log(`[AI Agent] ── analysis response size (chars): ${responseSize}`);
    console.log('[AI Agent] ── response:', content);

    if (!isValidOutput(output)) {
      console.warn('[AI Agent] ── validation failed, returning fallback');
      return withTokenMeta(FALLBACK, { intent: intentUsage, analysis: toUsageSummary(usage) });
    }

    return withTokenMeta(output, { intent: intentUsage, analysis: toUsageSummary(usage) });
  } catch (error) {
    console.error('[AI Agent] ── analysis error:', error.message ?? error);
    return withTokenMeta(FALLBACK, { intent: intentUsage, analysis: toUsageSummary(null) });
  }
};

module.exports = { runAgent };
