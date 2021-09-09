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
  // console.log('Inside URL1');
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
    .rows(400);

  client.search(strQuery, function (err, result) {
    // console.log('Query', strQuery);
    if (err) {
      // console.log(err);
      res.send({ message: 'unable to process' });
    }
    // console.log('Response:', result.response);
    res.send({ result: result.response });
  });
});

// *********************** URL_1u ********************************* //

router.get('/url_1u', (req, res, next) => {
  // console.log('Inside URL1');
  try {
    const area = req.query.area;
    const indicator = req.query.indicator;

    if (!process.env.indicatorId.includes(indicator)) {
      return res.status(400).send({ message: 'Invalid indicator id' });
    }

    const cQuery = `fl=timeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name%2Csubgroup_order%2Csubgroup_category%2Cstart_date%2Cend_date&fq=area_id%3A${area}&fq=indicator_id%3A${indicator}&omitHeader=true&q=*%3A*&rows=400&sort=timeperiod_id%20asc`;

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
      return res.status(400).send({
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
      return res.status(400).send({ message: 'Invalid indicator id' });
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
      return res.status(400).send({
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
      return res.status(400).send({ message: 'Invalid indicator id' });
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
      return res.status(400).send({ message: 'Invalid indicator id' });
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
      return res.status(400).send({ message: 'Invalid indicator id' });
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
      return res.status(400).send({ message: 'Invalid indicator id' });
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
      return res.status(400).send({ message: 'Invalid indicator id' });
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
        .status(400)
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
      return res.status(400).send({ message: 'Invalid indicator id' });
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
      return res.status(400).send({
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

module.exports = router;
