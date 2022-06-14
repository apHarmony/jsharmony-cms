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
  this.pageElements = [];
  this.origMarginTop = [];
  this.origMarginTopLoaded = false;
  this.currentOffsetTop = 0;
  this.dockPosition = 'top_offset';
  this.errors = [/*{ message: '...', type: 'text' (or 'html') }*/];

  this.excludeMarginOffsetId = ['cboxOverlay','colorbox'];
  this.excludeMarginOffsetClass = ['jsHarmonyElement'];
 
  this.render = function(){
    cms.util.addStyle('jsharmony_cms_editor_css',cms.views['jsh_cms_editor.css']);
    jsh.root.append(cms.views['jsh_cms_editor']);
    jsh.InitControls();
    this.renderErrors();
  };

  this.getHeight = function(){
    return $('#jsharmony_cms_page_toolbar .actions').outerHeight() || 0;
  };

  this.isAnchored = function(elem, computedStyles){
    if(elem.tagName && (elem.tagName.toUpperCase()=='BODY')) return true;
    if(computedStyles.position=='fixed') return true;
    if(computedStyles.position=='absolute'){
      //Check if there is a positioned ancestor
      var offsetParent = $(elem).offsetParent();
      if(offsetParent && offsetParent.length){
        offsetParent = offsetParent[0];
        if(offsetParent.tagName && _.includes(['HTML','BODY'], offsetParent.tagName.toUpperCase())) offsetParent = null;
      }
      else offsetParent = null;
      if(!offsetParent) return true;
    }
    return false;
  };

  this.excludeMarginOffset = function(jobj){
    var obj = jobj[0];
    for(let i=0;i<_this.excludeMarginOffsetId.length;i++){
      var excludeId = _this.excludeMarginOffsetId[i];
      if(obj.id == excludeId) return true;
      if(jobj.closest('#'+excludeId).length) return true;
    }
    for(let i=0;i<_this.excludeMarginOffsetClass.length;i++){
      var excludeClass = _this.excludeMarginOffsetClass[i];
      if(_.includes(obj.classList, excludeClass)) return true;
      if(jobj.closest('.'+excludeClass).length) return true;
    }
    return false;
  };

  this.saveOrigOffsets = function(options){
    options = _.extend({ preload: false, refreshExisting: false }, options);
    _.filter($('*').toArray(), function(elem){
      if(elem.id=='jsHarmonyCMSLoading') return;
      var computedStyles = window.getComputedStyle(elem);
      if(_this.isAnchored(elem, computedStyles)){
        var jelem = $(elem);
        var offsetId = jelem.attr('cms-toolbar-offsetid');
        if(typeof offsetId != 'undefined'){
          _this.pageElements[offsetId] = elem;
          if(!options.refreshExisting) return;
        }
        else if(jelem.parent().closest('[cms-content-editor]').length) return;
        else if(typeof jelem.attr('cms-toolbar-offset-exclude') != 'undefined') return;
        else if(_this.excludeMarginOffset(jelem)){
          jelem.attr('cms-toolbar-offset-exclude','1');
          return;
        }
        else{
          offsetId = _this.origMarginTop.length;
          jelem.attr('cms-toolbar-offsetid', offsetId);
        }
        _this.origMarginTop[offsetId] = computedStyles.marginTop;
        _this.pageElements[offsetId] = elem;
      }
    });
    if(!options.preload) _this.origMarginTopLoaded = true;
  };

  this.getOffsetTop = function(){
    var offsetTop = 0;
    if(this.editorBarDocked){
      if(_this.dockPosition == 'top_offset') offsetTop += _this.getHeight();
    }
    if(cms.editor) offsetTop += cms.editor.getOffsetTop();
    return offsetTop;
  };

  this.getComputedOffsetTop = function(elem){
    var computedStyles = window.getComputedStyle(elem);
    return computedStyles.marginTop;
  };

  function elementIsValid(obj){
    var parentNode = obj;
    var lastNode = null;
    while(parentNode){
      if(_.includes(['BODY','HTML'], (parentNode.nodeName||'').toUpperCase())) return true;
      lastNode = parentNode;
      parentNode = parentNode.parentNode;
      if(lastNode == parentNode) return false;
    }
    return true;
  }

  this.getPageElement = function(offsetId){
    let jelem = null;
    if(elementIsValid(_this.pageElements[offsetId])){
      jelem = $(_this.pageElements[offsetId]);
    }
    else{
      jelem = $('[cms-toolbar-offsetid='+offsetId.toString()+']');
      if(jelem.length) _this.pageElements[offsetId] = jelem[0];
    }
    return jelem;
  };

  this.refreshOffsets = function(options){
    options = _.extend({ addNewOffsets: false }, options);
    if(!_this.origMarginTopLoaded) return;
    if(options.addNewOffsets) _this.saveOrigOffsets();
    var offsetTop = _this.getOffsetTop();
    var origBodyOffset = null;
    var scrollTop = $(document).scrollTop();

    //Save starting offsets
    var startingOffsets = [];
    for(let i=0;i<_this.origMarginTop.length;i++){
      if(_this.origMarginTop[i] === null) continue;
      let jelem = _this.getPageElement(i);
      if(jelem.length){
        let elemIsBody = (jelem[0].tagName=='BODY');
        //Fixed elements need to subtract scrollTop from offset().top
        startingOffsets[i] = jelem.first().offset().top - (elemIsBody ? 0 : scrollTop);
        if(elemIsBody){
          origBodyOffset = _this.getComputedOffsetTop(jelem[0]);
        }
      }
    }

    //Apply offsets
    for(let i=0;i<_this.origMarginTop.length;i++){
      if(_this.origMarginTop[i] === null) continue;
      let jelem = _this.getPageElement(i);
      if(jelem.length){
        let elemIsBody = (jelem[0].tagName=='BODY');
        if(offsetTop){
          //Fixed elements need to subtract scrollTop from offset().top
          var curTop = jelem.first().offset().top - (elemIsBody ? 0 : scrollTop);
          if(curTop != startingOffsets[i]){
            //If offset changed automatically because of a parent / body offset, do not add the offset to this element
            _this.origMarginTop[i] = null;
            continue;
          }
          else {
            var newMarginTop = _this.origMarginTop[i] ? 'calc(' + _this.origMarginTop[i] + ' + ' + offsetTop + 'px)' : offsetTop+'px';
            jelem.css('marginTop', newMarginTop);
          }
        }
        else {
          jelem.css('marginTop', _this.origMarginTop[i]);
        }
        //If changing body offset
        if(scrollTop && elemIsBody){
          var newBodyOffset = _this.getComputedOffsetTop(jelem[0]);
          //Keep scroll position
          if(scrollTop && (origBodyOffset != newBodyOffset)){
            $(document).scrollTop(scrollTop + (parseInt(newBodyOffset) - parseInt(origBodyOffset)));
            scrollTop = $(document).scrollTop();
          }
        }
      }
    }
    this.currentOffsetTop = offsetTop;
  };

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
  };

  this.toggleAutoHide = function(val){
    if(typeof val =='undefined') val = !this.editorBarDocked;
    this.editorBarDocked = !!val;
    this.refreshOffsets();
    $('#jsharmony_cms_page_toolbar .autoHideEditorBar').toggleClass('enabled',!val);
  };
  
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
  };

  this.showSlideoutButton = function(buttonName, noSlide){ this.toggleSlideoutButton(buttonName, true, noSlide); };

  this.hideSlideoutButton = function(buttonName, noSlide){ this.toggleSlideoutButton(buttonName, false, noSlide); };
  
  this.showError = function(err) {
    if(_.isString(err)) err = { message: err, type: 'text' };
    err.type = (err.type=='html' ? 'html' : 'text');
    _this.errors.push(err);
    _this.renderErrors();
  };

  this.setDockPosition = function(dockPosition){
    _this.dockPosition = dockPosition || 'top_offset';
    _this.refreshOffsets();
    $('#jsharmony_cms_page_toolbar').toggleClass('jsharmony_cms_page_toolbar_bottom', _this.dockPosition=='bottom');
    $('#jsharmony_cms_content_editor_toolbar').toggleClass('jsharmony_cms_page_toolbar_bottom', _this.dockPosition=='bottom');

    if(_this.dockPosition == 'bottom'){
      $('#jsharmony_cms_page_toolbar').css('opacity', 0);
      var dockAnimation = function(){
        var barHeight = _this.getHeight();
        $('#jsharmony_cms_page_toolbar').css({ opacity: 1, bottom: '-'+barHeight+'px' });
        $('#jsharmony_cms_page_toolbar').animate({ bottom: '0px' }, function(){ this.style.bottom = null; });
      };
      if(cms.isInitialized) dockAnimation();
      else cms.loader.onLoadingComplete.push(dockAnimation);
    }
    cms.editor.renderContentEditorToolbar();
  };

};