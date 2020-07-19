//(routetype, req, res, callback, require, jsh, modelid, params)

var _ = require('lodash');
var Helper = require('../Helper.js');
var ejsext = require('../lib/ejsext.js');
var cms = jsh.Modules['jsHarmonyCMS'];
var dbtypes = jsh.AppSrv.DB.types;

if(routetype == 'model'){
  var model = jsh.getModel(req, modelid);
  if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }
  
  Helper.execif(cms.Config.onRouteLinkBrowser,
    function(f){
      cms.Config.onRouteLinkBrowser(jsh, req, res, model, function(rslt){
        if(rslt!==false) return f();
      });
    },
    function(){
      if(req.query.init_page_key){
        jsh.AppSrv.ExecRow(req._DBContext, "select page_folder from {schema}.v_my_page where page_key=@page_key", [dbtypes.BigInt], { page_key: req.query.init_page_key }, function (err, rslt) {
          if(err) callback();
          if(!rslt || !rslt.length || !rslt[0]) return callback();

          var page_folder = rslt[0].page_folder;
          if(!page_folder) return callback();
      
          var state = {};
          state[model.namespace+'Page_Browser_Tab'] = { page_folder: page_folder };
          res.end('***JSHARMONY_REDIRECT***\n'+req.baseurl+modelid+'?action=browse&state='+encodeURIComponent(JSON.stringify(state)));
          return;
        });
      }
      else if(req.query.init_media_key){
        jsh.AppSrv.ExecRow(req._DBContext, "select media_folder from {schema}.v_my_media where media_key=@media_key", [dbtypes.BigInt], { media_key: req.query.init_media_key }, function (err, rslt) {
          if(err) callback();
          if(!rslt || !rslt.length || !rslt[0]) return callback();

          var media_folder = rslt[0].media_folder;
          if(!media_folder) return callback();
      
          var state = {};
          state[model.namespace+'Media_Browser_Tab'] = { media_folder: media_folder };
          var tabs = {};
          tabs[modelid] = model.namespace+'Media_Browser_Tab';
          res.end('***JSHARMONY_REDIRECT***\n'+req.baseurl+modelid+'?action=update&state='+encodeURIComponent(JSON.stringify(state))+'&tabs='+encodeURIComponent(JSON.stringify(tabs)));
          return;
        });
      }
      else return callback();
    });
}
else return callback();
