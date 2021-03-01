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
  var _ = jsh._;

  this.editorBarDocked = true;
  this.origMarginTop = [];
  this.currentOffsetTop = 0;
  this.dockPosition = 'top_offset';
  this.errors = [/*{ message: '...', type: 'text' (or 'html') }*/];
 
  this.render = function(){
    cms.util.addStyle('jsharmony_cms_editor_css',cms.views['jsh_cms_editor.css']);
    jsh.root.append(cms.views['jsh_cms_editor']);
    jsh.InitControls();
    this.renderErrors();
  }

  this.getHeight = function(){
    return $('#jsharmony_cms_page_toolbar .actions').outerHeight() || 0;
  }

  this.saveOrigOffsets = function(){
    _.filter($('*').toArray(), function(elem){
      if(elem.id=='jsHarmonyCMSLoading') return;
      var computedStyles = window.getComputedStyle(elem);
      if((elem.tagName && (elem.tagName.toUpperCase()=='BODY')) || (computedStyles.position=='fixed')){
        var jelem = $(elem);
        if(typeof jelem.attr('cms-toolbar-offsetid') != 'undefined') return;
        if(jelem.parent().closest('[cms-content-editor]').length) return;
        var offsetId = _this.origMarginTop.length;
        jelem.attr('cms-toolbar-offsetid', offsetId);
        _this.origMarginTop[offsetId] = computedStyles.marginTop;
      }
    });
  }

  this.getOffsetTop = function(){
    var offsetTop = 0;
    if(this.editorBarDocked){
      if(_this.dockPosition == 'top_offset') offsetTop += _this.getHeight();
    }
    if(cms.editor) offsetTop += cms.editor.getOffsetTop();
    return offsetTop;
  }

  this.refreshOffsets = function(){
    var offsetTop = _this.getOffsetTop();

    var startingOffsets = [];
    for(var i=0;i<_this.origMarginTop.length;i++){
      if(_this.origMarginTop[i] === null) continue;
      var jelem = $('[cms-toolbar-offsetid='+i.toString()+']');
      if(jelem.length){
        startingOffsets[i] = jelem.first().offset().top;
      }
    }

    for(var i=0;i<_this.origMarginTop.length;i++){
      if(_this.origMarginTop[i] === null) continue;
      var jelem = $('[cms-toolbar-offsetid='+i.toString()+']');
      if(jelem.length){
        if(offsetTop){
          var curTop = jelem.first().offset().top;
          if(curTop != startingOffsets[i]){ _this.origMarginTop[i] = null; continue; }
          else {
            var newMarginTop = _this.origMarginTop[i] ? 'calc(' + _this.origMarginTop[i] + ' + ' + offsetTop + 'px)' : offsetTop+'px';
            $('[cms-toolbar-offsetid='+i.toString()+']').css('marginTop', newMarginTop);
          }
        }
        else {
          $('[cms-toolbar-offsetid='+i.toString()+']').css('marginTop', _this.origMarginTop[i]);
        }
      }
    }
    this.currentOffsetTop = offsetTop;
  }

  this.renderErrors = function(){
    var jcontainer = $('#jsharmony_cms_editor_errors');
    jcontainer.toggle(!!_this.errors.length);
    jcontainer.empty();
    if(jcontainer.length && _this.errors.length){
      jcontainer.append($('<div class="jsharmony_cms_editor_errors_close">X</div>'));
      for(var i=0;i<_this.errors.length;i++){
        var error = _this.errors[i];
        var jmessage = $('<div class="jsharmony_cms_editor_error"></div>');
        if(error.type=='html') jmessage.html(error.message);
        else jmessage.text(error.message);
        jcontainer.append(jmessage);
      }
      jcontainer.find('.jsharmony_cms_editor_errors_close').on('click', function(){ $('#jsharmony_cms_editor_errors').hide(); });
    }
  }

  this.toggleAutoHide = function(val){
    if(typeof val =='undefined') val = !this.editorBarDocked;
    this.editorBarDocked = !!val;
    this.refreshOffsets();
    $('#jsharmony_cms_page_toolbar .autoHideEditorBar').toggleClass('enabled',!val);
  }
  
  this.toggleSlideoutButton = function(button, display, noSlide){
    var jbutton;
    if(!button) return;
    if(_.isString(button)) jbutton = $('#jsharmony_cms_page_toolbar .jsharmony_cms_button.'+button);
    else jbutton = $(button);
    $('#jsharmony_cms_page_toolbar .jsharmony_cms_button[data-slideout].selected').not(jbutton).each(function(){
      _this.toggleSlideoutButton(this, false, true);
      //Disable slide if another button is already selected
      noSlide = true;
    });
    var prevdisplay = !!jbutton.hasClass('selected');
    if(typeof display == 'undefined') display = !prevdisplay;
    
    if(prevdisplay==display) return;
    else {
      var jslideout = $('#jsharmony_cms_page_toolbar .jsharmony_cms_tabcontrol_container.'+jbutton.data('slideout'));
      if(display){
        //Open
        jbutton.addClass('selected');
        jslideout.stop(true);
        if(noSlide) jslideout.show();
        else jslideout.slideDown();
      }
      else {
        //Close
        if(!cms.controller.validate()) return;
        jbutton.removeClass('selected');
        jslideout.stop(true);
        if(noSlide) jslideout.hide();
        else jslideout.slideUp();
      }
    }
  }

  this.showSlideoutButton = function(buttonName, noSlide){ this.toggleSlideoutButton(buttonName, true, noSlide); }

  this.hideSlideoutButton = function(buttonName, noSlide){ this.toggleSlideoutButton(buttonName, false, noSlide); }
  
  this.showError = function(err) {
    if(_.isString(err)) err = { message: err, type: 'text' };
    err.type = (err.type=='html' ? 'html' : 'text');
    _this.errors.push(err);
    _this.renderErrors();
  }

  this.setDockPosition = function(dockPosition){
    _this.dockPosition = dockPosition || 'top_offset';
    _this.refreshOffsets();
    $('#jsharmony_cms_page_toolbar').toggleClass('jsharmony_cms_page_toolbar_bottom', _this.dockPosition=='bottom');
    $('#jsharmony_cms_content_editor_toolbar').toggleClass('jsharmony_cms_page_toolbar_bottom', _this.dockPosition=='bottom');

    if(_this.dockPosition == 'bottom'){
      $('#jsharmony_cms_page_toolbar').css('opacity', 0);
      var dockAnimation = function(){
        var barHeight = _this.getHeight();
        $('#jsharmony_cms_page_toolbar').css({ opacity: 1, bottom: '-'+barHeight+'px' })
        $('#jsharmony_cms_page_toolbar').animate({ bottom: '0px' }, function(){ this.style.bottom = null; });
      };
      if(cms.isInitialized) dockAnimation();
      else cms.loader.onLoadingComplete.push(dockAnimation);
    }
    cms.editor.renderContentEditorToolbar();
  }

}