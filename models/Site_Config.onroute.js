//(routetype, req, res, callback, require, jsh, modelid, params)

var path = require('path');
var Helper = require('../Helper.js');
var cms = jsh.Modules['jsHarmonyCMS'];

function escapeQuote(txt){
  if(txt===null || (typeof txt == 'undefined')) return 'null';
  return "'"+jsh.DB['default'].sql.escape(txt)+"'";
}

if((routetype == 'd')||(routetype == 'csv')){

  var model = jsh.getModelClone(req, modelid);
  if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

  //Parse site_id
  var site_id = null;
  if(req.query && req.query.site_id) site_id = req.query.site_id;
  
  var fsConfigPath = '';
  if(cms.Config.showLocalTemplatePaths){
    fsConfigPath = path.join(path.join(jsh.Config.datadir,'site'),site_id.toString(),'templates','site_config.json');
  }
  model.breadcrumbs.sql = Helper.ReplaceAll(model.breadcrumbs.sql, '%%%FS_CONFIG_PATH%%%', escapeQuote(fsConfigPath));

  var sftpUrl = '';
  if(cms.Config.sftp.enabled){
    sftpUrl = cms.SFTPServer.getURL((req.headers.host||'').split(':')[0]);
  }
  model.breadcrumbs.sql = Helper.ReplaceAll(model.breadcrumbs.sql, '%%%SFTP_URL%%%', escapeQuote(sftpUrl));

  //Save model to local request cache
  req.jshlocal.Models[modelid] = model;

  return callback();
}
else return callback();
