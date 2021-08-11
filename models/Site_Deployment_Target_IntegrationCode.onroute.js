//(routetype, req, res, callback, require, jsh, modelid, params)

var _ = require('lodash');
var Helper = require('../Helper.js');
var async = require('async');
var dbtypes = jsh.AppSrv.DB.types;
var crypto = require('crypto');
var cms = jsh.Modules['jsHarmonyCMS'];
var urlparser = require('url');

if((routetype != 'model') && (routetype != 'model_child')) return callback();

var model = jsh.getModelClone(req, modelid);
if (!Helper.hasModelAction(req, model, 'B')) return Helper.GenError(req, res, -11, 'Invalid Model Access');

var server_url = cms.getCmsBaseUrlFromReq(req);

var deployment_target_id = null;
if(req.query) deployment_target_id = req.query.deployment_target_id;
if(!deployment_target_id) return Helper.GenError(req, res, -4, 'Invalid Parameters');
if(parseInt(deployment_target_id).toString() !== deployment_target_id.toString()) return Helper.GenError(req, res, -4, 'Invalid Parameters!');
deployment_target_id = parseInt(deployment_target_id);

cms.funcs.getAccessKey(req._DBContext, deployment_target_id, server_url, {}, function(err, access_key){
  if(err) return Helper.GenError(req, res, -99999, err.toString());

  model.oninit = [
    "_this.access_key = "+JSON.stringify(access_key)+";",
    "_this.server_url = "+JSON.stringify(server_url)+";",
    model.oninit||'',
  ].join('');

  //Save model to local request cache
  req.jshlocal.Models[modelid] = model;
  return callback();
});