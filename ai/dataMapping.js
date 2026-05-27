const dimensionMap = {
  state: 'area_name',
  state_id: 'area_id',
  district: 'area_name',
  district_id: 'area_id',
  subdistrict: 'area_name',
  subdistrict_id: 'area_id',
  area: 'area_name',
  area_type: 'area_level',
  area_level: 'area_level',
  area_parent: 'area_parent_id',
  year: 'timeperiod',
  year_id: 'timeperiod_id',
  timeperiod: 'timeperiod',
  start_date: 'start_date',
  end_date: 'end_date',
  category: 'category_id',
  lifecycle: 'lifecycle_id',
  subgroup: 'subgroup_name',
  subgroup_id: 'subgroup_id',
};

const metricMap = {
  population: 'data_value_num',
  total_population: 'data_value_num',
  value: 'data_value_num',
  percentage: 'data_value_num',
  rate: 'data_value_num',
  ratio: 'data_value_num',
  count: 'data_value_num',
  indicator_value: 'data_value_num',
  display_value: 'data_value',
};

const metricTypeMap = {
  data_value_num: 'absolute_or_percentage',
  data_value: 'absolute_or_percentage',
};

const filterSchema = {
  state: 'string',
  district: 'string',
  subdistrict: 'string',
  area: 'string',
  area_level: 'number',
  category: 'number',
  lifecycle: 'number',
  year: 'string_or_number',
  timeperiod_id: 'number',
  subgroup_id: 'number',
  indicator_id: 'number',
};

module.exports = {
  dimensionMap,
  metricMap,
  metricTypeMap,
  filterSchema,
};
