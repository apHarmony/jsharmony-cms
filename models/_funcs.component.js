/*
Copyright 2020 apHarmony

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

var ejs = require('ejs');
var _ = require('lodash');
var async = require('async');
var Helper = require('jsharmony/Helper');
var ejsext = require('jsharmony/lib/ejsext.js');
var urlparser = require('url');
var wclib = require('jsharmony/WebConnect');
var wc = new wclib.WebConnect();

/** Set the chars used to render new lines for the output **/
const NEW_LINE_OUTPUT = '\r\n';
/** Set the chars used for a single indent for the diff output **/
const INDENT_STRING = '  ';

module.exports = exports = function(module, funcs){
  const exports = {};

  exports.templates_components = function(req, res, next){
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

      var components = null;
      var site_id = null;

      async.waterfall([

        //Check if branch exists
        function(cb){
          var sql = "select branch_desc,site_id from "+(module.schema?module.schema+'.':'')+"v_my_branch_desc where branch_id=@branch_id";
          appsrv.ExecRow(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(!rslt || !rslt[0]){ return Helper.GenError(req, res, -4, 'No access to this branch'); }
            site_id = rslt[0].site_id;
            if(!site_id){ return Helper.GenError(req, res, -4, 'No site branch is currently checked out'); }
            return cb();
          });
        },

        //Get components
        function(cb){
          funcs.getComponentTemplates(req._DBContext, site_id, { withContent: true }, function(err, _components){
            if(err) return cb(err);
            components = _components;
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

        //Generate components
        function(cb){
          var publish_params = {
            timestamp: (Date.now()).toString(),
            branch_id: branch_id,
          };
          try{
            if(deployment_target_params) publish_params = _.extend(publish_params, JSON.parse(deployment_target_params));
          }
          catch(ex){
            return cb('Publish Target has invalid deployment_target_params: '+deployment.deployment_target_params);
          }
          publish_params = _.extend({}, cms.Config.deployment_target_params, publish_params);

          _.each(components, function(component){
              if(component.remote_templates && component.remote_templates.editor){
                component.remote_templates.editor = funcs.parseDeploymentUrl(component.remote_templates.editor, publish_params);
              }
            });

          return cb();
        },
        
        //Download remote templates
        function(cb){
          async.eachOf(components, function(component, component_name, component_cb){
            if(component.location=='LOCAL') return component_cb();
            if(!(component.remote_templates && component.remote_templates.editor)) return component_cb();
            if(component.optimization && component.optimization.bare_ejs_templates) return component_cb();
            
            var url = component.remote_templates.editor;
            wc.req(url, 'GET', {}, {}, undefined, function(err, res, templateContent){
              if(err) return component_cb(err);
              if(res && res.statusCode){
                if(res.statusCode > 500) return component_cb(new Error(res.statusCode+' Error downloading template '+url));
                if(res.statusCode > 400) return component_cb(new Error(res.statusCode+' Error downloading template '+url));
              }

              //Parse and merge component config
              var templateConfig = null;
              try{
                templateConfig = funcs.readComponentTemplateConfig(templateContent, 'remote component template  "'+url+'"');
              }
              catch(ex){
                return component_cb(new Error('Error reading "'+component_name+'" component template config: '+ex.toString()));
              }
              _.merge(component, templateConfig);

              component.templates.editor = templateContent;
              delete component.remote_templates.editor;

              return component_cb();
            });

          }, cb);
        },

        //Parse template config
        function(cb){
          for(var component_name in components){
            var component = components[component_name];
            if(!(component.templates && component.templates.editor) && !(component.remote_templates && component.remote_templates.editor)) continue;
            try{
              funcs.parseComponentTemplateConfigExtensions(component);
            }
            catch(ex){
              return cb(new Error('Could not parse "'+component_name+'" component template config: '+ex.toString()));
            }
          }
          return cb();
        },

        //Parse template content
        function(cb){
          for(var component_name in components){
            var component = components[component_name];
            if(!(component.templates && component.templates.editor)) continue;
            if(component.optimization && component.optimization.bare_ejs_templates) continue;
            try{
              component.templates.editor = funcs.generateComponentTemplate(component, component.templates.editor);
            }
            catch(ex){
              return cb(new Error('Could not parse "'+component_name+'" component editor template: '+ex.toString()));
            }
          }
          return cb();
        },
      ], function(err){
        if(err) { Helper.GenError(req, res, -9, err.toString()); return; }

        res.end(JSON.stringify({
          '_success': 1,
          'components': components
        }));
      });
    }
    else return next();
  }

  exports.templates_compile_components = function(req, res, next){
    var verb = req.method.toLowerCase();

    var Q = req.query;
    var P = req.body;
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;

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

    if (verb == 'post'){
      if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      if (!appsrv.ParamCheck('P', P, ['&components'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      
      var componentContent = [];
      try {
        componentContent = JSON.parse(P.components) || [];
      }
      catch(ex){
        Helper.GenError(req, res, -4, 'Invalid Parameters'); return;
      }

      try{
        components = funcs.compileInlineComponents(componentContent);
      }
      catch(err){
        return Helper.GenError(req, res, -9, err.toString());
      }

      res.end(JSON.stringify({
        '_success': 1,
        'components': components
      }));

      return;
    }
    else return next();
  }

  exports.compileInlineComponents = function(componentContent){
    if(!_.isArray(componentContent)) componentContent = [];
    var components = {};

    //Parse templates
    for(var i=0;i<componentContent.length;i++){
      var templateContent = componentContent[i];
      var componentDesc = '';
      try{
        var component = null;
        component = funcs.readComponentTemplateConfig(templateContent, 'inline component template "' + templateContent.substr(0,200) + ((templateContent.length>200)?'...':'') + '"');

        if(!component.id) throw new Error('Each inline component must have an "id" defined in the cms-component-config.  Missing id in "' + templateContent.substr(0,200) + ((templateContent.length>200)?'...':'') + '"');

        componentDesc = 'Inline component "'+component.id+'": ';

        if(component.remote_templates) throw new Error('Inline components do not support the "remote_templates" property');
        if(component.export) throw new Error('Inline components do not support the "export" property');

        component = _.extend({
          id: component.id,
          title: component.id,
          location: 'INLINE',
          templates: { editor: templateContent },
          properties: {},
          data: {},
        }, component);

        components[component.id] = component;
      }
      catch(ex){
        if(componentDesc) ex.message = componentDesc + ex.message;
        throw ex;
      }
    }

    //Parse template config
    for(var componentId in components){
      var component = components[componentId];
      if(!(component.templates && component.templates.editor)) continue;
      try{
        funcs.parseComponentTemplateConfigExtensions(component);
      }
      catch(ex){
        throw new Error('Could not parse "'+componentId+'" component template config: '+ex.toString());
      }
    }

    //Parse template content
    for(var componentId in components){
      var component = components[componentId];
      if(!(component.templates && component.templates.editor)) continue;
      if(component.optimization && component.optimization.bare_ejs_templates) continue;
      try{
        component.templates.editor = funcs.generateComponentTemplate(component, component.templates.editor);
      }
      catch(ex){
        throw new Error('Could not parse "'+componentId+'" component editor template: '+ex.toString());
      }
    }

    return components;
  }

  exports.generateComponentDeploymentTemplates = function(branchData, callback){
    async.eachOfSeries(branchData.component_templates, function(template, template_name, generate_cb){
      //Generate component templates
      try{
        funcs.parseComponentTemplateConfigExtensions(template);
        if(template.optimization && template.optimization.bare_ejs_templates) { /* Do nothing */ }
        else if(template_name in branchData.component_template_html){
          branchData.component_template_html[template_name] = funcs.generateComponentTemplate(template, branchData.component_template_html[template_name]);
        }
      }
      catch(ex){
        ex.message = 'Error generating component template '+template_name+' :: ' + ex.message;
        return generate_cb(ex);
      }
      //Generate component export templates
      _.each(template.export, function(exportItem, exportIndex){
        if(!(template_name in branchData.component_export_template_html)) branchData.component_export_template_html[template_name] = {};
        var component_export_templates = branchData.component_export_template_html[template_name];

        if(template.optimization && template.optimization.bare_ejs_templates) { /* Do nothing */ }
        else if(exportIndex in component_export_templates){
          //Pass null for "component" parameter, so that default field values will not be updated from export templates
          component_export_templates[exportIndex] = funcs.generateComponentTemplate(null, component_export_templates[exportIndex]);
        }
        else component_export_templates[exportIndex] = '';
      });
      return generate_cb();
    }, callback);
  }

  /**
   * Create an XML-like node from an object where
   * each object property is a child element with
   * the property value the element text.
   * @param {object} obj
   * @param {string} nodeName - the name of the top element
   * @param {Object.<string, string>} attribs
   */
  function parsePrettyComponentConfig(nodeName, obj, attribs) {
    /** @type {XmlLikeNode} */
    const dataNode = { children: [], attribs: attribs || {}, name: nodeName, text: '' };
    Object.entries(obj).map(kvp => {
      var itemName = kvp[0];
      if(Helper.endsWith(itemName, '_jsh_browserDataTitle')) itemName = Helper.ReplaceAll(itemName, '_jsh_browserDataTitle', '_desc');
      if(Helper.endsWith(itemName, '_browserButton')) return;
      if(Helper.endsWith(itemName, '_resetButton')) return;
      if(itemName=='component_preview') return;
      /** @type {XmlLikeNode} */
      const itemNode = {
        attribs: {},
        children: [],
        name: itemName,
        text: (Helper.isNullUndefined(kvp[1])?'':kvp[1]).toString()
      };
      dataNode.children.push(itemNode);
    });
    return dataNode;
  }

  /**
   * Process the raw component template EJS
   * to extract the component EJS template.
   * @param {string} templateContent
   */
  function extractComponentTemplate(templateContent) {
    templateContent = templateContent || '';
    var htdoc = new funcs.HTMLDoc(templateContent, { extractEJS: 'parseOnly' });
    var foundContent = false;
    htdoc.applyNodes([
      { //Apply properties
        pred: function(node){ return !foundContent && htdoc.hasClass(node, 'componentTemplate'); },
        exec: function(node){ foundContent = true; templateContent = htdoc.getNodeContent(node, 'componentTemplate'); }
      },
    ]);
    return templateContent;
  }

  /**
   * Get a string for indenting at a desired level
   * @param {number} level - indent level
   * @returns {string}
   */
  function getIndentString(level) {
    if (level < 1) return '';
    return new Array(level).fill(INDENT_STRING).join('');
  }

  /**
   * Indent each line of the text block
   * to the desired level
   * @param {string} text
   * @param {number} level - indentation level
   * @returns {string}
   */
  function indentTextBlock(text, level) {
    const indent = getIndentString(level);
    return indent + (text || '').replace(/\r?\n/g, `${NEW_LINE_OUTPUT}${indent}`);
  }

  exports.replacePageComponentsWithContentComponents = function(content, branchData, pageComponents){
    if(!content) return content;
    if(content.indexOf('cms-component')<0) return content;

    //Replace cms-component with data-component
    var htdoc = new funcs.HTMLDoc(content);
    htdoc.applyNodes([
      { //Apply properties
        pred: function(node){ return htdoc.hasAttr(node, 'cms-component'); },
        exec: function(node){
          var componentType = htdoc.getAttr(node, 'cms-component');
          var componentProperties = htdoc.getAttr(node, 'cms-component-properties');
          var componentData = htdoc.getAttr(node, 'cms-component-data');

          if(componentType){
            var component = undefined;
            if(componentType in branchData.component_template_html){
              component = branchData.component_templates[componentType];
            }
            else if(pageComponents && (componentType in pageComponents)){
              component = pageComponents[componentType];
            }
            if(!component) throw new Error('Component "'+componentType+'" is not defined');

            var defaultProperties = funcs.getComponentDefaultValues(component.properties);
            var defaultData = funcs.getComponentDefaultValues(component.data);

            
            //Parse component data
            try{
              if(!componentData){
                if(component.multiple_items) componentData = {items:[]};
                else componentData = {};
              }
              else componentData = JSON.parse(componentData);

              if(_.isArray(componentData)){
                for(var i=0;i<componentData.length;i++){ componentData[i] = _.extend({}, defaultData, componentData[i]); }
                componentData = {items: componentData};
              }
              else{
                componentData = _.extend({}, defaultData, componentData);
                componentData = {item: componentData};
              }
              componentData = JSON.stringify(componentData);
            }
            catch(ex){
              componentData = null;
            }

            //Parse component properties
            try{
              if(!componentProperties) componentProperties = {};
              else componentProperties = JSON.parse(componentProperties);

              componentProperties = _.extend({}, defaultProperties, componentProperties);
              componentProperties = JSON.stringify(componentProperties);
            }
            catch(ex){
              componentProperties = null;
            }

            htdoc.removeAttr(node, 'cms-component');
            htdoc.removeAttr(node, 'cms-component-data');
            htdoc.removeAttr(node, 'cms-component-properties');
            htdoc.removeAttr(node, 'data-component');
            htdoc.removeAttr(node, 'data-component-data');
            htdoc.removeAttr(node, 'data-component-properties');
            htdoc.appendAttr(node, 'data-component', componentType);
            if(componentData) htdoc.appendAttr(node, 'data-component-data', Buffer.from(componentData).toString('base64'));
            if(componentProperties) htdoc.appendAttr(node, 'data-component-properties', Buffer.from(componentProperties).toString('base64'));
          }
        }
      },
    ]);
    htdoc.trimRemoved();
    return htdoc.content;
  }

  function replaceComponents(pageContent, branchData, pageComponents, renderFunc){
    if(!pageContent) pageContent = '';

    //Render data-component tags
    var htdoc = new funcs.HTMLDoc(pageContent);
    htdoc.applyNodes([
      { //Apply properties
        pred: function(node){ return htdoc.hasAttr(node, 'data-component'); },
        exec: function(node){
          var componentType = '';
          var componentProperties = {};
          var componentData = {};

          componentType = htdoc.getAttr(node, 'data-component');
          try{
            componentProperties = JSON.parse(Buffer.from(htdoc.getAttr(node, 'data-component-properties') || '', 'base64').toString() || '{}');
          }
          catch(ex){
            throw new Error('Component "'+componentType+'" has invalid data-component-properties tag');
          }
          try{
            componentData = JSON.parse(Buffer.from(htdoc.getAttr(node, 'data-component-data') || '', 'base64').toString() || '{}');
          }
          catch(ex){
            throw new Error('Component "'+componentType+'" has invalid data-component-properties tag');
          }

          var template = '';
          var component = undefined;
          if(branchData && (componentType in branchData.component_template_html)){
            component = branchData.component_templates[componentType];
            template = branchData.component_template_html[componentType];
          }
          else if(pageComponents && (componentType in pageComponents)){
            component = pageComponents[componentType];
            template = component.templates.editor;
          }
          if(branchData && !component) throw new Error('Component "'+componentType+'" not defined');

          if(template) template = extractComponentTemplate(template || '');
          if(componentData && componentData.items) componentData = componentData.items;
          else if(componentData && componentData.item) componentData = componentData.item;

          var renderedContent = renderFunc(componentType, componentProperties, componentData, template, component);

          htdoc.replaceNode(node, renderedContent);
        }
      },
    ]);

    return htdoc.content;
  }

  /**
   * Generate a readable version of the component config for diffing
   * @param {string} pageContent - the page HTML containing the components to prettify
   */
  exports.renderComponentsPretty = function(pageContent) {
    return replaceComponents(pageContent, null, null, function(componentType, componentProperties, componentData){
      return renderComponentPretty(componentType, componentProperties, componentData);
    });
  }

  exports.renderComponents = function(pageContent, branchData, pageComponents) {
    return replaceComponents(pageContent, branchData, pageComponents, function(componentType, componentProperties, componentData, template, component){
      return funcs.renderComponent(template, branchData, {
        data: componentData, 
        properties: componentProperties, 
        templateName: componentType, 
        pageComponents: pageComponents, 
        component: component
      });
    });
  }

  exports.getComponentDefaultValues = function(model){
    var rslt = {};
    if(model) _.each(model.fields, function(field){
      if(field && field.name && ('default' in field)){
        rslt[field.name] = field.default;
      }
    });
    return rslt;
  }

  exports.renderComponent = function(template, branchData, renderOptions, additionalRenderParams) {
    additionalRenderParams = additionalRenderParams || {};
    renderOptions = _.extend({
      data: null, 
      properties: null, 
      renderType: 'component', 
      templateName: null, 
      pageComponents: {},
      component: undefined,
    }, renderOptions);

    var defaultProperties = {};
    var defaultData = {};
    if(renderOptions.component){
      var defaultProperties = funcs.getComponentDefaultValues(renderOptions.component.properties);
      var defaultData = funcs.getComponentDefaultValues(renderOptions.component.data);
    }
    var properties = _.extend({}, defaultProperties, renderOptions.properties);

    var renderParams = _.extend({
      baseUrl: '',
      data: { items: [], item: {} },
      properties: properties,
      renderType: renderOptions.renderType,
      _: _,
      escapeHTML: Helper.escapeHTML,
      escapeRegEx: Helper.escapeRegEx,
      stripTags: Helper.StripTags,
      isNullUndefinedEmpty: Helper.isNullUndefinedEmpty,
      isNullUndefined: Helper.isNullUndefined,
      iif: ejsext.iif,
      isInEditor: false,
      isInPageEditor: false,
      isInComponentEditor: false,
      items: [],
      item: {},
      component: properties,
      renderPlaceholder: function(){ return ''; },
      renderTemplate: function(locals, templateName, items){
        if(!items || (_.isArray(items) && !items.length)) return '';
        templateName = templateName || '';
        if(!locals.jsh_render_templates || !(templateName in locals.jsh_render_templates)) throw new Error('renderTemplate Error: Template not found: "'+templateName+'"');
        return locals.jsh_render_templates[templateName](items||[]);
      },
    }, additionalRenderParams);
    //Add item and items variables
    if(renderOptions.data){
      if(_.isArray(renderOptions.data)){
        renderParams.item = undefined;
        renderParams.items = _.map(renderOptions.data, function(item){ return _.extend({}, defaultData, item); });
      }
      else {
        renderParams.item = _.extend({}, defaultData, renderOptions.data);
        renderParams.items = [renderParams.item];
      }
      renderParams.data = { items: renderParams.items, item: renderParams.item };
    }

    var rslt = '';
    try{
      rslt = ejs.render(template, renderParams);
    }
    catch(ex){
      var errmsg = 'Error rendering '+(renderOptions.templateName?'"'+renderOptions.templateName+'"':'template:')+'\n'+ex.toString();
      errmsg += '\nTemplate:\n'+template;
      throw new Error(errmsg);
    }

    if(branchData) rslt = funcs.renderComponents(rslt, branchData, renderOptions.pageComponents);

    return rslt;
  }

  function renderComponentPretty(componentType, componentProperties, componentData) {

    /** @type {XmlLikeNode} */
    const topNode = { attribs: {}, children: [], name: componentType, text: '' };

    // Add properties
    topNode.children.push(parsePrettyComponentConfig('properties', componentProperties));

    // Add data
    var dataItems = [];
    if(componentData){
      if(_.isArray(componentData)) dataItems = componentData;
      else dataItems = [componentData];
    }
    dataItems.forEach((item, i) => topNode.children.push(parsePrettyComponentConfig('data', item, { item: i + 1 })));

    var rslt = renderComponentNodePretty(topNode);
    return rslt;
  }

  /**
   * @param {XmlLikeNode} node
   * @returns {string}
   */
  function renderComponentNodePretty(node) {

    const attributes = Object.entries(node.attribs).map(kvp => `${kvp[0]}="${kvp[1]}"`);
    const startTag = `<${[node.name, ...attributes].join(' ')}>`;
    const endTag = `</${node.name}>`;

    let text = node.text || '';

    text = replaceComponents(text, null, null, function(componentType, componentProperties, componentData){
      return renderComponentPretty(componentType, componentProperties, componentData);
    });

    const childrenNodeText = (node.children || []).map(child => renderComponentNodePretty(child)).join(NEW_LINE_OUTPUT);

    let innerText = '';
    if (text.length > 0 && childrenNodeText.length > 0) {
      innerText = text + NEW_LINE_OUTPUT + childrenNodeText;
    } else if (text.length > 0) {
      innerText = text;
    } else if (childrenNodeText.length > 0) {
      innerText = childrenNodeText;
    }

    const textIsMultiLine = /\r?\n/.test(innerText);
    innerText = textIsMultiLine ? NEW_LINE_OUTPUT + indentTextBlock(innerText, 1) + NEW_LINE_OUTPUT : innerText;
    return startTag + innerText + endTag;
  }

  return exports;
}


/**
 * @typedef {Object} XmlLikeNode
 * @property {Object.<string, string>} attribs
 * @property {string} name
 * @property {string} text
 * @property {XmlLikeNode[]} children
 */
