//(routetype, req, res, callback, require, jsh, modelid, params)

var Helper = require('../Helper.js');
var cms = jsh.Modules['jsHarmonyCMS'];

var model = jsh.getModelClone(req, modelid);

if (!Helper.hasModelAction(req, model, 'B')) return callback();

jsh.AppSrv.ExecRecordset(req._DBContext, "select site_id code_val,'site_id' code_txt from {schema}.branch where branch.branch_id={schema}.my_current_branch_id()", [], {  }, function (err, rslt) {
  if(err) callback();
  if(!rslt || !rslt.length || !rslt[0] || !rslt[0].length) return callback();

  cms.funcs.getCurrentPageTemplatesLOV(req._DBContext, rslt[0], {}, function(err, values){
    if(err) return callback();
    var field_page_template_id = jsh.AppSrv.getFieldByName(model.fields, 'page_template_id');
    field_page_template_id.lov.values = values;
    //Save model to local request cache
    req.jshlocal.Models[modelid] = model;
    return callback();
  });
});
