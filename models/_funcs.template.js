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
var parse5 = require('parse5');

module.exports = exports = function(module, funcs){
  var exports = {};

  exports.readPageTemplateConfig = function(templateContent, desc, options){
    var templateParts = funcs.parseConfig(templateContent, 'cms-page-config', desc, options);
    return templateParts.config;
  }
  
  exports.readComponentTemplateConfig = function(templateContent, desc, options){
    var templateParts = funcs.parseConfig(templateContent, 'cms-component-config', desc, options);
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
    if(!('multiple_items' in config)){
      config.multiple_items = (config.data && ((config.data.layout == 'grid_preview') || (config.data.layout == 'grid'))) ? true : false;
    }
    
    //Apply config.data.layout
    if(!config.data.layout){
      if(config.multiple_items) config.data.layout = 'grid_preview';
      else config.data.layout = 'form';
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
    options = _.extend({ continueOnConfigError: false, extractFromContent: false }, options);
    var rslt = {
      config: {},
      content: content,
    };
    var htdoc = null;
    try{
      var htdoc = new funcs.HTMLDoc(content, { extractEJS: 'parseOnly' });
      htdoc.applyNodes([
        { //Apply properties
          pred: function(node){ return (htdoc.isTag(node, 'script') && htdoc.hasAttr(node, 'type', 'text/'+configType)) || (htdoc.isTag(node, configType)); },
          exec: function(node){
            var configScript = htdoc.getNodeContent(node);
            htdoc.removeNode(node);
            var config = {};
            try{
              config = jshParser.ParseJSON(configScript, desc, { trimErrors: true });
            }
            catch(ex){
              if(options.continueOnConfigError) module.jsh.Log.info(new Error('Could not parse ' + configType + ' in ' + desc + ': ' + ex.toString()));
              else throw ex;
            }
            _.extend(rslt.config, config);
          }
        },
      ]);
    }
    catch(ex){
      ex = new Error('Could not parse ' + configType + ' script tag in ' + desc + ': ' + ex.toString());
      if(options.continueOnConfigError) module.jsh.Log.info(ex);
      else throw ex;
    }
    if(htdoc && options.extractFromContent){
      try{
        htdoc.trimRemoved();
      }
      catch(ex){
        ex = new Error('Could not parse ' + configType + ' in ' + desc + ': ' + ex.toString());
        if(options.continueOnConfigError) module.jsh.Log.info(ex);
        else throw ex;
      }
      rslt.content = htdoc.content;
    }
    return rslt;
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
      script_config_type: 'cms-page-config',
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
      script_config_type: 'cms-component-config',
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
        var publishTemplatePaths = {};
        var exportTemplatePaths = {};
  
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
                      templateParts = funcs.parseConfig(templateContent, options.script_config_type, 'local ' + options.site_template_type.toLowerCase() + ' template "' + file + '"', { continueOnConfigError: options.continueOnConfigError });
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
                          publishTemplatePaths[HelperFS.convertWindowsToPosix(publishTemplatePath.substr(normalizedSitePath.length))] = {
                            source: localTemplate.site_template_path,
                          };
                        }
                        //Do not allow an editor template to reference itself as a publish template
                        if(publishTemplatePath == filepath) return file_cb(new Error('Error processing local template ' + localTemplate.site_template_path + ': An Editor template cannot target itself as the Publish template.  Remove the remote_templates.publish property to auto-generate a publish template based on the current editor template.'));
                      }
                    }
                    if(templateConfig && templateConfig.export) for(var i=0;i<templateConfig.export.length;i++){
                      var exportItem = templateConfig.export[i];
                      var exportTemplatePath = exportItem.remote_template;
                      if(!exportTemplatePath) continue;
                      
                      if(exportTemplatePath.indexOf('//') < 0){
                        exportTemplatePath = path.normalize(path.join(path.dirname(filepath), exportTemplatePath));
                        if(exportTemplatePath.indexOf(normalizedSitePath+path.sep) == 0){
                          exportTemplatePaths[HelperFS.convertWindowsToPosix(exportTemplatePath.substr(normalizedSitePath.length))] = {
                            source: localTemplate.site_template_path,
                          };
                        }
                        //Do not allow an editor template to reference itself as an export template
                        if(exportTemplatePath == filepath) return file_cb(new Error('Error processing local template ' + localTemplate.site_template_path + ': An Editor template cannot target itself as the Export template.  Remove the export[].remote_template property to auto-generate an export template based on the current editor template.'));
                      }
                    }
                    return file_cb();
                  });
                }
                else file_cb();
              }, function(err){
                if(err) return data_cb(err);
                //Go through each local template
                for(var i=0;i<localTemplates.length;i++){
                  var localTemplate = localTemplates[i];

                  //If local template is a publish template
                  if(localTemplate.site_template_path in publishTemplatePaths){
                    //Do not allow publish templates to have a templateConfig
                    if(!_.isEmpty(localTemplate.site_template_config)){
                      var source = publishTemplatePaths[localTemplate.site_template_path].source;
                      return data_cb(new Error('Error processing publish template ' + localTemplate.site_template_path + ': Publish templates cannot contain a "' + options.script_config_type + '" script tag.  This template is used as a publish template by '+source+' via the remote_templates.publish property.\r\n\r\nPlease make sure not to use Editor templates as Publish templates.  Remove the remote_templates.publish property from the Editor template to auto-generate a Publish template based on the current editor template.'));
                    }
                    //Remove template
                    localTemplates.splice(i, 1);
                    i--;
                    continue;
                  }

                  //If local template is an export template
                  if(localTemplate.site_template_path in exportTemplatePaths){
                    //Do not allow export templates to have a templateConfig
                    if(!_.isEmpty(localTemplate.site_template_config)){
                      var source = exportTemplatePaths[localTemplate.site_template_path].source;
                      return data_cb(new Error('Error processing export template ' + localTemplate.site_template_path + ': Export templates cannot contain a "' + options.script_config_type + '" script tag.  This template is used as a export template by '+source+' via the export[].remote_template property.\r\n\r\nPlease make sure not to use Editor templates as Export templates.  Remove the export[].remote_template property from the Editor template to auto-generate an Export template based on the current editor template.'));
                    }
                    //Remove template
                    localTemplates.splice(i, 1);
                    i--;
                    continue;
                  }
                }
                return data_cb();
              });
            }
          );
        });
      },
  
      //Add local system templates
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
    var whiteSpace = ' \t\n\r\v\f';
    var JSHCMS_TAGS = [
      'jsh-for-item',
      'jsh-for-item-variable',
      'jsh-foreach-item',
      'jsh-foreach-item-separator',
      'jsh-foreach-item-start',
      'jsh-foreach-item-end',
      'jsh-foreach-item-skip',
      'jsh-foreach-item-variable',
      'jsh-foreach-item-index',
      'jsh-group-items',
      'jsh-group-items-into',
      'jsh-group-items-by',
      'jsh-group-items-separator',
      'jsh-group-items-subgroup',
      'jsh-group-items-index',
      'jsh-template',
      'cms-content-editor',
      'cms-content-editor-type',
      'cms-component-editor-remove-class',
      'cms-component-editor-add-class',
    ];

    this.origContent = _content;
    this.content = _content;
    this.offsets = []; //{ start, length }
    this.removed = []; //{ start, end }
    this.pendingTrim = []; //{ start, end, type { node, content, attr } }
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
        var scriptContent = str.substr(startIdx, endIdx - startIdx);
        var scriptType = 'standard';
        if(scriptContent.substr(0,3)=='<%~') scriptType = 'containerSlurp';
        //Extract string
        _this.ejsScripts.push({
          start: startIdx,
          end: endIdx,
          content: scriptContent,
          scriptType: scriptType,
          container: null,
          //index
          //scriptType
        });
        //Replace with spaces
        str = str.substr(0, startIdx) + Helper.pad('', ' ', endIdx - startIdx) + str.substr(endIdx);
        startIdx = nextStartIdx;
      }
      _this.content = str;
    }

    //Find containers for each containerSlurp script
    this.findEJSContainers = function(){
      var scripts = [];

      for(var i=0;i<_this.ejsScripts.length;i++){
        var ejsScript = _this.ejsScripts[i];
        if(ejsScript.container) continue;
        if(ejsScript.scriptType != 'containerSlurp') continue;

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
        //Add to scripts array
        scripts.push(_.extend({type:'script',index:i}, ejsScript));
      }

      if(!scripts.length) return;

      var allNodes = [].concat(scripts);
      _this.applyNodes([
        {
          pred: function(node){
            var nodeInfo = node.sourceCodeLocation;
            if(!nodeInfo) return;
            if(!nodeInfo.startTag) return;
            if(nodeInfo.startTag) allNodes.push({start: nodeInfo.startTag.startOffset, end: nodeInfo.startTag.endOffset, node: node, type: 'startTag'});
            if(nodeInfo.endTag) allNodes.push({start: nodeInfo.endTag.startOffset, end: nodeInfo.endTag.endOffset, node: node, type: 'endTag'});
            if(nodeInfo.startTag && nodeInfo.endTag) allNodes.push({start: nodeInfo.startTag.endOffset, end: nodeInfo.endTag.startOffset, node: node, type: 'nodeBody'});
            if(nodeInfo.attrs){
              for(var attrName in nodeInfo.attrs){
                var attrInfo = nodeInfo.attrs[attrName];
                allNodes.push({start: attrInfo.startOffset, end: attrInfo.endOffset, node: node, type: 'nodeAttr', attrName: attrName});
              }
            }
          },
          exec: function(node){ }
        },
      ]);
      allNodes.sort(function(a,b){
        if(a.start < b.start) return -1;
        if(a.start > b.start) return 1;
        if((a.type=='script') && (b.type!='script')) return 1;
        if((a.type!='script') && (b.type=='script')) return -1;
        if(a.end < b.end) return -1;
        if(a.end > b.end) return 1;
        return 0;
      });
      for(var i=0;i<allNodes.length;i++){
        var node = allNodes[i];
        if(node.type=='script'){
          for(var j=i-1;j>=0;j--){
            var prevNode = allNodes[j];
            if(node.end <= prevNode.end){
              node.parent = prevNode;
              break;
            }
          }
        }
      }
      for(var i=0;i<scripts.length;i++){
        var script = scripts[i];
        try{
          var container = {
            start: script.start,
            end: script.end
          };
          var parentMatch = script.parent;
          //containerSlurp must be inside a parent element
          if(!parentMatch) throw new Error('EJS container slurp <%~ tag must be inside an HTML element');

          var node = parentMatch.node;
          var nodeInfo = node.sourceCodeLocation;
          //Make sure parent node was not deleted
          if(node.removed) throw new Error('EJS container slurp <%~ tag should have been removed when node was removed');
          
          if(parentMatch.type=='nodeAttr'){
            if(!(parentMatch.attrName in nodeInfo.attrs)) throw new Error('EJS container slurp <%~ tag should have been removed when node attribute was removed');
            var attrVal = _this.getAttr(node, parentMatch.attrName);
            //For nodeAttr, make sure attribute length matches
            if(attrVal != Helper.pad('', ' ', script.content.length)) throw new Error('One EJS container slurp <%~ tag must be the only text within the attribute value, ex: <div style="<%~item.value%>"></div>');

            container = {
              start: nodeInfo.attrs[parentMatch.attrName].startOffset,
              end: nodeInfo.attrs[parentMatch.attrName].endOffset,
              offsetFrom: nodeInfo.attrs[parentMatch.attrName].offsetFrom,
              type: 'nodeAttr',
            };
          }
          
          //For nodeBody, make sure content length matches
          if(parentMatch.type=='nodeBody'){
            var nodeContent = _this.getNodeContent(node);
            //For nodeBody, make sure attribute length matches
            if(nodeContent != Helper.pad('', ' ', script.content.length)) throw new Error('One EJS container slurp <%~ tag must be the only text within the node content, ex: <div><%~item.value%></div>');

            container = {
              start: nodeInfo.startTag.startOffset,
              end: nodeInfo.endTag.endOffset,
              type: 'nodeBody',
            };
          }

          //For startTag or endTag, show an error - cannot slurp
          if((parentMatch.type=='startTag')||(parentMatch.type=='endTag')){
            throw new Error('EJS container slurp <%~ tags can only be used for attribute values or HTML element content');
          }

          //Update script tag
          _this.ejsScripts[script.index].container = container;
        }
        catch(ex){
          var errmsg = ex.message;
          var lines = _this.origContent.substr(0,script.start).split('\n');
          var line = lines.length;
          var char = lines[lines.length-1].length;
          errmsg = 'EJS Error at line '+line+', char '+char+' - '+errmsg + ': ' + script.content;
          throw new Error(errmsg);
        }
      }
    }

    this.restoreEJS = function(options){
      options = _.extend({ containerSlurp: true }, options);
      if(options.containerSlurp) _this.findEJSContainers();

      for(var i=0;i<_this.ejsScripts.length;i++){
        var ejsScript = _this.ejsScripts[i];
        var startIndex = _this.offsetIndex(ejsScript.start);
        var endIndex = startIndex + ejsScript.content.length;
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
        if(options.containerSlurp && (ejsScript.scriptType=='containerSlurp')){
          //Container Slurp
          if(!ejsScript.container) throw new Error('EJS container slurp <%~ script container not found: '+ejsScript.content);


          /*
            Possible EJS script tags beginnings and endings:
              <%
              <%_
              <%=
              <%-

              %>
              -%>
              _%>
          */
          var expr = '';
          var scriptContent = ejsScript.content;
          var firstFour = scriptContent.substr(0,4);
          var lastThree = scriptContent.substr(scriptContent.length-3,3);
          if(_.includes(['<%~-','<%~=','<%~_'], firstFour)){
            scriptContent = '<%'+firstFour[3]+' '+scriptContent.substr(4);
            expr = scriptContent.substr(4);
          }
          else{
            scriptContent = '<%=' + scriptContent.substr(3);
            expr = scriptContent.substr(3);
          }

          if(_.includes(['-%>','_%>'], lastThree)){
            expr = expr.substr(0, expr.length - 3);
          }
          else {
            expr = expr.substr(0, expr.length - 2);
          }

          //Get container
          var container = ejsScript.container;
          var containerStartIndex = _this.offsetIndex(container.start, container.offsetFrom);
          var containerEndIndex = _this.offsetIndex(container.end, container.offsetFrom);
          var pre = '<% if(!isNullUndefinedEmpty('+expr+')){ %>';
          var post = '<% } %>';

          //Replace script
          _this.content = _this.content.substr(0, startIndex) + scriptContent + _this.content.substr(endIndex);

          //Slurp back spaces for attributes
          if(container.type == 'nodeAttr'){
            while((containerStartIndex > 0) && whiteSpace.indexOf(_this.content[containerStartIndex-1])>=0) containerStartIndex--;
          }

          //Wrap script
          _this.content = _this.content.substr(0, containerStartIndex) + pre + _this.content.substr(containerStartIndex, containerEndIndex - containerStartIndex) + post + _this.content.substr(containerEndIndex);
          _this.offsets.push({ start: containerStartIndex, length: pre.length });
          _this.offsets.push({ start: containerEndIndex + pre.length, length: post.length });
        }
        else {
          //Standard Script
          _this.content = _this.content.substr(0, startIndex) + ejsScript.content + _this.content.substr(endIndex);
        }
      }
      _this.ejsScripts = [];
    }

    this.trimRemoved = function(){
      for(var i=0;i<_this.pendingTrim.length;i++){
        var snip = _this.pendingTrim[i];
        if(snip.type=='attr'){
          var startOffset = _this.offsetIndex(snip.start);
          var endOffset = startOffset;
          startOffset--;
          while((startOffset>=0) && (whiteSpace.indexOf(_this.content[startOffset]) >= 0)) startOffset--;
          startOffset++;
          if(startOffset < endOffset){
            _this.content = _this.content.substr(0, startOffset) + _this.content.substr(endOffset);
            _this.offsets.push({ start: startOffset, length: startOffset - endOffset });
            _this.removed.push({ start: startOffset, end: endOffset });
          }
        }
      }
    }

    this.spliceContent = function(startIndex, endIndex, newContent){
      newContent = newContent || '';
      _this.content = _this.content.substr(0, startIndex) + newContent + _this.content.substr(endIndex);
      _this.offsets.push({ start: startIndex, length: (newContent.length + (startIndex - endIndex)) });
      if(endIndex > startIndex){
        _this.removed.push({ start: startIndex, end: endIndex });
        _this.pendingTrim.push({ start: startIndex, end: endIndex, type: 'content' });
      }
    }

    this.offsetIndex = function(index, from){
      if(!from) from = 0;
      for(var i=from;i<_this.offsets.length;i++){
        if(index >= _this.offsets[i].start){
          index += _this.offsets[i].length;
          if(index < 0) index = 0;
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
      if(!nodeInfo.offsetFrom){
        _this.removed.push({ start: nodeInfo.startOffset, end: nodeInfo.endOffset });
        _this.pendingTrim.push({ start: nodeInfo.startOffset, end: nodeInfo.endOffset, type: 'node' });
      }
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

    this.removeChildren = function(childNodes){
      _.each(childNodes, function(childNode){
        _this.removeChildren(childNode.childNodes);
        childNode.removed = true;
      });
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
      if(!nodeInfo.startTag.offsetFrom){
        _this.removed.push({ start: nodeInfo.startTag.endOffset, end: nodeInfo.endTag.startOffset });
        _this.pendingTrim.push({ start: nodeInfo.startTag.endOffset, end: nodeInfo.endTag.startOffset, type: 'content' });
      }
      //Remove children
      _this.removeChildren(node.childNodes);
    }

    this.replaceNode = function(node, newContent, desc){
      if(node.removed) return;
      var nodeInfo = node.sourceCodeLocation;
      if(!nodeInfo) throw new Error('Error processing template: '+desc+' node missing sourceCodeLocation');
      if(!nodeInfo.startTag) throw new Error('Error processing template: '+desc+' node missing start tag');
      var startTag = nodeInfo.startTag;
      var endTag = nodeInfo.endTag || startTag;
      var startIndex = _this.offsetIndex(startTag.startOffset, startTag.offsetFrom);
      var endIndex = _this.offsetIndex(endTag.endOffset, startTag.offsetFrom);
      
      _this.content = _this.content.substr(0, startIndex) + newContent + _this.content.substr(endIndex);
      _this.offsets.push({ start: startIndex, length: (startIndex - endIndex + newContent.length) });
      if(!startTag.offsetFrom){
        _this.removed.push({ start: startTag.startOffset, end: endTag.endOffset });
        _this.pendingTrim.push({ start: startTag.startOffset, end: endTag.endOffset, type: 'content' });
      }
      node.removed = true;
      //Remove children
      _this.removeChildren(node.childNodes);
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

    this.hasParent = function(node, pred){
      if(!node || !node.tagName || node.removed) return false;
      if(pred(node)) return true;
      return _this.hasParent(node.parent);
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

    this.removeAttr = function(node, key, desc){
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
        if(!attrInfo.offsetFrom){
          _this.removed.push({ start: attrInfo.startOffset, end: attrInfo.endOffset });
          _this.pendingTrim.push({ start: attrInfo.startOffset, end: attrInfo.endOffset, type: 'attr' });
        }
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

    this.getAndRemoveAttr = function(node, attrName, defaultValue){
      var rslt = defaultValue;
      if(_this.hasAttr(node, attrName)){
        rslt = (_this.getAttr(node, attrName)||'').toString();
        _this.removeAttr(node, attrName);
      }
      return rslt||'';
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
            var startOffset = err.startOffset-1;
            var endOffset = err.startOffset;
            while((startOffset >= 0) && (whiteSpace.indexOf(content[startOffset]) < 0)) startOffset--;
            startOffset++;
            var attrName = (startOffset < endOffset) ? content.substr(startOffset, endOffset - startOffset).toLowerCase() : '';
            if(_.includes(JSHCMS_TAGS,attrName)){
              if(_this.origContent && (err.startLine == 1)){
                var linePos = Helper.getCharPos(_this.origContent, err.startOffset);
                err.startLine = linePos.line;
                err.startCol = linePos.char;
              }
              throw new Error('Duplicate attribute "'+attrName+'" at line '+err.startLine+', character '+err.startCol);
            }
          }
        }
      }
      return parse5.parse(content, parseOptions)
    }
    this.nodes = parseContent(this.content);
    if(options.extractEJS=='parseOnly') this.restoreEJS({ containerSlurp: false });
  }

  exports.applyRenderTags = function(content, params){
    if(!content) return content;

    //If no render tags, return
    var lcontent = content.toLowerCase();
    if(lcontent.indexOf('cms-onrender') < 0) return content;

    var htdoc = new funcs.HTMLDoc(content);
    htdoc.applyNodes([
      { //Apply properties
        pred: function(node){ return htdoc.hasAttr(node, 'cms-onRender'); },
        exec: function(node){
          var code = (htdoc.getAttr(node, 'cms-onRender')||'').toString();
          //Remove code from Doc
          htdoc.removeAttr(node, 'cms-onRender');
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
      htdoc.spliceContent(bodyNodeInfo.startTag.endOffset, bodyNodeInfo.startTag.endOffset, '<script type="text/javascript" class="removeOnPublish" src="'+Helper.escapeHTMLAttr(options.cmsBaseUrl+'/js/jsHarmonyCMS.js')+'"></script>');
    }

    content = htdoc.content;
    
    //Add DOCTYPE
    if(!htparts.doctype){
      content = '<!DOCTYPE HTML>' + content;
    }

    return content;
  }

  exports.generateDeploymentTemplate = function(template, content){
    if(!content) return '';
    if(!template) template = {};
    if(!template.components) template.components = {};
    if(!template.default_content) template.default_content = {};

    var htdoc = new funcs.HTMLDoc(content, { extractEJS: 'parseOnly' });
    
    //First pass - extract page config and inline templates
    htdoc.applyNodes([
      { //Remove page config script
        pred: function(node){ return htdoc.isTag(node, 'script') && htdoc.hasAttr(node, 'type', 'text/cms-page-config'); },
        exec: function(node){ htdoc.removeNode(node, 'Page Config Script'); }
      },
      { //Remove page config tag
        pred: function(node){ return htdoc.isTag(node, 'cms-page-config'); },
        exec: function(node){ htdoc.removeNode(node, 'Page Config Tag'); }
      },
      { //Remove inline components
        pred: function(node){ return htdoc.isTag(node, 'script') && htdoc.hasAttr(node, 'type', 'text/cms-component-template'); },
        exec: function(node){
          var componentTemplate = htdoc.getNodeContent(node, 'inline component template');
          htdoc.removeNode(node, 'Inline Component Template');
          var components = funcs.compileInlineComponents([componentTemplate]);
          for(var componentId in components){
            if(componentId in template.components) throw new Error('Page template contains duplicate inline component "' + componentId + '"');
            template.components[componentId] = components[componentId];
          }
        }
      },
      { //Remove inline web snippets
        pred: function(node){ return htdoc.isTag(node, 'script') && htdoc.hasAttr(node, 'type', 'text/cms-websnippet-template'); },
        exec: function(node){ htdoc.removeNode(node, 'Inline Websnippet Templates'); }
      },
    ]);
    content = htdoc.content;
    htdoc = new funcs.HTMLDoc(content, { extractEJS: true });

    var prevSeoTitle = false;
    var prevSeoKeywords = false;
    var prevSeoMetadesc = false;
    var prevSeoCanonicalUrl = false;

    //Second pass - transform EJS
    htdoc.applyNodes([
      { //Replace page title
        pred: function(node){ return htdoc.isTag(node, 'h1') && htdoc.hasAttr(node, 'cms-title'); },
        exec: function(node){
          htdoc.replaceNodeContent(node, '<%=page.title%>', 'Title H1');
          htdoc.wrapNode(node, '<% if(page.title){ %>', '<% } %>', 'Title H1')
          htdoc.removeAttr(node, 'cms-title');
        }
      },
      { //Add editable regions
        pred: function(node){ return htdoc.hasAttr(node, 'cms-content-editor'); },
        exec: function(node){
          //Get data-id
          var contentId = (htdoc.getAttr(node, 'cms-content-editor')||'').toString();
          var pageContentId = (Helper.beginsWith(contentId, 'page.content.')) ? contentId.substr(('page.content.').length) : contentId;
          if(pageContentId){
            var defaultContent = htdoc.getNodeContent(node, 'Content '+contentId);
            htdoc.replaceNodeContent(node, '<%-page.content['+JSON.stringify(pageContentId)+']%>', 'Content '+contentId);
            if(!(pageContentId in template.default_content)) template.default_content[pageContentId] = defaultContent;
          }
          htdoc.removeAttr(node, 'cms-content-editor');
        }
      },
      { //Process Components
        pred: function(node){ return htdoc.hasAttr(node, 'cms-component') || htdoc.hasClass(node, 'jsharmony_cms_component'); },
        exec: function(node){
          //Get component id
          var componentId = (htdoc.getAttr(node, 'cms-component')||'').toString();
          if(!componentId) (htdoc.getAttr(node, 'data-id')||'').toString();
          if(componentId){
            var props = {
              'cms-menu-tag': { renderParam: 'menu_tag', type: 'string'},
              'cms-component-properties': { renderParam: 'properties', type: 'json'},
              'cms-component-data': { renderParam: 'data', type: 'json'},
            }
            var renderOptions = {};
            for(var propName in props){
              var prop = props[propName];
              if(htdoc.hasAttr(node, propName)){
                var propVal = htdoc.getAttr(node, propName);
                if(prop.type=='json'){
                  propVal = jshParser.ParseJSON(propVal, componentId+' '+propName, { trimErrors: true });
                }
                renderOptions[prop.renderParam] = propVal;
                htdoc.removeAttr(node, propName);
              }
            }
            htdoc.removeAttr(node, 'cms-component', 'Component '+componentId);
            htdoc.removeAttr(node, 'cms-component-properties', 'Component '+componentId);
            htdoc.removeAttr(node, 'cms-component-data', 'Component '+componentId);
            htdoc.replaceNodeContent(node, '<%-renderComponent('+JSON.stringify(componentId)+(!_.isEmpty(renderOptions)?', '+JSON.stringify(renderOptions):'')+')%>', 'Component '+componentId);
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

    htdoc.restoreEJS();
    htdoc.trimRemoved();
    return htdoc.content;
  }

  exports.generateComponentTemplate = function(component, content){
    var default_editor_content = {};
    if(!content) return '';
    content = '<% locals.renderTemplate = locals.renderTemplate.bind(null, locals); function getEJSOutput(f){ var pos = __output.length; f(); return __output.substr(pos); } %>' + content;

    var htdoc = new funcs.HTMLDoc(content, { extractEJS: true, noDuplicateAttributes: true });

    htdoc.applyNodes([
      { //Remove component config script
        pred: function(node){ return htdoc.isTag(node, 'script') && htdoc.hasAttr(node, 'type', 'text/cms-component-config'); },
        exec: function(node){ htdoc.removeNode(node, 'Component Config Script'); }
      },
      { //Remove component config tag
        pred: function(node){ return htdoc.isTag(node, 'cms-component-config') },
        exec: function(node){ htdoc.removeNode(node, 'Component Config Tag'); }
      },
      { //jsh-group-items
        pred: function(node){ return htdoc.hasAttr(node, 'jsh-group-items') || htdoc.hasAttr(node, 'jsh-group-items-into') || htdoc.hasAttr(node, 'jsh-group-items-by'); },
        exec: function(node){
          var itemsVariable = htdoc.getAndRemoveAttr(node, 'jsh-group-items').trim()||'items';
          var groupInto = htdoc.getAndRemoveAttr(node, 'jsh-group-items-into').trim();
          var groupBy = htdoc.getAndRemoveAttr(node, 'jsh-group-items-by').trim();
          var subgroupVariable = htdoc.getAndRemoveAttr(node, 'jsh-group-items-subgroup').trim()||'items';
          var subgroupIndex = htdoc.getAndRemoveAttr(node, 'jsh-group-items-index','jsh_group_index');
          var subgroupSeparator = htdoc.getAndRemoveAttr(node, 'jsh-group-items-separator');

          if(groupBy && groupInto) throw new Error('Cannot use both jsh-group-items-by and jsh-group-items-into in the same tag.  Please use a combined jsh-group-items-by expression instead');
          if(!groupBy && !groupInto) throw new Error('Either jsh-group-items-by or jsh-group-items-into is required.  If grouping is not necessary, use a jsh-foreach-item expression instead');

          var groupByFunc = function(groupFunc, items){
            let rslt = {};
            for(let i=0;i<items.length;i++){
              let key = groupFunc(items[i], i);
              if(!(key in rslt)) rslt[key] = [];
              rslt[key].push(items[i]);
            }
            return rslt;
          }

          if(groupInto){
            var groupIntoStr = groupInto;
            groupInto = parseInt(groupIntoStr)||0;
            if(groupInto.toString() != groupIntoStr) throw new Error('The jsh-group-items-into property must be a whole number');
            if(groupInto <= 0) throw new Error('The jsh-group-items-into property must be greater than 0');
            groupBy = 'Math.floor(jsh_group_item_index/'+groupInto.toString()+')+1';
          }

          var groupByStr = '('+_.map(groupByFunc.toString().split('\n'),function(line){ return line.trim(); }).join('')+')(function(item, jsh_group_item_index){return ('+groupBy+');}, '+itemsVariable+')';

          htdoc.wrapNode(node, '<% (function(){ let jsh_groups = '+groupByStr+'; let jsh_subgroup_first = true; for(let '+subgroupIndex+' in jsh_groups){ let '+subgroupVariable+'=jsh_groups['+subgroupIndex+']; if(jsh_subgroup_first){ jsh_subgroup_first = false; }else{ %>'+subgroupSeparator+'<% } (function(){ %>','<% })(); } })(); %>');
        }
      },
      { //cms-component-editor-remove-class
        pred: function(node){ return htdoc.hasAttr(node, 'cms-component-editor-remove-class'); },
        exec: function(node){
          var classNameStr = (htdoc.getAttr(node, 'cms-component-editor-remove-class')||'').toString();
          var classNames = classNameStr.split(' ');
          for(var i=0;i<classNames.length;i++){
            var className = classNames[i].trim();
            if(!className) continue;
            if(htdoc.removeClass(node, className, 'cms-component-editor-remove-class', { noEscape: true })){
              //Item removed
              htdoc.addClass(node, '<%=(!isInComponentEditor?'+JSON.stringify(className)+':"")%>', 'cms-component-editor-remove-class', { noEscape: true });
            }
          }
          htdoc.removeAttr(node, 'cms-component-editor-remove-class');
        }
      },
      { //cms-component-editor-add-class
        pred: function(node){ return htdoc.hasAttr(node, 'cms-component-editor-add-class'); },
        exec: function(node){
          var classNameStr = (htdoc.getAttr(node, 'cms-component-editor-add-class')||'').toString().trim();
          if(classNameStr){
            htdoc.addClass(node, '<%=(isInComponentEditor?'+JSON.stringify(classNameStr)+':"")%>', 'cms-component-editor-add-class', { noEscape: true });
          }
          htdoc.removeAttr(node, 'cms-component-editor-add-class');
        }
      },
      { //cms-editor
        pred: function(node){ return htdoc.hasAttr(node, 'cms-content-editor') || htdoc.hasAttr(node, 'cms-content-editor-type'); },
        exec: function(node){
          var editorField = (htdoc.getAttr(node, 'cms-content-editor')||'').toString().trim();
          var editorType = (htdoc.getAttr(node, 'cms-content-editor-type')||'').toString().toLowerCase().trim();
          if(editorType && !editorField) throw new Error('The cms-content-editor attribute is required with the cms-content-editor-type attribute, ex: cms-content-editor="item.body" cms-content-editor-type="simple"');
          if(!editorField) throw new Error('The cms-content-editor property must have an item.property name, ex: cms-content-editor="item.body"');
          if(!editorType) editorType = 'full';
          if(editorField.indexOf('item.')!=0) throw new Error('The "cms-content-editor" attribute must begin with "item.", ex. cms-content-editor="item.body"');
          editorField = editorField.substr(('item.').length);
          htdoc.removeAttr(node, 'cms-content-editor');
          htdoc.removeAttr(node, 'cms-content-editor-type');
          var tagName = (node.tagName||'').toString().toLowerCase();
          if(tagName=='p'){
            if(htdoc.hasAttr(node, 'cms-editor-on-p')) htdoc.removeAttr(node, 'cms-editor-on-p');
            else throw new Error('A "cms-content-editor" attribute on a "p" tag will not work with line breaks.  Please add the "cms-editor-on-p" tag if this is intentional, ex. <p cms-content-editor="item.body" cms-editor-on-p></p>');
          }
          if(htdoc.hasAttr(node, 'data-component-full-editor')) throw new Error('The "cms-content-editor" attribute cannot be used together with the "data-component-full-editor" attribute');
          if(htdoc.hasAttr(node, 'data-component-title-editor')) throw new Error('The "cms-content-editor" attribute cannot be used together with the "data-component-title-editor" attribute');
          var attrName = '';
          if(editorType == 'full') attrName = 'data-component-full-editor';
          else if(editorType == 'simple') attrName = 'data-component-title-editor';
          else throw new Error('Unsupported cms-content-editor-type: '+editorType);
          
          htdoc.appendAttr(node, attrName, editorField);
          var prevContent = htdoc.getNodeContent(node, 'cms-content-editor content');
          if(prevContent){ default_editor_content[editorField] = prevContent; }
          htdoc.replaceNodeContent(node, '<%-item.'+editorField+'%>');
          htdoc.wrapAttr(node, attrName, '<% if(renderType=="gridItemPreview"){ %>', '<% } %>');
        }
      },
      { //jsh-template
        pred: function(node){ return htdoc.hasAttr(node, 'jsh-template'); },
        exec: function(node){
          var templateName = (htdoc.getAttr(node, 'jsh-template')||'').toString();
          htdoc.removeAttr(node, 'jsh-template');

          var subgroupVariable = htdoc.getAndRemoveAttr(node, 'jsh-template-subgroup').trim()||'items';
          
          htdoc.wrapNode(node, '<% (locals.jsh_render_templates=locals.jsh_render_templates||{})['+JSON.stringify(templateName)+'] = function('+subgroupVariable+'){ %>', '<% } %>', 'jsh-template');
        }
      },
      { //jsh-foreach-item
        pred: function(node){ return htdoc.hasAttr(node, 'jsh-foreach-item'); },
        exec: function(node){
          var itemsVariable = htdoc.getAndRemoveAttr(node, 'jsh-foreach-item').trim()||'items';
          var itemSeparator = htdoc.getAndRemoveAttr(node, 'jsh-foreach-item-separator');
          var itemVariable = htdoc.getAndRemoveAttr(node, 'jsh-foreach-item-variable').trim()||'item';
          var forEachStart = htdoc.getAndRemoveAttr(node, 'jsh-foreach-item-start').trim()||'1';
          forEachStart = '(' + forEachStart + ')';
          var forEachEnd = htdoc.getAndRemoveAttr(node, 'jsh-foreach-item-end').trim()||('(('+itemsVariable+')||[]).length');
          forEachEnd = '(' + forEachEnd + ')';
          var forEachSkip = htdoc.getAndRemoveAttr(node, 'jsh-foreach-item-skip').trim()||'0';
          var forEachIndex = htdoc.getAndRemoveAttr(node, 'jsh-foreach-item-index','jsh_item_index');

          htdoc.wrapNode(node, '<% for(let '+forEachIndex+'='+forEachStart+';'+forEachIndex+'<='+forEachEnd+';'+forEachIndex+'+=(1+'+forEachSkip+')){ let '+itemVariable+' = (('+itemsVariable+')||[])['+forEachIndex+'-1]; if('+forEachIndex+'>'+forEachStart+'){ %>'+itemSeparator+'<% } if(('+itemVariable+')&&('+itemVariable+').jsh_validation_errors){ %><%-renderPlaceholder({ errors: ('+itemVariable+').jsh_validation_errors })%><% } else { %>', '<% } } %>', 'jsh-foreach-item');
        }
      },
      { //jsh-for-item
        pred: function(node){ return htdoc.hasAttr(node, 'jsh-for-item'); },
        exec: function(node){
          var itemsVariable = htdoc.getAndRemoveAttr(node, 'jsh-for-item').trim()||'items';
          var itemVariable = htdoc.getAndRemoveAttr(node, 'jsh-for-item-variable').trim()||'item';

          htdoc.wrapNode(node, '<% (function(){ let '+itemVariable+'='+itemsVariable+'; if(!isNullUndefined('+itemVariable+')){ %>','<% } })(); %>','jsh-for-item');
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
    htdoc.trimRemoved();
    return htdoc.content;

  }

  return exports;
};
