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

module.exports = exports = function(module, funcs){
  var exports = {};

  funcs.deploymentQueue = async.queue(function (deployment_id, done){
    funcs.deploy_exec(deployment_id, done);
  }, 1);

  exports.deploy_req = function (req, res, next) {
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

    var model = jsh.getModel(req, module.namespace + 'Publish_Add');

    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    var sql = "select \
      (param_cur_val from jsharmony.v_param_cur where param_cur_process='CMS' and param_cur_attrib='PUBLISH_TGT') publish_path,\
      (param_cur_val from jsharmony.v_param_cur where param_cur_process='CMS' and param_cur_attrib='DEFAULT_PAGE') default_page,\
      (select deployment_id from "+(module.schema?module.schema+'.':'')+"deployment where deployment_sts='PENDING' and deployment_date <= %%%%%%jsh.map.timestamp%%%%%% order by deployment_date asc) deployment_id";
    appsrv.ExecRow(req._DBContext, sql, [], {}, function (err, rslt) {
      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
      var publish_tgt = '';
      var default_page = '';
      if(rslt && rslt[0]){
        publish_tgt = rslt[0].publish_path;
        default_page = rslt[0].default_page;
      }
      if(!publish_tgt) { Helper.GenError(req, res, -9, 'Publish Target parameter is not defined'); return; }
      var publish_path = path.isAbsolute(publish_tgt) ? publish_tgt : path.join(jsh.Config.datadir,publish_tgt);
      publish_path = path.normalize(publish_path);

      if (verb == 'get') {
        res.end(JSON.stringify({ '_success': 1, publish_path: publish_path, default_page: default_page }));
        return;
      }
      else if (verb == 'post') {
        if(rslt && rslt[0] && rslt[0].deployment_id){
          funcs.deploy(rslt[0].deployment_id, function(){
            res.end(JSON.stringify({ '_success': 1, publish_path: publish_path, default_page: default_page }));
          });
        }
        else return Helper.GenError(req, res, -9, 'No scheduled deployments');
        return;
      }
      return next();
    });
  }

  exports.deployment_getLogFileName = function (deployment_id) {
    return path.join(module.jsh.Config.datadir, 'publish_log', deployment_id + '.log');
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
    if(is_folder) page_fpath += publish_params.default_page;
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

  exports.getMenuRelativePath = function(menu, content_element_name, publish_params){
    var cms = module;
    var menu_fpath = menu.menu_path||'';
    if(!menu_fpath) return '';
    while(menu_fpath.substr(0,1)=='/') menu_fpath = menu_fpath.substr(1);

    var menuTemplate = cms.MenuTemplates[menu.menu_template_id];
    if(!menuTemplate) throw new Error('Menu template '+menu.menu_template_id+' not defined');
    if(!menuTemplate.content_elements[content_element_name]) throw new Error('Menu content element '+content_element_name+' not defined for menu ' + menu.menu_template_id);
    var content_element_filename = menuTemplate.content_elements[content_element_name].filename || '';

    var num_content_elements = 0;
    for(var key in menuTemplate.content_elements){
      if(menuTemplate.content_elements[key].filename) num_content_elements++;
    }

    var multiple_content_elements = (num_content_elements > 1);
    var is_folder = (menu_fpath[menu_fpath.length-1]=='/');

    if(multiple_content_elements && !is_folder) throw new Error('Menu '+menu.menu_tag+' contains multiple content elements and requires menu_path to be a folder (ending in "/")');

    if(is_folder) menu_fpath += content_element_filename;
    if(menu_fpath[menu_fpath.length-1]=='/') throw new Error('Final menu path:'+menu.menu_path+' must be a file, not a folder');

    if(path.isAbsolute(menu_fpath)) throw new Error('Menu path:'+menu.menu_path+' cannot be absolute');
    if(menu_fpath.indexOf('..') >= 0) throw new Error('Menu path:'+menu.menu_path+' cannot contain directory traversals');
    if(publish_params) menu_fpath = publish_params.menu_subfolder + menu_fpath;
    return menu_fpath;
  }

  exports.downloadRemoteTemplates = function(branchData, templates, template_html, options, download_cb){
    options = _.extend({ templateType: 'PAGE' }, options);

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
            url = funcs.parseDeploymentUrl(template.remote_templates.publish, branchData.publish_params);
            isPublishTemplate = true;
          }
          else if(template.remote_templates.editor){
            url = funcs.parseDeploymentUrl(template.remote_templates.editor, branchData.publish_params);
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
              if(options.templateType == 'PAGE') templateConfig = funcs.readPageTemplateConfig(templateContent, 'Remote Page Template: '+url);
              else if(options.templateType == 'COMPONENT') templateConfig = funcs.readComponentTemplateConfig(templateContent, 'Remote Component Template: '+url);
              else throw new Error('Invalid Template Type: ' + options.templateType);
            }
            catch(ex){
              return template_action_cb(ex);
            }
            if(templateConfig && templateConfig.remote_templates && templateConfig.remote_templates.publish){
              templateConfig.remote_templates.publish = funcs.parseDeploymentUrl(templateConfig.remote_templates.publish, branchData.publish_params, url);
            }
            _.merge(template, templateConfig);
            
            if(isPublishTemplate){
              template_html[template_name] = templateContent;
            }
            else if(!template.remote_templates.publish){
              try{
                if(options.templateType == 'PAGE') templateContent = funcs.generateDeploymentTemplate(templateContent);
              }
              catch(ex){
                return template_action_cb(new Error('Error parsing "'+template_name+'" '+options.templateType.toLowerCase()+' template: '+ex.toString()));
              }
              template_html[template_name] = templateContent;
            }
            return template_action_cb();
          });
        },
      ], template_cb);

    }, download_cb);
  }

  exports.downloadLocalTemplates = function(branchData, templates, template_html, options, download_cb){
    options = _.extend({ templateType: 'PAGE' }, options);

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
              if(options.templateType == 'PAGE') templateConfig = funcs.readPageTemplateConfig(templateContent, 'Local Page Template: '+template.path);
              else if(options.templateType == 'COMPONENT') templateConfig = funcs.readComponentTemplateConfig(templateContent, 'Local Component Template: '+template.path);
              else throw new Error('Invalid Template Type: ' + options.templateType);
            }
            catch(ex){
              return template_action_cb(ex);
            }

            async.waterfall([
              //Check publish template
              function(template_process_cb){
                if(templateConfig && templateConfig.remote_templates && templateConfig.remote_templates.publish){
                  if(templateConfig.remote_templates.publish.indexOf('//') < 0){
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
                    return;
                  }
                  else {
                    //If path is remote
                    templateConfig.remote_templates.publish = funcs.parseDeploymentUrl(templateConfig.remote_templates.publish, branchData.publish_params, url);
                  }
                }
                return template_process_cb();
              },
              //If no publish template, add to template_html
              function(template_process_cb){
                //Components already merged the config and post-processed it in getComponentTemplates
                if(options.templateType != 'COMPONENT') _.merge(template, templateConfig);

                if(!(template.remote_templates && template.remote_templates.publish)){
                  try{
                    if(options.templateType == 'PAGE') templateContent = funcs.generateDeploymentTemplate(templateContent);
                  }
                  catch(ex){
                    return template_action_cb(new Error('Error parsing "'+template_name+'" '+options.templateType.toLowerCase()+' template: '+ex.toString()));
                  }
                  template_html[template_name] = templateContent;
                }
                return template_process_cb();
              }
            ], template_action_cb);
          });
        },
      ], template_cb);

    }, download_cb);
  }

  exports.downloadTemplates = function(branchData, templates, template_html, options, download_cb){
    options = _.extend({ content_element_templates: false }, options);
    async.eachOf(templates, function(template, template_name, template_cb){

      async.waterfall([

        //Download template.remote_templates.publish (for page, component)
        function(template_action_cb){
          if(template_name in template_html) return template_action_cb(); //Already downloaded
          if(!template.remote_templates || !template.remote_templates.publish) return template_action_cb();

          var url = funcs.parseDeploymentUrl(template.remote_templates.publish, branchData.publish_params);
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

        //Download template.content_elements[].remote_templates.publish (for menu)
        function(template_action_cb){
          if(template_name in template_html) return template_action_cb(); //Already downloaded
          if(!options.content_element_templates) return template_action_cb();
          if(!(template_html[template_name])) template_html[template_name] = {};

          async.eachOfSeries(template.content_elements, function(content_element, content_element_name, content_element_cb){
            template_html[template_name][content_element_name] = '';
            if('template' in content_element) template_html[template_name][content_element_name] += content_element.templates.publish || '';

            if(!content_element || !content_element.remote_templates || !content_element.remote_templates.publish) return content_element_cb();

            var url = funcs.parseDeploymentUrl(content_element.remote_templates.publish, branchData.publish_params);
            funcs.deploy_log_info(branchData.publish_params.deployment_id, 'Downloading template: '+url);
            wc.req(url, 'GET', {}, {}, undefined, function(err, res, rslt){
              if(err) return content_element_cb(err);
              if(res && res.statusCode){
                if(res.statusCode > 500) return content_element_cb(new Error(res.statusCode+' Error downloading template '+url));
                if(res.statusCode > 400) return content_element_cb(new Error(res.statusCode+' Error downloading template '+url));
              }
              template_html[template_name][content_element_name] += rslt;
              return content_element_cb();
            });
          }, template_action_cb);
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
      ], template_cb);

    }, download_cb);
  }

  exports.deploy_exec = function (deployment_id, onComplete) {
    if(!onComplete) onComplete = function(){};
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var cms = jsh.Modules['jsHarmonyCMS'];

    //Update deployment to running status
    var sql = "select \
        deployment_id, site_id, deployment_tag, deployment_target_name, deployment_target_publish_path, deployment_target_params, deployment_target_sts, deployment_git_revision, \
        d.deployment_target_id, \
        (select param_cur_val from jsharmony.v_param_cur where param_cur_process='CMS' and param_cur_attrib='PUBLISH_TGT') publish_tgt, \
        (select param_cur_val from jsharmony.v_param_cur where param_cur_process='CMS' and param_cur_attrib='DEFAULT_PAGE') default_page \
        from "+(module.schema?module.schema+'.':'')+"deployment d \
        inner join "+(module.schema?module.schema+'.':'')+"deployment_target dt on d.deployment_target_id = dt.deployment_target_id \
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
          var default_page = deployment.default_page;

          var publish_params = {
            timestamp: (Date.now()).toString(),
          };
          try{
            if(deployment.deployment_target_params) publish_params = _.extend(publish_params, JSON.parse(deployment.deployment_target_params));
          }
          catch(ex){
            return deploy_cb('Publish Target has invalid deployment_target_params: '+deployment.deployment_target_params);
          }
          publish_params = _.extend({}, cms.Config.deployment_target_params, publish_params);
          publish_params.default_page = default_page;
          publish_params.publish_path = publish_path;
          publish_params.deployment_id = deployment_id;
          publish_params.deployment_target_id = deployment.deployment_target_id;
          deployment.publish_params = publish_params;

          var branchData = {
            publish_params: publish_params,
            deployment: deployment,
            site_id: deployment.site_id,
            site_files: {},

            page_keys: {},
            page_templates: null,
            page_template_html: {},
            page_redirects: {},

            component_templates: null,
            component_template_html: {},

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

          var farr = [];

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
                          //Set git user
                          funcs.deploy_log_info(deployment_id, 'Setting git user');
                          gitExec('git', ['config','user.name','CMS'], function(err, rslt){
                            if(err) return git_cb(err);
                            return git_cb();
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
                    HelperFS.copyRecursive(fpath, publish_path,
                      {
                        forEachDir: function(dirpath, targetpath, relativepath, cb){
                          if(relativepath=='.git') return cb(false);
                          return cb(true);
                        }
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
                      }
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
                var branchItemTypes = _.keys(cms.BranchItems);
                branchItemTypes.sort(function(a,b){
                  var aseq = (cms.BranchItems[a] && cms.BranchItems[a].deploy && cms.BranchItems[a].deploy.onDeploy_seq) || 0;
                  var bseq = (cms.BranchItems[b] && cms.BranchItems[b].deploy && cms.BranchItems[b].deploy.onDeploy_seq) || 0;
                  if(aseq > bseq) return 1;
                  if(bseq > aseq) return -1;
                  return 0;
                });
                async.eachSeries(branchItemTypes, function(branch_item_type, branch_item_cb){
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
          if(path.basename(page_cmspath)==publish_params.default_page){
            var page_dir = ((page_cmspath=='/'+publish_params.default_page) ? '/' : path.dirname(page_cmspath)+'/');
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
            renderMenu: function(menu_tag, content_element_name){
              if(!menu_tag) return '';
              if(!branchData.menus[menu_tag]) return '<!-- Menu '+Helper.escapeHTML(menu_tag)+' not found -->';
              var menu = branchData.menus[menu_tag];
              if(!content_element_name){
                for(var key in menu){ content_element_name = key; break; }
              }
              if(!(content_element_name in menu)) return '<!-- Menu Content Element '+Helper.escapeHTML(content_element_name)+' not found -->';
              return menu[content_element_name]||'';
            },
            renderComponent: function(id){
              if(!id) return '';
              if(!(id in branchData.component_template_html)) return '<!-- Component '+Helper.escapeHTML(id)+' not found -->';
              var rslt = ejs.render(branchData.component_template_html[id] || '', {
                baseUrl: '',
                data: { items: [], item: {} },
                properties: {},
                renderType: 'static',
                _: _,
                escapeHTML: Helper.escapeHTML,
                stripTags: Helper.StripTags,
                isInEditor: false,
                isInPageEditor: false,
                isInComponentEditor: false,
                items: [],
                item: {},
                component: {},
                data_errors: [],
                renderPlaceholder: function(){ return ''; },
                //Additional parameters for static render
                page: clientPage.page,
                template: clientPage.template,
                sitemap: clientPage.sitemap,
                getSitemapURL: function(sitemap_item){
                  if((sitemap_item.sitemap_item_link_type||'').toString()=='PAGE'){
                    var page_key = parseInt(sitemap_item.sitemap_item_link_dest);
                    if(!(page_key in branchData.page_keys)){ funcs.deploy_log_info(publish_params.deployment_id, 'Sitemap item  '+sitemap_item.sitemap_item_path+' :: '+sitemap_item.sitemap_item_text+' links to missing Page ID # '+page_key.toString()); return '#'; }
                    return branchData.page_keys[page_key];
                  }
                  else if((sitemap_item.sitemap_item_link_type||'').toString()=='MEDIA'){
                    var media_key = parseInt(sitemap_item.sitemap_item_link_dest);
                    if(!(media_key in branchData.media_keys)){ funcs.deploy_log_info(publish_params.deployment_id, 'Sitemap item '+sitemap_item.sitemap_item_path+' :: '+sitemap_item.sitemap_item_text+' links to missing Media ID # '+media_key.toString()); return '#'; }
                    return branchData.media_keys[media_key];
                  }
                  return sitemap_item.sitemap_item_link_dest;
                },
              });
              return rslt;
            }
          };
          var page_content = '';
          if(page.page_template_id in branchData.page_template_html){
            page_content = branchData.page_template_html[page.page_template_id]||'';
            page_content = ejs.render(page_content, ejsparams);
            try{
              page_content = funcs.replaceComponents(page_content, { components: branchData.component_template_html });
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

      var redirect_files = {};
      async.waterfall([
        function(redirect_cb){
          if(_.isFunction(publish_params.generate_redirect_files)){
            publish_params.generate_redirect_files(jsh, branchData.deployment, rslt[0], branchData.page_redirects, function(err, generated_redirect_files){
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
      m.menu_key, m.menu_file_id, m.menu_name, m.menu_tag, m.menu_template_id, m.menu_path \
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

      var menu_output_files = {};
      async.waterfall([
        //Get menus from disk and replace URLs
        function(menu_cb){
          async.eachSeries(menus, function(menu, menu_file_cb){
            funcs.getClientMenu(menu, { target: 'publish' }, function(err, menu_content){
              if(err) return menu_file_cb(err);

              //Replace URLs
              menu.menu_items = menu_content.menu_items||[];
              for(var i=0;i<menu.menu_items.length;i++){
                var menu_item = menu.menu_items[i];
                if((menu_item.menu_item_link_type||'').toString()=='PAGE'){
                  var page_key = parseInt(menu_item.menu_item_link_dest);
                  if(!(page_key in branchData.page_keys)) return menu_file_cb(new Error('Menu  '+menu.menu_tag+' links to missing Page ID # '+page_key.toString()));
                  menu_item.menu_item_link_dest = branchData.page_keys[page_key];
                }
                else if((menu_item.menu_item_link_type||'').toString()=='MEDIA'){
                  var media_key = parseInt(menu_item.menu_item_link_dest);
                  if(!(media_key in branchData.media_keys)) return menu_file_cb(new Error('Menu '+menu.menu_tag+' links to missing Media ID # '+media_key.toString()));
                  menu_item.menu_item_link_dest = branchData.media_keys[media_key];
                }
              }

              //Generate tree
              menu.menu_item_tree = funcs.createMenuTree(menu.menu_items);
              menu.template = menu_content.template;

              return menu_file_cb();
            });
          }, menu_cb);
        },

        //Generate menus
        function(menu_cb){
          if(_.isFunction(publish_params.generate_menu_files)){
            publish_params.generate_menu_files(jsh, branchData.deployment, menus, function(err, generated_menu_files){
              if(err) return menu_cb(err);
              menu_output_files = generated_menu_files||{};
              return menu_cb();
            });
          }
          else{
            async.eachSeries(menus, function(menu, menu_file_cb){
              branchData.menus[menu.menu_tag] = {};
              async.eachOfSeries(menu.template.content_elements, function(content_element, content_element_name, content_element_cb){
                //Merge content with template
                var ejsparams = {
                  menu: menu,
                  _: _,
                  escapeHTML: Helper.escapeHTML,
                  stripTags: Helper.StripTags,
                  isInEditor: false,
                };
                var menu_content = '';
                if(menu.menu_template_id in branchData.menu_template_html){
                  if(content_element_name in branchData.menu_template_html[menu.menu_template_id]){
                    menu_content = branchData.menu_template_html[menu.menu_template_id][content_element_name]||'';
                    menu_content = ejs.render(menu_content, ejsparams);
                  }
                  else {
                    menu_content = 'Error: Menu content element '+content_element_name+' not found';
                  }
                }
                else {
                  menu_content = 'Error: Menu template '+menu.menu_template_id+' not found';
                }

                var menu_fpath = '';
                try{
                  menu_fpath = funcs.getMenuRelativePath(menu, content_element_name, publish_params);
                }
                catch(ex){
                  return cb(ex);
                }
                if(!menu_fpath) return cb(new Error('Menu has no path: '+menu.menu_key));
                menu_output_files[menu_fpath] = menu_content;
                branchData.menus[menu.menu_tag][content_element_name] = menu_content;
                return content_element_cb();
              }, menu_file_cb);
            }, menu_cb);
          }
        }
      ], function(err){
        if(err) return cb(err);
        async.eachOfSeries(menu_output_files, function(fcontent, fpath, menu_cb){
          branchData.site_files[fpath] = {
            md5: crypto.createHash('md5').update(fcontent).digest("hex")
          };
          fpath = path.join(publish_params.publish_path, fpath);

          HelperFS.createFolderRecursive(path.dirname(fpath), function(err){
            if(err) return menu_cb(err);
            //Save menu to publish folder
            fs.writeFile(fpath, fcontent, 'utf8', menu_cb);
          });
        }, cb);
      });
    });
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
          HelperFS.copyFile(srcpath, dstpath, file_cb);
        }, fs_cb);
      }
    ], cb);
  }

  exports.deploy_s3 = function(deployment, publish_path, deploy_path, site_files, cb){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var cms = jsh.Modules['jsHarmonyCMS'];
    var deployment_id = deployment.deployment_id;

    var s3url = urlparser.parse(deploy_path);
    var AWS = require('aws-sdk');
    var s3 = new AWS.S3(cms.Config.aws_key);
    var bucket = s3url.hostname;
    var bucket_prefix = s3url.path.substr(1);
    if(!bucket_prefix || (bucket_prefix[bucket_prefix.length-1]!='/')) bucket_prefix += '/';

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
          s3.upload({ Bucket: bucket, Key: page_bpath, Body: fstream }, function(err, data){
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

    var sql = "select deployment_id, deployment_sts, (select code_txt from "+(module.schema?module.schema+'.':'')+"code_deployment_sts where code_deployment_sts.code_val = deployment.deployment_sts) deployment_sts_txt, deployment_date from "+(module.schema?module.schema+'.':'')+"deployment where deployment_id=@deployment_id";
    appsrv.ExecRow(req._DBContext, sql, [dbtypes.BigInt], { deployment_id: deployment_id }, function (err, rslt) {
      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
      if(!rslt || !rslt[0]) return Helper.GenError(req, res, -99999, 'Invalid Deployment ID');
      var deployment = rslt[0];

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
  }

  return exports;
};
