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

  this.type = ''; //Name of controller, ex. page
  this.hasChanges = false;

  this.init = function(cb){
  }

  this.load = function(cb){
  }

  this.createWorkspace = function(cb){
  }

  this.render = function(){
  }

  this.getValues = function(){
    _this.hasChanges = false;
  }

  this.validate = function(){
    return true;
  }

  this.save = function(){
  }

  this.getComponentRenderParameters = function(component_id){
    return {};
  }

  this.getMenuRenderParameters = function(menu_tag){
    return {
      menu: { menu_item_tree: [] }
    };
  }
}