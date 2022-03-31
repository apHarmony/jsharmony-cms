//(routetype, req, res, callback, require, jsh, modelid, params)

var Helper = require('../Helper.js');
var querystring = require('querystring');

var model = jsh.getModelClone(req, modelid);

if (!Helper.hasModelAction(req, model, 'B')) return callback();

if(routetype != 'model') return callback();

jsh.AppSrv.ExecRecordset(req._DBContext, 'select (select {schema}.my_current_branch_id()) branch_id', [], {  }, function (err, rslt) {
  if(err) callback();
  if(!rslt || !rslt.length || !rslt[0] || !rslt[0].length || !rslt[0][0]) return callback();

  //Redirect to listing on invalid key
  if(!rslt[0][0].branch_id){
    return res.end('***JSHARMONY_REDIRECT***\n'+req.baseurl+model.namespace+'Publish_Add_Release');
  }
  else if(req.query.target=='branch'){
    return res.end('***JSHARMONY_REDIRECT***\n'+req.baseurl+model.namespace+'Publish_Add_Branch?'+querystring.stringify({ action: 'update', branch_id: rslt[0][0].branch_id }));
  }
  else return callback();
});
