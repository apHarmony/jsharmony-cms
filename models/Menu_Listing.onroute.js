//(routetype, req, res, callback, require, jsh, modelid, params)

var _ = require('lodash');
var Helper = require('../Helper.js');
var cms = jsh.Modules['jsHarmonyCMS'];
var async = require('async');
var dbtypes = jsh.AppSrv.DB.types;

if(routetype != 'model') return callback();

var model = jsh.getModelClone(req, modelid);

if (!Helper.hasModelAction(req, model, 'B')) return callback();

var missing_menus = [];
var required_menus = [];
var existing_menus = {};
var site_config = {};
var site_id = null;
var branch_id = null;

async.waterfall([
  //Get site_id
  function(menu_cb){
    jsh.AppSrv.ExecRecordset(req._DBContext, 'select {schema}.my_current_branch_id() branch_id,{schema}.my_current_site_id() site_id', [], {  }, function (err, rslt) {
      if(err) callback();
      if(!rslt || !rslt.length || !rslt[0] || !rslt[0].length) return callback();

      site_id = rslt[0][0].site_id;
      //If no site is checked out, do not check menu config
      if(!site_id) return callback();

      branch_id = rslt[0][0].branch_id;
      //If no branch is checked out, do not check menu config
      if(!branch_id) return callback();

      return menu_cb();
    });
  },

  function(menu_cb){
    async.parallel([

      //Get site config
      function(template_cb){
        cms.funcs.getSiteConfig(req._DBContext, site_id, { continueOnConfigError: true }, function(err, siteConfig){
          if(err) return template_cb(err);
          site_config = siteConfig;
          return template_cb();
        });
      },

      //Get menus in current revision
      function(template_cb){
        jsh.AppSrv.ExecRecordset(req._DBContext, 'select menu_tag from {schema}.v_my_menu', [], {  }, function (err, rslt) {
          if(err) template_cb();
          if(!rslt || !rslt.length || !rslt[0] || !rslt[0].length) return template_cb();

          _.each(rslt[0], function(menu){
            existing_menus[menu.menu_tag] = menu;
          });

          return template_cb();
        });
      },
    
    ], function(err){
      return menu_cb(err);
    });
  },

  //Find missing menus
  function(menu_cb){
    required_menus = ((site_config || {}).menus||[]);

    _.each(required_menus, function(required_menu){
      if(required_menu && required_menu.tag){
        if(!(required_menu.tag in existing_menus)){
          missing_menus.push(_.pick(required_menu,['name','tag']));
        }
      }
    });

    return menu_cb();
  },
  
  //Add missing menus, if querstring add_missing_menus parameter is set
  function(menu_cb){
    if(!missing_menus.length || !req.query || !req.query.add_missing_menus) return menu_cb();

    async.eachSeries(missing_menus, function(missing_menu, missing_menu_cb){
      if(!missing_menu.tag) { var errmsg = 'Site Menu missing tag: '+JSON.stringify(missing_menu); jsh.Log.error(errmsg); res.end(errmsg); return; }
      var menu_name = missing_menu.name || missing_menu.tag;
      var menu_tag = missing_menu.tag;
      jsh.AppSrv.ExecCommand(req._DBContext,
        'insert into {schema}.v_my_menu(menu_name, menu_tag) values(@menu_name, @menu_tag)',
        [dbtypes.NVarChar(256),dbtypes.NVarChar(256)],
        { menu_name: menu_name, menu_tag: menu_tag },
        function (err, rslt) {
          if(err) { jsh.Log.error(err); Helper.GenError(req, res, -99999, 'An unexpected error has occurred'); return; }
          return missing_menu_cb();
        }
      );
    }, function(err){
      if (err) { jsh.Log.error(err); Helper.GenError(req, res, -99999, 'An unexpected error has occurred'); return; }
    
      res.end('***JSHARMONY_REDIRECT***\n'+req.baseurl+modelid+'?tstmp='+(new Date()).getTime());
    });
  },

  //Return missing menus to client
  function(menu_cb){
    model.oninit = '_this.missing_menus = '+JSON.stringify(missing_menus)+';'+model.oninit||'';
    return menu_cb();
  },


], function(err){
  //Save model to local request cache
  req.jshlocal.Models[modelid] = model;
  return callback();
});



