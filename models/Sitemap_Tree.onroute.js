//(routetype, req, res, callback, require, jsh, modelid, params)

var _ = require('lodash');
var Helper = require('../Helper.js');
var querystring = require('querystring');

var model = jsh.getModelClone(req, modelid);

if (!Helper.hasModelAction(req, model, 'B')) return callback();

if(routetype != 'model') return callback();

jsh.AppSrv.ExecRecordset(req._DBContext, "select sitemap_key from {schema}.v_my_sitemap", [], {  }, function (err, rslt) {
  if(err) callback();
  if(!rslt || !rslt.length || !rslt[0]) return callback();

  //Redirect to listing on invalid key
  if(!rslt[0].length || (rslt[0].length > 1)){
    if(!req.query.sitemap_key) return callback();
    for(var i=0;i<rslt[0].length;i++){
      if((rslt[0][i].sitemap_key||'').toString() == req.query.sitemap_key.toString()) return callback();
    }
    //Not found
    return res.end('***JSHARMONY_REDIRECT***\n'+req.baseurl+model.namespace+'Sitemap_Listing_Redirect');
  }
  else{
    var sitemap_key = rslt[0][0].sitemap_key || '';
    if(req.query.sitemap_key && (req.query.sitemap_key.toString() == rslt[0][0].sitemap_key.toString())) return callback();

    req.query.action = req.query.action || 'update';
    req.query.sitemap_key = sitemap_key;

    return res.end('***JSHARMONY_REDIRECT***\n'+req.baseurl+modelid+'?'+querystring.stringify(req.query));
  }

});
