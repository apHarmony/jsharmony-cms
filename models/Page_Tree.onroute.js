//(routetype, req, res, callback, require, jsh, modelid, params)

var Helper = require('../Helper.js');
var cms = jsh.Modules['jsHarmonyCMS'];
var dbtypes = jsh.AppSrv.DB.types;

if(routetype == 'd'){
  jsh.AppSrv.ExecRow(req._DBContext, 'select v_my_site.site_id, (select deployment_target_publish_config from {schema}.deployment_target where deployment_target.deployment_target_id = v_my_site.deployment_target_id) deployment_target_publish_config from {schema}.v_my_site where site_id={schema}.my_current_site_id()', [], { }, function (err, rslt) {
    if (err) { jsh.Log.error(err); Helper.GenError(req, res, -99999, 'An unexpected error has occurred'); return; }

    var root_txt = '(Root)';
    if (rslt && rslt.length && rslt[0]) {
      var deployment_target_publish_config = {};
      try{
        deployment_target_publish_config = cms.funcs.parseDeploymentTargetPublishConfig(rslt[0].site_id, rslt[0].deployment_target_publish_config, 'editor');
      }
      catch(ex){
        jsh.Log.error(ex);
        return;
      }
      if(deployment_target_publish_config.page_subfolder){
        root_txt += '/' + deployment_target_publish_config.page_subfolder;
        if(root_txt[root_txt.length-1] == '/') root_txt = root_txt.substr(0, root_txt.length - 1);
      }
    }

    var model = jsh.getModelClone(req, modelid);
    var treeField = jsh.AppSrvClass.prototype.getFieldByName(model.fields, 'page_folder');
    if(treeField) treeField.lov.post_process = Helper.ReplaceAll(treeField.lov.post_process, '%%%ROOT%%%', root_txt);

    //Save model to local request cache
    req.jshlocal.Models[modelid] = model;
    return callback();
  });
}
else if(routetype == 'model'){
  var model = jsh.getModel(req, modelid);
  if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

  var sql = undefined;
  var sql_ptypes = undefined;
  var sql_params = undefined;
  if(req.query.init_page_key) {
    sql = 'select page_folder from {schema}.v_my_page where page_key=@page_key';
    sql_ptypes = [dbtypes.BigInt];
    sql_params = { page_key: req.query.init_page_key };
  } else if (req.query.init_page_path) {
    if (!req.query.init_page_path.endsWith('/')) req.query.init_page_path = req.query.init_page_path + '/';
    sql = 'select page_folder from {schema}.v_my_page where substr(page_folder, 1, length(@page_folder)) = @page_folder';
    sql_ptypes = [dbtypes.NVarChar(dbtypes.MAX)];
    sql_params = { page_folder: req.query.init_page_path };
  }

  if (sql) {
    jsh.AppSrv.ExecRow(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
      if(err) callback();
      if(!rslt || !rslt.length || !rslt[0]) return callback();

      var page_folder = rslt[0].page_folder;
      if(!page_folder) return callback();
  
      var state = {};
      state[modelid] = { page_folder: page_folder };
      res.end('***JSHARMONY_REDIRECT***\n'+req.baseurl+modelid+'?state='+encodeURIComponent(JSON.stringify(state)));
      return;
    });
  }
  else return callback();
}
else return callback();
