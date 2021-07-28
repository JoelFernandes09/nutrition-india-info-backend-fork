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
  const bytes = CryptoJS.AES.decrypt(token, process.env.KEY);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

  if (decryptedData === process.env.SECRET_DATA) {
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
  } else {
    res.send({ result: 'Invalid credentials!!' });
  }
});

// *********************** URL_1u ********************************* //

router.get('/url_1u', (req, res) => {
  // console.log('Inside URL1');
  const token = req.get('Authorization');
  const bytes = CryptoJS.AES.decrypt(token, process.env.KEY);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

  if (decryptedData === process.env.SECRET_DATA) {
    const area = req.query.area;
    const indicator = req.query.indicator;
    //   const subgroup_id = 6;

    //   const strQuery = client
    //     .query()
    //     .q({
    //       area_id: area_id,
    //       indicator_id: indicator_id,
    //       subgroup_id: subgroup_id,
    //     })
    //     .fl([
    //       'timeperiod_id',
    //       'timeperiod',
    //       'unit_id',
    //       'unit_name',
    //       'data_value',
    //       'data_value_num',
    //       'subgroup_id',
    //       'subgroup_name',
    //       'subgroup_category',
    //       'start_date',
    //       'end_date',
    //     ])
    //     .addParams({
    //       wt: 'json',
    //       indent: true,
    //     })
    //     .sort({ timeperiod_id: 'asc' })
    //     .rows(400);

    const cQuery = `fl=timeperiod_id%2Ctimeperiod%2Cunit_id%2Cunit_name%2Cdata_value%2Cdata_value_num%2Csubgroup_id%2Csubgroup_name%2Csubgroup_category%2Cstart_date%2Cend_date&fq=area_id%3A${area}&fq=indicator_id%3A${indicator}&fq=subgroup_id%3A6&omitHeader=true&q=*%3A*&rows=400&sort=timeperiod_id%20asc`;

    client.search(cQuery, function (err, result) {
      // console.log('Query', cQuery);
      if (err) {
        // console.log(err);
        res.send({ message: 'unable to process' });
      }
      // console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  } else {
    res.send({ result: 'Invalid credentials!!' });
  }
});

// ***********************URL_1d***********************************//
router.get('/url_1d', (req, res) => {
  const token = req.get('Authorization');
  const bytes = CryptoJS.AES.decrypt(token, process.env.KEY);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

  if (decryptedData === process.env.SECRET_DATA) {
    const selCategory = req.query.selCategory;
    const selLifeycle = req.query.selLifeycle;
    const value = req.query.area_id;
    const selIndicator = req.query.selIndicator;

    var strQuery = `fl=title:timeperiod%2Cvalue:timeperiod_id&sort=timeperiod_id%20desc&fq=lifecycle_id%3A${selLifeycle}%20OR%20lifecycle_id%3A7&fq=category_id%3A${selCategory}&fq=indicator_id%3A${selIndicator}&fq=subgroup_id%3A6&fq=area_id%3A${value}&q=*%3A*&group=true&group.field=timeperiod_id&group.limit=1&group.main=true&omitHeader=true`;

    // var strQuery =client.query()
    // .q({
    //     lifecycle_id:selLifeycle,
    //     category_id:selCategory,
    //     indicator_id:selIndicator,
    //     area_id:value
    // })
    // .fl([
    //     'timeperiod',
    //     'timeperiod_id',
    // ])
    // .addParams({
    //     wt: 'json',
    //     indent: true,
    // })
    // .rows(100)
    // .sort({'timeperiod_id':'desc'})
    // .groupQuery({field:'timeperiod_id',main:true,omitHeader:true})

    client.search(strQuery, function (err, result) {
      if (err) {
        console.log(err);
        return;
      }
      console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  } else {
    res.send({ result: 'Invalid credentials!!' });
  }
});

// *********************** URL_2u ********************************* //
router.get('/url_2u', (req, res) => {
  // console.log('Inside URL2');
  const token = req.get('Authorization');
  const bytes = CryptoJS.AES.decrypt(token, process.env.KEY);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

  if (decryptedData === process.env.SECRET_DATA) {
    const area = req.query.area;
    const indicator = req.query.indicator;
    const timeperiod = req.query.timeperiod;

    //   const strQuery = client
    //     .query()
    //     .q({
    //       area_id: area_id,
    //       indicator_id: indicator_id,
    //       timeperiod_id: timeperiod_id,
    //     })
    //     .fl([
    //       'unit_id',
    //       'unit_name',
    //       'data_value',
    //       'data_value_num',
    //       'subgroup_id',
    //       'subgroup_name',
    //       'subgroup_category',
    //       'subgroup_order',
    //       'start_date',
    //       'end_date',
    //     ])
    //     .addParams({
    //       wt: 'json',
    //       indent: true,
    //     })
    //     .sort({ subgroup_order: 'asc' })
    //     .rows(100);

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
  } else {
    res.send({ result: 'Invalid credentials!!' });
  }
});

// ***********************URL_2d**********************************//
router.get('/url_2d', (req, res) => {
  const token = req.get('Authorization');
  const bytes = CryptoJS.AES.decrypt(token, process.env.KEY);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

  if (decryptedData === process.env.SECRET_DATA) {
    const selCategory = req.query.selCategory;
    const selLifeycle = req.query.selLifeycle;
    const val = req.query.indicator_id;
    const selArea = req.query.selArea;

    var strQuery = `fl=title:timeperiod%2Cvalue:timeperiod_id&sort=timeperiod_id%20desc&fq=lifecycle_id%3A${selLifeycle}%20OR%20lifecycle_id%3A7&fq=category_id%3A${selCategory}&fq=indicator_id%3A${val}&fq=subgroup_id%3A6&fq=area_id%3A${selArea}&q=*%3A*&group=true&group.field=timeperiod_id&group.limit=1&group.main=true&omitHeader=true`;

    // var strQuery =client.query()
    // .q({
    //     lifecycle_id:selLifeycle,
    //     category_id:selCategory,
    //     indicator_id:val,
    //     area_id:selArea
    // })
    // .fl([
    //     'timeperiod',
    //     'timeperiod_id',
    // ])
    // .addParams({
    //     wt: 'json',
    //     indent: true,
    // })
    // .rows(100)
    // .sort({'timeperiod_id':'desc'})
    // .groupQuery({field:'timeperiod_id',main:true,omitHeader:true})

    client.search(strQuery, function (err, result) {
      if (err) {
        // console.log(err);
        return;
      }
      // console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  } else {
    res.send({ result: 'Invalid credentials!!' });
  }
});

// *********************** URL_3u ********************************* //
router.get('/url_3u', (req, res) => {
  // console.log('Inside URL3');
  const token = req.get('Authorization');
  const bytes = CryptoJS.AES.decrypt(token, process.env.KEY);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

  if (decryptedData === process.env.SECRET_DATA) {
    const indicator = req.query.indicator;
    const timeperiod = req.query.timeperiod;
    // const subgroup_id = req.query.subgroup_id

    // const strQuery = client
    //   .query()
    //   .q({
    //     area_level: 2,
    //     indicator_id: indicator_id,
    //     timeperiod_id: timeperiod_id,
    //     subgroup_id: subgroup_id,
    //   })
    //   .fl([
    //     'area_id',
    //     'area_code',
    //     'area_name',
    //     'area_level',
    //     'data_value',
    //     'data_value_num'
    //   ])
    //   .addParams({
    //     wt: 'json',
    //     indent: true,
    //   })
    //   .rows(100);

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
  } else {
    res.send({ result: 'Invalid credentials!!' });
  }
});

// **********************URL_3d*************************************//
router.get('/url_3d', (req, res) => {
  const token = req.get('Authorization');
  const bytes = CryptoJS.AES.decrypt(token, process.env.KEY);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

  if (decryptedData === process.env.SECRET_DATA) {
    const val = req.query.val;

    var strQuery = `fl=unit_id%2Cunit_name%2Cindicator_id&fq=indicator_id%3A${val}&fq=subgroup_id%3A6&group.field=unit_id&group.main=true&group=true&omitHeader=true&q=*%3A*`;

    // var strQuery =client.query()
    // .q({indicator_id:indicator_id,subgroup_id:subgroup_id})
    // .fl([
    //     'unit_id',
    //     'unit_name',
    //     'indicator_id',
    // ])
    // .addParams({
    //     wt: 'json',
    //     indent: true,
    // })
    // .rows(100)
    // .groupQuery({field:'unit_id',main:true})

    client.search(strQuery, function (err, result) {
      if (err) {
        // console.log(err);
        return;
      }
      // console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  } else {
    res.send({ result: 'Invalid credentials!!' });
  }
});

// ***********************URL_4d*************************************//
router.get('/url_4d', (req, res) => {
  var strQuery = `fl=area_id%2Carea_parent_id%2Carea_code%2Carea_name%2Carea_level&group.field=area_id&group.main=true&group=true&omitHeader=true&q=*%3A*&rows=7000&sort=area_id%20asc`;

  // var strQuery =client.query()
  // .q('*:*')
  // .fl([
  //     'area_id',
  //     'area_parent_id',
  //     'area_code',
  //     'area_name',
  //     'area_level'
  // ])
  // .addParams({
  //     wt: 'json',
  //     indent: true,
  // })
  // .rows(7000)
  // .sort({'area_id':'asc'})
  // .groupQuery({field:'area_id',main:true})

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
router.get('/url_4b_u', (req, res) => {
  // console.log('Inside URL4b');
  const token = req.get('Authorization');
  const bytes = CryptoJS.AES.decrypt(token, process.env.KEY);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

  if (decryptedData === process.env.SECRET_DATA) {
    const parentArea = req.query.parentArea;
    const indicator = req.query.indicator;
    const timeperiod = req.query.timeperiod;
    //   const subgroup_id = req.query.subgroup_id;

    //   const strQuery = client
    //     .query()
    //     .q({
    //       area_parent_id: area_parent_id,
    //       indicator_id: indicator_id,
    //       timeperiod_id: timeperiod_id,
    //       subgroup_id: subgroup_id,
    //     })
    //     .fl([
    //       'area_id',
    //       'area_code',
    //       'area_name',
    //       'area_level',
    //       'data_value',
    //       'data_value_num',
    //     ])
    //     .addParams({
    //       wt: 'json',
    //       indent: true,
    //     })
    //     .rows(1000);

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
  } else {
    res.send({ result: 'Invalid credentials!!' });
  }
});

// *********************** URL_4c_u ********************************* //
router.get('/url_4c_u', (req, res) => {
  // console.log('Inside URL4c');
  const token = req.get('Authorization');
  const bytes = CryptoJS.AES.decrypt(token, process.env.KEY);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

  if (decryptedData === process.env.SECRET_DATA) {
    const area = req.query.area;
    const indicator = req.query.indicator;
    const timeperiod = req.query.timeperiod;
    //   const subgroup_id = req.query.subgroup_id;

    //   const strQuery = client
    //     .query()
    //     .q({
    //       area_parent_id: area_parent_id,
    //       indicator_id: indicator_id,
    //       timeperiod_id: timeperiod_id,
    //       subgroup_id: subgroup_id,
    //     })
    //     .fl([
    //       'area_id',
    //       'area_code',
    //       'area_name',
    //       'area_level',
    //       'data_value',
    //       'data_value_num',
    //     ])
    //     .addParams({
    //       wt: 'json',
    //       indent: true,
    //     })
    //     .rows(1000);

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
  } else {
    res.send({ result: 'Invalid credentials!!' });
  }
});

// *********************** URL_5u ********************************* //
router.get('/url_5u', (req, res) => {
  // console.log('Inside URL5');
  const token = req.get('Authorization');
  const bytes = CryptoJS.AES.decrypt(token, process.env.KEY);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

  if (decryptedData === process.env.SECRET_DATA) {
    const indicator = req.query.indicator;
    const timeperiod = req.query.timeperiod;
    //   const subgroup_id = req.query.subgroup_id;

    //   const strQuery = client
    //     .query()
    //     .q({
    //       area_level: 3,
    //       indicator_id: indicator_id,
    //       timeperiod_id: timeperiod_id,
    //       subgroup_id: subgroup_id,
    //     })
    //     .fl([
    //       'indicator_id',
    //       'indicator_name',
    //       'timeperiod_id',
    //       'timeperiod',
    //       'unit_id',
    //       'unit_name',
    //       'data_value',
    //       'data_value_num',
    //       'area_id',
    //       'area_code',
    //       'area_name',
    //       'area_level',
    //     ])
    //     .addParams({
    //       wt: 'json',
    //       indent: true,
    //     })
    //     .rows(10000);

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
  } else {
    res.send({ result: 'Invalid credentials!!' });
  }
});

// *********************** URL_6u ********************************* //
router.get('/url_6u', (req, res) => {
  // console.log("INSIDE URL 6")

  const token = req.get('Authorization');
  const bytes = CryptoJS.AES.decrypt(token, process.env.KEY);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

  if (decryptedData === process.env.SECRET_DATA) {
    const selCategory = req.query.selCategory;
    const selLifecycle = req.query.selLifecycle;

    const myQuery = `fl=value:indicator_id%2Ctitle:indicator_short_name%2Cindi_sense%2Cindicator_name%2Cnotes&fq=category_id%3A${selCategory}&fq=lifecycle_id%3A${selLifecycle}%20OR%20lifecycle_id%3A7&q=*%3A*&rows=100&sort=indicator_id%20asc&group=true&group.field=indicator_id&group.limit=1&group.main=true&omitHeader=true`;

    client.search(myQuery, function (err, result) {
      // console.log('Query', myQuery);
      if (err) {
        // console.log(err);
        res.send({ message: 'unable to process' });
      }
      // console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  } else {
    res.send({ result: 'Invalid credentials!!' });
  }
});

// *********************** URL_8u ********************************* //
router.get('/url_8u', (req, res) => {
  const token = req.get('Authorization');
  const bytes = CryptoJS.AES.decrypt(token, process.env.KEY);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

  if (decryptedData === process.env.SECRET_DATA) {
    // console.log('Inside URL8');
    const indiVal = req.query.indiVal;

    //   const strQuery = client
    //     .query()
    //     .q({
    //       indicator_id: indicator_id,
    //       subgroup_id: 6,
    //     })
    //     .fl(['indicator_id', 'unit_id', 'unit_name'])
    //     .groupQuery({ field: 'unit_id', main: true })
    //     .addParams({
    //       wt: 'json',
    //       indent: true,
    //     })
    //     .rows(10000);

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
  } else {
    res.send({ result: 'Invalid credentials!!' });
  }
});

// *********************** URL_9u ********************************* //
router.get('/url_9u', (req, res) => {
  // console.log('Inside URL9 ');
  const token = req.get('Authorization');
  const bytes = CryptoJS.AES.decrypt(token, process.env.KEY);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

  if (decryptedData === process.env.SECRET_DATA) {
    const selLifeycle = req.query.selLifeycle;
    const selCategory = req.query.selCategory;
    const indiVal = req.query.indiVal;
    const selArea = req.query.selArea;

    const cQuery = `fl=title:timeperiod%2Cvalue:timeperiod_id&sort=timeperiod_id%20desc&fq=lifecycle_id%3A${selLifeycle}%20OR%20lifecycle_id%3A7&fq=category_id%3A${selCategory}&fq=indicator_id%3A${indiVal}&fq=subgroup_id%3A6&fq=area_id%3A${selArea}&q=*%3A*&group=true&group.field=timeperiod_id&group.limit=1&group.main=true&omitHeader=true`;

    client.search(cQuery, function (err, result) {
      // console.log('Query', cQuery);
      if (err) {
        // console.log(err);
        res.send({ message: 'unable to process' });
      }
      // console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  } else {
    res.send({ result: 'Invalid credentials!!' });
  }
});

module.exports = router;
