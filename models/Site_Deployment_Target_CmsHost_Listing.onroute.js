//(routetype, req, res, callback, require, jsh, modelid, params)

var _ = require('lodash');
var Helper = require('../Helper.js');

function escapeQuote(txt){
  if(txt===null || (typeof txt == 'undefined')) return 'null';
  return "'"+jsh.DB['default'].sql.escape(txt)+"'";
}

if((routetype == 'd')||(routetype == 'csv')){

  var model = jsh.getModelClone(req, modelid);
  if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

  var host_ids = [];
  if(jsh.Config.queues) for(var queueid in jsh.Config.queues){
    queueid = (queueid||'').toString();
    if(queueid.toString().indexOf('deployment_host_publish_')==0){
      host_ids.push(queueid.substr(('deployment_host_publish_').length));
    }
  }

  var tablesql = "select NULL host_id where 1=0";
  if(host_ids.length){
    tablesql = _.map(host_ids, function(host_id){ return 'select '+ escapeQuote(host_id) + ' host_id' }).join(' union all ');
  }

  model.sqlselect = Helper.ReplaceAll(model.sqlselect, '%%%CMS_HOSTS%%%', '(' + tablesql + ') cms_hosts');

  //Save model to local request cache
  req.jshlocal.Models[modelid] = model;
  return callback();
}
else return callback();
