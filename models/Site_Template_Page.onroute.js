//(routetype, req, res, callback, require, jsh, modelid, params)

var _ = require('lodash');
var path = require('path');
var async = require('async');
var fs = require('fs');
var Helper = require('../Helper.js');
var ejsext = require('../lib/ejsext.js');
var cms = jsh.Modules['jsHarmonyCMS'];
var dbtypes = jsh.AppSrv.DB.types;

if((routetype == 'd')||(routetype == 'csv')){

  var model = jsh.getModelClone(req, modelid);
  if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

  //Parse site_id
  var site_id = null;
  var d = {};
  if(req.query && req.query.d){
    try{
      d = JSON.parse(req.query.d);
      if(d.site_id && (parseInt(d.site_id).toString() == d.site_id.toString())){
        site_id = parseInt(d.site_id);
      }
    }
    catch(ex){}
  }

  var localTemplates = [
    //site_template_type, site_template_name, site_template_title, site_template_path,site_template_config
  ];
  
  return async.waterfall([
    function(data_cb){
      if(!site_id) return data_cb();
      var sitePath = path.join(path.join(jsh.Config.datadir,'site'),site_id.toString(),'templates','pages');

      //Get all local site templates from site\#\templates\page
      fs.exists(sitePath, function (exists) {
        if (!exists) return data_cb(null);
        fs.readdir(sitePath, function (err, files) {
          if (err) return data_cb(err);
          async.each(files, function(file, file_cb){
            var ext = path.extname(file);
            if((ext=='.htm') || (ext=='.html')){
              var templateName = file.substr(0, file.length - ext.length);
              
              fs.readFile(path.join(sitePath, file), 'utf8', function(err, templateContent){
                if(err) return file_cb(err);

                //Read Page Template Config
                var templateConfig = cms.funcs.readPageTemplateConfig(templateContent);

                var templateTitle = templateConfig.title || templateName;
                localTemplates.push({
                  site_template_type: 'PAGE',
                  site_template_name: templateName,
                  site_template_title: templateTitle,
                  site_template_path: '/templates/pages/' + file,
                  site_template_config: null,
                  site_template_location: 'LOCAL',
                });
                return file_cb();
              });
            }
            else file_cb();
          }, data_cb);
        });
      });
    },

    //Add local system template
    function(data_cb){
      for(var key in cms.SystemPageTemplates){
        var pageTemplate = cms.SystemPageTemplates[key];
        var templatePath = ' ';
        if(pageTemplate.remote_template){
          templatePath = pageTemplate.remote_template.editor || ' ';
        }
        localTemplates.push({
          site_template_type: 'PAGE',
          site_template_name: key,
          site_template_title: pageTemplate.title,
          site_template_path: templatePath,
          site_template_config: null,
          site_template_location: 'SYSTEM',
        });
      }
      return data_cb();
    },

    //Generate SQL
    function(data_cb){      
      //Remote Templates
      var tablesql = "select site_template_id,site_id,site_template_type,site_template_name,site_template_title,'REMOTE' site_template_location,site_template_path,site_template_config from "+(cms.schema?cms.schema+'.':'')+"site_template";

      //Local Templates
      var addedTemplates = {};
      _.each(localTemplates, function(localTemplate){
        if(localTemplate.site_template_name in addedTemplates) return;
        addedTemplates[localTemplate.site_template_name] = 1;

        function escapeQuote(txt){
          if(txt===null || (typeof txt == 'undefined')) return 'null';
          return "'"+jsh.DB['default'].sql.escape(txt)+"'";
        }
        
        tablesql += " union all select null site_template_id,"+
          jsh.DB['default'].sql.escape(site_id)+" site_id,"+
          escapeQuote(localTemplate.site_template_type)+" site_template_type,"+
          escapeQuote(localTemplate.site_template_name)+" site_template_name,"+
          escapeQuote(localTemplate.site_template_title)+" site_template_title,"+
          escapeQuote(localTemplate.site_template_location)+" site_template_location,"+
          escapeQuote(localTemplate.site_template_path)+" site_template_path,"+
          escapeQuote(localTemplate.site_template_config)+" site_template_config";
      });

      model.sqlselect = Helper.ReplaceAll(model.sqlselect, '%%%SITE_TEMPLATE%%%', '(' + tablesql + ') site_template');

      //Save model to local request cache
      req.jshlocal.Models[modelid] = model;
      return data_cb();
    },
  ], function(err){
    if(err) return Helper.GenError(req, res, -99999, err.toString());
    return callback();
  });
}
else return callback();
