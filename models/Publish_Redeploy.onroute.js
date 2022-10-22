//(routetype, req, res, callback, require, jsh, modelid, params)

var Helper = require('../Helper.js');
var moment = require('moment');

if(routetype == 'model'){
  var model = jsh.getModel(req, modelid);
  if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

  var resModel = jsh.getModelClone(req, modelid);

  var deployment_date = jsh.AppSrvClass.prototype.getFieldByName(resModel.fields, 'deployment_date');
  deployment_date.default = 'js:' + JSON.stringify(moment().format('YYYY-MM-DD hh:mm A'));

  var deployment_tag = jsh.AppSrvClass.prototype.getFieldByName(resModel.fields, 'deployment_tag');
  deployment_tag.default = 'js:' + JSON.stringify(moment().format('YYYY-MM-DD hh:mm A')+' Redeployment');

  req.jshlocal.Models[modelid] = resModel;
  return callback();
}
else return callback();
