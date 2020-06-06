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

exports = module.exports = function(jsh, cms){
  var _this = this;
  var $ = jsh.$;
  var XExt = jsh.XExt;
  var async = jsh.async;
  var ejs = jsh.ejs;

  this.components = null;
  this.isInitialized = false;

  this.load = function(onComplete){
    var url = '../_funcs/templates/component/'+cms.branch_id;
    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.components = rslt.components;
        async.eachOf(_this.components, function(component, key, cb) {
          var loadObj = {};
          cms.loader.StartLoading(loadObj);
          _this.loadComponent(component, function(err){
            cms.loader.StopLoading(loadObj);
            cb(err)
          });
        }, function(error){
          _this.isInitialized = true;
        });
      }
      else{
        if(onComplete) onComplete(new Error('Error Loading Components'));
        XExt.Alert('Error loading components');
      }
    }, function (err) {
      if(onComplete) onComplete(err);
    });
  };

  this.render = function(){
    $('.jsharmony_cms_component').addClass('mceNonEditable').each(function(){
      var jobj = $(this);
      var component_id = jobj.data('id');
      var component_content = '';
      if(!component_id) component_content = '*** COMPONENT MISSING data-id ATTRIBUTE ***';
      else if(!(component_id in _this.components)) component_content = '*** MISSING CONTENT FOR COMPONENT ID ' + component_id+' ***';
      else{
        var component = _this.components[component_id];
        var templates = component != undefined ? component.templates : undefined
        var editorTemplate = (templates || {}).editor;
        component_content = ejs.render(editorTemplate || '', cms.controller.getComponentRenderParameters(component_id));
      }
      jobj.html(component_content);
    });

    $('[data-component]').each(function(i, element) {
      _this.renderComponent(element);
    });
  }

  this.loadComponent = function(component, complete_cb) {
    var url = (component.remote_template || {}).editor;
    if (!url) return complete_cb();

    _this.loadRemoteTemplate(url, function(error, data){
      if (error) {
        complete_cb(error);
      } else {
        component.templates = component.templates || {};
        var template = (component.templates.editor || '');
        data = data && template ? '\n' + data : data || '';
        component.templates.editor = (template + data) || '*** COMPONENT NOT FOUND ***';
        complete_cb();
      }
    });
  }

  this.loadRemoteTemplate = function(templateUrl, complete_cb) {
    $.ajax({
      type: 'GET',
      cache: false,
      url: templateUrl,
      xhrFields: { withCredentials: true },
      success: function(data){
        return complete_cb(undefined, data);
      },
      error: function(xhr, status, err){
        return complete_cb(err, undefined);
      }
    });
  }

  this.renderComponent = function(element) {

    var componentType = $(element).attr('data-component');
    var componentModel = componentType ? _this.components[componentType] : undefined;
    if (!componentModel) {
      return;
    }
    componentModel.id = componentModel.id || componentType;
    _this.addComponentStylesToPage(componentType, componentModel);
    var modelInstance = {};
    XExt.JSEval(componentModel.js, modelInstance, { _this: modelInstance, cms: cms });
    if (typeof modelInstance.render !== 'function') return;
    modelInstance.render(componentModel, element);
  }

  this.addComponentStylesToPage = function(componentType, componentModel) {
    var cssParts = [];
    if (componentModel.css) {
      cssParts.push(componentModel.css);
    }
    if (componentModel.properties && componentModel.properties.css) {
      cssParts.push(componentModel.properties.css);
    }
    if (componentModel.data && componentModel.data.css) {
      cssParts.push(componentModel.data.css);
    }
    var id = 'component-' + componentType;
    cms.util.removeStyle(id);
    cms.util.addStyle(id, cssParts.join('\n'));
  }
}