const sqlite3 = require('better-sqlite3');
const path = require('path');
const DB = require(path.join(__dirname, 'database.js'));
const fs = require('fs');

function getMockResoponse(req, res, next) {

  function serveResponse(id) {
    const row = DB.getById(id);
    return serveRow(row);
  }

  function serveFile(row) {
    // file://yyyy.xxxx.js
    const filePath = path.join(path.dirname(DB.__sqlite3Path), row.res_body.replace('file://', ''));
    const contents = fs.readFileSync(filePath, 'utf8');

    res.setHeader('Content-Type', row.res_content_type);
    res.write(contents);
    res.end();
  }

  function enableCORS() {
    origin = req.headers['origin'];
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
      res.setHeader('Access-Control-Allow-Credentials', true);
    }
  }

  function serveRow(row) {
    console.log('[mock-responses] handling request', req.method, row.req_url);
    row.res_delay_sec && console.log('[mock-responses] Delaying ', row.res_delay_sec, 'seconds');
    setTimeout(_ => {
      res.setHeader('Content-Type', row.res_content_type);
      enableCORS();

      if (req.method.toLowerCase() !== 'options') {
        res.statusCode = row.res_status;
      }

      res.write(row.res_body);
      res.end();
    }, (row.res_delay_sec || 0) * 1000);
    return row;
  }

  function checkPayload(row) {
    if (row.req_payload)  {
      console.log('[mock-responses] payload checking', row.req_payload, req.body);
      const payloads = row.req_payload.split(',');
      for (var i=0; i < payloads.length; i++) {
        var el = payloads[i].trim();
        if (el && typeof req.body[el] === 'undefined')  return 422;
      }
    }
    return 200;
  }

  const row = DB.getByRequest(req);

  if (row && req.method.toLowerCase() === 'options') {
    console.log('[mock-responses] handling request', req.method, row.req_url);
    enableCORS();
    res.statusCode = 200;
    res.end();
  } else if (row) {
    // payload check
    const payloadStatus = checkPayload(row);
    if (payloadStatus !== 200) {
      res.statusCode = payloadStatus;
      res.end();
    }

    if (payloadStatus === 200) {
      if (row.res_body.match(/^file:\/\//)) {
        serveFile(row);
      } else if (row.res_content_type === 'text/javascript') {
        const func = new Function('serveResponse', 
          `return ${row.res_body.replace(/\\x27/g, '\'')}`);
        const result = func(serveResponse)(req, res, next);
        result || serveRow(row); //serveResponse is not defined
      } else if (row) {
        serveRow(row);
      }
    }
  } else {
    next();
  }

};

module.exports = getMockResoponse;
