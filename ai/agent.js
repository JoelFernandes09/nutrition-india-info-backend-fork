'use strict';

const OpenAI = require('openai');
const { getNutritionData } = require('./tools');
const { findAreaByName, findSubgroup, resolveAreaContextFromQuery } = require('./metadataLoader');
const { parseTimeperiodFromQuery, deriveTimeperiodFromRows } = require('./timeperiodResolver');
const {
  parseSubgroupsFromQuery,
  formatMissingSubgroupsMessage,
} = require('./subgroupResolver');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const FALLBACK = { responseMode: 'text', chart: null, answer: 'Unable to process request', insights: [] };

const ALLOWED_RESPONSE_MODES = new Set(['auto', 'text', 'visual']);

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
- "timeperiod": if a survey round is mentioned use its key: "nfhs6", "nfhs5", "nfhs4", "nfhs3",
  "2023-24", "2019-20", "cnns", "srs 2024", "srs 2022", "census 2011", "nsso 2022".
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
- Preserve "unit" on each row exactly as provided ("%" for percentages, "burden" for absolute counts, or the rate unit string for mortality indicators).
- When unit is "%", insights should describe values as percentages. For rate units (e.g. per 100,000 live births), do not call values percentages or burden.
- "insights" must be an array of short strings with genuine observations from the numbers provided.
- ${chartTypeInstruction ?? 'Choose the most appropriate chart type for the data'}
- Supported types: bar, line, area, pie, donut, radar, radialBar, composed
`.trim();

const buildTextAnalysisPrompt = () =>
  `
You are a nutrition data assistant for an India nutrition dashboard.

You will receive a user question and optional survey data JSON ("meta" and "data").
Use ONLY values from the payload — do not invent numbers.

Return ONLY valid JSON in exactly this format:

{
  "responseMode": "text",
  "answer": "",
  "insights": []
}

Rules:
- "answer" is a concise natural-language reply (1-3 sentences) that directly answers the question.
- Include the numeric value with its unit (% for percentages, plain numbers for burden, or the rate unit when provided).
- Mention area and timeperiod when present in the data.
- "insights" is optional — 0-2 short extra notes, or an empty array.
- Do NOT include a chart.
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

const isValidTextOutput = (output) => {
  if (!output || typeof output !== 'object') return false;
  if (typeof output.answer !== 'string' || output.answer.trim() === '') return false;
  if (!Array.isArray(output.insights)) return false;
  if (!output.insights.every((s) => typeof s === 'string')) return false;
  return true;
};

const normalizeResponseMode = (mode) => {
  const key = String(mode || 'auto').toLowerCase().trim();
  return ALLOWED_RESPONSE_MODES.has(key) ? key : 'auto';
};

const detectResponseMode = (query, context, rowCount, intent, forcedMode = 'auto', chartTypeInstruction = null) => {
  if (forcedMode === 'text') return 'text';
  if (forcedMode === 'visual') return 'visual';

  if (chartTypeInstruction) return 'visual';

  const qLower = String(query || '').toLowerCase();

  if (
    /\b(compare|comparison|comparision|versus|vs\.?|chart|graph|plot|visuali[sz]e|breakdown|rank|ranking|top\s+\d+|districts|states|subdistricts|trend|over time|across|between)\b/.test(
      qLower
    )
  ) {
    return 'visual';
  }

  if (context?.breakdown) return 'visual';
  if (context?.compareAcrossTimeperiods) return 'visual';
  if (intent?.mode === 'trend') return 'visual';
  if (context?.compareAcrossSubgroups) return 'visual';
  if (Array.isArray(context?.subgroups) && context.subgroups.length > 1) return 'visual';
  if (Array.isArray(intent?.indicators) && intent.indicators.length > 1) return 'visual';
  if (rowCount > 1) return 'visual';

  return 'text';
};

const formatValueForText = (value, unit) => {
  if (unit === '%') return `${value}%`;
  if (unit === 'burden') return Number(value).toLocaleString('en-IN');
  if (unit) return `${value} ${unit}`;
  return String(value);
};

