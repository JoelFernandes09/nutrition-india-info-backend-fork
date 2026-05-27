# AI Backend Guide

This folder contains the backend logic for the AI dashboard.

## How one AI query works

1. Frontend sends a query to `POST /ai/query`.
2. `routes/ai/aiRoute.js` validates the query and calls `runAgent()`.
3. `ai/agent.js` does:
   - intent extraction (which indicators, comparison/trend, optional timeperiod),
   - context inference from plain language (area, district-wise, subgroups),
   - metric hinting (percentage vs absolute when explicitly asked),
   - data fetch via `getNutritionData()`,
   - chart + insights generation from OpenAI,
   - token usage aggregation for UI display.
4. Response returns:
   - `chart`
   - `insights`
   - `meta.tokens` (intent/analysis + overall usage budget)

## Key files

- `agent.js`: orchestration layer
- `tools.js`: Solr query builder + result shaping
- `metadataLoader.js`: reads cached metadata (`areas`, `indicators`, `subgroups`)
- `dataMapping.js`: canonical field mappings between natural terms and Solr schema

## Query understanding rules currently implemented

- Detects specific indicator hints, for example:
  - `full immunization` -> `Full Immunization`
  - `anemia among women` -> `Anemia among women 15-49 years`
- Detects district-wise requests:
  - `district-wise ... in Bihar` resolves to districts under Bihar (`area_parent_id` + `area_level=3`)
- Detects subgroup comparisons:
  - `rural vs urban` becomes multi-subgroup Solr filter

## Value handling (percentage vs absolute)

The shaping logic in `tools.js` decides which numeric field to use and how labels should look.

- If query explicitly asks percentage/rate/share, percentage is preferred.
- If query explicitly asks count/number/burden/raw, absolute is preferred.
- If not explicit, series is inferred from values and units.
- Percent sign is shown only when the actual plotted value looks like a percentage (`abs(value) < 100`).

## Token usage in response

`meta.tokens` includes:

- `intent`: tokens used for intent extraction call
- `analysis`: tokens used for chart/insight generation call
- `overall`: spent, allowed, remaining, and percent used

`allowed` comes from `AI_MAX_TOKENS_PER_REQUEST` (fallback `2000`).

## If a query returns wrong chart data

Check these first:

1. Indicator hinting in `agent.js` (`detectIndicatorHintsFromQuery`)
2. Context inference in `agent.js` (`inferContextFromQuery`)
3. Filter construction in `tools.js` (`buildFilterQueries`)
4. Series shaping in `tools.js` (`rowsFromDocs`)

