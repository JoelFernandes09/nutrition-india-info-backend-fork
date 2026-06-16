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

module.exports = { dimensionMap };