const formatTextAnswerFromRows = (rows, valueKind = 'percentage', options = {}) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const unit = rows[0]?.unit || (valueKind === 'burden' ? 'burden' : '%');
  const fmt = (row) => formatValueForText(row.value, row.unit || unit);
  const tp = rows[0]?.timeperiod ? ` (${rows[0].timeperiod})` : '';
  const dimension = options.compareAcrossTimeperiods
    ? 'timeperiods'
    : options.compareAcrossSubgroups
      ? 'subgroups'
      : 'areas';

  const missingNote = options.subgroupCoverage?.missing?.length
    ? formatMissingSubgroupsMessage(options.subgroupCoverage)
    : '';

  if (rows.length === 1) {
    const row = rows[0];
    const answer = `${row.label}: ${fmt(row)}${tp}.`;
    return missingNote ? `${answer} ${missingNote}` : answer;
  }

  const sorted = options.compareAcrossTimeperiods
    ? [...rows].sort((a, b) => (a.timeperiod_id || 0) - (b.timeperiod_id || 0))
    : [...rows].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 3).map((row) => `${row.label} (${fmt(row)})`);
  const bottom = sorted.length > 3
    ? sorted.slice(-2).map((row) => `${row.label} (${fmt(row)})`)
    : [];

  let summary = `Across ${rows.length} ${dimension}${tp}: highest values are ${top.join(', ')}`;
  if (bottom.length) summary += `; lowest are ${bottom.join(', ')}`;
  summary += '.';
  if (missingNote) summary += ` ${missingNote}`;
  return summary;
};

const appendSubgroupNotes = (answer, insights = [], subgroupCoverage = null) => {
  const note = formatMissingSubgroupsMessage(subgroupCoverage);
  if (!note) return { answer, insights };
  const nextInsights = Array.isArray(insights) ? [...insights] : [];
  if (!nextInsights.includes(note)) nextInsights.push(note);
  if (!answer) return { answer: note, insights: nextInsights };
  if (answer.includes(note)) return { answer, insights: nextInsights };
  return { answer: `${answer} ${note}`, insights: nextInsights };
};

const buildResponseMeta = (context, metricHint, rowCount, responseMode, timeperiod = null, subgroupCoverage = null) => ({
  rowCount,
  source: 'solr',
  responseMode,
  valueKind: metricHint === 'burden' ? 'burden' : 'percentage',
  timeperiod: timeperiod
    ? { id: timeperiod.id ?? null, name: timeperiod.name || '' }
    : null,
  subgroupCoverage: subgroupCoverage || null,
  context,
});

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

const deriveChartIndicatorName = (rows = [], fallbackNames = []) => {
  const fromRows = [...new Set(rows.map((row) => String(row?.indicator || '').trim()).filter(Boolean))];
  if (fromRows.length === 1) return fromRows[0];
  if (fromRows.length > 1) return fromRows.join(', ');

  const fromHints = [...new Set(fallbackNames.map((name) => String(name || '').trim()).filter(Boolean))];
  if (fromHints.length === 1) return fromHints[0];
  if (fromHints.length > 1) return fromHints.join(', ');

  return '';
};

const applyValueUnitsToChart = (output, valueKind = 'percentage', solrRows = [], indicatorNames = [], options = {}) => {
  if (!output?.chart || typeof output.chart !== 'object') return output;

  const defaultUnit = valueKind === 'burden' ? 'burden' : '%';
  const indicatorName = deriveChartIndicatorName(solrRows, indicatorNames);
  if (indicatorName) output.chart.indicatorName = indicatorName;
  if (options.preserveOrder) output.chart.preserveOrder = true;

  if (Array.isArray(solrRows) && solrRows.length > 0) {
    output.chart.data = solrRows.map((row) => ({
      label: row.label,
      value: row.value,
      unit: row.unit || defaultUnit,
      timeperiod: row.timeperiod || '',
      timeperiod_id: row.timeperiod_id ?? null,
      indicator: row.indicator || indicatorName || '',
    }));
    if (!output.chart.xKey) output.chart.xKey = 'label';
    if (!output.chart.yKey) output.chart.yKey = 'value';
    return output;
  }

  if (!Array.isArray(output.chart.data)) return output;
  output.chart.data = output.chart.data.map((row) => ({
    ...row,
    unit: defaultUnit,
  }));
  return output;
};

