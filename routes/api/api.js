const express = require("express");
const SolrNode = require('solr-node');
const app = express()
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
    console.log('Inside URL1');
    const area_id = req.body.area_id;
    const indicator_id = req.body.indicator_id;
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
      console.log('Query', strQuery);
      if (err) {
        console.log(err);
        res.send({ message: 'unable to process' });
      }
      console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  });
  
  // *********************** URL_1 ********************************* //
  
  router.get('/url_1', (req, res) => {
    console.log('Inside URL1');
    const area = req.body.area;
    const indicator = req.body.indicator;
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
      console.log('Query', cQuery);
      if (err) {
        console.log(err);
        res.send({ message: 'unable to process' });
      }
      console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  });
  
  // *********************** URL_2 ********************************* //
  router.get('/url_2', (req, res) => {
    console.log('Inside URL2');
    const area = req.body.area;
    const indicator = req.body.indicator;
    const timeperiod = req.body.timeperiod;
  
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
      console.log('Query', cQuery);
      if (err) {
        console.log(err);
        res.send({ message: 'unable to process' });
      }
      console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  });
  
  // *********************** URL_3 ********************************* //
  router.get('/url_3', (req, res) => {
    console.log('Inside URL3');
    const indicator = req.body.indicator;
    const timeperiod = req.body.timeperiod;
    // const subgroup_id = req.body.subgroup_id
  
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
      console.log('Query', cQuery);
      if (err) {
        console.log(err);
        res.send({ message: 'unable to process' });
      }
      console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  });
  
  // *********************** URL_4a ********************************* //
  router.get('/url_4a', (req, res) => {
    console.log('Inside URL4a');
    const parentArea = req.body.parentArea;
    const indicator = req.body.indicator;
    const timeperiod = req.body.timeperiod;
    //   const subgroup_id = req.body.subgroup_id;
  
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
      console.log('Query', cQuery);
      if (err) {
        console.log(err);
        res.send({ message: 'unable to process' });
      }
      console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  });
  
  // *********************** URL_4b ********************************* //
  router.get('/url_4b', (req, res) => {
    console.log('Inside URL4b');
    const area = req.body.area;
    const indicator = req.body.indicator;
    const timeperiod = req.body.timeperiod;
    //   const subgroup_id = req.body.subgroup_id;
  
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
      console.log('Query', cQuery);
      if (err) {
        console.log(err);
        res.send({ message: 'unable to process' });
      }
      console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  });
  
  // *********************** URL_5 ********************************* //
  router.get('/url_5', (req, res) => {
    console.log('Inside URL5');
    const indicator = req.body.indicator_id;
    const timeperiod = req.body.timeperiod_id;
    //   const subgroup_id = req.body.subgroup_id;
  
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
      console.log('Query', cQuery);
      if (err) {
        console.log(err);
        res.send({ message: 'unable to process' });
      }
      console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  });
  
  // *********************** URL_6 ********************************* //
  router.get('/url_6', (req, res) => {
    const category_id = req.body.category_id;
    const lifecycle_id = req.body.lifecycle_id;
  
    const myQuery = `fl=value:indicator_id%2Ctitle:indicator_short_name%2Cindi_sense%2Cindicator_name%2Cnotes&fq=category_id%3A${category_id}&fq=lifecycle_id%3A${lifecycle_id}%20OR%20lifecycle_id%3A7&q=*%3A*&rows=100&sort=indicator_id%20asc&group=true&group.field=indicator_id&group.limit=1&group.main=true&omitHeader=true`;
  
    client.search(myQuery, function (err, result) {
      console.log('Query', myQuery);
      if (err) {
        console.log(err);
        res.send({ message: 'unable to process' });
      }
      console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  });
  
  // *********************** URL_8 ********************************* //
  router.get('/url_8', (req, res) => {
    console.log('Inside URL8');
    const indiVal = req.body.indiVal;
  
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
  
      const cQuery = `fl=unit_id%2Cunit_name%2Cindicator_id&fq=indicator_id%3A${indiVal}&fq=subgroup_id%3A6&group.field=unit_id&group.main=true&group=true&omitHeader=true&q=*%3A*`
  
    client.search(cQuery, function (err, result) {
      console.log('Query', cQuery);
      if (err) {
        console.log(err);
        res.send({ message: 'unable to process' });
      }
      console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  });
  
  // *********************** URL_9 ********************************* //
  router.get('/url_9', (req, res) => {
    console.log('Inside URL9 ');
    const selLifeycle = req.body.selLifeycle;
    const selCategory = req.body.selCategory;
    const indiVal = req.body.indiVal;
    const selArea = req.body.selArea;
  
    const cQuery = `fl=title:timeperiod%2Cvalue:timeperiod_id&sort=timeperiod_id%20desc&fq=lifecycle_id%3A${selLifeycle}%20OR%20lifecycle_id%3A7&fq=category_id%3A${selCategory}&fq=indicator_id%3A${indiVal}&fq=subgroup_id%3A6&fq=area_id%3A${selArea}&q=*%3A*&group=true&group.field=timeperiod_id&group.limit=1&group.main=true&omitHeader=true`;
  
    client.search(cQuery, function (err, result) {
      console.log('Query', cQuery);
      if (err) {
        console.log(err);
        res.send({ message: 'unable to process' });
      }
      console.log('Response:', result.response);
      res.send({ result: result.response });
    });
  });
  

  module.exports = router;