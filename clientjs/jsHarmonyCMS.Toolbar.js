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

  this.editorBarDocked = false;
  this.origMarginTop = undefined;
 
  this.render = function(){
    cms.util.addStyle('jsharmony_cms_editor_css',cms.views['jsh_cms_editor.css']);
    jsh.root.append(cms.views['jsh_cms_editor']);
    this.origMarginTop = $('body').css('margin-top');
    this.toggleAutoHide(false);
    jsh.InitControls();
  }

  this.toggleAutoHide = function(val){
    if(typeof val =='undefined') val = !this.editorBarDocked;
    this.editorBarDocked = !!val;

    if(this.editorBarDocked){
      $('body').css('margin-top', this.origMarginTop);
    }
    else {
      var barHeight = $('#jsharmony_cms_editor_bar .actions').outerHeight();
      $('body').css('margin-top', barHeight+'px');
    }
    $('#jsharmony_cms_editor_bar .autoHideEditorBar').toggleClass('enabled',!val);
  }
  
  this.toggleSettings = function(display, noSlide){
    var jbutton = $('#jsharmony_cms_editor_bar .button.settings');
    var prevdisplay = !!jbutton.hasClass('selected');
    if(typeof display == 'undefined') display = !prevdisplay;
    
    if(prevdisplay==display) return;
    else {
      var jsettings = $('#jsharmony_cms_editor_bar .page_settings');
      if(display){
        //Open
        jbutton.addClass('selected');
        jsettings.stop(true);
        if(noSlide) jsettings.show();
        else jsettings.slideDown();
      }
      else {
        //Close
        if(!cms.controller.validate()) return;
        jbutton.removeClass('selected');
        jsettings.stop(true);
        if(noSlide) jsettings.hide();
        else jsettings.slideUp();
      }
    }
  }

  this.showSettings = function(noSlide){ this.toggleSettings(true, noSlide); }

  this.hideSettings = function(noSlide){ this.toggleSettings(false, noSlide); }


}