const detectCompareAcrossTimeperiods = (query = '') => {
  const q = String(query || '').toLowerCase();
  return (
    /\b(across|over|between)\s+(different\s+)?(time\s*periods?|survey\s*rounds?|surveys?|rounds?)\b/.test(q) ||
    /\b(time\s*periods?|survey\s*rounds?|surveys?|rounds?)\s+(comparison|compare|comparision|wise)\b/.test(q) ||
    /\b(compare|comparison|comparision)\b[\s\S]{0,80}\b(time\s*periods?|survey\s*rounds?|surveys?|rounds?)\b/.test(q) ||
    /\b(time\s*periods?|survey\s*rounds?|surveys?|rounds?)\b[\s\S]{0,40}\b(compare|comparison|comparision)\b/.test(q)
  );
};

const detectMetricFromQuery = (query = '') => {
  const q = String(query || '').toLowerCase();
  if (/\b(burden|count|number|numbers|total|population|raw|absolute|numeric)\b/.test(q)) {
    return 'burden';
  }
  return 'percentage';
};

const inferContextFromQuery = (query = '') => {
  const qLower = String(query || '').toLowerCase();
  const inferred = { ...resolveAreaContextFromQuery(query) };

  if (detectCompareAcrossTimeperiods(query)) {
    inferred.compareAcrossTimeperiods = true;
  } else {
    const parsedTp = parseTimeperiodFromQuery(query);
    if (parsedTp?.name) {
      inferred.timeperiod = parsedTp.name;
      inferred.timeperiod_id = parsedTp.id;
    }
  }

  const subgroupInfo = parseSubgroupsFromQuery(query);
  if (subgroupInfo.compareAcrossSubgroups) {
    inferred.compareAcrossSubgroups = true;
    inferred.subgroups = subgroupInfo.subgroups;
    inferred.requestedSubgroups = subgroupInfo.requestedSubgroups;
  } else if (subgroupInfo.subgroups.length > 1) {
    inferred.subgroups = subgroupInfo.subgroups;
    inferred.requestedSubgroups = subgroupInfo.requestedSubgroups;
  } else if (subgroupInfo.subgroup) {
    inferred.subgroup = subgroupInfo.subgroup;
    inferred.requestedSubgroups = subgroupInfo.requestedSubgroups;
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
  if (/\bstunting\b/.test(q)) return ['Stunting'];
  if (/\bwasting\b/.test(q)) return ['Wasting'];
  if (/\bunderweight\b/.test(q)) return ['Underweight'];
  if (/\bimr\b/.test(q)) return ['IMR'];
  if (/\bmmr\b/.test(q)) return ['MMR'];
  return [];
};

const resolveContext = (context = {}) => {
  const next = {};
  if (typeof context !== 'object' || !context) return next;

  const areaInput = String(context.area || '').trim();
  const breakdownInput = String(context.breakdown || '').trim().toLowerCase();

  if (areaInput && breakdownInput) {
    const breakdownQuery =
      breakdownInput === 'state'
        ? `${areaInput} states`
        : breakdownInput === 'district'
          ? `${areaInput} districts`
          : `${areaInput} subdistricts`;
    Object.assign(next, resolveAreaContextFromQuery(breakdownQuery));
  } else if (areaInput) {
    const matchedArea = findAreaByName(areaInput, { partial: true });
    if (matchedArea) {
      next.area_id = matchedArea.id;
      next.area = matchedArea.name;
      if (matchedArea.level != null) next.area_level = matchedArea.level;
    } else {
      next.area = areaInput;
    }
  }

  const areaParent = Number(context.area_parent ?? context.areaParent);
  if (Number.isFinite(areaParent)) next.area_parent = areaParent;

  const areaLevel = Number(context.area_level ?? context.areaLevel);
  if (Number.isFinite(areaLevel)) next.area_level = areaLevel;

  if (breakdownInput === 'state' || breakdownInput === 'district' || breakdownInput === 'subdistrict') {
    next.breakdown = breakdownInput;
  }

  if (Number.isFinite(next.area_parent) && Number.isFinite(next.area_level)) {
    delete next.area;
  }

  const subgroupInput = String(context.subgroup || '').trim();
  if (subgroupInput) {
    const matchedSubgroup = findSubgroup(subgroupInput, { partial: true });
    next.subgroup = matchedSubgroup?.name || subgroupInput;
  }

  const subgroupsInput = Array.isArray(context.subgroups)
    ? context.subgroups.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  if (subgroupsInput.length > 0) {
    next.subgroups = subgroupsInput.map((name) => findSubgroup(name, { partial: true })?.name || name);
    next.requestedSubgroups = next.subgroups;
  }

  if (context.compareAcrossSubgroups === true) {
    next.compareAcrossSubgroups = true;
  }

  const timeperiodInput = String(context.timeperiod || '').trim();
  if (timeperiodInput) next.timeperiod = timeperiodInput;

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

const buildTextResponse = async ({
  cleanQuery,
  payload,
  solrData,
  rowCount,
  valueKind,
  subgroupCoverage = null,
  compareAcrossSubgroups = false,
}) => {
  const textOptions = {
    compareAcrossSubgroups,
    subgroupCoverage,
  };
  const quickAnswer =
    rowCount > 0 ? formatTextAnswerFromRows(solrData, valueKind, textOptions) : null;
  const missingNote = formatMissingSubgroupsMessage(subgroupCoverage);
  const noDataAnswer = missingNote
    ? missingNote
    : 'No matching data was found for this query. Try adding a survey round (e.g. NFHS-5) or checking the area name.';

  if (rowCount === 1 && quickAnswer) {
    return { answer: quickAnswer, insights: missingNote ? [missingNote] : [], usage: toUsageSummary(null) };
  }

  if (payload && rowCount > 0) {
    try {
      const maxTokens = rowCount > 30 ? 700 : rowCount > 10 ? 550 : rowCount > 3 ? 450 : 320;
      const { output, usage } = await runTextAnalysis(cleanQuery, payload, maxTokens);
      if (isValidTextOutput(output)) {
        const merged = appendSubgroupNotes(output.answer.trim(), output.insights || [], subgroupCoverage);
        return {
          answer: merged.answer,
          insights: merged.insights,
          usage,
        };
      }
    } catch (err) {
      console.error('[AI Agent] ── text analysis failed:', err.message);
    }
  }

  if (quickAnswer) {
    return { answer: quickAnswer, insights: missingNote ? [missingNote] : [], usage: toUsageSummary(null) };
  }

  return {
    answer: noDataAnswer,
    insights: [],
    usage: toUsageSummary(null),
  };
};

const runTextAnalysis = async (cleanQuery, payload, maxTokens = 280) => {
  const userMessage = payload
    ? `${cleanQuery}\n\nSurvey payload:\n${JSON.stringify(payload)}`
    : cleanQuery;

  const messages = [
    { role: 'system', content: buildTextAnalysisPrompt() },
    { role: 'user', content: userMessage },
  ];

  const { output, usage } = await parseAnalysisJson(messages, maxTokens);
  return { output, usage: toUsageSummary(usage) };
};

const runVisualAnalysis = async ({
  cleanQuery,
  payload,
  chartTypeInstruction,
  maxTokens,
  valueKind,
  intentUsage,
  usedTimeperiod,
  context,
  metricHint,
  rowCount,
  indicatorNames = [],
  preserveChartOrder = false,
  subgroupCoverage = null,
  compareAcrossSubgroups = false,
}) => {
  if (!payload?.data?.length) {
    const missingNote = formatMissingSubgroupsMessage(subgroupCoverage);
    return withTokenMeta(
      {
        responseMode: 'text',
        answer:
          missingNote ||
          'No matching data was found for this query in the dataset. The indicator may not be available at the requested geographic level — try a broader area or a different survey round.',
        chart: null,
        insights: missingNote ? [missingNote] : [],
        timeperiod: null,
        meta: buildResponseMeta(context, metricHint, 0, 'text', null, subgroupCoverage),
      },
      { intent: intentUsage, analysis: toUsageSummary(null) }
    );
  }

  const userMessage = `${cleanQuery}\n\nSurvey payload:\n${JSON.stringify(payload)}`;

  const messages = [
    { role: 'system', content: buildAnalysisPrompt(chartTypeInstruction) },
    { role: 'user', content: userMessage },
  ];

  const { output, content, usage } = await parseAnalysisJson(messages, maxTokens);
  const responseSize = typeof content === 'string' ? content.length : 0;
  console.log(`[AI Agent] ── analysis response size (chars): ${responseSize}`);
  console.log('[AI Agent] ── response:', content);

  if (!isValidOutput(output)) {
    console.warn('[AI Agent] ── visual validation failed, returning fallback');
    return withTokenMeta(FALLBACK, { intent: intentUsage, analysis: toUsageSummary(usage) });
  }

  const styled = applyValueUnitsToChart(
    {
      ...output,
      responseMode: 'visual',
      answer: formatTextAnswerFromRows(payload.data, valueKind, {
        compareAcrossTimeperiods: preserveChartOrder,
        compareAcrossSubgroups,
        subgroupCoverage,
      }),
      insights: output.insights || [],
      timeperiod: usedTimeperiod,
      meta: buildResponseMeta(
        context,
        metricHint,
        rowCount,
        'visual',
        usedTimeperiod,
        subgroupCoverage
      ),
    },
    valueKind,
    payload.data,
    indicatorNames,
    { preserveOrder: preserveChartOrder }
  );

  const merged = appendSubgroupNotes(styled.answer, styled.insights, subgroupCoverage);
  styled.answer = merged.answer;
  styled.insights = merged.insights;

  return withTokenMeta(styled, { intent: intentUsage, analysis: toUsageSummary(usage) });
};

const runAgent = async (userQuery, rawContext = {}) => {
  const queryLen = userQuery.length;
  console.log(`[AI Agent] ── query length: ${queryLen}`);
  console.log('[AI Agent] ── query:', userQuery);

  const chartTypeMatch = userQuery.match(/You MUST use chart type "([^"]+)"\./);
  const chartTypeInstruction = chartTypeMatch
    ? `You MUST set chart type to exactly "${chartTypeMatch[1]}" - no exceptions`
    : null;
  const cleanQuery = userQuery.replace(/\s*You MUST use chart type "[^"]+"\./, '').trim();
  const metricHint = detectMetricFromQuery(cleanQuery);
  const forcedResponseMode = normalizeResponseMode(rawContext.responseMode);

  const context = { ...inferContextFromQuery(cleanQuery), ...resolveContext(rawContext) };
  const { intent, usage: intentUsage } = await extractIntent(cleanQuery);
  const indicatorHints = detectIndicatorHintsFromQuery(cleanQuery);
  console.log('[AI Agent] ── intent:', JSON.stringify(intent));
  if (Object.keys(context).length > 0) {
    console.log('[AI Agent] ── context:', JSON.stringify(context));
  }

  let solrData = null;
  let usedTimeperiod = null;
  const indicatorList =
    indicatorHints.length > 0 ? indicatorHints : intent?.indicators || [];
  const compareAcrossTimeperiods = Boolean(context.compareAcrossTimeperiods);
  const compareAcrossSubgroups = Boolean(context.compareAcrossSubgroups);
  const requestedSubgroups = Array.isArray(context.requestedSubgroups)
    ? context.requestedSubgroups
    : Array.isArray(context.subgroups) && context.subgroups.length > 0
      ? context.subgroups
      : context.subgroup
        ? [context.subgroup]
        : [];
  const queryMode = compareAcrossTimeperiods ? 'trend' : intent?.mode || 'comparison';
  let subgroupCoverage = null;
  try {
    const timeperiodHint = compareAcrossTimeperiods
      ? ''
      : context.timeperiod ||
        (context.timeperiod_id != null ? String(context.timeperiod_id) : '') ||
        intent?.timeperiod ||
        '';
    const nutritionResult = await getNutritionData({
      indicators: indicatorList,
      mode: queryMode,
      timeperiod: timeperiodHint,
      metric: metricHint,
      filters: {
        area: context.area || '',
        area_id: context.area_id,
        area_level: context.area_level,
        area_parent: context.area_parent,
        subgroup: context.subgroup || '',
        subgroups: context.subgroups || [],
        requestedSubgroups,
      },
    });
    subgroupCoverage = nutritionResult?.subgroupCoverage || null;
    if (nutritionResult?.rows?.length > 0) {
      solrData = nutritionResult.rows;
      usedTimeperiod =
        nutritionResult.timeperiod ||
        deriveTimeperiodFromRows(nutritionResult.rows) ||
        null;
    } else if (Array.isArray(nutritionResult) && nutritionResult.length > 0) {
      solrData = nutritionResult;
    }
  } catch (err) {
    console.error('[AI Agent] ── solr fetch failed:', err.message);
  }

  if (usedTimeperiod?.name) {
    console.log(`[AI Agent] ── timeperiod used: ${usedTimeperiod.name} (id=${usedTimeperiod.id})`);
  }

  const rowCount = Array.isArray(solrData) ? solrData.length : 0;
  console.log(`[AI Agent] ── solr row count: ${rowCount}`);

  const resolvedResponseMode = detectResponseMode(
    cleanQuery,
    context,
    rowCount,
    intent,
    forcedResponseMode,
    chartTypeInstruction
  );
  console.log(`[AI Agent] ── response mode: ${resolvedResponseMode} (requested: ${forcedResponseMode})`);

  const valueKind = metricHint === 'burden' ? 'burden' : 'percentage';
  const payload = solrData
    ? {
        meta: {
          ...buildResponseMeta(
            context,
            metricHint,
            rowCount,
            resolvedResponseMode,
            usedTimeperiod,
            subgroupCoverage
          ),
          indicators: indicatorList,
        },
        data: solrData,
      }
    : null;

  if (resolvedResponseMode === 'text') {
    const { answer, insights, usage: analysisUsage } = await buildTextResponse({
      cleanQuery,
      payload,
      solrData,
      rowCount,
      valueKind,
      subgroupCoverage,
      compareAcrossSubgroups,
    });

    return withTokenMeta(
      {
        responseMode: 'text',
        answer,
        chart: null,
        insights,
        timeperiod: usedTimeperiod,
        meta: buildResponseMeta(
          context,
          metricHint,
          rowCount,
          'text',
          usedTimeperiod,
          subgroupCoverage
        ),
      },
      { intent: intentUsage, analysis: analysisUsage || toUsageSummary(null) }
    );
  }

  let maxTokens = 600;
  if (rowCount < 10) maxTokens = 500;
  if (rowCount > 20) maxTokens = 800;
  if (rowCount > 30) maxTokens = 1200;
  if (rowCount > 60) maxTokens = 1500;

  try {
    return await runVisualAnalysis({
      cleanQuery,
      payload,
      chartTypeInstruction,
      maxTokens,
      valueKind,
      intentUsage,
      usedTimeperiod,
      context,
      metricHint,
      rowCount,
      indicatorNames: indicatorList,
      preserveChartOrder: compareAcrossTimeperiods,
      subgroupCoverage,
      compareAcrossSubgroups,
    });
  } catch (error) {
    console.error('[AI Agent] ── analysis error:', error.message ?? error);
    return withTokenMeta(FALLBACK, { intent: intentUsage, analysis: toUsageSummary(null) });
  }
};

module.exports = { runAgent };
