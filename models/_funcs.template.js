/*
Copyright 2021 apHarmony

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
var jshParser = require('jsharmony/lib/JSParser.js');
var _ = require('lodash');
var async = require('async');
var path = require('path');
var fs = require('fs');
var urlparser = require('url');
var cheerio = require('cheerio');
var parse5 = require('parse5');

module.exports = exports = function(module, funcs){
  var exports = {};

  exports.readPageTemplateConfig = function(templateContent, desc, options){
    var templateParts = funcs.parseConfig(templateContent, 'jsharmony-cms-page-config', desc, options);
    return templateParts.config;
  }
  
  exports.readComponentTemplateConfig = function(templateContent, desc, options){
    var templateParts = funcs.parseConfig(templateContent, 'jsharmony-cms-component-config', desc, options);
    return templateParts.config;
  }

  exports.parseComponentTemplateConfigExtensions = function(config){
    if(!config) return;
    if(!config.properties) config.properties = {};
    if(!config.data) config.data = {};

    //Apply config.component_properties
    if(config.component_properties){
      if(!_.isArray(config.component_properties)) throw new Error('Component config.component_properties must be an array');
      config.properties.fields = (config.properties.fields||[]);
      if(!_.isArray(config.properties.fields)) throw new Error('Component config.properties.fields must be an array');
      config.properties.fields = config.properties.fields.concat(config.component_properties);
      delete config.component_properties;
    }

    //Apply config.item_properties
    if(config.item_properties){
      if(!_.isArray(config.item_properties)) throw new Error('Component config.item_properties must be an array');
      config.data.fields = (config.data.fields||[]);
      if(!_.isArray(config.data.fields)) throw new Error('Component config.data.fields must be an array');
      config.data.fields = config.data.fields.concat(config.item_properties);
      delete config.item_properties;
    }

    //Apply config.type
    if('multiple_items' in config){
      if(config.multiple_items){
        if(!config.data.layout) config.data.layout = 'grid_preview';
      }
      else if(!config.multiple_items){
        if(!config.data.layout) config.data.layout = 'form';
      }
      else throw new Error('Unrecognized Component config.type: '+config.type.toString());
    }
    else {
      config.multiple_items = (config.data && ((config.data.layout == 'grid_preview') || (config.data.layout == 'grid'))) ? true : false;
    }

    //Add config.editor_placeholder
    config.editor_placeholder = config.editor_placeholder || {};
    if(!('items_empty' in config.editor_placeholder)) config.editor_placeholder.items_empty = true;
    if(!('invalid_fields' in config.editor_placeholder)) config.editor_placeholder.invalid_fields = true;
    
    //Apply config.caption
    if(!('caption' in config)){
      config.caption = [config.title, config.title];
    }

    //Generate component class
    if(!('className' in config)){
      config.className = Helper.escapeCSSClass(config.id, { nodash: true });
    }

    //Set default target to "content"
    if(!('target' in config)) config.target = 'content';

    //Set default icon
    if((config.target == 'content') && !('icon' in config)){
      config.icon = 'material:layers';
    }

    if(!_.includes(['content', 'page', 'site'], config.target)) throw new Error('Invalid config.target - must be either "content", "page", or "site"');

    //Set default field.control and field.type for htmleditor
    _.each(config.data.fields, function(field){
      if(!field) return;
      if(field.control == 'htmleditor'){
        field.control = 'hidden';
        field.type = field.type || 'varchar';
      }
    });
  }

  exports.parseConfig = function(content, configType, desc, options){
    options = _.extend({ continueOnConfigError: false }, options);
    var rslt = {
      config: {},
      content: content,
    };
    var htdoc = null;
    try{
      var htdoc = new funcs.HTMLDoc(content, { extractEJS: true });
      htdoc.applyNodes([
        { //Apply properties
          pred: function(node){ return htdoc.isTag(node, 'script') && htdoc.hasAttr(node, 'type', 'text/'+configType); },
          exec: function(node){
            var configScript = htdoc.getNodeContent(node);
            htdoc.removeNode(node);
            var config = {};
            try{
              config = jshParser.ParseJSON(configScript, desc, { trimErrors: true });
            }
            catch(ex){
              if(options.continueOnConfigError) module.jsh.Log.info('Error parsing ' + configType + ' script tag in ' + desc + ': ' + ex.toString());
              else throw ex;
            }
            _.extend(rslt.config, config);
          }
        },
      ]);
    }
    catch(ex){
      if(!options.continueOnConfigError) throw ex;
    }
    if(htdoc){
      htdoc.restoreEJS();
      rslt.content = htdoc.content;
    }
    return rslt;
  }

  exports.templates_menus = function(req, res, next){
    var verb = req.method.toLowerCase();

    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var XValidate = jsh.XValidate;
    var cms = module;

    if(!req.params || !req.params.branch_id) return next();
    var branch_id = req.params.branch_id;

    var referer = req.get('Referer');
    if(referer){
      var urlparts = urlparser.parse(referer, true);
      var remote_domain = urlparts.protocol + '//' + (urlparts.auth?urlparts.auth+'@':'') + urlparts.hostname + (urlparts.port?':'+urlparts.port:'');
      res.setHeader('Access-Control-Allow-Origin', remote_domain);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Origin,X-Requested-With, Content-Type, Accept');
      res.setHeader('Access-Control-Allow-Credentials', true);
    }

    var model = jsh.getModel(req, module.namespace + 'Page_Editor');
    if (!Helper.hasModelAction(req, model, 'BU')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    //Get page
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { 'branch_id': branch_id };
    var validate = new XValidate();
    var verrors = {};
    validate.AddValidator('_obj.branch_id', 'Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);

    var deployment_target_params = '';

    if (verb == 'get'){

      var menuTemplates = {};

      async.waterfall([

        //Check if branch exists
        function(cb){
          var sql = "select branch_desc from "+(module.schema?module.schema+'.':'')+"v_my_branch_desc where branch_id=@branch_id";
          appsrv.ExecScalar(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(!rslt || !rslt[0]){ return Helper.GenError(req, res, -4, 'No access to this branch'); }
            return cb();
          });
        },

        //Get deployment_target_params for branch
        function(cb){
          var sql = "select deployment_target_params from "+(module.schema?module.schema+'.':'')+"v_my_branch_desc left outer join "+(module.schema?module.schema+'.':'')+"v_my_site on v_my_site.site_id = v_my_branch_desc.site_id where branch_id=@branch_id";
          appsrv.ExecScalar(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]) deployment_target_params = rslt[0];
            return cb();
          });
        },

        //Generate menu templates
        function(cb){
          var publish_params = {
            timestamp: (Date.now()).toString()
          };
          try{
            if(deployment_target_params) publish_params = _.extend(publish_params, JSON.parse(deployment_target_params));
          }
          catch(ex){
            return cb('Publish Target has invalid deployment_target_params: '+deployment.deployment_target_params);
          }
          publish_params = _.extend({}, cms.Config.deployment_target_params, publish_params);

          //Parse menu templates
          for(var tmplname in module.MenuTemplates){
            var tmpl = module.MenuTemplates[tmplname];
            var front_tmpl = {
              title: tmpl.title,
              content_elements: {},
            };

            for(var key in tmpl.content_elements){
              var content_element = tmpl.content_elements[key];
              front_tmpl.content_elements[key] = {};
              var rslt_content_element = front_tmpl.content_elements[key];
              if('template' in content_element) rslt_content_element.template = content_element.template['editor'] || '';
              if('remote_templates' in content_element) rslt_content_element.remote_templates = content_element.remote_templates['editor'] || '';

              //Resolve Remote Templates
              if(rslt_content_element.remote_templates){
                rslt_content_element.remote_templates = funcs.parseDeploymentUrl(rslt_content_element.remote_templates, publish_params);
              }
            }
            menuTemplates[tmplname] = front_tmpl;
          }

          return cb();
        },
      ], function(err){
        if(err) { Helper.GenError(req, res, -99999, err.toString()); return; }

        res.end(JSON.stringify({
          '_success': 1,
          'menuTemplates': menuTemplates
        }));
      });
    }
    else return next();
  }

  exports.getPageTemplate = function(dbcontext, site_id, template_id, options, callback){
    funcs.getPageTemplates(dbcontext, site_id, _.extend({ target_template_id: template_id }, options), function(err, pageTemplates){
      if(err) return callback(err);
      return callback(null, pageTemplates[template_id]);
    });
  }

  exports.getPageTemplates = function(dbcontext, site_id, options, callback){
    var cms = module;

    options = _.extend({
      site_template_type: 'PAGE',
      template_folder: 'pages',
      system_templates: cms.SystemPageTemplates,
      script_config_type: 'jsharmony-cms-page-config',
    }, options);

    funcs.getSiteTemplates(dbcontext, site_id, options, function(err, rsltTemplates){
      if(err) return callback(err);

      for(var key in rsltTemplates){
        var template = rsltTemplates[key];
        var newTemplate = {
          title: template.site_template_title,
          raw: false,
          location: template.site_template_location,
          path: template.site_template_path,
        };
        if(template.site_template_location == 'REMOTE'){
          if(template.site_template_path){
            newTemplate.remote_templates = {
              editor: template.site_template_path
            };
          }
        }
        if(template.site_template_config){
          var templateConfig = {};
          if(_.isString(template.site_template_config)){
            try{
              templateConfig = JSON.parse(template.site_template_config);
            }
            catch(ex){
            }
          }
          else{
            templateConfig = template.site_template_config;
          }
          _.merge(newTemplate, templateConfig);
        }
        if(!newTemplate.content_elements && (template.site_template_location != 'REMOTE')) newTemplate.content_elements = { body: { type: 'htmleditor', title: 'Body' } };
        if(!newTemplate.content) newTemplate.content = {};
        if(!('title' in newTemplate)) newTemplate.title = key;
        rsltTemplates[key] = newTemplate;
      }

      return callback(null, rsltTemplates);
    });
  }

  exports.getComponentTemplates = function(dbcontext, site_id, options, callback){
    var cms = module;

    options = _.extend({
      site_template_type: 'COMPONENT',
      template_folder: 'components',
      system_templates: cms.SystemComponentTemplates,
      script_config_type: 'jsharmony-cms-component-config',
      withContent: false,
      includeLocalPath: false,
      recursive: true,
    }, options);

    var componentTemplates = [];
    async.waterfall([

      //Get template definitions
      function(cb){
        funcs.getSiteTemplates(dbcontext, site_id, options, function(err, _componentTemplates){
          if(err) return cb(err);
          componentTemplates = _componentTemplates;

          for(var key in componentTemplates){
            var template = componentTemplates[key];
            var newTemplate = {
              id: template.site_template_name,
              title: template.site_template_title,
              location: template.site_template_location,
              templates: {},
              properties: {},
              data: {},
            };
            if(options.withContent){
              if(typeof template.site_template_content != 'undefined'){
                newTemplate.templates.editor = template.site_template_content;
              }
            }
            if(options.includeLocalPath) newTemplate.path = template.site_template_path;
            if(template.site_template_location == 'REMOTE'){
              if(template.site_template_path){
                newTemplate.remote_templates = {
                  editor: template.site_template_path
                };
              }
            }
            if(template.site_template_config){
              var templateConfig = {};
              if(_.isString(template.site_template_config)){
                try{
                  templateConfig = JSON.parse(template.site_template_config);
                }
                catch(ex){
                }
              }
              else{
                templateConfig = template.site_template_config;
              }
              delete templateConfig.id;
              _.merge(newTemplate, templateConfig);
            }
            if(!('title' in newTemplate)) newTemplate.title = key;
            componentTemplates[key] = newTemplate;
          }
          
          return cb();
        });
      },
    ], function(err){
      if(err) return callback(err);
      return callback(null, componentTemplates);
    });
  }

  exports.getSiteTemplates = function(dbcontext, site_id, options, callback){
    options = _.extend({
      target_template_id: null, //Optional - target only one template
      site_template_type: null, //Required
      template_folder: null, //Required
      system_templates: null, //Required
      script_config_type: null, //Required
      continueOnConfigError: false,
      withContent: false,
      recursive: false,
    }, options);
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var cms = module;

    var rsltTemplates = {
      //id = {
      //  title: '...',
      //  raw: true,
      //  location: '...',  LOCAL,SYSTEM,REMOTE
      //  path: '...',
      //}
    };
    var systemTemplates = [];
    var localTemplates = [];
    var remoteTemplates = [];
    
    return async.parallel([
      function(data_cb){
        if(!site_id) return data_cb();
        var sitePath = path.join(path.join(jsh.Config.datadir,'site'),site_id.toString());
        var normalizedSitePath = path.normalize(sitePath);
        var templatePath = path.join(sitePath, 'templates', options.template_folder);
        var publishTemplatePaths = [];
  
        //Get all local site templates from site\#\templates\[options.template_folder]
        fs.exists(templatePath, function (exists) {
          if (!exists) return data_cb(null);
          
          var files = [];
          HelperFS.funcRecursive(templatePath,
            function(filepath, filerelativepath, file_cb){
              files.push({ filepath: filepath, filerelativepath: HelperFS.convertWindowsToPosix(filerelativepath) });
              return file_cb();
            },
            function(dirpath, dirrelativepath, cb){
              if(!dirrelativepath) return cb();
              if(options.recursive) return cb();
              return cb(false); //Non-recursive
            },
            null,
            function(err){
              if(err) return data_cb(err);

              async.each(files, function(fileinfo, file_cb){
                var file = fileinfo.filerelativepath;
                var ext = path.extname(file);
                if((ext=='.htm') || (ext=='.html')){
                  var templateName = file.substr(0, file.length - ext.length);

                  //Do not read / parse template if it does not match target_template_id
                  //Also helps to isolate options.continueOnConfigError to target template
                  if(options.target_template_id && (templateName != options.target_template_id)) return file_cb();
                  
                  var filepath = path.normalize(fileinfo.filepath);
                  fs.readFile(filepath, 'utf8', function(err, templateContent){
                    if(err) return file_cb(err);
    
                    //Read Template Config
                    var templateParts = null;
                    try{
                      templateParts = funcs.parseConfig(templateContent, options.script_config_type, 'Local ' + options.site_template_type.toLowerCase() + ' template: ' + file, { continueOnConfigError: options.continueOnConfigError });
                    }
                    catch(ex){
                      return file_cb(ex);
                    }
                    var templateConfig = templateParts.config;
    
                    var templateTitle = templateConfig.title || templateName;
                    var localTemplate = {
                      site_template_type: options.site_template_type,
                      site_template_name: templateName,
                      site_template_title: templateTitle,
                      site_template_path: '/templates/'+options.template_folder+'/' + file,
                      site_template_config: templateConfig,
                      site_template_location: 'LOCAL',
                    };
                    if(options.withContent) localTemplate.site_template_content = templateContent;
                    localTemplates.push(localTemplate);
                    if(templateConfig && templateConfig.remote_templates && templateConfig.remote_templates.publish){
                      var publishTemplatePath = templateConfig.remote_templates.publish;
                      if(publishTemplatePath.indexOf('//') < 0){
                        publishTemplatePath = path.normalize(path.join(path.dirname(filepath), publishTemplatePath));
                        if(publishTemplatePath.indexOf(normalizedSitePath+path.sep) == 0){
                          publishTemplatePaths.push({
                            path: HelperFS.convertWindowsToPosix(publishTemplatePath.substr(normalizedSitePath.length)),
                            source: localTemplate.site_template_path,
                          });
                        }
                        //Do not allow an editor template to reference itself as a publish template
                        if(publishTemplatePath == filepath) return file_cb(new Error('Error processing local template ' + localTemplate.site_template_path + ': An Editor template cannot target itself as the Publish template.  Remove the remote_templates.publish property to auto-generate a publish template based on the current editor template.'));
                      }
                    }
                    return file_cb();
                  });
                }
                else file_cb();
              }, function(err){
                if(err) return data_cb(err);
                //Go through each publish template
                for(var i=0;i<publishTemplatePaths.length;i++){
                  //Find publish template
                  for(var j=0;j<localTemplates.length;j++){
                    if(publishTemplatePaths[i].path == localTemplates[j].site_template_path){
                      var publishTemplate = localTemplates[j];
                      //Remove Publish Templates
                      localTemplates.splice(j, 1);
                      j--;
                      //Do not allow publish templates to have a templateConfig
                      if(!_.isEmpty(publishTemplate.site_template_config)){
                        return data_cb(new Error('Error processing publish template ' + publishTemplate.site_template_path + ': Publish templates cannot contain a "' + options.script_config_type + '" script tag.  This template is used as a publish template by '+publishTemplatePaths[i].source+' via the remote_templates.publish property.\r\n\r\nPlease make sure not to use Editor templates as Publish templates.  Remove the remote_templates.publish property from the Editor template to auto-generate a Publish template based on the current editor template.'));
                      }
                    }
                  }
                }
                return data_cb();
              });
            }
          );
        });
      },
  
      //Add local system template
      function(data_cb){
        for(var key in options.system_templates){
          if(options.target_template_id && (key != options.target_template_id)) continue;

          var systemTemplate = JSON.parse(JSON.stringify(options.system_templates[key]));
          var templatePath = ' ';
          if(systemTemplate.remote_templates){
            templatePath = systemTemplate.remote_templates.editor || ' ';
          }
          systemTemplates.push({
            site_template_type: options.site_template_type,
            site_template_name: key,
            site_template_title: systemTemplate.title,
            site_template_path: templatePath,
            site_template_config: systemTemplate,
            site_template_location: 'SYSTEM',
          });
        }
        return data_cb();
      },
  
      //Generate SQL
      function(data_cb){      
        //Remote Templates
        var sql = "select site_template_id,site_id,site_template_type,site_template_name,site_template_title,site_template_path,site_template_config from "+(cms.schema?cms.schema+'.':'')+"site_template where site_template_type=@site_template_type and site_id=@site_id";
        appsrv.ExecRecordset(dbcontext, sql, [dbtypes.BigInt, dbtypes.VarChar(32)], { site_id: site_id, site_template_type: options.site_template_type }, function (err, rslt) {
          if(err) return data_cb(err);
          if(!rslt || !rslt.length || !rslt[0]){ return data_cb(new Error('Error loading remote '+options.site_template_type.toLowerCase()+' templates')); }
          _.each(rslt[0], function(row){
            if(options.target_template_id && (row.site_template_name != options.target_template_id)) return;
            remoteTemplates.push({
              site_template_type: options.site_template_type,
              site_template_name: row.site_template_name,
              site_template_title: row.site_template_title,
              site_template_path: row.site_template_path,
              site_template_config: row.site_template_config,
              site_template_location: 'REMOTE',
            });
          });
          return data_cb();
        });
      },
    ], function(err){
      if(err) return callback(err);

      //Combine all templates into one array
      _.each(remoteTemplates, function(template){ if(!(template.site_template_name in rsltTemplates)) rsltTemplates[template.site_template_name] = template; });
      _.each(localTemplates, function(template){ if(!(template.site_template_name in rsltTemplates)) rsltTemplates[template.site_template_name] = template; });
      _.each(systemTemplates, function(template){ if(!(template.site_template_name in rsltTemplates)) rsltTemplates[template.site_template_name] = template; });

      if(options.withContent){
        _.each(rsltTemplates, function(template){
          if(!('site_template_content' in template)) template.site_template_content = undefined;
        });
      }

      return callback(null, rsltTemplates);
    });
  }

  exports.getCurrentPageTemplatesLOV = function(dbcontext, values, options, cb){
    options = _.extend({ blank:false }, options);
    var site_id = null;
    for(var i=0;i<values.length;i++){
      if(values[i].code_txt=='site_id') site_id = parseInt(values[i].code_val);
      if(values[i].code_val){
        values.splice(i, 1);
        i--;
      }
    }
    if(!site_id) return;

    funcs.getPageTemplates(dbcontext, site_id, { continueOnConfigError: true }, function(err, pageTemplates){
      if(err) return cb(err);
      if(!pageTemplates) return cb(new Error('Error loading page templates'));
      
      var rsltlov = [];
      if(options.blank) rsltlov.push({ code_val: '', code_txt: '(None)' });
      for(var key in pageTemplates){
        rsltlov.push({ code_val: key, code_txt: (pageTemplates[key].title||key||'').toString() });
      }
      //Sort by name
      rsltlov = rsltlov.sort(function(a,b){
        var ua = a.code_txt.toUpperCase();
        var ub = b.code_txt.toUpperCase();
        if(ua > ub) return 1;
        if(ua < ub) return -1;
        return 0;
      });
      return cb(null, rsltlov);
    });
    return false;
  }

  exports.HTMLDoc = function(_content, options){
    options = _.extend({
      extractEJS: false,
      noDuplicateAttributes: false,
    }, options);

    var _this = this;
    this.content = _content;
    this.offsets = []; //{ start, length }
    this.removed = []; //{ start, end }
    this.ejsScripts = [];
    this.nodes = [];

    this.extractEJS = function(){
      var str = _this.content;
      var startIdx = str.indexOf('<%');
      while(startIdx >= 0){
        var endIdx = str.indexOf('%>', startIdx + 2);
        var nextStartIdx = str.indexOf('<%', startIdx + 2);
        if((endIdx < 0) || ((nextStartIdx >= 0) && (nextStartIdx < endIdx))) throw new Error('EJS missing closing "%>" tag at Line '+(_this.content.substr(0, startIdx).split('\n').length));
        endIdx += 2;
        //Extract string
        _this.ejsScripts.push({
          start: startIdx,
          end: endIdx,
          content: str.substr(startIdx, endIdx - startIdx),
        });
        //Replace with spaces
        str = str.substr(0, startIdx) + Helper.pad('', ' ', endIdx - startIdx) + str.substr(endIdx);
        startIdx = nextStartIdx;
      }
      _this.content = str;
    }

    this.restoreEJS = function(){
      for(var i=0;i<_this.ejsScripts.length;i++){
        var ejsScript = _this.ejsScripts[i];
        var startIdx = _this.offsetIndex(ejsScript.start);
        var endIdx = startIdx + ejsScript.content.length;
        //Check if script was removed
        var skip = false;
        for(var j=0;j<_this.removed.length;j++){
          var removed = _this.removed[j];
          if((removed.end - removed.start) <= 0) continue;
          if((removed.start < ejsScript.end) && (removed.end > ejsScript.start)){
            skip = true;
            break;
          }
        }
        //Part of script was removed
        if(skip) continue;
        //Add script back
        _this.content = _this.content.substr(0, startIdx) + ejsScript.content + _this.content.substr(endIdx);
      }
      _this.ejsScripts = [];
    }

    this.spliceContent = function(startIndex, endIndex, newContent){
      newContent = newContent || '';
      _this.content = _this.content.substr(0, startIndex) + newContent + _this.content.substr(endIndex);
      _this.offsets.push({ start: startIndex, length: (newContent.length + (startIndex - endIndex)) });
      if(endIndex > startIndex) _this.removed.push({ start: startIndex, end: endIndex });
    }

    this.offsetIndex = function(index, from){
      if(!from) from = 0;
      for(var i=from;i<_this.offsets.length;i++){
        if(index >= _this.offsets[i].start){
          index += _this.offsets[i].length;
        }
      }
      return index;
    }

    this.insertHtml = function(position, newContent){
      newContent = newContent || '';
      var startIndex = _this.offsetIndex(position);
      
      _this.content = _this.content.substr(0, startIndex) + newContent + _this.content.substr(startIndex);
      _this.offsets.push({ start: startIndex, length: (newContent.length) });
    }

    this.removeNode = function(node, desc){
      if(node.removed) return;
      var nodeInfo = node.sourceCodeLocation;
      if(!nodeInfo) throw new Error('Error processing template: '+desc+' node missing sourceCodeLocation');
      var startIndex = _this.offsetIndex(nodeInfo.startOffset, nodeInfo.offsetFrom);
      var endIndex = _this.offsetIndex(nodeInfo.endOffset, nodeInfo.offsetFrom);
      _this.content = _this.content.substr(0, startIndex) + _this.content.substr(endIndex);
      _this.offsets.push({ start: startIndex, length: (startIndex - endIndex) });
      if(!nodeInfo.offsetFrom) _this.removed.push({ start: nodeInfo.startOffset, end: nodeInfo.endOffset });
      node.removed = true;
    }

    this.getNodeContent = function(node, desc){
      if(node.removed) return;
      var nodeInfo = node.sourceCodeLocation;
      if(!nodeInfo) throw new Error('Error processing template: '+desc+' node missing sourceCodeLocation');
      if(!nodeInfo.startTag) return '';
      if(!nodeInfo.endTag) return '';
      var startIndex = _this.offsetIndex(nodeInfo.startTag.endOffset, nodeInfo.startTag.offsetFrom);
      var endIndex = _this.offsetIndex(nodeInfo.endTag.startOffset, nodeInfo.startTag.offsetFrom);
      
      return _this.content.substr(startIndex, endIndex - startIndex);
    }

    this.getNodeHtml = function(node, desc){
      if(node.removed) return;
      var nodeInfo = node.sourceCodeLocation;
      if(!nodeInfo) throw new Error('Error processing template: '+desc+' node missing sourceCodeLocation');
      var startIndex = 0;
      var endIndex = 0;
      if(nodeInfo.startTag && nodeInfo.endTag){
        startIndex = _this.offsetIndex(nodeInfo.startTag.startOffset, nodeInfo.startTag.offsetFrom);
        endIndex = _this.offsetIndex(nodeInfo.endTag.endOffset, nodeInfo.startTag.offsetFrom);
      }
      else if(nodeInfo.startTag){
        startIndex = _this.offsetIndex(nodeInfo.startTag.startOffset, nodeInfo.startTag.offsetFrom);
        endIndex = _this.offsetIndex(nodeInfo.startTag.endOffset, nodeInfo.startTag.offsetFrom);
      }
      else if(nodeInfo.endTag){
        startIndex = _this.offsetIndex(nodeInfo.endTag.startOffset, nodeInfo.endTag.offsetFrom);
        endIndex = _this.offsetIndex(nodeInfo.endTag.endOffset, nodeInfo.endTag.offsetFrom);
      }
      else return '';
      return _this.content.substr(startIndex, endIndex - startIndex);
    }

    this.replaceNodeContent = function(node, newContent, desc){
      if(node.removed) return;
      var nodeInfo = node.sourceCodeLocation;
      if(!nodeInfo) throw new Error('Error processing template: '+desc+' node missing sourceCodeLocation');
      if(!nodeInfo.startTag) throw new Error('Error processing template: '+desc+' node missing start tag');
      if(!nodeInfo.endTag) throw new Error('Error processing template: '+desc+' node missing end tag');
      var startIndex = _this.offsetIndex(nodeInfo.startTag.endOffset, nodeInfo.startTag.offsetFrom);
      var endIndex = _this.offsetIndex(nodeInfo.endTag.startOffset, nodeInfo.startTag.offsetFrom);
      
      _this.content = _this.content.substr(0, startIndex) + newContent + _this.content.substr(endIndex);
      _this.offsets.push({ start: startIndex, length: (startIndex - endIndex + newContent.length) });
      if(!nodeInfo.startTag.offsetFrom) _this.removed.push({ start: nodeInfo.startTag.endOffset, end: nodeInfo.endTag.startOffset });
    }

    this.wrapNode = function(node, pre, post, desc){
      var nodeInfo = node.sourceCodeLocation;
      if(!nodeInfo) throw new Error('Error processing template: '+desc+' node missing sourceCodeLocation');
      pre = pre || '';
      post = post || '';
      var startIndex = _this.offsetIndex(nodeInfo.startOffset, nodeInfo.offsetFrom);
      var endIndex = _this.offsetIndex(nodeInfo.endOffset, nodeInfo.offsetFrom);

      _this.content = _this.content.substr(0, startIndex) + pre + _this.content.substr(startIndex, endIndex - startIndex) + post + _this.content.substr(endIndex);
      _this.offsets.push({ start: startIndex, length: pre.length });
      _this.offsets.push({ start: endIndex + pre.length, length: post.length });
    }

    this.wrapNodeContent = function(node, pre, post, desc){
      var nodeInfo = node.sourceCodeLocation;
      if(!nodeInfo) throw new Error('Error processing template: '+desc+' node missing sourceCodeLocation');
      if(!nodeInfo.startTag) throw new Error('Error processing template: '+desc+' node missing start tag');
      if(!nodeInfo.endTag) throw new Error('Error processing template: '+desc+' node missing end tag');
      pre = pre || '';
      post = post || '';
      var startIndex = _this.offsetIndex(nodeInfo.startTag.endOffset, nodeInfo.startTag.offsetFrom);
      var endIndex = _this.offsetIndex(nodeInfo.endTag.startOffset, nodeInfo.startTag.offsetFrom);

      _this.content = _this.content.substr(0, startIndex) + pre + _this.content.substr(startIndex, endIndex - startIndex) + post + _this.content.substr(endIndex);
      _this.offsets.push({ start: startIndex, length: pre.length });
      _this.offsets.push({ start: endIndex + pre.length, length: post.length });
    }

    this.findNodes = function(pred, tree, rslt){
      if(typeof tree == 'undefined') tree = _this.nodes;
      if(!rslt) rslt = [];
      if(tree.removed) return;
      if(pred(tree)) rslt.push(tree);
      if(tree.childNodes){
        for(var i=0;i<tree.childNodes.length;i++){
          if(tree.childNodes[i]) _this.findNodes(pred, tree.childNodes[i], rslt);
        }
      }
      return rslt;
    }

    this.applyNodes = function(actions, tree){
      if(typeof tree == 'undefined') tree = _this.nodes;
      if(tree.removed) return;
      if(!actions) actions = [];
      for(var i=0;i<actions.length;i++){
        if(actions[i].pred(tree)) actions[i].exec(tree);
      }
      if(tree.childNodes){
        for(var i=0;i<tree.childNodes.length;i++){
          if(tree.childNodes[i]) _this.applyNodes(actions, tree.childNodes[i]);
        }
      }
    }

    this.isTag = function(node, tag){
      if(!node || !node.tagName || node.removed) return false;
      if(node.tagName.toString().toLowerCase() == tag.toLowerCase()) return true;
      return false;
    }

    this.isNodeName = function(node, tag){
      if(!node || !node.nodeName || node.removed) return false;
      if(node.nodeName.toString().toLowerCase() == tag.toLowerCase()) return true;
      return false;
    }

    this.hasAttr = function(node, key, value, options){
      if(!node || !node.attrs || node.removed) return false;
      options = options || { caseInsensitive: false };
      for(var i=0;i<node.attrs.length;i++){
        var attr = node.attrs[i];
        if((attr.name||'').toLowerCase() == key.toLowerCase()){
          if(typeof value == 'undefined') return true;
          if(attr.value == value){
            return true;
          }
          else if(options.caseInsensitive && ((attr.value||'').toString().toLowerCase() == (value||'').toString().toLowerCase())){
            return true;
          }
        }
      }
      return false;
    }

    this.getAttr = function(node, key){
      if(!node || !node.attrs || node.removed) return undefined;
      for(var i=0;i<node.attrs.length;i++){
        var attr = node.attrs[i];
        if((attr.name||'').toLowerCase() == key.toLowerCase()){
          return attr.value;
        }
      }
      return undefined;
    }

    this.removeAttr = function(node, key){
      if(node.removed) return;
      var nodeInfo = node.sourceCodeLocation;
      if(!nodeInfo) throw new Error('Error processing template: '+desc+' node missing sourceCodeLocation');
      if(!nodeInfo.attrs) return;
      var toDelete = [];
      for(var attrName in nodeInfo.attrs){
        if((attrName != key) && (attrName != key.toLowerCase())) continue;
        var attrInfo = nodeInfo.attrs[attrName];
        var startIndex = _this.offsetIndex(attrInfo.startOffset, attrInfo.offsetFrom);
        var endIndex = _this.offsetIndex(attrInfo.endOffset, attrInfo.offsetFrom);
        //while((startIndex > 0) && (_this.content[startIndex-1]==' ')) startIndex--; //Do not remove white-space (so that EJS replacement will work)
        _this.content = _this.content.substr(0, startIndex) + _this.content.substr(endIndex);
        _this.offsets.push({ start: startIndex + 1, length: (startIndex - endIndex) });
        if(!attrInfo.offsetFrom) _this.removed.push({ start: attrInfo.startOffset, end: attrInfo.endOffset });
        toDelete.push(attrName);
      }
      _.each(toDelete, function(attrName){ delete nodeInfo.attrs[attrName]; });
      for(var i=0;i<node.attrs.length;i++){
        if((node.attrs[i].name||'').toLowerCase()==key.toLowerCase()){
          node.attrs.splice(i, 1);
          i--;
        }
      }
    }

    this.appendAttr = function(node, key, value, separator, desc, options){
      if(node.removed) return;
      var nodeInfo = node.sourceCodeLocation;
      if(!nodeInfo) throw new Error('Error processing template: '+desc+' node missing sourceCodeLocation');
      key = (key||'').toLowerCase();
      separator = separator||'';
      options = options || { noEscape: false };
      if(!node.attrs) node.attrs = [];
      if(!nodeInfo.attrs) nodeInfo.attrs = {};

      if(!_this.hasAttr(node, key)){
        if(!nodeInfo.attrs) throw new Error('Error processing template: '+desc+' node missing startTag');
        var endChars = Buffer.from([0x20, 0x09, 0x0A, 0x0C, 0x0D, 0x2F, 0x3E]).toString();
        var tagStartIndex = _this.offsetIndex(nodeInfo.startTag.startOffset, nodeInfo.startTag.offsetFrom);
        var tagEndIndex = _this.offsetIndex(nodeInfo.startTag.endOffset, nodeInfo.startTag.offsetFrom);
        var tagContent = _this.content.substr(tagStartIndex, tagEndIndex - tagStartIndex);
        var tagAttrIndex = -1;
        for(i=1;i<tagContent.length;i++){
          if(endChars.indexOf(tagContent[i])>=0){ tagAttrIndex = i; break; }
        }
        if(tagAttrIndex < 0) throw new Error('Error processing template: Cannot add attribute to '+desc+' node');

        //Add space and empty attribute
        var emptyAttribute = (' '+key+'=""');
        _this.content = _this.content.substr(0, tagStartIndex + tagAttrIndex) + emptyAttribute + _this.content.substr(tagStartIndex + tagAttrIndex);
        _this.offsets.push({ start: tagStartIndex+tagAttrIndex+1, length: emptyAttribute.length });
        //Update node and sourceCodeLocation
        node.attrs.push({ 'name': key, value: '' });
        nodeInfo.attrs[key] = {
          startLine: nodeInfo.startTag.startLine,
          startCol: nodeInfo.startTag.startCol,
          startOffset: tagStartIndex+tagAttrIndex+1,
          endLine: nodeInfo.startTag.startLine,
          endCol: nodeInfo.startTag.startCol,
          endOffset: tagStartIndex+tagAttrIndex+emptyAttribute.length,
          offsetFrom: _this.offsets.length,
        };
      }
      if(!nodeInfo.attrs[key]) throw new Error('Error processing template: '+desc+' node missing sourceCodeLocation.attr for key '+key);
      var attrInfo = nodeInfo.attrs[key];

      //Update node.attrs
      var oldValue = '';
      for(var i=0;i<node.attrs.length;i++){
        if((node.attrs[i].name||'').toLowerCase()==key){
          oldValue = (node.attrs[i].value||'');
          node.attrs[i].value = oldValue + (oldValue ? separator : '') + value; 
          break;
        }
      }
      
      var startIndex = _this.offsetIndex(attrInfo.startOffset, attrInfo.offsetFrom);
      var endIndex = _this.offsetIndex(attrInfo.endOffset, attrInfo.offsetFrom);
      //Rewrite
      var newAttribute = (key+'="'+Helper.escapeHTML(oldValue + (oldValue ? separator : '') + value)+'"');
      if(options.noEscape) newAttribute = (key+'="'+ oldValue + (oldValue ? separator : '') + value +'"');
      _this.content = _this.content.substr(0, startIndex) + newAttribute + _this.content.substr(endIndex);
      _this.offsets.push({ start: endIndex, length: (startIndex - endIndex + newAttribute.length) });
    }

    this.replaceAttr = function(node, key, val, desc, options){
      if(!node || !node.attrs || node.removed) return;

      var nodeInfo = node.sourceCodeLocation;
      if(!nodeInfo) throw new Error('Error processing template: '+desc+' node missing sourceCodeLocation');
      key = (key||'').toLowerCase();
      options = _.extend({ noEscape: false, logRemoved: true }, options);

      if(!nodeInfo.attrs[key]) throw new Error('Error processing template: '+desc+' node missing sourceCodeLocation.attr for key '+key);
      var attrInfo = nodeInfo.attrs[key];

      //Update node.attrs
      for(var i=0;i<node.attrs.length;i++){
        if((node.attrs[i].name||'').toLowerCase()==key){
          node.attrs[i].value = val;
          break;
        }
      }
      
      var startIndex = _this.offsetIndex(attrInfo.startOffset, attrInfo.offsetFrom);
      var endIndex = _this.offsetIndex(attrInfo.endOffset, attrInfo.offsetFrom);
      //Rewrite
      var newAttribute = (key+'="'+Helper.escapeHTML(val)+'"');
      if(options.noEscape) newAttribute = (key+'="'+ val +'"');
      _this.content = _this.content.substr(0, startIndex) + newAttribute + _this.content.substr(endIndex);
      _this.offsets.push({ start: endIndex, length: (startIndex - endIndex + newAttribute.length) });
      if(options.logRemoved && !nodeInfo.offsetFrom) _this.removed.push({ start: nodeInfo.startOffset, end: nodeInfo.endOffset });
    }

    this.wrapAttr = function(node, key, pre, post, desc){
      if(node.removed) return;
      var nodeInfo = node.sourceCodeLocation;
      if(!nodeInfo) throw new Error('Error processing template: '+desc+' node missing sourceCodeLocation');
      if(!nodeInfo.attrs) return;
      
      for(var attrName in nodeInfo.attrs){
        if((attrName != key) && (attrName != key.toLowerCase())) continue;
        var attrInfo = nodeInfo.attrs[attrName];
        var startIndex = _this.offsetIndex(attrInfo.startOffset, attrInfo.offsetFrom);
        var endIndex = _this.offsetIndex(attrInfo.endOffset, attrInfo.offsetFrom);
        pre = pre || '';
        post = post || '';
        _this.content = _this.content.substr(0, startIndex) + pre + _this.content.substr(startIndex, endIndex - startIndex) + post + _this.content.substr(endIndex);
        _this.offsets.push({ start: startIndex, length: pre.length });
        _this.offsets.push({ start: endIndex + pre.length, length: post.length });
      }
    }

    this.hasClass = function(node, className){
      if(!node || !node.attrs || node.removed) return false;
      for(var i=0;i<node.attrs.length;i++){
        var attr = node.attrs[i];
        if((attr.name||'').toLowerCase() == 'class'){
          var classNames = (attr.value||'').toString().split(' ');
          if(_.includes(classNames, className)) return true;
        }
      }
      return false;
    }

    this.addClass = function(node, classTxt, desc, options){
      if(!node || node.removed) return;
      classTxt = (classTxt||'').toString();
      if(!classTxt.trim()) return;
      _this.appendAttr(node, 'class', classTxt, ' ', desc, options);
    }

    this.removeClass = function(node, className, desc, options){
      if(!node || !node.attrs || node.removed) return false;
      options = _.extend({ noEscape: false, logRemoved: false }, options);
      var existingClassTxt = (_this.getAttr(node, 'class') || '');
      if(!existingClassTxt) return false;
      var whiteSpace = ' \t\n\r\v\f';
      var idx = -1;
      var newClassTxt = existingClassTxt;
      while((idx = newClassTxt.indexOf(className, idx + 1)) >= 0){
        var nextChar = newClassTxt[idx + className.length];
        if((typeof nextChar == 'undefined') || (whiteSpace.indexOf(nextChar)>=0)){
          //Remove Class
          newClassTxt = newClassTxt.substr(0, idx) + newClassTxt.substr(idx + className.length);
        }
      }
      if(newClassTxt != existingClassTxt){
        _this.replaceAttr(node, 'class', newClassTxt, desc, options);
        return true;
      }
      return false;
    }

    this.getParts = function(){
      var rslt = {
        doctype: null,
        html: null,
        head: null,
        body: null,
      };
      _this.applyNodes([
        {
          pred: function(node){ return _this.isNodeName(node, '#documentType'); },
          exec: function(node){ if(!rslt.doctype && node.sourceCodeLocation) rslt.doctype = node; }
        },
        {
          pred: function(node){ return _this.isTag(node, 'html'); },
          exec: function(node){ if(!rslt.html && node.sourceCodeLocation && node.sourceCodeLocation.startTag && node.sourceCodeLocation.endTag) rslt.html = node; }
        },
        {
          pred: function(node){ return _this.isTag(node, 'head'); },
          exec: function(node){ if(!rslt.head && node.sourceCodeLocation && node.sourceCodeLocation.startTag && node.sourceCodeLocation.endTag) rslt.head = node; }
        },
        {
          pred: function(node){ return _this.isTag(node, 'body'); },
          exec: function(node){ if(!rslt.body && node.sourceCodeLocation && node.sourceCodeLocation.startTag && node.sourceCodeLocation.endTag) rslt.body = node; }
        },
      ]);
      return rslt;
    }

    this.serialize = function(){
      return parse5.serialize(this.nodes);
    }
    
    //Constructor
    if(options.extractEJS) this.extractEJS();
    function parseContent(content){
      var parseOptions = { sourceCodeLocationInfo: true };
      if(options.noDuplicateAttributes){
        parseOptions.onParseError = function(err){
          if(err && (err.code == 'duplicate-attribute')){
            throw new Error('Duplicate attribute at line '+err.startLine+', character '+err.startCol);
          }
        }
      }
      return parse5.parse(content, parseOptions)
    }
    this.nodes = parseContent(this.content);
  }

  exports.applyRenderTags = function(content, params){
    if(!content) return content;

    //If no render tags, return
    var lcontent = content.toLowerCase();
    if((lcontent.indexOf('data-jsharmony_cms_onrender') < 0) && (lcontent.indexOf('data-jsharmony_cms_onapplyproperties') < 0)) return content;

    var htdoc = new funcs.HTMLDoc(content);
    htdoc.applyNodes([
      { //Apply properties
        pred: function(node){ return htdoc.hasAttr(node, 'data-jsharmony_cms_onRender') || htdoc.hasAttr(node, 'data-jsharmony_cms_onApplyProperties'); },
        exec: function(node){
          var code = (htdoc.getAttr(node, 'data-jsharmony_cms_onRender')||'').toString();
          code += (code ? ';' : '') + (htdoc.getAttr(node, 'data-jsharmony_cms_onApplyProperties')||'').toString();
          //Remove code from Doc
          htdoc.removeAttr(node, 'data-jsharmony_cms_onRender');
          htdoc.removeAttr(node, 'data-jsharmony_cms_onApplyProperties');
          //Render Parameters
          var renderParams = _.extend({
            page: {}
          }, params);
          //Render Functions
          renderParams.showIf = function(cond){ if(!cond) htdoc.removeNode(node, 'showIf Target Node'); }
          renderParams.toggle = renderParams.showIf;
          renderParams.addClass = function(classTxt){ htdoc.addClass(node, classTxt, 'addClass Target Node'); }
          renderParams.setClass = renderParams.addClass;
          renderParams.addStyle = function(styleTxt){ styleTxt = (styleTxt||'').toString(); if(styleTxt.trim()) htdoc.appendAttr(node, 'style', styleTxt, ';', 'addStyle Target Node'); }
          renderParams.setStyle = renderParams.addStyle;
          //Execute Code
          try{
            code = '(function(){'+code+'})()';
            Helper.JSEval(code, {}, renderParams)
          }
          catch(ex){
            throw new Error('Error evaluating ' + code + ': ' + ex.toString());
          }
        }
      },
    ]);
    return htdoc.content;
  }

  exports.generateEditorTemplate = function(content, options){
    options = _.extend({ cmsBaseUrl: '' }, options);

    if(!content) return '';

    var htdoc = new funcs.HTMLDoc(content);
    var htparts = htdoc.getParts();

    //Ensure HTML document is properly configured
    var hasChanges = false;
    if(!htparts.html || !htparts.head || !htparts.body){
      content = htdoc.serialize();
      hasChanges = true;
    }

    //Reparse document if changes were made
    if(hasChanges){
      htdoc = new funcs.HTMLDoc(content);
      htparts = htdoc.getParts();
      hasChanges = false;
    }

    var hasCmsScript = false;
    htdoc.applyNodes([
      { //Check if jsHarmony CMS script exists
        pred: function(node){ return htdoc.isTag(node, 'script') && Helper.endsWith((htdoc.getAttr(node, 'src')||'').toString(), '/js/jsHarmonyCMS.js'); },
        exec: function(node){ hasCmsScript = true; }
      },
    ]);

    if(!hasCmsScript){
      if(!htparts.body) throw new Error('Error generating Editor Template - body tag not found');
      var bodyNodeInfo = htparts.body.sourceCodeLocation;
      if(!bodyNodeInfo.startTag && !bodyNodeInfo.endTag) throw new Error('Error generating Editor Template - body tag does not have both a start tag and an end tag');
      //Add CMS Script
      htdoc.spliceContent(bodyNodeInfo.startTag.endOffset, bodyNodeInfo.startTag.endOffset, '<script type="text/javascript" src="'+Helper.escapeHTMLAttr(options.cmsBaseUrl+'/js/jsHarmonyCMS.js')+'"></script>');
    }

    content = htdoc.content;
    
    //Add DOCTYPE
    if(!htparts.doctype){
      content = '<!DOCTYPE HTML>' + content;
    }

    return content;
  }

  exports.generateDeploymentTemplate = function(content){
    if(!content) return '';

    var htdoc = new funcs.HTMLDoc(content);

    var prevSeoTitle = false;
    var prevSeoKeywords = false;
    var prevSeoMetadesc = false;
    var prevSeoCanonicalUrl = false;

    htdoc.applyNodes([
      { //Remove page config script
        pred: function(node){ return htdoc.isTag(node, 'script') && htdoc.hasAttr(node, 'type', 'text/jsharmony-cms-page-config'); },
        exec: function(node){ htdoc.removeNode(node, 'Page Config Script'); }
      },
      { //Replace page title
        pred: function(node){ return htdoc.isTag(node, 'h1') && htdoc.hasAttr(node, 'id', 'jsharmony_cms_title'); },
        exec: function(node){
          htdoc.replaceNodeContent(node, '<%=page.title%>', 'Title H1');
          htdoc.wrapNode(node, '<% if(page.title){ %>', '<% } %>', 'Title H1')
        }
      },
      { //Add editable regions
        pred: function(node){ return htdoc.hasAttr(node, 'data-id') && htdoc.hasClass(node, 'jsharmony_cms_content'); },
        exec: function(node){
          //Get data-id
          var contentId = (htdoc.getAttr(node, 'data-id')||'').toString();
          if(contentId){
            htdoc.replaceNodeContent(node, '<%-page.content['+JSON.stringify(contentId)+']%>', 'Content '+contentId);
          }
        }
      },
      { //Remove any nodes with the "removeOnPublish" class, such as the jsHarmony CMS script
        pred: function(node){ return htdoc.hasClass(node, 'removeOnPublish'); },
        exec: function(node){ htdoc.removeNode(node, 'removeOnPublish'); }
      },
      { //SEO Title Update
        pred: function(node){ return htdoc.isTag(node, 'title'); },
        exec: function(node){
          htdoc.replaceNodeContent(node, '<%=page.seo.title%>', 'Title Tag');
          htdoc.wrapNode(node, '<% if(page.seo.title){ %>', '<% } %>', 'Title Tag')
          prevSeoTitle = true;
        }
      },
      { //SEO Meta Keywords Update
        pred: function(node){ return htdoc.isTag(node, 'meta') && htdoc.hasAttr(node, 'name', 'keywords', { caseInsensitive: true }); },
        exec: function(node){
          htdoc.removeAttr(node, 'content');
          htdoc.appendAttr(node, 'content', '<%=page.seo.keywords%>', '', 'Meta Keywords Tag', { noEscape: true });
          htdoc.wrapNode(node, '<% if(page.seo.keywords){ %>', '<% } %>', 'Meta Keywords Tag')
          prevSeoKeywords = true;
        }
      },
      { //SEO Meta Description Update
        pred: function(node){ return htdoc.isTag(node, 'meta') && htdoc.hasAttr(node, 'name', 'description', { caseInsensitive: true }); },
        exec: function(node){
          htdoc.removeAttr(node, 'content');
          htdoc.appendAttr(node, 'content', '<%=page.seo.metadesc%>', '', 'Meta Description Tag', { noEscape: true });
          htdoc.wrapNode(node, '<% if(page.seo.metadesc){ %>', '<% } %>', 'Meta Description Tag')
          prevSeoMetadesc = true;
        }
      },
      { //SEO Meta Description Update
        pred: function(node){ return htdoc.isTag(node, 'link') && htdoc.hasAttr(node, 'rel', 'canonical', { caseInsensitive: true }); },
        exec: function(node){
          htdoc.removeAttr(node, 'href');
          htdoc.appendAttr(node, 'href', '<%=page.seo.canonical_url%>', '', 'Canonical URL Tag', { noEscape: true });
          htdoc.wrapNode(node, '<% if(page.seo.canonical_url){ %>', '<% } %>', 'Canonical URL Tag')
          prevSeoCanonicalUrl = true;
        }
      },
    ]);

    var htparts = htdoc.getParts();
    
    //1. If there is an existing tag (title, meta, link) - replace those
    //2. If there is a head tag, add to head.
    //3. If there is an HTML tag, add to html
    //4. Otherwise, add to top of page, after doctype, or otherwise at top
    var headerInsertPosition = 0;
    if(htparts.head) headerInsertPosition = htparts.head.sourceCodeLocation.endTag.startOffset;
    else if(htparts.html) headerInsertPosition = htparts.html.sourceCodeLocation.startTag.endOffset;
    else if(htparts.doctype) headerInsertPosition = htparts.doctype.sourceCodeLocation.endOffset;

    if(!prevSeoTitle) htdoc.insertHtml(headerInsertPosition, '<% if(page.seo.title){ %><title><%=page.seo.title%></title><% } %>');
    if(!prevSeoKeywords) htdoc.insertHtml(headerInsertPosition, '<% if(page.seo.keywords){ %><meta name="keywords" content="<%=page.seo.keywords%>" /><% } %>');
    if(!prevSeoMetadesc) htdoc.insertHtml(headerInsertPosition, '<% if(page.seo.metadesc){ %><meta name="description" content="<%=page.seo.metadesc%>" /><% } %>');
    if(!prevSeoCanonicalUrl) htdoc.insertHtml(headerInsertPosition, '<% if(page.seo.canonical_url){ %><link rel="canonical" href="<%=page.seo.canonical_url%>" /><% } %>');
    
    htdoc.insertHtml(headerInsertPosition, '<% if(page.css){ %><style type="text/css"><%-page.css%></style><% } %>');
    htdoc.insertHtml(headerInsertPosition, '<% if(page.js){ %><script type="test/javascript"><%-page.js%></script><% } %>');
    htdoc.insertHtml(headerInsertPosition, '<%-page.header%>');
    
    //1. If there is a body tag, add to end of body
    //2. If there is an HTML tag, add to end of html
    //3. Otherwise, add to end of page
    var footerInsertPosition = content.length;
    if(htparts.body) footerInsertPosition = htparts.body.sourceCodeLocation.endTag.startOffset;
    else if(htparts.html) footerInsertPosition = htparts.html.sourceCodeLocation.endTag.startOffset;
    htdoc.insertHtml(footerInsertPosition, '<%-page.footer%>');

    return htdoc.content;
  }

  exports.generateComponentTemplate = function(component, content){
    var default_editor_content = {};
    if(!content) return '';
    content = '<% var component_group_offset = 0; %>' + content;

    var htdoc = new funcs.HTMLDoc(content, { extractEJS: true, noDuplicateAttributes: true });

    htdoc.applyNodes([
      { //Remove page config script
        pred: function(node){ return htdoc.isTag(node, 'script') && htdoc.hasAttr(node, 'type', 'text/jsharmony-cms-component-config'); },
        exec: function(node){ htdoc.removeNode(node, 'Component Config Script'); }
      },
      { //component-item
        pred: function(node){ return htdoc.hasAttr(node, 'component-item'); },
        exec: function(node){
          htdoc.removeAttr(node, 'component-item');
          htdoc.wrapNode(node, '<% for(var component_item_index=0;component_item_index<items.length;component_item_index++){ var item = items[component_item_index]; if(data_errors[component_group_offset+component_item_index]){ %><%-renderPlaceholder({ errors: data_errors[component_group_offset+component_item_index] })%><% } else { %>', '<% } } %>', 'component-item');
        }
      },
      { //component-group-every
        pred: function(node){ return htdoc.hasAttr(node, 'component-group-every'); },
        exec: function(node){
          var countStr = (htdoc.getAttr(node, 'component-group-every')||'').toString();
          var count = parseInt(countStr);
          if(!count || (count.toString() != countStr)) throw new Error('The component-group-every property must have a number of items per group, ex: component-group-every="3"');
          htdoc.removeAttr(node, 'component-group-every');
          htdoc.wrapNode(node, '<% for(var component_group_index=0;component_group_index<Math.ceil(items.length/'+count+');component_group_index++){ var component_group_parent_offset = component_group_offset; var component_subgroup_offset = component_group_index*'+count+'; var component_subgroup = items.slice(component_group_index*'+count+',(component_group_index+1)*'+count+'); (function(){ var component_group_offset = component_group_parent_offset + component_subgroup_offset; var items = component_subgroup; %>', '<% })(); } %>', 'component-group-every');
        }
      },
      { //component-editor-remove-class
        pred: function(node){ return htdoc.hasAttr(node, 'component-editor-remove-class'); },
        exec: function(node){
          var classNameStr = (htdoc.getAttr(node, 'component-editor-remove-class')||'').toString();
          var classNames = classNameStr.split(' ');
          for(var i=0;i<classNames.length;i++){
            var className = classNames[i].trim();
            if(!className) continue;
            if(htdoc.removeClass(node, className, 'component-editor-remove-class', { noEscape: true })){
              //Item removed
              htdoc.addClass(node, '<%=(!isInComponentEditor?'+JSON.stringify(className)+':"")%>', 'component-editor-remove-class', { noEscape: true });
            }
          }
          htdoc.removeAttr(node, 'component-editor-remove-class');
        }
      },
      { //component-editor-add-class
        pred: function(node){ return htdoc.hasAttr(node, 'component-editor-add-class'); },
        exec: function(node){
          var classNameStr = (htdoc.getAttr(node, 'component-editor-add-class')||'').toString().trim();
          if(classNameStr){
            htdoc.addClass(node, '<%=(isInComponentEditor?'+JSON.stringify(classNameStr)+':"")%>', 'component-editor-add-class', { noEscape: true });
          }
          htdoc.removeAttr(node, 'component-editor-add-class');
        }
      },
      { //cms-editor
        pred: function(node){ return htdoc.hasAttr(node, 'cms-editor-for') || htdoc.hasAttr(node, 'cms-editor-type'); },
        exec: function(node){
          var editorField = (htdoc.getAttr(node, 'cms-editor-for')||'').toString().trim();
          var editorType = (htdoc.getAttr(node, 'cms-editor-type')||'').toString().toLowerCase().trim();
          if(editorType && !editorField) throw new Error('The cms-editor-for attribute is required with the cms-editor-type attribute, ex: cms-editor-for="item.body" cms-editor-type="simple"');
          if(!editorField) throw new Error('The cms-editor-for property must have an item.property name, ex: cms-editor-for="item.body"');
          if(!editorType) editorType = 'full';
          if(editorField.indexOf('item.')!=0) throw new Error('The "cms-editor-for" attribute must begin with "item.", ex. cms-editor-for="item.body"');
          editorField = editorField.substr(('item.').length);
          htdoc.removeAttr(node, 'cms-editor-for');
          htdoc.removeAttr(node, 'cms-editor-type');
          var tagName = (node.tagName||'').toString().toLowerCase();
          if(tagName=='p'){
            if(htdoc.hasAttr(node, 'cms-editor-on-p')) htdoc.removeAttr(node, 'cms-editor-on-p');
            else throw new Error('A "cms-editor-for" attribute on a "p" tag will not work with line breaks.  Please add the "cms-editor-on-p" tag if this is intentional, ex. <p cms-editor-for="item.body" cms-editor-on-p></p>');
          }
          if(htdoc.hasAttr(node, 'data-component-full-editor')) throw new Error('The "cms-editor-for" attribute cannot be used together with the "data-component-full-editor" attribute');
          if(htdoc.hasAttr(node, 'data-component-title-editor')) throw new Error('The "cms-editor-for" attribute cannot be used together with the "data-component-title-editor" attribute');
          var attrName = '';
          if(editorType == 'full') attrName = 'data-component-full-editor';
          else if(editorType == 'simple') attrName = 'data-component-title-editor';
          else throw new Error('Unsupport cms-editor-type: '+editorType);
          
          htdoc.appendAttr(node, attrName, editorField);
          var prevContent = (htdoc.getNodeContent(node, 'cms-editor-for content'));
          if(prevContent){ default_editor_content[editorField] = prevContent; }
          htdoc.replaceNodeContent(node, '<%-item.'+editorField+'%>');
          htdoc.wrapAttr(node, attrName, '<% if(renderType=="gridItemPreview"){ %>', '<% } %>');
        }
      },
    ]);

    //Modify component
    if(component){
      _.each(component.data && component.data.fields, function(field){
        if(field.name && !('default' in field)){
          if(field.name in default_editor_content){
            field.default = default_editor_content[field.name];
          }
        }
      });
    }

    htdoc.restoreEJS();
    return htdoc.content;

  }

  return exports;
};
