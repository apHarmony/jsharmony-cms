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

  this.menus = null;
  this.isInitialized = false;

  this.load = function(onComplete){
    var url = '../_funcs/page/menus/'+cms.branch_id;
    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.menus = rslt.menus;
        async.eachOf(_this.menus, function(menu, menu_tag, menu_cb){
          if(menu.remote_template && menu.remote_template.publish){
            var loadObj = {};
            cms.loader.StartLoading(loadObj);
            $.ajax({
              type: 'GET',
              cache: false,
              url: menu.remote_template.publish,
              xhrFields: { withCredentials: true },
              success: function(data){
                cms.loader.StopLoading(loadObj);
                menu.content = data;
                return menu_cb();
              },
              error: function(xhr, status, err){
                cms.loader.StopLoading(loadObj);
                menu.content = '*** MENU NOT FOUND ***';
                return menu_cb();
              }
            });
          }
          else return menu_cb();
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
      var menu_content = '';
      if(!menu_tag) menu_content = '*** MENU MISSING data-id ATTRIBUTE ***';
      else if(!(menu_tag in _this.menus)) menu_content = '*** MISSING CONTENT FOR MENU TAG ' + menu_tag+' ***';
      else{
        menu_content = ejs.render(_this.menus[menu_tag].content || '', cms.controller.getMenuRenderParameters(menu_tag));
      }
      jobj.html(menu_content);
    });
  }
}