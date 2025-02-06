const express = require('express');
const SolrNode = require('solr-node');
const CryptoJS = require('crypto-js');

const router = express.Router();
const keys = require('../../config/keys');

// Create client
const solr_domain = keys.solr_domain;
const solr_core = keys.solr_core;

const client = new SolrNode({
  host: solr_domain,
  port: '8983',
  core: solr_core,
  protocol: 'http',
});

// **********************EXPERIMENT********************************** //
router.get('/url', (req, res) => {
  const token = req.get('Authorization');
  const area_id = req.query.area_id;
  const indicator_id = req.query.indicator_id;
  const subgroup_id = 6;

  const strQuery = client
    .query()
    .q({ area_level: 3 })
    .fl([
      'indicator_id',
      'timeperiod_id',
      'timeperiod',
      'unit_id',
      'unit_name',
      'data_value',
      'data_value_num',
      'area_level',
      'area_parent_id',
      'subgroup_id',
      'subgroup_name',
      'subgroup_category',
      'category_id',
      'lifecycle_id',
      'start_date',
      'end_date',
    ])
    .addParams({
      wt: 'json',
      indent: true,
    })
    .sort({ area_level: 'asc' })
    .rows(404);

  client.search(strQuery, function (err, result) {
    // console.log('Query', strQuery);
    if (err) {
      // console.log(err);
      res.send({ message: 'unable to process' });
    }
    console.log('Response:', result);
    res.send({ result: result.response });
  });
});

// *********************** URL_1u ********************************* //

router.get('/url_1u', (req, res, next) => {
  // console.log('Inside URL1');
  try {
    const area = req.query.area;
    const indicator = req.query.indicator;

    // console.log(`Area: ${area} | Indicator: ${indicator}`);

    if (!process.env.indicatorId.includes(indicator)) {
      return res.status(404).send({ message: 'Invalid indicator id' });
    }

    const cQuery = `fl=timeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name%2Csubgroup_order%2Csubgroup_category%2Cstart_date%2Cend_date&fq=area_id%3A${area}&fq=indicator_id%3A${indicator}&omitHeader=true&q=*%3A*&rows=404&sort=timeperiod_id%20asc`;

    client.search(cQuery, function (err, result) {
      // console.log('Query', cQuery);
      if (err) {
        console.log(err);
        res.send({ message: 'unable to process' });
      }
      // console.dir(result.response.docs[0]);
      res.send({ result: result.response });
    });
  } catch (err) {
    next(err);
  }
});

