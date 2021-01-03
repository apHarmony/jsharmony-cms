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

  this.menuTemplates = {};
  this.isInitialized = false;

  this.load = function(onComplete){
    var url = '../_funcs/templates/menu/'+cms.branch_id;
    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.menuTemplates = rslt.menuTemplates;
        async.eachOf(_this.menuTemplates, function(menu, menu_template_id, menu_cb){
          async.eachOf(menu.content_elements, function(content_element, content_element_name, content_element_cb){
            if(!content_element.remote_template) return content_element_cb();

            //Load remote menu templates
            var loadObj = {};
            cms.loader.StartLoading(loadObj, 'CMS Menu');
            $.ajax({
              type: 'GET',
              cache: false,
              url: content_element.remote_template,
              xhrFields: { withCredentials: true },
              success: function(data){
                cms.loader.StopLoading(loadObj);
                content_element.template = (content_element.template||'')+data;
                return content_element_cb();
              },
              error: function(xhr, status, err){
                cms.loader.StopLoading(loadObj);
                content_element.template = '*** ERROR DOWNLOADING REMOTE MENU ***';
                return content_element_cb();
              }
            });
          }, menu_cb);
        }, function(err){
          _this.isInitialized = true;
        });
      }
      else{
        if(onComplete) onComplete(new Error('Error Loading Menus'));
        XExt.Alert('Error loading menus');
      }
    }, function (err) {
      if(onComplete) onComplete(err);
    });
  };

  this.render = function(){
    $('.jsharmony_cms_menu').addClass('mceNonEditable').each(function(){
      var jobj = $(this);
      var menu_tag = jobj.data('menu_tag');
      var content_element_name = jobj.data('menu_content_element');
      var menu_content = '';
      if(!menu_tag) menu_content = '*** MENU MISSING data-menu_tag ATTRIBUTE ***';
      else if(!content_element_name) menu_content = '*** MENU MISSING data-menu_content_element ATTRIBUTE ***';
      else if(!(menu_tag in cms.controller.menus)) menu_content = '*** MISSING MENU DATA FOR MENU TAG ' + menu_tag+' ***';
      else {
        var menu = cms.controller.menus[menu_tag];
        var menuTemplate = _this.menuTemplates[menu.menu_template_id];
        if(!menuTemplate) menu_content = '*** MENU TEMPLATE NOT FOUND: ' + menu.menu_template_id+' ***';
        else if(!(content_element_name in menuTemplate.content_elements)) menu_content = '*** MENU ' + menu.menu_template_id + ' CONTENT ELEMENT NOT DEFINED: ' + content_element_name+' ***';
        else{
          var content_element = menuTemplate.content_elements[content_element_name];
          menu_content = ejs.render(content_element.template || '', cms.controller.getMenuRenderParameters(menu_tag));
        }
      }
      jobj.html(menu_content);
    });
  }
}