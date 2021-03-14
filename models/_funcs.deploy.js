/*
Copyright 2019 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/

var Helper = require('jsharmony/Helper');
var HelperFS = require('jsharmony/HelperFS');
var _ = require('lodash');
var urlparser = require('url');
var path = require('path');
var ejs = require('ejs');
var fs = require('fs');
var async = require('async');
var crypto = require('crypto');
var wclib = require('jsharmony/WebConnect');
var wc = new wclib.WebConnect();
var baseModule = module;

module.exports = exports = function(module, funcs){
  var exports = {};

  funcs.deploymentQueue = async.queue(function (deployment_id, done){
    funcs.deploy_exec(deployment_id, done);
  }, 1);

  exports.deployment_getLogFileName = function (deployment_id) {
    return path.join(module.jsh.Config.datadir, 'publish_log', deployment_id + '.log');
  }

  exports.deployment_getChangeFileName = function (deployment_id) {
    return path.join(module.jsh.Config.datadir, 'publish_log', deployment_id + '.changes.log');
  }

  exports.deploy_log = function (deployment_id, txt, logtype){
    var jsh = module.jsh;
    jsh.Log[logtype](txt);
    var logfile = funcs.deployment_getLogFileName(deployment_id);
    jsh.Log[logtype](logtype.toUpperCase() + ' ' + txt, { logfile: logfile });
  }

  exports.deploy_log_error = function (deployment_id, txt){
    funcs.deploy_log(deployment_id, 'Publish Failed: '+(txt||'').toString(), 'error');
  }

  exports.deploy_log_info = function (deployment_id, txt){
    funcs.deploy_log(deployment_id, txt, 'info');
  }

  exports.deploy_log_change = function (deployment_id, txt){
    var jsh = module.jsh;
    if(!jsh.Config.logdir) return;
    var logfile = funcs.deployment_getChangeFileName(deployment_id);
    fs.appendFile(logfile, txt+'\r\n', function(){});
  }

  exports.deploy = function (deployment_id, onComplete) {
    funcs.deploymentQueue.push(deployment_id, function(err){
      if(onComplete) return onComplete();
    });
  }

  exports.deploy_waitForLog = function(deployment_id, onComplete){
    var jsh = module.jsh;
    var logQueue = jsh.Log.getQueue();
    var logfile = funcs.deployment_getLogFileName(deployment_id);
    var waiting = false;
    for(var i=0;i<logQueue.length;i++){
      var log = logQueue[i];
      if(log && logfile && (log.logfile == logfile)){ waiting = true; break; }
    }
    if(waiting){ setTimeout(function(){ exports.deploy_waitForLog(deployment_id, onComplete); }, 50); return; }
    if(onComplete) onComplete();
  }

  exports.getPageRelativePath = function(page, publish_params){
    var page_fpath = page.page_path||'';
    if(!page_fpath) return '';
    while(page_fpath.substr(0,1)=='/') page_fpath = page_fpath.substr(1);

    var is_folder = (page_fpath[page_fpath.length-1]=='/');
    if(is_folder) page_fpath += publish_params.site_default_page_filename;
    if(path.isAbsolute(page_fpath)) throw new Error('Page path:'+page.page_path+' cannot be absolute');
    if(page_fpath.indexOf('..') >= 0) throw new Error('Page path:'+page.page_path+' cannot contain directory traversals');
    if(publish_params) page_fpath = publish_params.page_subfolder + page_fpath;
    return page_fpath;
  }

  exports.getMediaRelativePath = function(media, publish_params){
    var media_fpath = media.media_path||'';
    if(!media_fpath) return '';
    while(media_fpath.substr(0,1)=='/') media_fpath = media_fpath.substr(1);

    var is_folder = (media_fpath[media_fpath.length-1]=='/');
    if(is_folder) throw new Error('Media path:'+media.media_path+' cannot be a folder');
    if(path.isAbsolute(media_fpath)) throw new Error('Media path:'+media.media_path+' cannot be absolute');
    if(media_fpath.indexOf('..') >= 0) throw new Error('Media path:'+media.media_path+' cannot contain directory traversals');
    if(media_fpath.indexOf('./') >= 0) throw new Error('Media path:'+media.media_path+' cannot contain directory traversals');
    if(publish_params) media_fpath = publish_params.media_subfolder + media_fpath;
    return media_fpath;
  }

  exports.downloadLocalTemplates = function(branchData, templates, template_html, options, download_cb){
    options = _.extend({ templateType: 'PAGE', exportTemplates: {} }, options);

    var jsh = module.jsh;
    var sitePath = path.join(path.join(jsh.Config.datadir,'site'),(branchData.site_id||'').toString());

    async.eachOf(templates, function(template, template_name, template_cb){
      if(template.location != 'LOCAL') return template_cb();
      if(!template.path) return template_cb();

      async.waterfall([
        function(template_action_cb){
          var templatePath = path.join(sitePath, template.path);

          fs.readFile(templatePath, 'utf8', function(err, templateContent){
            if (HelperFS.fileNotFound(err)) return template_action_cb(new Error('Error downloading template - local template file not found: '+template.path));
            if(err) return template_action_cb(new Error('Error downloading template: '+err.toString()));

            //Parse and merge template config
            var templateConfig = null;
            try{
              if(options.templateType == 'PAGE') templateConfig = funcs.readPageTemplateConfig(templateContent, 'local page template "'+template.path+'"');
              else if(options.templateType == 'COMPONENT') templateConfig = funcs.readComponentTemplateConfig(templateContent, 'local component template "'+template.path+'"');
              else throw new Error('Invalid Template Type: ' + options.templateType);
            }
            catch(ex){
              return template_action_cb(ex);
            }

            async.parallel([
              //Download publish template, if necessary
              function(template_publish_cb){
                async.waterfall([
                  //Check publish template
                  function(template_process_cb){
                    if(templateConfig && templateConfig.remote_templates && templateConfig.remote_templates.publish){
                      templateConfig.remote_templates.publish = funcs.parseDeploymentUrl(templateConfig.remote_templates.publish, branchData.deployment_target_params);
                      //If path is remote
                      if(templateConfig.remote_templates.publish.indexOf('//') >= 0) return template_process_cb();
                      //If path is local
                      var publishTemplatePath = path.normalize(path.join(path.dirname(templatePath), templateConfig.remote_templates.publish));
                      if(publishTemplatePath.indexOf(path.normalize(sitePath)+path.sep) != 0) return template_process_cb(new Error('Invalid remote_templates.publish path: '+templateConfig.remote_templates.publish));

                      //Download local publish template
                      fs.readFile(publishTemplatePath, 'utf8', function(err, publishTemplateContent){
                        if (HelperFS.fileNotFound(err)) return template_process_cb(new Error('Error downloading publish template - publish template file not found: '+templateConfig.remote_templates.publish));
                        if(err) return template_process_cb(new Error('Error downloading publish template: '+err.toString()));
                        //Add publish template to template_html
                        template_html[template_name] = publishTemplateContent;
                        return template_process_cb();
                      });
                    }
                    else return template_process_cb();
                  },
                  //If no publish template, add to template_html
                  function(template_process_cb){
                    //Components already merged the config and post-processed it in getComponentTemplates
                    if(options.templateType != 'COMPONENT') _.merge(template, templateConfig);

                    if(!(template.remote_templates && template.remote_templates.publish)){
                      try{
                        if(options.templateType == 'PAGE') templateContent = funcs.generateDeploymentTemplate(template, templateContent);
                      }
                      catch(ex){
                        return template_publish_cb(new Error('Could not parse "'+template_name+'" '+options.templateType.toLowerCase()+' template: '+ex.toString()));
                      }
                      template_html[template_name] = templateContent;
                    }
                    return template_process_cb();
                  }
                ], template_publish_cb);
              },

              //Download export templates
              function(template_publish_cb){
                if(options.templateType != 'COMPONENT') return template_publish_cb();
                async.eachOf(templateConfig.export, function(exportItem, exportIndex, export_cb){
                  var exportDesc = '#'+(exportIndex+1).toString();
                  if(exportItem.export_path) exportDesc = '"' + exportItem.export_path + '"';
                  var exportErrorPrefix = 'Error in "'+template_name+'" '+options.templateType.toLowerCase()+', export '+exportDesc+' - ';
                  if(!(template_name in options.exportTemplates)) options.exportTemplates[template_name] = {};
                  Helper.execif(exportItem.remote_template,
                    //Initialize remote template
                    function(done){
                      exportItem.remote_template = funcs.parseDeploymentUrl(exportItem.remote_template, branchData.deployment_target_params);
                      //If path is remote
                      if(exportItem.remote_template.indexOf('//') >= 0) return done();
                      //If path is local
                      var exportTemplatePath = path.normalize(path.join(path.dirname(templatePath), exportItem.remote_template));
                      if(exportTemplatePath.indexOf(path.normalize(sitePath)+path.sep) != 0) return export_cb(new Error(exportErrorPrefix + 'Invalid remote_template path: '+exportItem.remote_template));

                      //Download local export template
                      fs.readFile(exportTemplatePath, 'utf8', function(err, exportTemplateContent){
                        if (HelperFS.fileNotFound(err)) return export_cb(new Error(exportErrorPrefix + 'File not found: '+exportItem.remote_template));
                        if(err) return export_cb(new Error(exportErrorPrefix + 'Could not download remote_template: '+err.toString()));
                        //Add export template to exportTemplates
                        options.exportTemplates[template_name][exportIndex] = exportTemplateContent;
                        return done();
                      });
                    },
                    //If no publish template, add current template to exportTemplates
                    function(){
                      if(!(exportItem.remote_template)){
                        options.exportTemplates[template_name][exportIndex] = templateContent;
                      }
                      return export_cb();
                    }
                  );
                }, template_publish_cb);
              },
            ], template_action_cb);
          });
        },
      ], template_cb);

    }, download_cb);
  }

  exports.downloadRemoteTemplates = function(branchData, templates, template_html, options, download_cb){
    options = _.extend({ templateType: 'PAGE', exportTemplates: {} }, options);

    var jsh = module.jsh;

    async.eachOf(templates, function(template, template_name, template_cb){
      if(template.location != 'REMOTE') return template_cb();
      if(!template.remote_templates) return template_cb();
      async.waterfall([
        //Download template.remote_templates.publish or template.remote_templates.editor
        function(template_action_cb){
          var url = '';
          var isPublishTemplate = false;
          if(template.remote_templates.publish){
            url = funcs.parseDeploymentUrl(template.remote_templates.publish, branchData.deployment_target_params);
            isPublishTemplate = true;
          }
          else if(template.remote_templates.editor){
            url = funcs.parseDeploymentUrl(template.remote_templates.editor, branchData.deployment_target_params);
          }
          else return template_action_cb();

          //Add cache-busting timestamp to URL
          try{
            var parsedUrl = new urlparser.URL(url);
            if(!parsedUrl.searchParams.has('_')){
              parsedUrl.searchParams.set('_', (Date.now()).toString());
              url = parsedUrl.toString();
            }
          }
          catch(ex){
            if(branchData.publish_params) funcs.deploy_log_info(branchData.publish_params.deployment_id, 'Downloading remote template: '+url);
            else jsh.Log.info('Downloading remote template: '+url);
            return template_action_cb(ex);
          }

          if(branchData.publish_params) funcs.deploy_log_info(branchData.publish_params.deployment_id, 'Downloading remote template: '+url);
          else jsh.Log.info('Downloading remote template: '+url);

          wc.req(url, 'GET', {}, {}, undefined, function(err, res, templateContent){
            if(err) return template_action_cb(err);
            if(res && res.statusCode){
              if(res.statusCode > 500) return template_action_cb(new Error(res.statusCode+' Error downloading template '+url));
              if(res.statusCode > 400) return template_action_cb(new Error(res.statusCode+' Error downloading template '+url));
            }
            //Parse and merge template config
            var templateConfig = null;
            try{
              if(options.templateType == 'PAGE') templateConfig = funcs.readPageTemplateConfig(templateContent, 'remote page template "'+url + '"');
              else if(options.templateType == 'COMPONENT') templateConfig = funcs.readComponentTemplateConfig(templateContent, 'remote component template "'+url+'"');
              else throw new Error('Invalid Template Type: ' + options.templateType);
            }
            catch(ex){
              return template_action_cb(ex);
            }
            if(templateConfig && templateConfig.remote_templates && templateConfig.remote_templates.publish){
              templateConfig.remote_templates.publish = funcs.parseDeploymentUrl(templateConfig.remote_templates.publish, branchData.deployment_target_params, url);
            }
            _.merge(template, templateConfig);
            
            if(isPublishTemplate){
              template_html[template_name] = templateContent;
            }
            else if(!template.remote_templates.publish){
              try{
                if(options.templateType == 'PAGE') templateContent = funcs.generateDeploymentTemplate(template, templateContent);
              }
              catch(ex){
                return template_action_cb(new Error('Could not parse "'+template_name+'" '+options.templateType.toLowerCase()+' template: '+ex.toString()));
              }
              template_html[template_name] = templateContent;
            }

            //Parse URLs for export templates
            _.each((options.templateType == 'COMPONENT') && template.export, function(exportItem, exportIndex){
              if(!(template_name in options.exportTemplates)) options.exportTemplates[template_name] = {};
              if(exportItem.remote_template){
                exportItem.remote_template = funcs.parseDeploymentUrl(exportItem.remote_template, branchData.deployment_target_params, url);
              }
              if(!exportItem.remote_template){
                options.exportTemplates[template_name][exportIndex] = templateContent;
              }
            });

            return template_action_cb();
          });
        },
      ], template_cb);

    }, download_cb);
  }

  exports.downloadPublishTemplates = function(branchData, templates, template_html, options, download_cb){
    options = _.extend({ templateType: 'PAGE', exportTemplates: {} }, options);
    async.eachOf(templates, function(template, template_name, template_cb){

      async.parallel([

        //Download standard templates
        function(template_download_cb){
          async.waterfall([
            //Download template.remote_templates.publish (for page, component)
            function(template_action_cb){
              if(template_name in template_html) return template_action_cb(); //Already downloaded
              if(!template.remote_templates || !template.remote_templates.publish) return template_action_cb();

              var url = funcs.parseDeploymentUrl(template.remote_templates.publish, branchData.deployment_target_params);
              funcs.deploy_log_info(branchData.publish_params.deployment_id, 'Downloading template: '+url);
              wc.req(url, 'GET', {}, {}, undefined, function(err, res, rslt){
                if(err) return template_action_cb(err);
                if(res && res.statusCode){
                  if(res.statusCode > 500) return template_action_cb(new Error(res.statusCode+' Error downloading template '+url));
                  if(res.statusCode > 400) return template_action_cb(new Error(res.statusCode+' Error downloading template '+url));
                }
                template_html[template_name] = rslt;
                return template_action_cb();
              });
            },

            //Add hard-coded templates to result
            function(template_action_cb){
              if(template.templates && ('publish' in template.templates)){
                //Clear editor templates, if they were used
                if(!(template.remote_templates && template.remote_templates.publish)) template_html[template_name] = '';
                //Prepend hard-coded template
                template_html[template_name] = template.templates.publish + (template_html[template_name]||'');
              }
              return template_action_cb();
            }
          ], template_download_cb);
        },

        //Download component export templates
        function(template_download_cb){
          if(options.templateType != 'COMPONENT') return template_download_cb();
          async.eachOf(template.export, function(exportItem, exportIndex, export_cb){
            if(!(template_name in options.exportTemplates)) options.exportTemplates[template_name] = {};
            async.waterfall([
              //Download remote_template
              function(template_action_cb){
                if(exportIndex in options.exportTemplates[template_name]) return template_action_cb(); //Already downloaded
                if(!exportItem.remote_template) return template_action_cb();

                var url = funcs.parseDeploymentUrl(exportItem.remote_template, branchData.deployment_target_params);
                funcs.deploy_log_info(branchData.publish_params.deployment_id, 'Downloading template: '+url);
                wc.req(url, 'GET', {}, {}, undefined, function(err, res, rslt){
                  if(err) return template_action_cb(err);
                  if(res && res.statusCode){
                    if(res.statusCode > 500) return template_action_cb(new Error(res.statusCode+' Error downloading template '+url));
                    if(res.statusCode > 400) return template_action_cb(new Error(res.statusCode+' Error downloading template '+url));
                  }
                  options.exportTemplates[template_name][exportIndex] = rslt;
                  return template_action_cb();
                });
              },

              //Add hard-coded templates to result
              function(template_action_cb){
                if(exportItem.template){
                  //Clear editor templates, if they were used
                  if(!exportItem.remote_template) options.exportTemplates[template_name][exportIndex] = '';
                  //Prepend hard-coded template
                  options.exportTemplates[template_name][exportIndex] = exportItem.template + (options.exportTemplates[template_name][exportIndex]||'');
                }
                return template_action_cb();
              }
            ], export_cb);
          }, template_download_cb);
        },
      ], template_cb);

    }, download_cb);
  }

  exports.getDeploymentSortedBranchItemTypes = function(){
    var cms = module;
    var branchItemTypes = _.keys(cms.BranchItems);
    branchItemTypes.sort(function(a,b){
      var aseq = (cms.BranchItems[a] && cms.BranchItems[a].deploy && cms.BranchItems[a].deploy.onDeploy_seq) || 0;
      var bseq = (cms.BranchItems[b] && cms.BranchItems[b].deploy && cms.BranchItems[b].deploy.onDeploy_seq) || 0;
      if(aseq > bseq) return 1;
      if(bseq > aseq) return -1;
      return 0;
    });
    return branchItemTypes;
  }

  exports.deploy_exec = function (deployment_id, onComplete) {
    if(!onComplete) onComplete = function(){};
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var cms = module;

    //Update deployment to running status
    var sql = "select \
        deployment_id, dt.site_id, deployment_tag, deployment_target_name, deployment_target_publish_path, deployment_target_params, deployment_target_publish_config, deployment_target_sts, deployment_git_revision, \
        d.deployment_target_id, \
        (select param_cur_val from jsharmony.v_param_cur where param_cur_process='CMS' and param_cur_attrib='PUBLISH_TGT') publish_tgt, \
        site.site_default_page_filename site_default_page_filename \
        from "+(module.schema?module.schema+'.':'')+"deployment d \
        inner join "+(module.schema?module.schema+'.':'')+"deployment_target dt on d.deployment_target_id = dt.deployment_target_id \
        inner join "+(module.schema?module.schema+'.':'')+"site site on site.site_id = dt.site_id\
        where deployment_sts='PENDING' and deployment_id=@deployment_id\
      ";
    appsrv.ExecRow('deployment', sql, [dbtypes.BigInt], { deployment_id: deployment_id }, function (err, rslt) {
      if (err != null) { err.sql = sql; funcs.deploy_log_error(deployment_id, err); return onComplete(err); }
      var publish_tgt = '';
      var deployment = (rslt ? rslt[0] : null);
      if(!deployment) { var err = 'Invalid Deployment ID'; funcs.deploy_log_error(deployment_id, err); return onComplete(err); }

      async.waterfall([

        //Change status to RUNNING
        function(deploy_cb){
          var sql = "update "+(module.schema?module.schema+'.':'')+"deployment set deployment_sts='RUNNING' where deployment_id=@deployment_id;";
          var sql_ptypes = [dbtypes.BigInt];
          var sql_params = { deployment_id: deployment_id };
          appsrv.ExecCommand('deployment', sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err) return deploy_cb(err);
            return deploy_cb();
          });
        },

        //Execute deployment
        function(deploy_cb){
          publish_tgt = deployment.publish_tgt;
          deployment_id = rslt[0].deployment_id;
          funcs.deploy_log_info(deployment_id, 'Deploying: '+(deployment.deployment_tag||''));
          if(!publish_tgt){ return deploy_cb('Publish Target parameter is not defined'); }
          if(deployment.deployment_target_sts.toUpperCase() != 'ACTIVE'){ return deploy_cb('Deployment Target is not ACTIVE'); }
          var publish_path = path.isAbsolute(publish_tgt) ? publish_tgt : path.join(jsh.Config.datadir,publish_tgt);
          publish_path = path.normalize(publish_path);

          //Deployment Target Params
          var deployment_target_params = {
            timestamp: (Date.now()).toString(),
          };
          try{
            if(deployment.deployment_target_params) deployment_target_params = _.extend(deployment_target_params, JSON.parse(deployment.deployment_target_params));
          }
          catch(ex){
            return deploy_cb('Publish Target has invalid deployment_target_params: '+deployment.deployment_target_params);
          }
          deployment_target_params = _.extend({}, cms.Config.deployment_target_params, deployment_target_params);

          //Deployment Target Publish Path
          var publish_params = JSON.parse(JSON.stringify(deployment_target_params));
          try{
            if(deployment.deployment_target_publish_config) publish_params = _.extend(publish_params, JSON.parse(deployment.deployment_target_publish_config));
          }
          catch(ex){
            return deploy_cb('Publish Target has invalid deployment_target_publish_config: '+deployment.deployment_target_publish_config);
          }
          for(var key in cms.Config.deployment_target_publish_config){
            if((key == 's3_config')||(key == 'ftp_config')) publish_params[key] = _.extend({}, cms.Config.deployment_target_publish_config[key], publish_params[key]);
            else if(!(key in publish_params)) publish_params[key] = cms.Config.deployment_target_publish_config[key];
          }
          publish_params.site_default_page_filename = deployment.site_default_page_filename;
          publish_params.publish_path = publish_path;
          publish_params.deployment_id = deployment_id;
          publish_params.deployment_target_id = deployment.deployment_target_id;
          deployment.publish_params = publish_params;

          //Branch Data
          var branchData = {
            publish_params: publish_params,
            deployment_target_params: deployment_target_params,
            deployment: deployment,
            site_id: deployment.site_id,
            site_files: {},
            site_redirects: [],

            page_keys: {},
            page_templates: null,
            page_template_html: {},
            page_redirects: {},

            component_templates: null,
            component_template_html: {},
            component_export_template_html: {},

            media_keys: {},

            menus: {},
            menu_template_html: {},

            sitemaps: {},
          }

          //Shell Commands
          function shellExec(cmd, params, cb, exec_options){
            var rslt = '';
            var returned = false;
            var orig_cb = cb;
            cb = function(err, rslt){
              if(returned) return;
              returned = true;
              return orig_cb(err, rslt);
            }
            exec_options = _.extend({ cwd: publish_path }, exec_options);
            wclib.xlib.exec(cmd, params, function(err){ //cb
              if(err) return cb(err, rslt.trim());
              return cb(null,rslt.trim());
            }, function(data){ //stdout
              rslt += data;
            }, null //stderr
            , function(err){ //onError
              return cb(err, rslt.trim());
            }, exec_options);
          }
          //Git Commands
          var git_path = cms.Config.git.bin_path || '';
          var git_branch = Helper.ReplaceAll(publish_params.git_branch, '%%%SITE_ID%%%', deployment.site_id);
          var deployment_git_revision = (deployment.deployment_git_revision||'');
          function gitExec(git_cmd, params, cb, exec_options){
            return shellExec(path.join(git_path, git_cmd), params, function(err, rslt){
              if(err) return cb(new Error('Git Error: ' + err.toString()), rslt);
              return cb(err, rslt);
            }, exec_options);
          }

          if(deployment_git_revision){
            //--------------------------
            //Single Revision Deployment
            //--------------------------
            async.waterfall([
              //Create output folder if it does not exist
              function (cb){
                return HelperFS.createFolderRecursive(publish_path, cb);
              },

              //Git - Initialize and Select Branch
              function (cb) {
                if(!cms.Config.git || !cms.Config.git.enabled){
                  return cb(new Error('GIT setup required for redeployment.  Please configure in app.config.js - jsHarmonyCMS.Config.git'));
                }

                async.waterfall([
                  //Initialize Git, if not initialized in publish folder
                  function(git_cb){
                    gitExec('git', ['rev-parse','--show-toplevel'], function(err, rslt){
                      if(!err && rslt && (path.normalize(rslt)==publish_path)) return git_cb();
                      return git_cb(new Error('GIT not initialized in publish path.  Cannot find revision for deployment.'));
                    });
                  },

                  //Check if branch exists
                  function(git_cb){
                    gitExec('git', ['show-ref','--verify','--quiet','refs/heads/'+git_branch], function(err, rslt){
                      if(!err && !rslt) return git_cb();
                      return git_cb(new Error('Target branch not found in publish folder.  Cannot find revision for deployment'));
                    });
                  },

                  //Check if deployment commit
                  function(git_cb){
                    gitExec('git', ['cat-file','-e',deployment_git_revision], function(err, rslt){
                      if(!err && !rslt) return git_cb();
                      return git_cb(new Error('Target deployment commit not found in publish folder.  Cannot find revision for deployment'));
                    });
                  },

                  //Checking out target revision
                  function(git_cb){
                    funcs.deploy_log_info(deployment_id, 'Checking out git branch: '+git_branch);
                    gitExec('git', ['checkout','-f',deployment_git_revision], function(err, rslt){
                      return git_cb(err);
                    });
                  }

                ], cb);
              },

              //Get list of all site files
              function (cb){
                var folders = {};

                HelperFS.funcRecursive(publish_path, function (filepath, relativepath, file_cb) { //filefunc
                  var parentpath = path.dirname(relativepath);
                  var webpath = '';
                  if(parentpath=='.') webpath = relativepath;
                  else webpath = folders[parentpath] + '/' + path.basename(relativepath);
                  fs.readFile(filepath, null, function(err, filecontent){
                    if(err) return cb(err);
                    branchData.site_files[webpath] = {
                      md5: crypto.createHash('md5').update(filecontent).digest("hex")
                    };
                    return file_cb();
                  });
                }, function (dirpath, relativepath, dir_cb) {
                  if(relativepath=='.git') return dir_cb(false);
                  var parentpath = path.dirname(relativepath);
                  if(parentpath=='.') folders[relativepath] = relativepath;
                  else {
                    folders[relativepath] = folders[parentpath] + '/' + path.basename(relativepath);
                  }
                  return dir_cb();
                }, {
                  file_before_dir: false,
                  preview_dir: function(dirpath, relativepath, dir_cb){
                    if(relativepath=='.git') return dir_cb(false);
                    return dir_cb();
                  }
                }, cb);
              },

              //Deploy to target
              function (cb) {
                var deploy_path = (deployment.deployment_target_publish_path||'').toString();

                if(!deploy_path){ return cb(); }
                else if(deploy_path.indexOf('file://')==0){
                  //File Deployment
                  return funcs.deploy_fs(deployment, publish_path, deploy_path.substr(7), branchData.site_files, cb);
                }
                else if(deploy_path.indexOf('s3://')==0){
                  //Amazon S3 Deployment
                  return funcs.deploy_s3(deployment, publish_path, deploy_path, branchData.site_files, cb);
                }
                else if((deploy_path.indexOf('ftps://')==0)||(deploy_path.indexOf('ftp://')==0)||(deploy_path.indexOf('sftp://')==0)) {
                  return funcs.deploy_ftp(deployment, publish_path, deploy_path, branchData.site_files, cb)
                }
                else return cb(new Error('Deployment Target path not supported'));
              },

              //Exec Post-Deployment Shell Command
              function (cb) {
                if(!publish_params.exec_post_deployment) return cb();
                shellExec(
                  publish_params.exec_post_deployment.cmd,
                  publish_params.exec_post_deployment.params, function(err, rslt){
                  if(err) return cb(err);
                  if(rslt) rslt = rslt.trim();
                  funcs.deploy_log_info(deployment_id, rslt);
                  return cb();
                });
              },

              //Log success
              function (cb) {
                funcs.deploy_log_info(deployment_id, 'Deployment successful');
                return cb();
              },

            ], function (err, rslt) {
              if (err) return deploy_cb(err.toString() + '\n' + (err.stack?err.stack:(new Error()).stack));
              return deploy_cb();
            });
          }
          else{
            //-------------------
            //Standard Deployment
            //-------------------
            async.waterfall([
              //Create output folder if it does not exist
              function (cb){
                return HelperFS.createFolderRecursive(publish_path, cb);
              },

              //Git - Initialize and Select Branch
              function (cb) {
                if(!cms.Config.git || !cms.Config.git.enabled){
                  if(deployment.deployment_git_revision) return cb(new Error('GIT setup required for redeployment.  Please configure in app.config.js - jsHarmonyCMS.Config.git'));
                  return cb();
                }

                async.waterfall([
                  //Initialize Git, if not initialized in publish folder
                  function(git_cb){
                    gitExec('git', ['rev-parse','--show-toplevel'], function(err, rslt){
                      if(!err && rslt && (path.normalize(rslt)==publish_path)) return git_cb();
                      //Initialize git for the first time
                      funcs.deploy_log_info(deployment_id, 'Initializing git in publish path: '+publish_path);
                      gitExec('git', ['init','-q'], function(err, rslt){
                        if(err) return git_cb(err);
                        //Set git email
                        funcs.deploy_log_info(deployment_id, 'Setting git email');
                        gitExec('git', ['config','user.email','cms@localhost'], function(err, rslt){
                          if(err) return git_cb(err);
                          //Disable CRLF Warnings
                          funcs.deploy_log_info(deployment_id, 'Disable git CRLF warnings');
                          gitExec('git', ['config','core.safecrlf','false'], function(err, rslt){
                            if(err) return git_cb(err);
                            //Set git user
                            funcs.deploy_log_info(deployment_id, 'Setting git user');
                            gitExec('git', ['config','user.name','CMS'], function(err, rslt){
                              if(err) return git_cb(err);
                              return git_cb();
                            });
                          });
                        });
                      });
                    });
                  },

                  //Check if branch exists, create if it does not
                  function(git_cb){
                    gitExec('git', ['show-ref','--verify','--quiet','refs/heads/'+git_branch], function(err, rslt){
                      if(!err && !rslt) return git_cb();
                      //Initialize git for the first time
                      funcs.deploy_log_info(deployment_id, 'Initializing git branch: '+git_branch);
                      gitExec('git', ['checkout','-f','--orphan',git_branch], function(err, rslt){
                        if(err) return git_cb(err);
                        funcs.deploy_log_info(deployment_id, 'Saving initial commit');
                        gitExec('git', ['commit','--allow-empty','-m','Initial commit'], function(err, rslt){
                          if(err) return git_cb(err);
                          return git_cb();
                        });
                      });
                    });
                  },

                  //Checking out target branch
                  function(git_cb){
                    funcs.deploy_log_info(deployment_id, 'Checking out git branch: '+git_branch);
                    gitExec('git', ['checkout','-f',git_branch], function(err, rslt){
                      return git_cb(err);
                    });
                  }

                ], cb);
              },

              //Clear output folder
              function (cb){
                //rmdirRecursive
                var isBasePath = false;
                HelperFS.funcRecursive(publish_path, function (filepath, relativepath, file_cb) { //filefunc
                  fs.unlink(filepath, file_cb);
                }, function (dirpath, relativepath, dir_cb) { //dirfunc
                  if(relativepath) HelperFS.rmdirRecursive(dirpath, dir_cb);
                  else return dir_cb();
                }, {
                  file_before_dir: true,
                  preview_dir: function(dirpath, relativepath, dir_cb){
                    if(relativepath=='.git') return dir_cb(false);
                    return dir_cb();
                  }
                }, cb);
              },

              //Copy static files to publish folder
              function (cb){
                if(!publish_params.copy_folders) return cb();
                async.eachSeries(publish_params.copy_folders, function(fpath, file_cb){
                  if(!path.isAbsolute(fpath)) fpath = path.join(jsh.Config.datadir, fpath);
                  fs.lstat(fpath, function(err, stats){
                    if(err) return file_cb(err);
                    if(!stats.isDirectory()) return file_cb(new Error('"copy_folder" parameter is not a folder: ' + fpath));
                    //Add copied files to "site_files" array
                    HelperFS.copyRecursive(fpath, publish_path,
                      {
                        forEachDir: function(dirpath, targetpath, relativepath, copy_cb){
                          if(relativepath=='.git') return cb(false);
                          return copy_cb(true);
                        },
                        forEachFile: function(filepath, targetpath, relativepath, copy_cb){
                          var fhash = crypto.createHash('md5');
                          HelperFS.copyFile(filepath, targetpath, copy_cb, {
                            onData: function(data) { fhash.update(data); },
                            onClose: function(){ branchData.site_files[HelperFS.convertWindowsToPosix(relativepath)] = { md5: fhash.digest('hex') }; },
                          });
                        },
                      },
                      file_cb
                    );
                  });
                }, cb);
              },

              //Copy site files to publish folder
              function (cb){
                var sitePath = path.join(path.join(jsh.Config.datadir,'site'),(branchData.site_id||'').toString());
                fs.lstat(sitePath, function(err, stats){
                  if(err){
                    if (HelperFS.fileNotFound(err)) return cb(); //Not found
                    return cb(err); //Other FS Error
                  }
                  HelperFS.copyRecursive(sitePath, publish_path,
                    {
                      forEachDir: function(dirpath, targetpath, relativepath, dir_cb){
                        if(relativepath=='.git') return dir_cb(false);
                        return dir_cb(true);
                      },
                      forEachFile: function(filepath, targetpath, relativepath, copy_cb){
                        var fhash = crypto.createHash('md5');
                        HelperFS.copyFile(filepath, targetpath, copy_cb, {
                          onData: function(data) { fhash.update(data); },
                          onClose: function(){ branchData.site_files[HelperFS.convertWindowsToPosix(relativepath)] = { md5: fhash.digest('hex') }; },
                        });
                      },
                    },
                    cb
                  );
                });
              },

              //Run onBeforeDeploy functions
              function(cb){
                async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, branch_item_cb){
                  if(!branch_item.deploy) return branch_item_cb();
                  Helper.execif(branch_item.deploy.onBeforeDeploy,
                    function(f){
                      branch_item.deploy.onBeforeDeploy(jsh, branchData, publish_params, f);
                    },
                    branch_item_cb
                  );
                }, cb);
              },

              //Load Custom Branch Data
              function (cb){
                if(!module.Config.onDeploy_LoadData) return cb();
                return module.Config.onDeploy_LoadData(jsh, branchData, publish_params, cb);
              },

              //Run onDeploy functions
              function(cb){
                var branchItemTypes = funcs.getDeploymentSortedBranchItemTypes();
                async.eachSeries(branchItemTypes, function(branch_item_type, branch_item_cb){
                  funcs.deploy_log_info(deployment_id, 'Generating: '+branch_item_type.toUpperCase()+' items');
                  var branch_item = cms.BranchItems[branch_item_type];
                  if(!branch_item.deploy) return branch_item_cb();
                  Helper.execif(branch_item.deploy.onDeploy,
                    function(f){
                      branch_item.deploy.onDeploy(jsh, branchData, publish_params, f);
                    },
                    branch_item_cb
                  );
                }, cb);
              },

              //Run onDeploy_PostBuild functions
              function(cb){
                funcs.deploy_log_info(deployment_id, 'Running post-build operations');

                //File system operations for PostBuild functions
                branchData.fsOps = funcs.deploy_getFS(branchData.site_files);

                //Run onDeploy_PostBuild operations
                var branchItemTypes = funcs.getDeploymentSortedBranchItemTypes();
                async.eachSeries(branchItemTypes, function(branch_item_type, branch_item_cb){
                  var branch_item = cms.BranchItems[branch_item_type];
                  if(!branch_item.deploy) return branch_item_cb();
                  Helper.execif(branch_item.deploy.onDeploy_PostBuild,
                    function(f){
                      branch_item.deploy.onDeploy_PostBuild(jsh, branchData, publish_params, f);
                    },
                    branch_item_cb
                  );
                }, function(err){
                  if(err) return cb(err);
                  Helper.execif(module.Config.onDeploy_PostBuild,
                    function(f){ module.Config.onDeploy_PostBuild(jsh, branchData, publish_params, f); },
                    function(err){
                      if(err) return cb(err);

                      //Save generated files to publish folder
                      async.waterfall([
                        //Perform file delete operations
                        function(file_cb){
                          async.eachOf(branchData.fsOps.deletedFilesUpper, function(fpath, fpathUpper, delete_cb){
                            if(!(fpath in branchData.site_files)) return delete_cb(new Error('Could not delete "' + fpath + '" - file not found in site_files'));
                            delete branchData.site_files[fpath];
                            fpath = path.join(publish_params.publish_path, fpath);
                            fs.unlink(fpath, delete_cb);
                          }, file_cb);
                        },
                
                        //Perform file add operations
                        function(file_cb){
                          async.eachOf(branchData.fsOps.addedFiles, function(fcontent, fpath, add_cb){
                            branchData.site_files[fpath] = {
                              md5: crypto.createHash('md5').update(fcontent).digest("hex")
                            };
                            fpath = path.join(publish_params.publish_path, fpath);
                          
                            HelperFS.createFolderRecursive(path.dirname(fpath), function(err){
                              if(err) return add_cb(err);
                              //Save redirect to publish folder
                              fs.writeFile(fpath, fcontent, 'utf8', add_cb);
                            });
                          }, file_cb);
                        },
                      ], cb);
                    }
                  );
                });
              },

              //Exec Pre-Deployment Shell Command
              function (cb) {
                if(!publish_params.exec_pre_deployment) return cb();
                funcs.deploy_log_info(deployment_id, 'Running pre-deployment task');
                funcs.deploy_log_info(deployment_id, publish_params.exec_pre_deployment.cmd + ' ' + (publish_params.exec_pre_deployment.params||[]).join(' '));
                shellExec(
                  publish_params.exec_pre_deployment.cmd,
                  publish_params.exec_pre_deployment.params, function(err, rslt){
                  if(err) return cb(err);
                  if(rslt) rslt = rslt.trim();
                  funcs.deploy_log_info(deployment_id, rslt);
                  return cb();
                });
              },

              //Save to Git
              function (cb) {
                if(!cms.Config.git || !cms.Config.git.enabled) return cb();

                async.waterfall([
                  //Adding / committing all files to git
                  function(git_cb){
                    gitExec('git', ['add','-A'], function(err, rslt){
                      if(err) return git_cb(err);
                      funcs.deploy_log_info(deployment_id, 'Saving deployment commit');
                        gitExec('git', ['commit','--allow-empty','-m','Deployment '+deployment.deployment_tag], function(err, rslt){
                          if(err) return git_cb(err);
                          gitExec('git', ['rev-parse','HEAD'], function(err, rslt){
                            if(err) return git_cb(err);
                            deployment_git_revision = (rslt||'').toString();
                            funcs.deploy_log_info(deployment_id, 'Revision: '+deployment_git_revision);
                            if(!deployment_git_revision) return git_cb(new Error('No git revision returned'));

                            var sql = "update "+(module.schema?module.schema+'.':'')+"deployment set deployment_git_revision=@deployment_git_revision where deployment_id=@deployment_id;";
                            var sql_ptypes = [dbtypes.BigInt, dbtypes.VarChar(1024)];
                            var sql_params = { deployment_id: deployment_id, deployment_git_revision: deployment_git_revision };
                            appsrv.ExecRecordset('deployment', sql, sql_ptypes, sql_params, function (err, rslt) {
                              if (err != null) { err.sql = sql; return git_cb(err); }
                              return git_cb(null);
                            });
                          });
                        });
                    });
                  }
                ], cb);
              },

              //Deploy to target
              function (cb) {
                var deploy_path = (deployment.deployment_target_publish_path||'').toString();

                if(!deploy_path){ return cb(); }
                else if(deploy_path.indexOf('file://')==0){
                  //File Deployment
                  return funcs.deploy_fs(deployment, publish_path, deploy_path.substr(7), branchData.site_files, cb);
                }
                else if(deploy_path.indexOf('s3://')==0){
                  //Amazon S3 Deployment
                  return funcs.deploy_s3(deployment, publish_path, deploy_path, branchData.site_files, cb);
                }
                else if((deploy_path.indexOf('ftps://')==0)||(deploy_path.indexOf('ftp://')==0)||(deploy_path.indexOf('sftp://')==0)) {
                  return funcs.deploy_ftp(deployment, publish_path, deploy_path, branchData.site_files, cb)
                }
                else return cb(new Error('Deployment Target path not supported'));
              },

              //Exec Post-Deployment Shell Command
              function (cb) {
                if(!publish_params.exec_post_deployment) return cb();
                funcs.deploy_log_info(deployment_id, 'Running post-deployment task');
                funcs.deploy_log_info(deployment_id, publish_params.exec_post_deployment.cmd + ' ' + (publish_params.exec_post_deployment.params||[]).join(' '));
                shellExec(
                  publish_params.exec_post_deployment.cmd,
                  publish_params.exec_post_deployment.params, function(err, rslt){
                  if(rslt) rslt = rslt.trim();
                  funcs.deploy_log_info(deployment_id, rslt);
                  if(err) return cb(err);
                  return cb();
                });
              },

              //Log success
              function (cb) {
                funcs.deploy_log_info(deployment_id, 'Deployment successful');
                return cb();
              }

            ], function (err, rslt) {
              if (err) return deploy_cb(err.toString() + '\n' + (err.stack?err.stack:(new Error()).stack));
              return deploy_cb();
            });
          }
        }
      ], function(err){
        var deployment_sts = 'COMPLETE';
        if(err){
          funcs.deploy_log_error(deployment_id, err);
          deployment_sts = 'FAILED';
        }
        funcs.deploy_waitForLog(deployment_id, function(){
          //In no_publish_complete debug mode, do not set finish the deployment
          if(module.Config.debug_params.no_publish_complete) return;
          //Otherwise, update deployment status
          var sql = "update "+(module.schema?module.schema+'.':'')+"deployment set deployment_sts=@deployment_sts where deployment_id=@deployment_id;";
          var sql_ptypes = [dbtypes.BigInt, dbtypes.VarChar(32)];
          var sql_params = { deployment_id: deployment_id, deployment_sts: deployment_sts };
          appsrv.ExecRecordset('deployment', sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err) { err.sql = sql; funcs.deploy_log_error(deployment_id, err); return onComplete(err); }
            return onComplete();
          });
        });
      });
    });
  }

  exports.deploy_getFS = function(site_files){
    var fsOps = {
      siteFiles: {},
      addedFiles: {},
      addedFilesUpper: {},
      deletedFilesUpper: {},
    }
    for(var fname in site_files) fsOps.siteFiles[fname.toUpperCase()] = fname;

    fsOps.getValidFilePath = function(filePath){
      filePath = (filePath||'').toString();
      if(!filePath.trim()) throw new Error('Invalid empty file path');
      if(filePath.indexOf('\\') >= 0) throw new Error('Character \\ is not allowed in file path: "' + filePath + '"');
      if(HelperFS.cleanPath(filePath) != filePath) throw new Error('Invalid characters in file path: "' + filePath + '"');
      if(filePath[0]=='/') throw new Error('File path cannot begin with / character: "' + filePath + '"');
      if((filePath.indexOf('/../')>0) || (filePath.indexOf('../')==0)) throw new Error('Directory tranversals not allowed in file path: "' + filePath + '"');
      if((filePath.indexOf('/./')>0) || (filePath.indexOf('./')==0)) throw new Error('Directory tranversals not allowed in file path: "' + filePath + '"');
      return filePath;
    }
    fsOps.hasFile = function(filePath){
      var filePathUpper = filePath.toUpperCase();
      if(filePathUpper in fsOps.addedFilesUpper) return true;
      else if(filePathUpper in fsOps.deletedFilesUpper) return false;
      else if(filePathUpper in fsOps.siteFiles) return true;
      else return false;
    };
    fsOps.addFile = function(filePath, fileContent){
      filePath = fsOps.getValidFilePath(filePath);
      if(!(filePath||'').toString().trim()) throw new Error('Cannot add "'+filePath+'" - invalid file name');
      if(fsOps.hasFile(filePath)) throw new Error('Cannot add file "' + filePath + '" - file already exists');
      fsOps.addedFiles[filePath] = fileContent||'';
      fsOps.addedFilesUpper[filePath.toUpperCase()] = filePath;
    };
    fsOps.deleteFile = function(filePath){
      if(!(filePath||'').toString().trim()) throw new Error('Cannot delete "'+filePath+'" - invalid file name');
      var filePathUpper = filePath.toUpperCase();
      if(filePathUpper in fsOps.addedFilesUpper){
        delete fsOps.addedFiles[fsOps.addedFilesUpper[filePathUpper]];
        delete fsOps.addedFilesUpper[filePathUpper];
      }
      else if(filePathUpper in fsOps.deletedFilesUpper) throw new Error('Cannot delete "'+filePath+'" - file already deleted');
      else if(filePathUpper in fsOps.siteFiles) fsOps.deletedFilesUpper[filePathUpper] = filePath;
      else throw new Error('Cannot delete "'+filePath+'" - file not found');
    };
    return fsOps;

  }

  exports.deploy_getSitemaps = function(jsh, branchData, publish_params, cb){
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    //Get all sitemaps
    var sql = 'select \
      s.sitemap_key,s.sitemap_file_id, s.sitemap_type \
      from '+(module.schema?module.schema+'.':'')+'sitemap s \
      inner join '+(module.schema?module.schema+'.':'')+'branch_sitemap bs on bs.sitemap_id = s.sitemap_id\
      inner join '+(module.schema?module.schema+'.':'')+'deployment d on d.branch_id = bs.branch_id and d.deployment_id=@deployment_id\
      where s.sitemap_file_id is not null'
      ;
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { deployment_id: publish_params.deployment_id };
    appsrv.ExecRecordset('deployment', sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; return cb(err); }
      if(!rslt || !rslt.length || !rslt[0]){ return cb(new Error('Error loading deployment sitemaps')); }
      _.each(rslt[0], function(sitemap){
        branchData.sitemaps[sitemap.sitemap_type] = sitemap;
      });
      async.eachOfSeries(branchData.sitemaps, function(sitemap, sitemap_type, sitemap_cb){
        funcs.getClientSitemap(sitemap, function(err, sitemap_content){
          if(err) return sitemap_cb(err);
          if(!sitemap_content) return sitemap_cb(null);
          sitemap.sitemap_items = sitemap_content.sitemap_items;
          return sitemap_cb();
        });
      }, cb);
    });
  }

  exports.deploy_getPages = function(jsh, branchData, publish_params, cb){
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    //Get list of all page_keys
    var sql = 'select \
      p.page_key,page_path \
      from '+(module.schema?module.schema+'.':'')+'page p \
      inner join '+(module.schema?module.schema+'.':'')+'branch_page bp on bp.page_id = p.page_id\
      inner join '+(module.schema?module.schema+'.':'')+'deployment d on d.branch_id = bp.branch_id and d.deployment_id=@deployment_id\
      where p.page_file_id is not null'
      ;
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { deployment_id: publish_params.deployment_id };
    appsrv.ExecRecordset('deployment', sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; return cb(err); }
      if(!rslt || !rslt.length || !rslt[0]){ return cb(new Error('Error loading deployment pages')); }
      _.each(rslt[0], function(page){

        var page_urlpath = '';
        var page_cmspath = '';
        try{
          var relativePath = funcs.getPageRelativePath(page, publish_params);
          if(!relativePath) return cb(new Error('Page has no path: '+page.page_key));
          page_cmspath = '/' + relativePath;
          page_urlpath = publish_params.content_url + relativePath;
        }
        catch(ex){ }

        if(page_urlpath){
          branchData.page_keys[page.page_key] = page_cmspath;
          branchData.page_redirects[page_cmspath] = page_urlpath;
          if(path.basename(page_cmspath)==publish_params.site_default_page_filename){
            var page_dir = ((page_cmspath=='/'+publish_params.site_default_page_filename) ? '/' : path.dirname(page_cmspath)+'/');
            branchData.page_redirects[page_dir] = page_urlpath;
            branchData.page_keys[page.page_key] = page_dir;
          }
          else if(path.basename(page_cmspath).indexOf('.')<0){
            if(page_cmspath[page_cmspath.length-1] != '/'){
              branchData.page_redirects[page_cmspath+'/'] = page_urlpath;
            }
          }
        }
      });
      return cb();
    });
  }

  exports.deploy_getMedia = function(jsh, branchData, publish_params, cb){
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    //Get list of all media_keys
    var sql = 'select \
      m.media_key,media_file_id,media_path \
      from '+(module.schema?module.schema+'.':'')+'media m \
      inner join '+(module.schema?module.schema+'.':'')+'branch_media bm on bm.media_id = m.media_id\
      inner join '+(module.schema?module.schema+'.':'')+'deployment d on d.branch_id = bm.branch_id and d.deployment_id=@deployment_id\
      where m.media_file_id is not null'
      ;
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { deployment_id: publish_params.deployment_id };
    appsrv.ExecRecordset('deployment', sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; return cb(err); }
      if(!rslt || !rslt.length || !rslt[0]){ return cb(new Error('Error loading deployment media')); }
      _.each(rslt[0], function(media){

        var media_urlpath = '';
        try{
          var relativePath = funcs.getMediaRelativePath(media, publish_params);
          if(!relativePath) return cb(new Error('Media has no path: '+media.media_key));
          media_urlpath = publish_params.content_url + relativePath;
        }
        catch(ex){ }

        if(media_urlpath) branchData.media_keys[media.media_key] = media_urlpath;
      });
      return cb();
    });
  }

  exports.deploy_page = function(jsh, branchData, publish_params, cb){
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    //Make sure inline components do not conflict with standard components
    for(var page_template_id in branchData.page_templates){
      var page_template = branchData.page_templates[page_template_id];
      if(page_template.components) for(var componentId in page_template.components){
        if(componentId in branchData.component_templates){ return cb(new Error('Page template "' + page_template.title + '" has an inline component "' + componentId + '" that is already defined as a site component.')); }
      }
    }

    //Get list of all pages
    //For each page
    //  Merge content with template
    //  Save template to file
    var sql = 'select \
      p.page_key,page_file_id,page_title,page_path,page_tags,page_author,page_template_id, \
      page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_review_sts,page_lang \
      from '+(module.schema?module.schema+'.':'')+'page p \
      inner join '+(module.schema?module.schema+'.':'')+'branch_page bp on bp.page_id = p.page_id\
      inner join '+(module.schema?module.schema+'.':'')+'deployment d on d.branch_id = bp.branch_id and d.deployment_id=@deployment_id\
      where p.page_file_id is not null'
      ;
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { deployment_id: publish_params.deployment_id };
    appsrv.ExecRecordset('deployment', sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; return cb(err); }
      if(!rslt || !rslt.length || !rslt[0]){ return cb(new Error('Error loading deployment pages')); }
      async.eachSeries(rslt[0], function(page, cb){
        funcs.getClientPage('deployment', page, branchData.sitemaps, branchData.site_id, { pageTemplates: branchData.page_templates }, function(err, clientPage){
          if(err) return cb(err);
          funcs.createSitemapTree(clientPage.sitemap, branchData);

          //Merge content with template
          var ejsparams = {
            page: {
              seo: {
                title: clientPage.page.seo.title||clientPage.page.title||'',
                keywords: clientPage.page.seo.keywords||'',
                metadesc: clientPage.page.seo.metadesc||'',
                canonical_url: clientPage.page.seo.canonical_url||'',
              },
              css: (clientPage.template.css||'')+(clientPage.template.css?' ':'')+(clientPage.page.css||''),
              js: (clientPage.template.js||'')+(clientPage.template.js?' ':'')+(clientPage.page.js||''),
              header: (clientPage.template.header||'')+(clientPage.template.header?' ':'')+(clientPage.page.header||''),
              content: clientPage.page.content||{},
              footer: (clientPage.template.footer||'')+(clientPage.page.footer||''),
              properties: _.extend({}, clientPage.template.default_properties, clientPage.page.properties),
              title: clientPage.page.title
            },
            _: _,
            Helper: Helper,
            renderComponent: function(id, renderOptions){
              if(!id) return '';
              var template = '';
              if(id in branchData.component_template_html) template = branchData.component_template_html[id];
              else if(clientPage.template.components && (id in clientPage.template.components)) template = clientPage.template.components[id].templates.editor;
              else return '<!-- Component '+Helper.escapeHTML(id)+' not found -->';
              
              renderOptions = _.extend({
                renderType: 'page',
                templateName: id,
                //menu_tag: '...',
                //data: {},
                //properties: {},
                pageComponents: clientPage.template.components
              }, renderOptions);

              var renderParams = {
                //Additional parameters for static render
                page: clientPage.page,
                template: clientPage.template,
                sitemap: clientPage.sitemap,
                getSitemapURL: function(sitemap_item){ return funcs.getSitemapUrl(sitemap_item, branchData); },
                menu: null,
                getMenuURL: function(menu_item){ return funcs.getMenuUrl(menu_item, branchData); },
              }
              if(renderOptions.menu_tag){
                if(!branchData.menus[renderOptions.menu_tag]) return '<!-- Menu '+Helper.escapeHTML(renderOptions.menu_tag)+' not found -->';
                renderParams.menu = branchData.menus[renderOptions.menu_tag];
                renderParams.menu.currentItem = null;
                _.each(renderParams.menu.items, function(menu_item){
                  menu_item.selected = ((menu_item.menu_item_link_type=='PAGE') && ((menu_item.menu_item_link_dest||'').toString() == page.page_key.toString()));
                  if(menu_item.selected) renderParams.menu.currentItem = menu_item;
                });
              }
              return funcs.renderComponent(template || '', branchData, renderOptions, renderParams);
            }
          };
          var page_content = '';
          if(page.page_template_id in branchData.page_template_html){
            page_content = branchData.page_template_html[page.page_template_id]||'';
            try{
              //Replace cms-component with data-component in clientPage.page.content
              for(var key in clientPage.page.content){
                clientPage.page.content[key] = funcs.replacePageComponentsWithContentComponents(clientPage.page.content[key], branchData, clientPage.template.components);
              }
              //Render page
              page_content = ejs.render(page_content, ejsparams);
            }
            catch(ex){
              var errmsg = 'Could not render page '+page.page_path+': '+ex.message;
              return cb(new Error(errmsg));
            }
            try{
              page_content = funcs.renderComponents(page_content, branchData, clientPage.template.components);
              page_content = funcs.applyRenderTags(page_content, { page: ejsparams.page });
              page_content = funcs.replaceBranchURLs(page_content, {
                getMediaURL: function(media_key){
                  if(!(media_key in branchData.media_keys)) throw new Error('Page '+page.page_path+' links to missing Media ID # '+media_key.toString());
                  return branchData.media_keys[media_key];
                },
                getPageURL: function(page_key){
                  if(!(page_key in branchData.page_keys)) throw new Error('Page '+page.page_path+' links to missing Page ID # '+page_key.toString());
                  return branchData.page_keys[page_key];
                },
                branchData: branchData,
                removeClass: true
              });
            }
            catch(ex){
              return cb(ex);
            }
          }
          else {
            //Raw Content
            page_content = ejsparams.page.content.body||'';
          }

          var page_fpath = '';
          try{
            page_fpath = funcs.getPageRelativePath(page, publish_params);
          }
          catch(ex){
            return cb(ex);
          }
          if(!page_fpath) return cb(new Error('Page has no path: '+page.page_key));

          branchData.site_files[page_fpath] = {
            md5: crypto.createHash('md5').update(page_content).digest("hex")
          };
          page_fpath = path.join(publish_params.publish_path, page_fpath);

          //Create folders for path
          HelperFS.createFolderRecursive(path.dirname(page_fpath), function(err){
            if(err) return cb(err);
            //Save page to publish folder
            fs.writeFile(page_fpath, page_content, 'utf8', cb);
          });
        });
      }, cb);
    });
  }

  exports.deploy_exportComponentRender = function(jsh, branchData, publish_params, template_name, exportItem, exportIndex){

    if(!(template_name in branchData.component_export_template_html) || !(exportIndex in branchData.component_export_template_html[template_name])){
      return '<!-- Export Component '+Helper.escapeHTML(template_name + ' - Export #' + (exportIndex+1))+' not found -->';
    }

    var renderOptions = {
      renderType: 'site',
      templateName: template_name,
    };
    _.each(['menu_tag','data','properties'], function(key){
      if(key in exportItem) renderOptions[key] = exportItem[key];
    });

    var renderParams = {
      //Additional parameters for static render
      sitemaps: branchData.sitemaps,
      sitemap: (branchData.sitemaps||{}).PRIMARY||{},
      getSitemapURL: function(sitemap_item){ return funcs.getSitemapUrl(sitemap_item, branchData); },
      menus: branchData.menus,
      menu: null,
      getMenuURL: function(menu_item){ return funcs.getMenuUrl(menu_item, branchData); },

      page_paths: branchData.page_redirects,
      site_redirects: branchData.site_redirects,

      branchData: branchData,
      publish_params: publish_params,

      addFile: branchData.fsOps.addFile,
      deleteFile: branchData.fsOps.deleteFile,
      hasFile: branchData.fsOps.hasFile,
    };
    
    if(renderOptions.menu_tag){
      if(!branchData.menus[renderOptions.menu_tag]) return '<!-- Menu '+Helper.escapeHTML(renderOptions.menu_tag)+' not found -->';
      renderParams.menu = branchData.menus[renderOptions.menu_tag];
      renderParams.menu.currentItem = null;
      _.each(renderParams.menu.items, function(menu_item){ menu_item.selected = false; });
    }

    var rslt = funcs.renderComponent(branchData.component_export_template_html[template_name][exportIndex] || '', null, renderOptions, renderParams);
    if(exportItem.export_path){
      branchData.fsOps.addFile(branchData.fsOps.getValidFilePath(exportItem.export_path), rslt);
    }
  }

  exports.deploy_exportComponents = function(jsh, branchData, publish_params, cb){
    //Get all components
    async.eachOfSeries(branchData.component_templates, function(template, template_name, generate_cb){
      async.eachOfSeries(template.export, function(exportItem, exportIndex, export_cb){

        try{
          funcs.deploy_exportComponentRender(jsh, branchData, publish_params, template_name, exportItem, exportIndex);
        }
        catch(ex){
          return export_cb('Error exporting component "'+template_name+'": '+ex.message);
        }

        return export_cb();
      }, generate_cb);
    }, cb);
  }

  exports.deploy_media = function(jsh, branchData, publish_params, cb){
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    //Get list of all media
    //For each media
    //  Save media to file
    var sql = 'select \
      m.media_key,media_file_id,media_path,media_ext \
      from '+(module.schema?module.schema+'.':'')+'media m \
      inner join '+(module.schema?module.schema+'.':'')+'branch_media bm on bm.media_id = m.media_id\
      inner join '+(module.schema?module.schema+'.':'')+'deployment d on d.branch_id = bm.branch_id and d.deployment_id=@deployment_id\
      where m.media_file_id is not null'
      ;
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { deployment_id: publish_params.deployment_id };
    appsrv.ExecRecordset('deployment', sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; return cb(err); }
      if(!rslt || !rslt.length || !rslt[0]){ return cb(new Error('Error loading deployment media')); }
      async.eachSeries(rslt[0], function(media, cb){
        var srcpath = funcs.getMediaFile(media.media_file_id, media.media_ext);
        fs.readFile(srcpath, null, function(err, media_content){
          if(err) return cb(err);

          var media_fpath = '';
          try{
            media_fpath = funcs.getMediaRelativePath(media, publish_params);
          }
          catch(ex){
            return cb(ex);
          }
          if(!media_fpath) return cb(new Error('Media has no path: '+media.media_key));

          branchData.site_files[media_fpath] = {
            md5: crypto.createHash('md5').update(media_content).digest("hex")
          };
          media_fpath = path.join(publish_params.publish_path, media_fpath);

          //Create folders for path
          HelperFS.createFolderRecursive(path.dirname(media_fpath), function(err){
            if(err) return cb(err);
            //Save media to publish folder
            HelperFS.copyFile(srcpath, media_fpath, cb);
          });
        });
      }, cb);
    });
  }

  exports.deploy_redirect = function(jsh, branchData, publish_params, cb){
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    //Get list of all redirects
    //Generate redirect file and save to disk
    var sql = 'select \
      r.redirect_key, r.redirect_url, r.redirect_url_type, r.redirect_dest, r.redirect_http_code \
      from '+(module.schema?module.schema+'.':'')+'redirect r \
      inner join '+(module.schema?module.schema+'.':'')+'branch_redirect br on br.redirect_id = r.redirect_id \
      inner join '+(module.schema?module.schema+'.':'')+'deployment d on d.branch_id = br.branch_id and d.deployment_id=@deployment_id \
      order by r.redirect_seq'
      ;
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { deployment_id: publish_params.deployment_id };
    appsrv.ExecRecordset('deployment', sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; return cb(err); }
      if(!rslt || !rslt.length || !rslt[0]){ return cb(new Error('Error loading deployment redirects')); }

      branchData.site_redirects = rslt[0];

      var redirect_files = {};
      async.waterfall([
        function(redirect_cb){
          if(_.isFunction(module.Config.onDeploy_GenerateRedirects)){
            module.Config.onDeploy_GenerateRedirects(jsh, branchData, publish_params, function(err, generated_redirect_files){
              if(err) return redirect_cb(err);
              redirect_files = generated_redirect_files||{};
              return redirect_cb();
            });
          }
          else return redirect_cb();
        }
      ], function(err){
        if(err) return cb(err);
        async.eachOfSeries(redirect_files, function(fcontent, fpath, redirect_cb){
          branchData.site_files[fpath] = {
            md5: crypto.createHash('md5').update(fcontent).digest("hex")
          };
          fpath = path.join(publish_params.publish_path, fpath);

          HelperFS.createFolderRecursive(path.dirname(fpath), function(err){
            if(err) return redirect_cb(err);
            //Save redirect to publish folder
            fs.writeFile(fpath, fcontent, 'utf8', redirect_cb);
          });
        }, cb);
      });
    });
  }

  exports.deploy_menu = function(jsh, branchData, publish_params, cb){
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    //Get all menus
    //Generate menu files and save to disk
    var sql = 'select \
      m.menu_key, m.menu_file_id, m.menu_name, m.menu_tag \
      from '+(module.schema?module.schema+'.':'')+'menu m \
      inner join '+(module.schema?module.schema+'.':'')+'branch_menu bm on bm.menu_id = m.menu_id \
      inner join '+(module.schema?module.schema+'.':'')+'deployment d on d.branch_id = bm.branch_id and d.deployment_id=@deployment_id'
      ;
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { deployment_id: publish_params.deployment_id };
    appsrv.ExecRecordset('deployment', sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; return cb(err); }
      if(!rslt || !rslt.length || !rslt[0]){ return cb(new Error('Error loading deployment menus')); }

      var menus = rslt[0];

      async.waterfall([
        //Get menus from disk and replace URLs
        function(menu_cb){
          async.eachSeries(menus, function(menu, menu_file_cb){
            funcs.getClientMenu(menu, function(err, menu_content){
              if(err) return menu_file_cb(err);

              menu.menu_items = menu_content.menu_items||[];

              //Generate tree
              funcs.createMenuTree(menu, branchData);

              return menu_file_cb();
            });
          }, function(err){
            if(err) return menu_cb(err);
            branchData.menus = {};
            _.each(menus, function(menu){
              if(!(menu.menu_tag in branchData.menus)) branchData.menus[menu.menu_tag] = menu;
            });
            return menu_cb();
          });
        },
      ], cb);
    });
  }

  exports.deploy_ignore_remote = function(publish_params, fpath){
    return false;
    /*
    if(!publish_params || !publish_params.ignore_remote) return false;
    var origpath = fpath;
    fpath = HelperFS.convertWindowsToPosix(fpath);
    while(fpath){
      for(var i=0;i<publish_params.ignore_remote.length;i++){
        var ignore_expr = publish_params.ignore_remote[i];
        if(!ignore_expr) continue;
        if(ignore_expr.regex){
        }
        else {
          if(ignore_expr == fpath) return true;
        }
      }
      fpath = path.dirname(fpath);
      if(fpath=='.') fpath = '';
      if(fpath=='..') fpath = '';
    }
    return true;
    */
  }

  exports.deploy_fs = function(deployment, publish_path, deploy_path, site_files, cb){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var deployment_id = deployment.deployment_id;

    //Get list of folders
    var folders = {};
    var normalized_files = {};
    for(var filename in site_files){
      normalized_files[path.normalize(filename)] = filename;
      var foldername = path.dirname(filename);
      if((foldername=='.')||(foldername=='..')) continue;
      while(!(foldername in folders)){
        foldername = path.normalize(foldername);
        folders[foldername] = true;
        foldername = path.dirname(foldername);
        if((foldername=='.')||(foldername=='..')) break;
      }
    }

    var found_files = {};
    var found_folders = {};

    async.waterfall([

      //Delete extra files / folders
      function(fs_cb){
        HelperFS.funcRecursive(deploy_path, function (filepath, relativepath, file_cb) { //filefunc
          var delfunc = function(){
            if(funcs.deploy_ignore_remote(deployment.publish_params, relativepath)) return file_cb();
            funcs.deploy_log_info(deployment_id, 'Deleting '+filepath);
            fs.unlink(filepath, file_cb);
          };
          //Always delete destination files
          if(relativepath in normalized_files){
            HelperFS.fileHash(filepath, 'md5', function(err, hash){
              if(err){ funcs.deploy_log_info(deployment_id, 'Error generating file hash for '+filepath+': '+err.toString()); return delfunc(); }
              if(hash != site_files[normalized_files[relativepath]].md5){
                return file_cb();
              }
              found_files[relativepath] = true;
              return file_cb();
            });
          }
          else delfunc();
        }, function (dirpath, relativepath, dir_cb) { //dirfunc
          if(!relativepath) return dir_cb();
          if(relativepath in folders){
            found_folders[relativepath] = true;
            return dir_cb();
          }
          else if(funcs.deploy_ignore_remote(deployment.publish_params, relativepath)){
            return dir_cb();
          }
          funcs.deploy_log_info(deployment_id, 'Deleting '+dirpath);
          HelperFS.rmdirRecursive(dirpath, dir_cb);
        }, {
          file_before_dir: true,
        }, fs_cb);
      },

      //Create new folder structure
      function(fs_cb){
        var foldernames = _.keys(folders);
        foldernames.sort();
        async.eachSeries(foldernames, function(foldername, folder_cb){
          if(foldername in found_folders) return folder_cb();
          funcs.deploy_log_info(deployment_id, 'Creating folder '+foldername);
          HelperFS.createFolderRecursive(path.join(deploy_path, foldername), folder_cb);
        }, fs_cb);
      },

      //Copy files
      function(fs_cb){
        async.eachOfSeries(normalized_files, function(val, fname, file_cb){
          if(fname in found_files) return file_cb();
          var srcpath = path.join(publish_path, fname);
          var dstpath = path.join(deploy_path, fname);
          funcs.deploy_log_info(deployment_id, 'Copying file '+dstpath);
          funcs.deploy_log_change(deployment_id, fname);
          HelperFS.copyFile(srcpath, dstpath, file_cb);
        }, fs_cb);
      }
    ], cb);
  }

  exports.deploy_ftp = function(deployment, publish_path, deploy_path, site_files, cb) {


    var local_manifest = undefined;
    var deployment_id = deployment.deployment_id;
    var file_cache_info_path = 'config/.cms_files';
    var remote_file_info_cache = undefined;
    var remote_files = undefined;
    var remote_path = '';
    var remote_host = '';
    var operations = undefined;

    /** @type {import('./_funcs.deploy.ftp').FtpClient} */
    var ftpClient = undefined;

    // Start deployment

    //Initialize FTP Client
    try {
      var parsed_url = urlparser.parse(deploy_path);
      var protocol = parsed_url.protocol.replace(/:$/, '') // Trim the trailing ":", if exists
      remote_path = parsed_url.path;

      // remote_host is used for reporting. remote_hostname is used for connecting.
      // remote_host includes port, remote_hostname does not.
      remote_host = parsed_url.host; 
      var remote_hostname = parsed_url.hostname;
      var port =  (parsed_url.port != undefined) ? parseInt(parsed_url.port) : undefined;

      // split at _FIRST_ ":" (username cannot contain ":", but password may)
      var username = undefined;
      var password = undefined;
      var split_index = parsed_url.auth.indexOf(':');
      if(split_index >= 0){
        username = parsed_url.auth.slice(0, split_index);
        password = parsed_url.auth.slice(split_index + 1);
      }
      else {
        username = parsed_url.auth;
      }
      
      /** @type {import('./_funcs.deploy.ftp').ConnectionParams} */
      var connectionParams = {
        host: remote_hostname,
        username,
        password,
        port,
      }

      ftpClient = new funcs.ftpClient(protocol, connectionParams, deployment.publish_params.ftp_config, function(msg){ funcs.deploy_log_info(deployment_id, msg); });

    } catch (error) {
      cb(error);
      return;
    }

    var remote_host_desc = protocol+'://'+remote_host+(port?':'+port:'');

    funcs.deploy_log_info(deployment_id, 'Connecting to '+remote_host_desc);

    //Open connection
    ftpClient.connect()

    //Create Remote Root Directory If Not Exists
    .then(function() {

      // Need to build the tree so we
      // can handle nested paths.
      var child_path = remote_path;
      var paths = [];
      while (child_path !== '/') {
        paths.unshift(child_path);
        child_path = path.dirname(child_path);
      }

      if (paths.length < 1) return Promise.resolve();

      funcs.deploy_log_info(deployment_id, `Verifying remote publish directory exists: ${remote_host_desc}${remote_path}`);
      return ftpClient.createDirectoriesIfNotExists(paths);
    })

    //Build Local Manifests
    .then(function() {
      funcs.deploy_log_info(deployment_id, `Building local manifest`);
      return ftpClient.createLocalManifest(publish_path, site_files).then(function(manifest){ return local_manifest = manifest; });
    })

    //Load Remote File Listing
    .then(function() {
      funcs.deploy_log_info(deployment_id, 'Retrieving file listing: '+remote_host_desc+remote_path);
      var numPaths = 0;
      return ftpClient.getDirectoryListRecursive(remote_path, remote_path, function(p){
        numPaths++;
        if((numPaths % 50)==0) funcs.deploy_log_info(deployment_id, 'Retrieving file listing #'+numPaths+': '+remote_host_desc+p);
      })
      .then(function(files){
        return remote_files = files || [];
      });
    })

    //Load Remote File Index Cache
    .then(function() {
      var cacheFound = false;
      var cachePath = remote_path + '/' + file_cache_info_path;
      _.each(remote_files, function(remote_file){
        if(remote_file.path == file_cache_info_path) cacheFound = true;
      });
      if(!cacheFound) return;
      funcs.deploy_log_info(deployment_id, 'Retrieving CMS file index: '+remote_host_desc+cachePath);
      return ftpClient.readFile(cachePath)
        .then(function(file_info_cache){
          remote_file_info_cache = file_info_cache ?  JSON.parse(file_info_cache) : undefined;
        });
    })

    //Display statistics
    .then(function(){
      var ignore_files = {
        [file_cache_info_path]: {},
        [path.dirname(file_cache_info_path)]: {}
      };

      operations = ftpClient.getOperations(
        deployment,
        local_manifest,
        remote_file_info_cache,
        remote_files,
        ignore_files
      );

      if(operations.matching_file_count) funcs.deploy_log_info(deployment_id, 'Unchanged files: '+operations.matching_file_count);
      if(operations.missing_file_in_remote_count) funcs.deploy_log_info(deployment_id, 'New files: '+operations.missing_file_in_remote_count);
      if(operations.modified_file_count) funcs.deploy_log_info(deployment_id, 'Modified files: '+operations.modified_file_count);
      if(operations.missing_file_in_local_count) funcs.deploy_log_info(deployment_id, ((deployment.publish_params.ftp_config && deployment.publish_params.ftp_config.delete_excess_files)?'Deleting: ':'Ignoring: ')+operations.missing_file_in_local_count+' excess files.');
      if(operations.missing_folder_in_local_count) funcs.deploy_log_info(deployment_id, ((deployment.publish_params.ftp_config && deployment.publish_params.ftp_config.delete_excess_files)?'Deleting: ':'Ignoring: ')+operations.missing_folder_in_local_count+' excess directories.');
    })

    //Delete excess remote files
    .then(function() {

      if (operations.files_to_delete.length < 1) return Promise.resolve();

      var current_index = 1;
      var total = operations.files_to_delete.length;
      var files_to_delete = operations.files_to_delete.map(function(p){ return path.join(remote_path, p).replace(/\\/g,  '/'); });

      funcs.deploy_log_info(deployment_id, `Deleting ${total} remote files from ${remote_host_desc}${remote_path}`);
      return ftpClient.deleteFiles(files_to_delete, function(p){
        funcs.deploy_log_info(deployment_id, `(${current_index++}/${total}) Deleting ${remote_host_desc + p}`);
      });
    })

    //Delete excess remote folders
    .then(function() {

      if (operations.folders_to_delete.length < 1) return Promise.resolve();

      var current_index = 1;
      var total = operations.folders_to_delete.length
      var folders_to_delete = operations.folders_to_delete.map(function(p){ return path.join(remote_path, p).replace(/\\/g,  '/') });

        funcs.deploy_log_info(deployment_id, `Deleting ${total} remote directories from ${remote_host_desc}`);
        return ftpClient.deleteDirectoriesRecursive(folders_to_delete, function(p){
          funcs.deploy_log_info(deployment_id, `(${current_index++}/${total}) Deleting ${remote_host_desc + p}`);
        });
    })

    //Create new remote folders
    .then(function() {

      if (operations.folders_to_create.length < 1) return Promise.resolve();

      var current_index = 1;
      var total = operations.folders_to_create.length;

      var dirs = operations.folders_to_create.map(function(p){ return path.join(remote_path, p).replace(/\\/g,  '/'); });
      return ftpClient.createDirectoriesIfNotExists(dirs, function(p){
        funcs.deploy_log_info(deployment_id, `(${current_index++}/${total}) Creating directory: ${remote_host_desc + p}`);
      });
    })

    //Upload files to remote
    .then(function() {
      var files_to_upload = [];
      var path_mapper = function(rel_path){
        return {
          local_path: path.join(publish_path, rel_path),
          dest_path: path.join(remote_path, rel_path).replace(/\\/g, '/')
        }
      };

      operations.files_to_upload.forEach(function(p){ files_to_upload.push(path_mapper(p)) });

      var current_index = 1;
      var total = files_to_upload.length;

      if (total < 1) return Promise.resolve();

      return ftpClient.writeFiles(files_to_upload, function(p){
        funcs.deploy_log_info(deployment_id, `(${current_index++}/${total}) Uploading file: ${remote_host_desc + p}`);
      });
    })

    //Upload File Index Cache to remote
    .then(function() {

      var file_info = {
        files: {}
      };

      local_manifest.file_index.forEach(function(info, file){
        file_info.files[file] = info;
      });

      var file_info_string = JSON.stringify(file_info, null, 2);
      var upload_path = path.join(remote_path, file_cache_info_path).replace(/\\/g, '/');

      funcs.deploy_log_info(deployment_id, `Updating CMS file index: ${remote_host_desc}${upload_path}`);

      return ftpClient.createDirectoriesIfNotExists([path.dirname(upload_path)]).then(function(){
        return ftpClient.writeString(file_info_string, upload_path);
      });
    })

    //Handle Errors
    .catch(function(err){ return err; })
    .then(function(err){
      ftpClient.end();
      cb(err);
    });
  }

  exports.deploy_s3 = function(deployment, publish_path, deploy_path, site_files, cb){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var cms = module;
    var deployment_id = deployment.deployment_id;

    var s3url = urlparser.parse(deploy_path);
    var AWS = Helper.requireAnywhere(baseModule, 'aws-sdk');
    if(!AWS){
      return cb(new Error('"aws-sdk" module is required for AWS S3 publish. Use `npm i aws-sdk` to install.'));
    }
    var s3 = new AWS.S3({
      accessKeyId: deployment.publish_params.s3_config.accessKeyId,
      secretAccessKey: deployment.publish_params.s3_config.secretAccessKey,
    });
    var bucket = s3url.hostname;
    var bucket_prefix = (s3url.path||'/').substr(1);
    if(bucket_prefix){
      if(!bucket_prefix || (bucket_prefix[bucket_prefix.length-1]!='/')) bucket_prefix += '/';
    }

    var s3_files = {};
    var s3_upload = [];
    var s3_delete = [];

    async.waterfall([
      //Get list of all files
      function(s3_cb){
        var list_complete = false;
        var next_token = undefined;
        funcs.deploy_log_info(deployment_id, 'Getting files from '+deploy_path);
        async.until(function(){ return list_complete; }, function(list_cb){
          s3.listObjectsV2({ Bucket: bucket, Prefix: bucket_prefix, ContinuationToken: next_token }, function(err, rslt) {
            if(err) return list_cb(err);
            _.each(rslt.Contents, function(file){
              var fname = file.Key.substr(bucket_prefix.length);
              if(fname.substr(0,1)=='/') fname = fname.substr(1);
              if(fname) s3_files[fname] = file;
            });
            list_complete = !rslt.IsTruncated;
            next_token = rslt.NextContinuationToken;
            return list_cb();
          });
        }, s3_cb);
      },

      //Decide which files need to be uploaded or deleted
      function(s3_cb){
        for(var fname in s3_files){
          if(fname in site_files){
            var site_md5 = site_files[fname].md5;
            var s3_md5 = s3_files[fname].ETag.replace(/"/g,'');
            if(site_md5 != s3_md5) s3_upload.push(fname);
          }
          else {
            s3_delete.push(fname);
          }
        }
        for(var fname in site_files){
          if(!(fname in s3_files)) s3_upload.push(fname);
        }
        if(!s3_delete.length && !s3_upload.length) funcs.deploy_log_info(deployment_id, 'No changes required');
        return s3_cb();
      },

      //Upload new files to S3
      function(s3_cb){
        async.eachSeries(s3_upload, function(page_path, page_cb){
          var page_bpath = bucket_prefix + page_path;
          var page_fpath = path.join(publish_path, page_path);
          var fstream = fs.createReadStream(page_fpath);
          funcs.deploy_log_info(deployment_id, 'Uploading: '+page_path);
          funcs.deploy_log_change(deployment_id, page_path);
          var uploadParams = {
            Bucket: bucket,
            Key: page_bpath,
            Body: fstream,
            ACL: 'public-read'
          };
          var contentType = HelperFS.getMimeType(page_bpath);
          if(contentType) uploadParams.ContentType = contentType;
          s3.upload(uploadParams, function(err, data){
            if(err) return page_cb(err);
            return page_cb();
          });
        }, s3_cb);
      },

      //Delete removed files from S3
      function(s3_cb){
        async.eachSeries(s3_delete, function(page_path, page_cb){
          var page_bpath = bucket_prefix + page_path;
          funcs.deploy_log_info(deployment_id, 'Deleting: '+page_path);
          s3.deleteObject({ Bucket: bucket, Key: page_bpath }, function(err, data){
            if(err) return page_cb(err);
            return page_cb();
          });
        }, s3_cb);
      }

    ], cb);
  }

  exports.deployment_log = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};

    var Q = req.query;
    var P = {};
    if (req.body && ('data' in req.body)){
      try{ P = JSON.parse(req.body.data); }
      catch(ex){ Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
    }
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Publish_Log');

    var deployment_id = req.params.deployment_id;
    if(!deployment_id) return next();
    if(deployment_id.toString() != parseInt(deployment_id).toString()) return Helper.GenError(req, res, -4, 'Invalid Parameters');

    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    var sql = "select deployment_id, deployment_sts, branch_id, (select code_txt from "+(module.schema?module.schema+'.':'')+"code_deployment_sts where code_deployment_sts.code_val = deployment.deployment_sts) deployment_sts_txt, deployment_date from "+(module.schema?module.schema+'.':'')+"deployment where deployment_id=@deployment_id";
    appsrv.ExecRow(req._DBContext, sql, [dbtypes.BigInt], { deployment_id: deployment_id }, function (err, rslt) {
      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
      if(!rslt || !rslt[0]) return Helper.GenError(req, res, -99999, 'Invalid Deployment ID');
      var deployment = rslt[0];

      funcs.validateBranchAccess(req, res, deployment.branch_id, 'R%', ['PUBLISHER','WEBMASTER'], function(){
        if (verb == 'get') {
          var logfile = funcs.deployment_getLogFileName(deployment_id);
          var log = '';

          fs.exists(logfile, function(exists){
            Helper.execif(exists,
              function(f){
                fs.readFile(logfile, 'utf8', function(err, data){
                  if(err) return f();
                  log = data;
                  return f();
                });
              },
              function(){
                res.end(JSON.stringify({ '_success': 1, deployment: deployment, log: log }));
              }
            );
          });
          return;
        }
        return next();
      });
    });
  }

  exports.deployment_change_log = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};

    var Q = req.query;
    var P = {};
    if (req.body && ('data' in req.body)){
      try{ P = JSON.parse(req.body.data); }
      catch(ex){ Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
    }
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Publish_Changed_Files');

    var deployment_id = req.params.deployment_id;
    if(!deployment_id) return next();
    if(deployment_id.toString() != parseInt(deployment_id).toString()) return Helper.GenError(req, res, -4, 'Invalid Parameters');

    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    var sql = "select deployment_id, deployment_sts, (select code_txt from "+(module.schema?module.schema+'.':'')+"code_deployment_sts where code_deployment_sts.code_val = deployment.deployment_sts) deployment_sts_txt, deployment_date from "+(module.schema?module.schema+'.':'')+"deployment where deployment_id=@deployment_id";
    appsrv.ExecRow(req._DBContext, sql, [dbtypes.BigInt], { deployment_id: deployment_id }, function (err, rslt) {
      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
      if(!rslt || !rslt[0]) return Helper.GenError(req, res, -99999, 'Invalid Deployment ID');
      var deployment = rslt[0];

      if (verb == 'get') {
        var logfile = funcs.deployment_getChangeFileName(deployment_id);
        var log = '';

        fs.exists(logfile, function(exists){
          Helper.execif(exists,
            function(f){
              fs.readFile(logfile, 'utf8', function(err, data){
                if(err) return f();
                log = data;
                return f();
              });
            },
            function(){
              res.end(JSON.stringify({ '_success': 1, deployment: deployment, log: log }));
            }
          );
        });
        return;
      }
      return next();
    });
  }

  return exports;
};