// ***********************URL_1d***********************************//
router.get('/url_1d', (req, res, next) => {
  try {
    const selCategory = req.query.selCategory;
    const selLifecycle = req.query.selLifecycle;
    const value = req.query.area_id;
    const selIndicator = req.query.selIndicator;

    if (
      !process.env.categoryId.includes(selCategory) ||
      !process.env.lifecycleId.includes(selLifecycle) ||
      !process.env.indicatorId.includes(selIndicator)
    ) {
      return res.status(404).send({
        message: 'Invalid category id or lifecycle id or indicator id',
      });
    }

    var strQuery = `fl=title:timeperiod%2Cvalue:timeperiod_id&sort=timeperiod_id%20desc&fq=lifecycle_id%3A${selLifecycle}%20OR%20lifecycle_id%3A7&fq=category_id%3A${selCategory}&fq=indicator_id%3A${selIndicator}&fq=subgroup_id%3A6&fq=area_id%3A${value}&q=*%3A*&group=true&group.field=timeperiod_id&group.limit=1&group.main=true&omitHeader=true`;

    client.search(strQuery, function (err, result) {
      if (err) {
        console.log(err);
        return;
      }
      // console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  } catch (err) {
    next(err);
  }
});

// *********************** URL_2u ********************************* //
router.get('/url_2u', (req, res, next) => {
  // console.log('Inside URL2');
  try {
    const area = req.query.area;
    const indicator = req.query.indicator;
    const timeperiod = req.query.timeperiod;

    if (!process.env.indicatorId.includes(indicator)) {
      return res.status(404).send({ message: 'Invalid indicator id' });
    }
    const cQuery = `fl=unit_id%2Cunit_name%2Csubgroup_name%2Csub_category%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name_subgroup_category&fq=area_id%3A${area}&fq=indicator_id%3A${indicator}&fq=timeperiod_id%3A${timeperiod}&omitHeader=true&q=*%3A*&rows=100&sort=subgroup_order%20asc`;

    client.search(cQuery, function (err, result) {
      // console.log('Query', cQuery);
      if (err) {
        // console.log(err);
        res.send({ message: 'unable to process' });
      }
      // console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  } catch (err) {
    next(err);
  }
});

// ***********************URL_2d**********************************//
router.get('/url_2d', (req, res, next) => {
  try {
    const selCategory = req.query.selCategory;
    const selLifeycle = req.query.selLifeycle;
    const val = req.query.indicator_id;
    const selArea = req.query.selArea;

    if (
      !process.env.categoryId.includes(selCategory) ||
      !process.env.lifecycleId.includes(selLifecycle) ||
      !process.env.indicatorId.includes(val)
    ) {
      return res.status(404).send({
        message: 'Invalid category id or lifecycle id or indicator id',
      });
    }

    const strQuery = `fl=title:timeperiod%2Cvalue:timeperiod_id&sort=timeperiod_id%20desc&fq=lifecycle_id%3A${selLifeycle}%20OR%20lifecycle_id%3A7&fq=category_id%3A${selCategory}&fq=indicator_id%3A${val}&fq=subgroup_id%3A6&fq=area_id%3A${selArea}&q=*%3A*&group=true&group.field=timeperiod_id&group.limit=1&group.main=true&omitHeader=true`;

    client.search(strQuery, function (err, result) {
      if (err) {
        // console.log(err);
        return;
      }
      // console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  } catch (err) {
    next(err);
  }
});

// *********************** URL_3u ********************************* //
router.get('/url_3u', (req, res, next) => {
  // console.log('Inside URL3');
  try {
    const indicator = req.query.indicator;
    const timeperiod = req.query.timeperiod;

    if (!process.env.indicatorId.includes(indicator)) {
      return res.status(404).send({ message: 'Invalid indicator id' });
    }
    const cQuery = `fl=area_id%2Carea_code%2Carea_name%2Carea_level%2Cdata_value%2Cdata_value_num&fq=area_level%3A2&fq=indicator_id%3A${indicator}&fq=subgroup_id%3A6&fq=timeperiod_id%3A${timeperiod}&rows=100&omitHeader=true&q=*%3A*`;

    client.search(cQuery, function (err, result) {
      // console.log('Query', cQuery);
      if (err) {
        // console.log(err);
        res.send({ message: 'unable to process' });
      }
      // console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  } catch (err) {
    next(err);
  }
});

// **********************URL_3d*************************************//
router.get('/url_3d', (req, res, next) => {
  try {
    const val = req.query.val;

    if (!process.env.indicatorId.includes(val)) {
      return res.status(404).send({ message: 'Invalid indicator id' });
    }

    var strQuery = `fl=unit_id%2Cunit_name%2Cindicator_id&fq=indicator_id%3A${val}&fq=subgroup_id%3A6&group.field=unit_id&group.main=true&group=true&omitHeader=true&q=*%3A*`;

    client.search(strQuery, function (err, result) {
      if (err) {
        // console.log(err);
        return;
      }
      // console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  } catch (err) {
    next(err);
  }
});

// ***********************URL_4d*************************************//
router.get('/url_4d', (req, res, next) => {
  var strQuery = `fl=area_id%2Carea_parent_id%2Carea_code%2Carea_name%2Carea_level&group.field=area_id&group.main=true&group=true&omitHeader=true&q=*%3A*&rows=7000&sort=area_id%20asc`;

  client.search(strQuery, function (err, result) {
    if (err) {
      // console.log(err);
      return;
    }
    // console.log('Response:', result.response);
    res.send({ result: result.response });
  });
});

// *********************** URL_4b_u ********************************* //
router.get('/url_4b_u', (req, res, next) => {
  // console.log('Inside URL4b');
  try {
    const parentArea = req.query.parentArea;
    const indicator = req.query.indicator;
    const timeperiod = req.query.timeperiod;

    if (!process.env.indicatorId.includes(indicator)) {
      return res.status(404).send({ message: 'Invalid indicator id' });
    }
    const cQuery = `fl=area_id%2Carea_code%2Carea_name%2Carea_level%2Cdata_value%2Cdata_value_num&fq=area_parent_id%3A${parentArea}&fq=indicator_id%3A${indicator}&fq=subgroup_id%3A6&fq=timeperiod_id%3A${timeperiod}&rows=1000&omitHeader=true&q=*%3A*`;

    client.search(cQuery, function (err, result) {
      // console.log('Query', cQuery);
      if (err) {
        // console.log(err);
        res.send({ message: 'unable to process' });
      }
      // console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  } catch (err) {
    next(err);
  }
});

// *********************** URL_4c_u ********************************* //
router.get('/url_4c_u', (req, res, next) => {
  // console.log('Inside URL4c');
  try {
    const area = req.query.area;
    const indicator = req.query.indicator;
    const timeperiod = req.query.timeperiod;

    if (!process.env.indicatorId.includes(indicator)) {
      return res.status(404).send({ message: 'Invalid indicator id' });
    }

    const cQuery = `fl=area_id%2Carea_code%2Carea_name%2Carea_level%2Cdata_value%2Cdata_value_num&fq=area_parent_id%3A${area}&fq=indicator_id%3A${indicator}&fq=subgroup_id%3A6&fq=timeperiod_id%3A${timeperiod}&rows=1000&omitHeader=true&q=*%3A*`;

    client.search(cQuery, function (err, result) {
      // console.log('Query', cQuery);
      if (err) {
        // console.log(err);
        res.send({ message: 'unable to process' });
      }
      // console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  } catch (err) {
    next(err);
  }
});

// *********************** URL_5u ********************************* //
router.get('/url_5u', (req, res, next) => {
  // console.log('Inside URL5');
  try {
    const indicator = req.query.indicator;
    const timeperiod = req.query.timeperiod;

    if (!process.env.indicatorId.includes(indicator)) {
      return res.status(404).send({ message: 'Invalid indicator id' });
    }

    const cQuery = `fl=indicator_id%2Cindicator_name%2Ctimeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Carea_id%2Carea_code%2Carea_name%2Carea_level&fq=area_level%3A3&fq=indicator_id%3A${indicator}&fq=subgroup_id%3A6&fq=timeperiod_id%3A${timeperiod}&q=*%3A*&rows=10000&omitHeader=true`;

    client.search(cQuery, function (err, result) {
      // console.log('Query', cQuery);
      if (err) {
        // console.log(err);
        res.send({ message: 'unable to process' });
      }
      // console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  } catch (err) {
    next(err);
  }
});

// *********************** URL_6u ********************************* //
router.get('/url_6u', (req, res, next) => {
  // console.log("INSIDE URL 6")
  try {
    const selCategory = req.query.selCategory;
    const selLifecycle = req.query.selLifecycle;

    if (
      !process.env.categoryId.includes(selCategory) ||
      !process.env.lifecycleId.includes(selLifecycle)
    ) {
      return res
        .status(404)
        .send({ message: 'Invalid category id or lifecycle id' });
    }

    const myQuery = `fl=value:indicator_id%2Ctitle:indicator_short_name%2Cindi_sense%2Cindicator_name%2Cnotes%2Cunit_id%2Cunit_name&fq=category_id%3A${selCategory}&fq=lifecycle_id%3A${selLifecycle}%20OR%20lifecycle_id%3A7&q=*%3A*&rows=100&sort=indicator_order%20asc&group=true&group.field=indicator_id&group.limit=1&group.main=true&omitHeader=true`;

    client.search(myQuery, function (err, result) {
      // console.log('Query', myQuery);
      if (err) {
        // console.log(err);
        res.send({ message: 'unable to process' });
      }
      // console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  } catch (err) {
    next(err);
  }
});

// *********************** URL_8u ********************************* //
router.get('/url_8u', (req, res, next) => {
  try {
    // console.log('Inside URL8');
    const indiVal = req.query.indiVal;

    if (!process.env.indicatorId.includes(indiVal)) {
      return res.status(404).send({ message: 'Invalid indicator id' });
    }
    const cQuery = `fl=unit_id%2Cunit_name%2Cindicator_id&fq=indicator_id%3A${indiVal}&fq=subgroup_id%3A6&group.field=unit_id&group.main=true&group=true&omitHeader=true&q=*%3A*`;

    client.search(cQuery, function (err, result) {
      // console.log('Query', cQuery);
      if (err) {
        // console.log(err);
        res.send({ message: 'unable to process' });
      }
      // console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  } catch (err) {
    next(err);
  }
});

// *********************** URL_9u ********************************* //
router.get('/url_9u', (req, res, next) => {
  // console.log('Inside URL9 ');
  try {
    const selLifecycle = req.query.selLifecycle;
    const selCategory = req.query.selCategory;
    const indiVal = req.query.indiVal;
    const selArea = req.query.selArea;

    if (
      !process.env.categoryId.includes(selCategory) ||
      !process.env.lifecycleId.includes(selLifecycle) ||
      !process.env.indicatorId.includes(indiVal)
    ) {
      return res.status(404).send({
        message: 'Invalid category id or lifecycle id or indicator id',
      });
    }

    const cQuery = `fl=title:timeperiod%2Cvalue:timeperiod_id&sort=timeperiod_id%20desc&fq=lifecycle_id%3A${selLifecycle}%20OR%20lifecycle_id%3A7&fq=category_id%3A${selCategory}&fq=indicator_id%3A${indiVal}&fq=subgroup_id%3A6&fq=area_id%3A${selArea}&q=*%3A*&group=true&group.field=timeperiod_id&group.limit=1&group.main=true&omitHeader=true`;

    client.search(cQuery, function (err, result) {
      // console.log('Query', cQuery);
      if (err) {
        // console.log(err);
        res.send({ message: 'unable to process' });
      }
      // console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  } catch (err) {
    next(err);
  }
});

// *********************** Nutrition India Factsheet Generator API's ********************************* //
const indicatorIDs = {
  'Stunting': 12,
  'Wasting': 19,
  'Underweight': 17,
  'Anemia among PW': 239,
  'MMR': 509,
  'NMR': 366,
  'IMR': 53,
  'U5MR': 62,
  'Pregnant Women consuming IFA': 70,
  'Exclusive Breastfeeding': 11,
  'Initiation of B.F in 1 hr.': 31,
  'Minimum Diet Diversity': 6,
  'Adolescent Pregnancy': 4,
  '4+ ANC': 77,
  'Institutional Deliveries': 75,
  'Full Immunization': 23,
  'Children with Fever': 510,
  'Children with ARI/Pneumonia': 14,
  'Children with Diarrhea': 15,
  '10 Yrs.+ Women Education': 84,
  'Hand Wash': 417,
  'Improved Water': 51,
  'Improved Toilet': 42,
  'Clean Fuel': 361,
  'Low Birth Weight (<2.5 Kg)': 29,
  'Anemia (6-59 Months)': 26,
  'Anemia among adolescent girls 15-19 years': 1,
  'Low BMI in adolescent girls 15-19 years': 2,
  'Anemia among women 15-49 years': 71,
  'Low BMI in women 15-49 years': 72,
  'Pregnant Women receiving Supplementary Food': 57,
  'Lactating Mothers receiving Supplementary Food': 513,
  'Postnatal Care': 514,
  'Introducing Complementary Foods': 28,
  'Minimum Acceptable Diet (MAD)': 5,
  'Minimum Meal Frequency': 7,
  'Contraceptive Prevalence Rate (Family Planning)': 309,
  'Child Faeces Disposal': 34,
  'ANC (1st Trimester)': 76,
  'Pregnant women visited at least once by ANM': 79,
  'Pregnant women visited at least once by ASHA': 80,
  'Vitamin A Supplementation (VAS)': 25,
  'Treatment received for Fever': 511,
  'Treatment received for ARI/Pneumonia': 32,
  'Treatment received for Diarrhoea': 512,
  'Household Intake of Protein': 48,
  'Expenditure on Food': 47,
  'Expenditure on Cereal': 46,
  'Total Population 2024': 520,
  'Total Population 2011': 56,
  'Child Population (<2 years)': 8,
  'Child Population (<5 years)': 9,
  'Households with access to banking services': 382,
  'Households with no assets': 39,
  'Households living in pucca houses': 40,
  'Households with access to electricity': 37,
  'Married women participated in household decisions': 83,
  'Women 15-49 years of age who have and use bank account': 86
};

const timeperiodIDs = {
  'NFHS5 2019-2020': 24,
  'NFHS4 2015-2016': 20,
  'NFHS3 2005-2006': 6,
  'CNNS 2016-2018': 23,
  'NSSO 1999-2000': 2,
  'NSSO 2004-2005': 5,
  'NSSO 2009-2010': 8,
  'NSSO 2022-2023': 33,
  'CENSUS 2001': 3,
  'CENSUS 2011': 11,
  'SRS 2018-20': 28,
  'SRS 2017-19': 29,
  'SRS 2016-18': 30,
  'SRS 2015-17': 31,
  'SRS 2014-16': 32,
  'SRS 2014': 18,
  'SRS 2016': 21,
  'SRS 2018': 25,
  'SRS 2020': 27
};

const subgroupIDs = {
  'All': 6,
  'Rural': 3,
  'Urban': 7,
  'Male': 15,
  'Female': 14,
  'SC': 4,
  'ST': 5
};
// *********************** Page 1 ********************************* //
router.get('/factsheet-generator/page1', async (req, res, next) => {
  try {
    const area = req.query.area;
    const indicators = req.query.indicators ? JSON.parse(req.query.indicators) : null;
    let response = await Promise.all(indicators.map(async (indicator) => {
      let findValue, value;
      const cQuery = `fl=timeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name%2Csubgroup_order%2Csubgroup_category%2Cstart_date%2Cend_date&fq=area_id%3A${area}&fq=indicator_id%3A${indicator}&omitHeader=true&q=*%3A*&rows=404&sort=timeperiod_id%20asc`;
      const result = await client.search(cQuery);

      if ([indicatorIDs['MMR'], indicatorIDs['NMR'], indicatorIDs['IMR'], indicatorIDs['U5MR'],].includes(indicator)) {
        if (indicator === indicatorIDs['MMR']) findValue = result.response.docs.find(data => data.subgroup_id === subgroupIDs.All && data.timeperiod_id === timeperiodIDs["SRS 2018-20"]);
        else findValue = result.response.docs.find(data => data.subgroup_id === subgroupIDs.All && data.timeperiod_id === timeperiodIDs["SRS 2020"]);
      } else {
        findValue = result.response.docs.find(data => data.subgroup_id === subgroupIDs.All && data.timeperiod_id === timeperiodIDs["NFHS5 2019-2020"]);
      }

      if (findValue) value = findValue.data_value;
      return value ? value : 'N/A';

    }));

    res.send({ result: response });

  } catch (err) {
    next(err);
  }
});

// *********************** Page 2 ********************************* //
router.get('/factsheet-generator/page2', async (req, res, next) => {
  const page2Values = {
    LowBirthWeight: {
      LineChart: [],
      LineChartData: true,
      BarChart1: [],
      BarChart1Data: true,
      BarChart2: [],
      BarChart2Data: true
    },
    Anemia: {
      LineChart: [],
      LineChartData: true,
      BarChart1: [],
      BarChart1Data: true,
      BarChart2: [],
      BarChart2Data: true
    },
    Stunting: {
      LineChart: [],
      LineChartData: true,
      BarChart1: [],
      BarChart1Data: true,
      BarChart2: [],
      BarChart2Data: true
    },
    MMR: {
      LineChart: [],
      LineChartData: true
    },
    IMR: {
      LineChart: [],
      LineChartData: true,
      BarChart1: [],
      BarChart1Data: true,
      BarChart2: [],
      BarChart2Data: true
    },
    U5MR: {
      LineChart: [],
      LineChartData: true,
      BarChart1: [],
      BarChart1Data: true,
      BarChart2: [],
      BarChart2Data: true
    }
  };

  const timeperiodsRequired = {
    LowBirthWeight: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    Anemia: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    Stunting: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2016-18': timeperiodIDs["CNNS 2016-2018"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    MMR: {
      '2014-16': timeperiodIDs["SRS 2014-16"],
      '2015-17': timeperiodIDs["SRS 2015-17"],
      '2016-18': timeperiodIDs["SRS 2016-18"],
      '2017-19': timeperiodIDs["SRS 2017-19"],
      '2018-20': timeperiodIDs["SRS 2018-20"]
    },
    IMR: {
      '2014': timeperiodIDs["SRS 2014"],
      '2016': timeperiodIDs["SRS 2016"],
      '2018': timeperiodIDs["SRS 2018"],
      '2020': timeperiodIDs["SRS 2020"]
    },
    U5MR: {
      '2014': timeperiodIDs["SRS 2014"],
      '2016': timeperiodIDs["SRS 2016"],
      '2018': timeperiodIDs["SRS 2018"],
      '2020': timeperiodIDs["SRS 2020"]
    }
  };

  const subgroupsRequired = {
    'Value': subgroupIDs.All,
    'Female': subgroupIDs.Female,
    'Male': subgroupIDs.Male,
    'Rural': subgroupIDs.Rural,
    'Urban': subgroupIDs.Urban
  };

  try {
    const area = req.query.area;
    const indicators = req.query.indicators ? JSON.parse(req.query.indicators) : null;

    await Promise.all(Object.keys(indicators).map(async (indicator) => {
      const cQuery = `fl=timeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name%2Csubgroup_order%2Csubgroup_category%2Cstart_date%2Cend_date&fq=area_id%3A${area}&fq=indicator_id%3A${indicators[`${indicator}`]}&omitHeader=true&q=*%3A*&rows=404&sort=timeperiod_id%20asc`;
      const result = await client.search(cQuery);
      let findValue, value, lineChartTotal = '', barChart1Total = '', barChart2Total = '';
      for (const timePeriod in timeperiodsRequired[`${indicator}`]) {
        for (const subgroup in subgroupsRequired) {
          findValue = result.response.docs.find(data => data.subgroup_id === subgroupsRequired[subgroup] && data.timeperiod_id === timeperiodsRequired[`${indicator}`][timePeriod]);
          if (!findValue?.data_value) value = '';
          else value = findValue.data_value;

          if (subgroupsRequired[subgroup] === subgroupIDs.All) {
            page2Values[`${indicator}`].LineChart.push({ date: timePeriod, [subgroup]: value ? value : null });
            lineChartTotal += value;
          } else if (subgroupsRequired[subgroup] === subgroupIDs.Male || subgroupsRequired[subgroup] === subgroupIDs.Female) {
            if (!page2Values[`${indicator}`].BarChart1) continue;
            const index = page2Values[`${indicator}`].BarChart1.findIndex(val => val.year === timePeriod);
            if (index != -1) {
              page2Values[`${indicator}`].BarChart1[index] = { ...page2Values[`${indicator}`].BarChart1[index], [subgroup]: value };
            } else page2Values[`${indicator}`].BarChart1.push({ year: timePeriod, [subgroup]: value });
            barChart1Total += value;
          } else {
            if (!page2Values[`${indicator}`].BarChart2) continue;
            const index = page2Values[`${indicator}`].BarChart2.findIndex(val => val.year === timePeriod);
            if (index != -1) {
              page2Values[`${indicator}`].BarChart2[index] = { ...page2Values[`${indicator}`].BarChart2[index], [subgroup]: value };
            } else page2Values[`${indicator}`].BarChart2.push({ year: timePeriod, [subgroup]: value });
            barChart2Total += value;
          }
        }
      }

      if (page2Values[`${indicator}`].BarChart1) page2Values[`${indicator}`].BarChart1 = page2Values[`${indicator}`].BarChart1.reverse();

      if (isNaN(parseFloat(lineChartTotal))) page2Values[`${indicator}`].LineChartData = false;
      if (isNaN(parseFloat(barChart1Total))) page2Values[`${indicator}`].BarChart1Data = false;
      if (isNaN(parseFloat(barChart2Total))) page2Values[`${indicator}`].BarChart2Data = false;

      lineChartTotal = '', barChart1Total = '', barChart2Total = '';
    }));

    res.send({ result: page2Values });

  } catch (err) {
    next(err);
  }
});

// *********************** Page 3 ********************************* //
router.get('/factsheet-generator/page3', async (req, res, next) => {
  const page3Values = {
    AdolescentGirlsNutrition: [],
    AdolescentGirlsNutritionData: true,
    WomenNutrition: [],
    WomenNutritionData: true,
    PostnatalCare: [],
    PostnatalCareData: true,
    PregnantWomenFood: [],
    PregnantWomenFoodData: true,
    LactatingMothersFood: [],
    LactatingMothersFoodData: true,
    IFCTablets: [],
    IFCTabletsData: true,
    AntenatalCare: [],
    AntenatalCareData: true,
    BreastfedInitiation: [],
    BreastfedInitiationData: true,
    ExclusiveBreastfeeding: [],
    ExclusiveBreastfeedingData: true,
    ComplementaryFoods: [],
    ComplementaryFoodsData: true,
    MinimumAcceptableDiet: [],
    MinimumAcceptableDietData: true,
    MinimumDietDiversity: [],
    MinimumDietDiversityData: true,
    MinimumMealFrequency: [],
    MinimumMealFrequencyData: true,
    ChildFever: [],
    ChildFeverData: true,
    ChildARI: [],
    ChildARIData: true,
    ChildDiarrhea: [],
    ChildDiarrheaData: true
  };

  const timeperiodsRequired = {
    AdolescentGirlsNutrition: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    WomenNutrition: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    PostnatalCare: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    PregnantWomenFood: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    LactatingMothersFood: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    IFCTablets: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    AntenatalCare: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    BreastfedInitiation: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    ExclusiveBreastfeeding: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    ComplementaryFoods: {
      '2019-20': timeperiodIDs["NFHS5 2019-2020"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2005-06': timeperiodIDs["NFHS3 2005-2006"]
    },
    MinimumAcceptableDiet: {
      '2019-20': timeperiodIDs["NFHS5 2019-2020"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2005-06': timeperiodIDs["NFHS3 2005-2006"]
    },
    MinimumDietDiversity: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    MinimumMealFrequency: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    ChildFever: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    ChildARI: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    ChildDiarrhea: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
  };

  const subgroupsRequired = {
    'Value': subgroupIDs.All,
    'Female': subgroupIDs.Female,
    'Male': subgroupIDs.Male,
    'Rural': subgroupIDs.Rural,
    'Urban': subgroupIDs.Urban
  };

  let findValue, value, isDataAvailable = {};
  try {
    const area = req.query.area;
    const indicators = req.query.indicators ? JSON.parse(req.query.indicators) : null;

    await Promise.all(Object.keys(indicators).map(async (indicator) => {
      isDataAvailable[`${indicator}`] = false;
      if (indicator == 'AdolescentGirlsNutrition' || indicator == 'WomenNutrition') {
        for (const extraIndicator in indicators[`${indicator}`]) {
          const cQuery = `fl=timeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name%2Csubgroup_order%2Csubgroup_category%2Cstart_date%2Cend_date&fq=area_id%3A${area}&fq=indicator_id%3A${indicators[`${indicator}`][`${extraIndicator}`]}&omitHeader=true&q=*%3A*&rows=404&sort=timeperiod_id%20asc`;
          const result = await client.search(cQuery);
          for (const timePeriod in timeperiodsRequired[`${indicator}`]) {
            findValue = result.response.docs.find(data => data.subgroup_id === subgroupIDs.All && data.timeperiod_id === timeperiodsRequired[`${indicator}`][timePeriod]);
            if (!findValue?.data_value) value = '';
            else value = findValue.data_value;
            if (!isNaN(parseFloat(value))) isDataAvailable[`${indicator}`] = true;

            const index = page3Values[`${indicator}`].findIndex(val => val.year === timePeriod);
            if (index != -1) {
              page3Values[`${indicator}`][index] = { ...page3Values[`${indicator}`][index], [`${extraIndicator}`]: value };
            } else page3Values[`${indicator}`].push({ year: timePeriod, [`${extraIndicator}`]: value });
          }
        }

        page3Values[`${indicator}Data`] = isDataAvailable[`${indicator}`];
      } else if (indicator == 'ChildFever' || indicator == 'ChildARI' || indicator == 'ChildDiarrhea') {
        const cQuery = `fl=timeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name%2Csubgroup_order%2Csubgroup_category%2Cstart_date%2Cend_date&fq=area_id%3A${area}&fq=indicator_id%3A${indicators[`${indicator}`]}&omitHeader=true&q=*%3A*&rows=404&sort=timeperiod_id%20asc`;
        const result = await client.search(cQuery);
        for (const timePeriod in timeperiodsRequired[`${indicator}`]) {
          for (const subgroup in subgroupsRequired) {
            findValue = result.response.docs.find(data => data.subgroup_id === subgroupsRequired[subgroup] && data.timeperiod_id === timeperiodsRequired[`${indicator}`][timePeriod]);
            if (!findValue?.data_value) value = '';
            else value = findValue.data_value;
            if (!isNaN(parseFloat(value))) isDataAvailable[`${indicator}`] = true;

            if (subgroupsRequired[subgroup] === subgroupIDs.All) {
              page3Values[`${indicator}`].push({ year: timePeriod, 'Total': value });
            } else if (subgroupsRequired[subgroup] === subgroupIDs.Rural || subgroupsRequired[subgroup] === subgroupIDs.Urban) {
              const index = page3Values[`${indicator}`].findIndex(val => val.year === timePeriod);
              if (index != -1) {
                page3Values[`${indicator}`][index] = { ...page3Values[`${indicator}`][index], [subgroup]: value };
              } else page3Values[`${indicator}`].push({ year: timePeriod, [subgroup]: value });
            } else continue;
          }
        }

        page3Values[`${indicator}Data`] = isDataAvailable[`${indicator}`];
      } else {
        const cQuery = `fl=timeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name%2Csubgroup_order%2Csubgroup_category%2Cstart_date%2Cend_date&fq=area_id%3A${area}&fq=indicator_id%3A${indicators[`${indicator}`]}&omitHeader=true&q=*%3A*&rows=404&sort=timeperiod_id%20asc`;
        const result = await client.search(cQuery);

        for (const timePeriod in timeperiodsRequired[`${indicator}`]) {
          findValue = result.response.docs.find(data => data.subgroup_id === subgroupIDs.All && data.timeperiod_id === timeperiodsRequired[`${indicator}`][timePeriod]);
          if (!findValue?.data_value) value = '';
          else value = findValue.data_value;
          if (!isNaN(parseFloat(value))) isDataAvailable[`${indicator}`] = true;

          const index = page3Values[`${indicator}`].findIndex(val => val.year === timePeriod);
          if (index != -1) {
            page3Values[`${indicator}`][index] = { ...page3Values[`${indicator}`][index], 'Value': value ? value : null };
          } else page3Values[`${indicator}`].push({ year: timePeriod, 'Value': value ? value : null });
        }

        page3Values[`${indicator}Data`] = isDataAvailable[`${indicator}`];
      }
    }));

    res.send({ result: page3Values });

  } catch (err) {
    next(err);
  }
});

// *********************** Page 4 ********************************* //
router.get('/factsheet-generator/page4', async (req, res, next) => {
  const page4Values = {
    ContraceptivePrevalence: [],
    ContraceptivePrevalenceData: true,
    AdolescentPregnancies: 0,
    ChildStool: [],
    ChildStoolData: true,
    AntenatalFirstTrimester: [],
    AntenatalFirstTrimesterData: true,
    AntenatalCheckups4: [],
    AntenatalCheckups4Data: true,
    WomenLiveBirth: [],
    WomenLiveBirthData: true,
    InstitutionalDelivery: [],
    InstitutionalDeliveryData: true,
    Immunization: [],
    ImmunizationData: true,
    ChildTreatment: [],
    ChildTreatmentData: true,
    WaterAndSanitation: [],
    WaterAndSanitationData: true,
    HouseholdProteinIntake: [],
    HouseholdProteinIntakeData: true,
    ExpenditureOnFood: [],
    ExpenditureOnFoodData: true,
    ExpenditureOnCereal: [],
    ExpenditureOnCerealData: true
  };

  const timeperiodsRequired = {
    ContraceptivePrevalence: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    ChildStool: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    AntenatalFirstTrimester: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    AntenatalCheckups4: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    WomenLiveBirth: {
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    InstitutionalDelivery: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    Immunization: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    ChildTreatment: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    WaterAndSanitation: {
      '2005-06': timeperiodIDs["NFHS3 2005-2006"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    HouseholdProteinIntake: {
      '2004-05': timeperiodIDs["NSSO 2004-2005"],
      '2009-10': timeperiodIDs["NSSO 2009-2010"],
      '2022-23': timeperiodIDs["NSSO 2022-2023"]
    },
    ExpenditureOnFood: {
      '2004-05': timeperiodIDs["NSSO 2004-2005"],
      '2022-23': timeperiodIDs["NSSO 2022-2023"]
    },
    ExpenditureOnCereal: {
      '2022-23': timeperiodIDs["NSSO 2022-2023"]
    },
  };

  const subgroupsRequired = {
    'Value': subgroupIDs.All,
    'Female': subgroupIDs.Female,
    'Male': subgroupIDs.Male,
    'Rural': subgroupIDs.Rural,
    'Urban': subgroupIDs.Urban
  };

  let findValue, value, chartTotal = '';

  try {
    const area = req.query.area;
    const indicators = req.query.indicators ? JSON.parse(req.query.indicators) : null;

    await Promise.all(Object.keys(indicators).map(async (indicator) => {
      if (indicator == 'WomenLiveBirth' || indicator == 'Immunization' || indicator == 'ChildTreatment' || indicator == 'WaterAndSanitation') {
        for (const extraIndicator in indicators[`${indicator}`]) {
          const cQuery = `fl=timeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name%2Csubgroup_order%2Csubgroup_category%2Cstart_date%2Cend_date&fq=area_id%3A${area}&fq=indicator_id%3A${indicators[`${indicator}`][`${extraIndicator}`]}&omitHeader=true&q=*%3A*&rows=404&sort=timeperiod_id%20asc`;
          const result = await client.search(cQuery);
          for (const timePeriod in timeperiodsRequired[`${indicator}`]) {
            findValue = result.response.docs.find(data => data.subgroup_id === subgroupIDs.All && data.timeperiod_id === timeperiodsRequired[`${indicator}`][timePeriod]);
            if (!findValue?.data_value) value = '';
            else value = findValue.data_value;
            chartTotal += value;

            const index = page4Values[`${indicator}`].findIndex(val => val.year === timePeriod);
            if (index != -1) {
              page4Values[`${indicator}`][index] = { ...page4Values[`${indicator}`][index], [`${extraIndicator}`]: value };
            } else page4Values[`${indicator}`].push({ year: timePeriod, [`${extraIndicator}`]: value });
          }
        }
        if (isNaN(parseFloat(chartTotal))) page4Values[`${indicator}Data`] = false;
        chartTotal = '';
      } else if (indicator == 'AdolescentPregnancies') {
        const cQuery = `fl=timeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name%2Csubgroup_order%2Csubgroup_category%2Cstart_date%2Cend_date&fq=area_id%3A${area}&fq=indicator_id%3A${indicators[`${indicator}`]}&omitHeader=true&q=*%3A*&rows=404&sort=timeperiod_id%20asc`;
        const result = await client.search(cQuery);
        findValue = result.response.docs.find(data => data.subgroup_id === subgroupIDs.All && data.timeperiod_id === timeperiodIDs["NFHS5 2019-2020"]);
        if (!findValue?.data_value) value = '';
        else value = findValue.data_value;
        chartTotal += value;
        page4Values[`${indicator}`] = value;

      } else if (indicator == 'HouseholdProteinIntake' || indicator == 'ExpenditureOnFood' || indicator == 'ExpenditureOnCereal') {
        const cQuery = `fl=timeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name%2Csubgroup_order%2Csubgroup_category%2Cstart_date%2Cend_date&fq=area_id%3A${area}&fq=indicator_id%3A${indicators[`${indicator}`]}&omitHeader=true&q=*%3A*&rows=404&sort=timeperiod_id%20asc`;
        const result = await client.search(cQuery);

        for (const timePeriod in timeperiodsRequired[`${indicator}`]) {
          for (const subgroup in subgroupsRequired) {
            findValue = result.response.docs.find(data => data.subgroup_id === subgroupsRequired[subgroup] && data.timeperiod_id === timeperiodsRequired[`${indicator}`][timePeriod]);
            if (!findValue?.data_value) value = '';
            else value = findValue.data_value;
            chartTotal += value;

            if (subgroupsRequired[subgroup] === subgroupIDs.Rural || subgroupsRequired[subgroup] === subgroupIDs.Urban) {
              const index = page4Values[`${indicator}`].findIndex(val => val.year === timePeriod);
              if (index != -1) {
                page4Values[`${indicator}`][index] = { ...page4Values[`${indicator}`][index], [subgroup]: value };
              } else page4Values[`${indicator}`].push({ year: timePeriod, [subgroup]: value });
            } else continue;
          }
        }

        if (isNaN(parseFloat(chartTotal))) page4Values[`${indicator}Data`] = false;
        chartTotal = '';
      } else {
        const cQuery = `fl=timeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name%2Csubgroup_order%2Csubgroup_category%2Cstart_date%2Cend_date&fq=area_id%3A${area}&fq=indicator_id%3A${indicators[`${indicator}`]}&omitHeader=true&q=*%3A*&rows=404&sort=timeperiod_id%20asc`;
        const result = await client.search(cQuery);

        for (const timePeriod in timeperiodsRequired[`${indicator}`]) {
          findValue = result.response.docs.find(data => data.subgroup_id === subgroupIDs.All && data.timeperiod_id === timeperiodsRequired[`${indicator}`][timePeriod]);
          if (!findValue?.data_value) value = '';
          else value = findValue.data_value;
          chartTotal += value;

          const index = page4Values[`${indicator}`].findIndex(val => val.year === timePeriod);
          if (index != -1) {
            page4Values[`${indicator}`][index] = { ...page4Values[`${indicator}`][index], 'Value': value };
          } else page4Values[`${indicator}`].push({ year: timePeriod, 'Value': value });

        }

        if (isNaN(parseFloat(chartTotal))) page4Values[`${indicator}Data`] = false;
        chartTotal = '';
      }

      const dataToReverse = ['ContraceptivePrevalence', 'ChildStool', 'HouseholdProteinIntake'];
      dataToReverse.forEach((data) => page4Values[`${data}`] = page4Values[`${data}`].reverse());

    }));

    res.send({ result: page4Values });

  } catch (err) {
    next(err);
  }
});

// *********************** Page 5 ********************************* //
router.get('/factsheet-generator/page5', async (req, res, next) => {
  const page5Values = {
    PopulationSize: 0,
    PopulationSizeArea: [],
    PopulationSizeAreaData: true,
    PopulationSizeAreaPercent: [],
    PopulationSizeAreaPercentData: true,
    PopulationSizeGender: [],
    PopulationSizeGenderData: true,
    PopulationSizeCaste: [],
    PopulationSizeCasteData: true,
    ChildPopulation2Yrs: [],
    ChildPopulation2YrsData: true,
    ChildPopulation5Yrs: [],
    ChildPopulation5YrsData: true,
    HouseholdBankingServices: [],
    HouseholdBankingServicesData: true,
    HouseholdElectricity: [],
    HouseholdElectricityData: true,
    HouseholdAssets: [],
    HouseholdAssetsData: true,
    HouseholdPuccaHouse: [],
    HouseholdPuccaHouseData: true,
    YearsOfSchooling: 0,
    HouseholdMarriedWomen: [],
    HouseholdMarriedWomenData: true,
    WomenWithBankAccount: [],
    WomenWithBankAccountData: true
  };

  const timeperiodsRequired = {
    HouseholdBankingServices: {
      '2011': timeperiodIDs["CENSUS 2011"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    HouseholdElectricity: {
      '2011': timeperiodIDs["CENSUS 2011"],
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    HouseholdAssets: {
      '2001': timeperiodIDs["CENSUS 2001"],
      '2011': timeperiodIDs["CENSUS 2011"],
    },
    HouseholdPuccaHouse: {
      '2011': timeperiodIDs["CENSUS 2011"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    HouseholdMarriedWomen: {
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
    WomenWithBankAccount: {
      '2015-16': timeperiodIDs["NFHS4 2015-2016"],
      '2019-20': timeperiodIDs["NFHS5 2019-2020"]
    },
  };

  const subgroupsRequired = {
    'Value': subgroupIDs.All,
    'Female': subgroupIDs.Female,
    'Male': subgroupIDs.Male,
    'Rural': subgroupIDs.Rural,
    'Urban': subgroupIDs.Urban,
    'Scheduled Caste': subgroupIDs.SC,
    'Scheduled Tribe': subgroupIDs.ST
  };

  let findValue, value, chartTotal = '';

  try {
    const area = req.query.area;
    const indicators = req.query.indicators ? JSON.parse(req.query.indicators) : null;

    await Promise.all(Object.keys(indicators).map(async (indicator) => {
      if (indicator === 'PopulationInformation') {
        const cQuery2024 = `fl=timeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name%2Csubgroup_order%2Csubgroup_category%2Cstart_date%2Cend_date&fq=area_id%3A${area}&fq=indicator_id%3A${indicatorIDs["Total Population 2024"]}&omitHeader=true&q=*%3A*&rows=404&sort=timeperiod_id%20asc`;
        const cQuery2011 = `fl=timeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name%2Csubgroup_order%2Csubgroup_category%2Cstart_date%2Cend_date&fq=area_id%3A${area}&fq=indicator_id%3A${indicatorIDs["Total Population 2011"]}&omitHeader=true&q=*%3A*&rows=404&sort=timeperiod_id%20asc`;
        const result2024 = await client.search(cQuery2024);
        const result2011 = await client.search(cQuery2011);
        let chartTotal = '', chartTotalArea = '', chartTotalGender = '', chartTotalCaste = '';
        let populationSize2024 = {};
        for (const subgroup in subgroupsRequired) {
          let existsPopulationSize2024, valuePopulationSize2024, existsPopulationSize2011, valuePopulationSize2011;
          existsPopulationSize2024 = result2024.response.docs.find(data => data.subgroup_id === subgroupsRequired[subgroup]);
          if (!existsPopulationSize2024?.data_value) valuePopulationSize2024 = '';
          else valuePopulationSize2024 = Math.ceil(existsPopulationSize2024.data_value / 1000);
          chartTotal += valuePopulationSize2024;

          existsPopulationSize2011 = result2011.response.docs.find(data => data.subgroup_id === subgroupsRequired[subgroup]);
          if (!existsPopulationSize2011?.data_value) valuePopulationSize2011 = '';
          else valuePopulationSize2011 = Math.ceil(existsPopulationSize2011.data_value / 1000);
          chartTotal += valuePopulationSize2011;

          if (subgroupsRequired[subgroup] === subgroupIDs.All) {
            if (valuePopulationSize2024) page5Values.PopulationSize = new Intl.NumberFormat('en-IN').format(valuePopulationSize2024);
            else page5Values.PopulationSize = valuePopulationSize2024;
          } else if (subgroupsRequired[subgroup] === subgroupIDs.Rural || subgroupsRequired[subgroup] === subgroupIDs.Urban) {
            populationSize2024[`${subgroup}`] = valuePopulationSize2024;
            const index = page5Values.PopulationSizeArea.findIndex(val => val.category === subgroup);
            chartTotalArea += valuePopulationSize2024;
            chartTotalArea += valuePopulationSize2011;
            if (index != -1) {
              page5Values.PopulationSizeArea[index] = { ...page5Values.PopulationSizeArea[index], '2024 (Projected)': valuePopulationSize2024, '2011': valuePopulationSize2011 };
            } else page5Values.PopulationSizeArea.push({ category: subgroup, '2024 (Projected)': valuePopulationSize2024, '2011': valuePopulationSize2011 });
          } else if (subgroupsRequired[subgroup] === subgroupIDs.Female || subgroupsRequired[subgroup] === subgroupIDs.Male) {
            const index = page5Values.PopulationSizeGender.findIndex(val => val.category === subgroup);
            chartTotalGender += valuePopulationSize2024;
            chartTotalGender += valuePopulationSize2011;
            if (index != -1) {
              page5Values.PopulationSizeGender[index] = { ...page5Values.PopulationSizeGender[index], '2024 (Projected)': valuePopulationSize2024, '2011': valuePopulationSize2011 };
            } else page5Values.PopulationSizeGender.push({ category: subgroup, '2024 (Projected)': valuePopulationSize2024, '2011': valuePopulationSize2011 });
          } else {
            const index = page5Values.PopulationSizeCaste.findIndex(val => val.category === subgroup);
            chartTotalCaste += valuePopulationSize2024;
            chartTotalCaste += valuePopulationSize2011;
            if (index != -1) {
              page5Values.PopulationSizeCaste[index] = { ...page5Values.PopulationSizeCaste[index], '2011': valuePopulationSize2011 };
            } else page5Values.PopulationSizeCaste.push({ category: subgroup, '2011': valuePopulationSize2011 });
          }
        }

        page5Values.PopulationSizeArea = page5Values.PopulationSizeArea.reverse();

        let populationSize2024Total = 0;
        Object.keys(populationSize2024).forEach((val) => populationSize2024Total += populationSize2024[val]);
        populationSize2024.Total = populationSize2024Total;

        let urbanPopulationSizePercent = Math.ceil(populationSize2024.Urban / populationSize2024.Total * 100);
        let ruralPopulationSizePercent = Math.ceil(populationSize2024.Rural / populationSize2024.Total * 100);

        page5Values.PopulationSizeAreaPercent.push({ name: 'Urban', value: urbanPopulationSizePercent, color: 'rgb(0, 111, 192, 1)' });
        page5Values.PopulationSizeAreaPercent.push({ name: 'Rural', value: ruralPopulationSizePercent, color: 'rgb(0, 175, 239, 1)' });

        if (isNaN(parseFloat(chartTotalArea))) page5Values.PopulationSizeAreaData = false;
        if (isNaN(parseFloat(chartTotalGender))) page5Values.PopulationSizeGenderData = false;
        if (isNaN(parseFloat(chartTotalCaste))) page5Values.PopulationSizeCasteData = false;

        if (isNaN(parseFloat(chartTotal))) page5Values.PopulationSizeAreaPercentData = false;

        chartTotal, chartTotalArea, chartTotalGender, chartTotalCaste = '';
      } else if (indicator === 'ChildPopulation2Yrs' || indicator === 'ChildPopulation5Yrs') {
        const cQuery = `fl=timeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name%2Csubgroup_order%2Csubgroup_category%2Cstart_date%2Cend_date&fq=area_id%3A${area}&fq=indicator_id%3A${indicators[`${indicator}`]}&omitHeader=true&q=*%3A*&rows=404&sort=timeperiod_id%20asc`;
        const result = await client.search(cQuery);

        for (const subgroup in subgroupsRequired) {
          findValue = result.response.docs.find(data => data.subgroup_id === subgroupsRequired[subgroup] && data.timeperiod_id === timeperiodIDs["CENSUS 2011"]);

          if (!findValue?.data_value) value = '';
          else value = Math.ceil(findValue.data_value / 1000);
          chartTotal += value;

          if (subgroupsRequired[subgroup] === subgroupIDs.All) {
            page5Values[`${indicator}`].push({ category: 'Total', 'Value': value });
          } else if (subgroupsRequired[subgroup] === subgroupIDs.SC || subgroupsRequired[subgroup] === subgroupIDs.ST) continue;
          else {
            page5Values[`${indicator}`].push({ category: subgroup, 'Value': value });
          }
        }

        if (isNaN(parseFloat(chartTotal))) page5Values[`${indicator}Data`] = false;
        chartTotal = '';
      } else if (indicator === 'YearsOfSchooling') {
        const cQuery = `fl=timeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name%2Csubgroup_order%2Csubgroup_category%2Cstart_date%2Cend_date&fq=area_id%3A${area}&fq=indicator_id%3A${indicators[`${indicator}`]}&omitHeader=true&q=*%3A*&rows=404&sort=timeperiod_id%20asc`;
        const result = await client.search(cQuery);
        findValue = result.response.docs.find(data => data.subgroup_id === subgroupIDs.All && data.timeperiod_id === timeperiodIDs["NFHS5 2019-2020"]);
        if (!findValue?.data_value) value = '';
        else value = findValue.data_value;
        page5Values.YearsOfSchooling = value;
      } else {
        const cQuery = `fl=timeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name%2Csubgroup_order%2Csubgroup_category%2Cstart_date%2Cend_date&fq=area_id%3A${area}&fq=indicator_id%3A${indicators[`${indicator}`]}&omitHeader=true&q=*%3A*&rows=404&sort=timeperiod_id%20asc`;
        const result = await client.search(cQuery);
        for (const timePeriod in timeperiodsRequired[`${indicator}`]) {
          for (const subgroup in subgroupsRequired) {
            findValue = result.response.docs.find(data => data.subgroup_id === subgroupsRequired[subgroup] && data.timeperiod_id === timeperiodsRequired[`${indicator}`][timePeriod]);
            if (!findValue?.data_value) value = '';
            else value = findValue.data_value;
            chartTotal += value;

            if (subgroupsRequired[subgroup] === subgroupIDs.All) {
              const index = page5Values[`${indicator}`].findIndex(val => val.category === 'Total');
              if (index != -1) {
                page5Values[`${indicator}`][index] = { ...page5Values[`${indicator}`][index], [timePeriod]: value };
              } else page5Values[`${indicator}`].push({ category: 'Total', [timePeriod]: value });
            } else if (subgroupsRequired[subgroup] === subgroupIDs.Rural || subgroupsRequired[subgroup] === subgroupIDs.Urban) {
              const index = page5Values[`${indicator}`].findIndex(val => val.category === subgroup);
              if (index != -1) {
                page5Values[`${indicator}`][index] = { ...page5Values[`${indicator}`][index], [timePeriod]: value };
              } else page5Values[`${indicator}`].push({ category: subgroup, [timePeriod]: value });
            } else continue;
          }
        }

        if (isNaN(parseFloat(chartTotal))) page5Values[`${indicator}Data`] = false;
        chartTotal = '';
      }
    }));

    res.send({ result: page5Values });

  } catch (err) {
    next(err);
  }
});

module.exports = router;;;;
