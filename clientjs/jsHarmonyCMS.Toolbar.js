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
    jsh.xdroot.append(cms.views['jsh_cms_editor']);
    jsh.InitControls();
    this.renderErrors();
  };

  this.getHeight = function(){
    return jsh.XDom.calc.heightToBorder('#jsharmony_cms_page_toolbar .actions') || 0;
  };

  this.isAnchored = function(elem, computedStyles){
    if(elem.tagName && (elem.tagName.toUpperCase()=='BODY')) return true;
    if(computedStyles.position=='fixed') return true;
    if(computedStyles.position=='absolute'){
      //Check if there is a positioned ancestor
      var offsetParent = elem.offsetParent;
      if(offsetParent){
        if(offsetParent.tagName && _.includes(['HTML','BODY'], offsetParent.tagName.toUpperCase())) offsetParent = null;
      }
      else offsetParent = null;
      //Element is hidden
      if(!offsetParent && elem && (elem.offsetParent===null)) return false;
      if(!offsetParent) return true;
    }
    return false;
  };

  this.excludeMarginOffset = function(obj){
    for(let i=0;i<_this.excludeMarginOffsetId.length;i++){
      var excludeId = _this.excludeMarginOffsetId[i];
      if(obj.id == excludeId) return true;
      if(jsh.XDom.parent(obj, '#'+excludeId).length) return true;
    }
    for(let i=0;i<_this.excludeMarginOffsetClass.length;i++){
      var excludeClass = _this.excludeMarginOffsetClass[i];
      if(_.includes(obj.classList, excludeClass)) return true;
      if(jsh.XDom.parent(obj, '.'+excludeClass).length) return true;
    }
    return false;
  };

  this.saveOrigOffsets = function(options){
    options = _.extend({ preload: false, refreshExisting: false }, options);
    _.filter(jsh.XDom('*').elements, function(elem){
      if(elem.id=='jsHarmonyCMSLoading') return;
      var computedStyles = window.getComputedStyle(elem);
      if(_this.isAnchored(elem, computedStyles)){
        var xdelem = jsh.XDom(elem);
        var offsetId = xdelem.attr['cms-toolbar-offsetid'];
        if(typeof offsetId == 'string'){
          offsetId = parseInt(offsetId);
          _this.pageElements[offsetId] = elem;
          if(!options.refreshExisting) return;
        }
        else if(xdelem.parent().parent('[cms-content-editor]').length) return;
        else if(!_.isNil(xdelem.attr['cms-toolbar-offset-exclude'])) return;
        else if(_this.excludeMarginOffset(elem)){
          xdelem.attr['cms-toolbar-offset-exclude'] = '1';
          return;
        }
        else{
          offsetId = _this.origMarginTop.length;
          xdelem.attr['cms-toolbar-offsetid'] = offsetId;
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
    let elem = null;
    if(elementIsValid(_this.pageElements[offsetId])){
      elem = _this.pageElements[offsetId];
    }
    else{
      elem = jsh.XDom('[cms-toolbar-offsetid='+offsetId.toString()+']').element;
      if(elem) _this.pageElements[offsetId] = elem;
    }
    return elem;
  };

  this.refreshOffsets = function(options){
    options = _.extend({ addNewOffsets: false }, options);
    if(!_this.origMarginTopLoaded) return;
    if(options.addNewOffsets) _this.saveOrigOffsets();
    var offsetTop = _this.getOffsetTop();
    var origBodyOffset = null;
    var scrollTop = window.scrollY;

    //Save starting offsets
    var startingOffsets = [];
    for(let i=0;i<_this.origMarginTop.length;i++){
      if(_this.origMarginTop[i] === null) continue;
      let elem = _this.getPageElement(i);
      if(elem){
        let elemIsBody = (elem.tagName=='BODY');
        //Fixed elements need to subtract scrollTop from offset().top
        startingOffsets[i] = jsh.XDom.calc.top(elem) - (elemIsBody ? 0 : scrollTop);
        if(elemIsBody){
          origBodyOffset = _this.getComputedOffsetTop(elem);
        }
      }
    }

    //Apply offsets
    for(let i=0;i<_this.origMarginTop.length;i++){
      if(_this.origMarginTop[i] === null) continue;
      let elem = _this.getPageElement(i);
      if(elem){
        let elemIsBody = (elem.tagName=='BODY');
        if(offsetTop){
          //Fixed elements need to subtract scrollTop from offset().top
          var curTop = jsh.XDom.calc.top(elem) - (elemIsBody ? 0 : scrollTop);
          if(curTop != startingOffsets[i]){
            //If offset changed automatically because of a parent / body offset, do not add the offset to this element
            _this.origMarginTop[i] = null;
            continue;
          }
          else {
            var newMarginTop = _this.origMarginTop[i] ? 'calc(' + _this.origMarginTop[i] + ' + ' + offsetTop + 'px)' : offsetTop+'px';
            elem.style.marginTop = newMarginTop;
          }
        }
        else {
          elem.style.marginTop = _this.origMarginTop[i];
        }
        //If changing body offset
        if(scrollTop && elemIsBody){
          var newBodyOffset = _this.getComputedOffsetTop(elem);
          //Keep scroll position
          if(scrollTop && (origBodyOffset != newBodyOffset)){
            window.scrollY = (scrollTop + (parseInt(newBodyOffset) - parseInt(origBodyOffset)));
            scrollTop = window.scrollY;
          }
        }
      }
    }
    this.currentOffsetTop = offsetTop;
  };

  this.renderErrors = function(){
    var xdcontainer = jsh.XDom('#jsharmony_cms_editor_errors');
    xdcontainer.style.display = !!_this.errors.length;
    xdcontainer.clear();
    if(xdcontainer.length && _this.errors.length){
      xdcontainer.append('<div class="jsharmony_cms_editor_errors_close">X</div>');
      for(var i=0;i<_this.errors.length;i++){
        var error = _this.errors[i];
        var message = jsh.render('<div class="jsharmony_cms_editor_error"></div>');
        if(error.type=='html') message.innerHTML = error.message;
        else message.innerText = error.message;
        xdcontainer.append(message);
      }
      xdcontainer.get('.jsharmony_cms_editor_errors_close').on('click', function(){ jsh.XDom('#jsharmony_cms_editor_errors').style.display = false; });
    }
  };

  this.toggleAutoHide = function(val){
    if(typeof val =='undefined') val = !this.editorBarDocked;
    this.editorBarDocked = !!val;
    this.refreshOffsets();
    if (!val) {
      jsh.XDom.class.add('#jsharmony_cms_page_toolbar .autoHideEditorBar', 'enabled');
    } else {
      jsh.XDom.class.remove('#jsharmony_cms_page_toolbar .autoHideEditorBar', 'enabled');
    }
  };
  
  this.toggleSlideoutButton = function(button, display, noSlide){
    var xdbutton;
    if(!button) return;
    if(_.isString(button)) xdbutton = jsh.XDom('#jsharmony_cms_page_toolbar .jsharmony_cms_button.'+button);
    else xdbutton = jsh.XDom(button);
    jsh.XDom('#jsharmony_cms_page_toolbar .jsharmony_cms_button[data-slideout].selected').elements.forEach(function(el){
      if (el == xdbutton.element) return;
      _this.toggleSlideoutButton(el, false, true);
      //Disable slide if another button is already selected
      noSlide = true;
    });
    var prevdisplay = !!xdbutton.class.contains('selected');
    if(typeof display == 'undefined') display = !prevdisplay;
    
    if(prevdisplay==display) return;
    else {
      var xdslideout = jsh.XDom('#jsharmony_cms_page_toolbar .jsharmony_cms_tabcontrol_container.'+xdbutton.data.slideout);
      if(display){
        //Open
        xdbutton.class.add('selected');
        jsh.XDom.stop(xdslideout);
        if(noSlide) xdslideout.display = true;
        else xdslideout.animate.height(true);
      }
      else {
        //Close
        if(!cms.controller.validate()) return;
        xdbutton.class.remove('selected');
        jsh.XDom.stop(xdslideout);
        if(noSlide) xdslideout.display = false;
        else xdslideout.animate.height(false);
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
    if (_this.dockPosition=='bottom') {
      jsh.XDom('#jsharmony_cms_page_toolbar').class.add('jsharmony_cms_page_toolbar_bottom');
      jsh.XDom('#jsharmony_cms_content_editor_toolbar').class.add('jsharmony_cms_page_toolbar_bottom');
    } else {
      jsh.XDom('#jsharmony_cms_page_toolbar').class.remove('jsharmony_cms_page_toolbar_bottom');
      jsh.XDom('#jsharmony_cms_content_editor_toolbar').class.remove('jsharmony_cms_page_toolbar_bottom');
    }

    if(_this.dockPosition == 'bottom'){
      jsh.XDom('#jsharmony_cms_page_toolbar').stlye.opacity = 0;
      var dockAnimation = function(){
        var barHeight = _this.getHeight();
        var xdpageToolbar = jsh.XDom('#jsharmony_cms_page_toolbar');
        xdpageToolbar.style.opacity = 1;
        xdpageToolbar.style.bottom = '-'+barHeight+'px';
        xdpageToolbar.animate({ bottom: '0px' }, function(){ xdpageToolbar.style.bottom = null; });
      };
      if(cms.isInitialized) dockAnimation();
      else cms.loader.onLoadingComplete.push(dockAnimation);
    }
    cms.editor.renderContentEditorToolbar();
  };

};