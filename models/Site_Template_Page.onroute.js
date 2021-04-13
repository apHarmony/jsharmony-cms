//(routetype, req, res, callback, require, jsh, modelid, params)

var _ = require('lodash');
var path = require('path');
var ftppath = require('path').posix;
var async = require('async');
var fs = require('fs');
var Helper = require('../Helper.js');
var HelperFS = require('../HelperFS.js');
var ejsext = require('../lib/ejsext.js');
var cms = jsh.Modules['jsHarmonyCMS'];
var dbtypes = jsh.AppSrv.DB.types;

function escapeQuote(txt){
  if(txt===null || (typeof txt == 'undefined')) return 'null';
  return "'"+jsh.DB['default'].sql.escape(txt)+"'";
}

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

  var publishTemplatePaths = {};
  
  return async.waterfall([
    function(data_cb){
      if(!site_id) return data_cb();
      var sitePath = path.join(path.join(jsh.Config.datadir,'site'),site_id.toString(),'templates','pages');
      var normalizedSitePath = path.normalize(sitePath);

      //Get all local site templates from site\#\templates\pages
      fs.exists(sitePath, function (exists) {
        if (!exists) return data_cb(null);
        fs.readdir(sitePath, function (err, files) {
          if (err) return data_cb(err);
          async.each(files, function(file, file_cb){
            var ext = path.extname(file);
            if((ext=='.htm') || (ext=='.html')){
              var templateName = file.substr(0, file.length - ext.length);
              var fpath = path.join(sitePath, file);
              
              fs.readFile(fpath, 'utf8', function(err, templateContent){
                if(err) return file_cb(err);

                //Read Page Template Config
                var templateConfig = null;
                try{
                  templateConfig = cms.funcs.readPageTemplateConfig(templateContent, 'local page template  "'+file+'"', { continueOnConfigError: true });
                }
                catch(ex){
                  return file_cb(ex);
                }

                var templateTitle = templateConfig.title || templateName;
                var localTemplate = {
                  site_template_type: 'PAGE',
                  site_template_name: templateName,
                  site_template_title: templateTitle,
                  site_template_path: '/templates/pages/' + file,
                  site_template_config: null,
                  site_template_location: 'LOCAL',
                };
                localTemplates.push(localTemplate);

                if(templateConfig && templateConfig.remote_templates && templateConfig.remote_templates.publish){
                  var filepath = path.normalize(fpath);
                  var publishTemplatePath = templateConfig.remote_templates.publish;
                  if(publishTemplatePath.indexOf('//') < 0){
                    publishTemplatePath = path.normalize(path.join(path.dirname(filepath), publishTemplatePath));
                    if(publishTemplatePath.indexOf(normalizedSitePath+path.sep) == 0){
                      //Do not allow an editor template to reference itself as a publish template
                      if(publishTemplatePath != filepath){
                        publishTemplatePaths['/templates/pages' + HelperFS.convertWindowsToPosix(publishTemplatePath.substr(normalizedSitePath.length))] = {
                          source: localTemplate.site_template_path,
                        };
                      }
                    }
                  }
                }

                return file_cb();
              });
            }
            else file_cb();
          }, data_cb);
        });
      });
    },

    //Remove local publish templates
    function(data_cb){
      _.each(_.keys(publishTemplatePaths), function(key){
        if(!publishTemplatePaths[key]) return;
        var source = publishTemplatePaths[key].source;
        if(source in publishTemplatePaths) delete publishTemplatePaths[source];
      });

      //Remove publish templates
      for(var i=0;i<localTemplates.length;i++){
        if(localTemplates[i].site_template_path in publishTemplatePaths){
          localTemplates.splice(i, 1);
          i--;
        }
      }

      return data_cb();
    },

    //Add local system templates
    function(data_cb){
      for(var key in cms.SystemPageTemplates){
        var pageTemplate = cms.SystemPageTemplates[key];
        var templatePath = ' ';
        if(pageTemplate.remote_templates){
          templatePath = pageTemplate.remote_templates.editor || ' ';
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
      
      var fsPageTemplatePath = '';
      if(cms.Config.showLocalTemplatePaths){
        fsPageTemplatePath = path.join(path.join(jsh.Config.datadir,'site'),site_id.toString(),'templates','pages');
      }
      model.breadcrumbs.sql = Helper.ReplaceAll(model.breadcrumbs.sql, '%%%FS_PAGE_TEMPLATE_PATH%%%', escapeQuote(fsPageTemplatePath));

      var sftpUrl = '';
      if(cms.Config.sftp.enabled){
        sftpUrl = cms.SFTPServer.getURL((req.headers.host||'').split(':')[0]);
      }
      model.breadcrumbs.sql = Helper.ReplaceAll(model.breadcrumbs.sql, '%%%SFTP_URL%%%', escapeQuote(sftpUrl));

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
