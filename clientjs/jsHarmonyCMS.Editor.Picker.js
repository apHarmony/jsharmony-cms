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
  var XExt = jsh.XExt;
  var $ = jsh.$;
  
  this.lastMediaPath = undefined;
  this.lastLinkPath = undefined;

  this.getParameters = function(filePickerType, url){
    url = (url||'').toString();
    if(cms.onGetFilePickerParameters){
      var qs = cms.onGetFilePickerParameters(filePickerType, url);
      if(qs) return qs;
    }
    if(url.indexOf('#@JSHCMS') >= 0){
      var urlparts = document.createElement('a');
      urlparts.href = url;
      var patharr = (urlparts.pathname||'').split('/');
      if(((urlparts.pathname||'').indexOf('/_funcs/media/')==0) && (patharr.length>=4)){
        var media_key = parseInt(patharr[3]);
        if(media_key.toString()==patharr[3]) return { init_media_key: media_key };
      }
      if(((urlparts.pathname||'').indexOf('/_funcs/page/')==0) && (patharr.length>=4)){
        var page_key = parseInt(patharr[3]);
        if(page_key.toString()==patharr[3]) return { init_page_key: page_key };
      }
    }
    else if((filePickerType === 'link') && _this.lastLinkPath) {
      if(_this.lastLinkPath.init_media_path) return { init_media_path: _this.lastLinkPath.init_media_path };
      else if(_this.lastLinkPath.init_page_path) return { init_page_path: _this.lastLinkPath.init_page_path };
    }
    else if ((filePickerType === 'media') && _this.lastMediaPath) return { init_media_path: _this.lastMediaPath.init_media_path };

    return {};
  };

  this.openLink = function(cb, value, meta){
    cms.filePickerCallback = cb;
    var qs = _this.getParameters('link', value);
    XExt.popupForm('jsHarmonyCMS/Link_Browser', 'update', qs, { width: 1100, height: 600 });
  };

  this.openMedia = function(cb, value, meta){
    cms.filePickerCallback = cb;
    var qs = _this.getParameters('media', value);
    XExt.popupForm('jsHarmonyCMS/Media_Browser', 'update', qs, { width: 1100, height: 600 });
  };

  this.openMediaEditor = function(cb, imageSource) {
    cms.mediaEditorCallback = cb;
    XExt.popupForm('jsHarmonyCMS/Media_Editor', 'update', { image_source: imageSource }, { width: 1100, height: 750 });
  }

  this.onmessage = function(event, data){
    if(data.indexOf('cms_file_picker:')==0){
      if(!cms.filePickerCallback) return true;
      data = data.substr(16);
      var jdata = JSON.parse(data);
      if(cms.onFilePickerCallback && (cms.onFilePickerCallback(jdata))){ /* Do nothing */ }
      else if(jdata.media_key){
        _this.lastMediaPath = { init_media_path: jdata.media_folder };
        _this.lastLinkPath = { init_media_path: jdata.media_folder };
        if(jdata.media_path) jdata.text = XExt.basename(jdata.media_path);
        cms.filePickerCallback(cms._baseurl+'_funcs/media/'+jdata.media_key+'/?media_file_id='+jdata.media_file_id+'#@JSHCMS', jdata);
      }
      else if(jdata.page_key){
        _this.lastLinkPath = { init_page_path: jdata.page_folder };
        if(jdata.page_title) jdata.text = jdata.page_title;
        cms.filePickerCallback(cms._baseurl+'_funcs/page/'+jdata.page_key+'/#@JSHCMS', jdata);
      }
      else XExt.Alert('Invalid response from File Browser: '+JSON.stringify(jdata));
      cms.filePickerCallback = null;
      return true;
    }
    else if (data.indexOf('cms_media_editor:')==0){
      var jdata = JSON.parse(data.slice('cms_media_editor:'.length));
      if (cms.mediaEditorCallback) cms.mediaEditorCallback(jdata);
      cms.mediaEditorCallback = null;
    }
    return false;
  };

  this.fileSelector_onGetValue = function(val, field, xmodel, jctrl, parentobj){
    return jctrl.find('input.jsharmony_cms_fileselector').val();
  };

  this.fileSelector_render = function(fileSelectorType, xmodel, field, val){  //fileSelectorType = link_browser or media_browser
    return XExt.renderEJS(jsh.$('.jsharmony_cms_fileselector_template').html(), xmodel.id, {
      fileSelectorType: fileSelectorType,
      field: field,
      val: val,
    });
  };

  this.fileSelector_onChange = function(obj){
    var jobj = $(obj);
    var jctrl = jobj.closest('.xform_ctrl');
    var xform = XExt.getFormFromObject(obj);
    if(jctrl.length && xform){
      if(!jctrl.hasClass('editable')) return;
      xform.Data.OnControlUpdate(jctrl[0]);
    }
  };

  this.fileSelector_reset = function(obj){
    var jobj = $(obj);
    var jparent = jobj.closest('.jsharmony_cms_fileselector_container');
    var jtext = jparent.find('input.jsharmony_cms_fileselector');
    jtext.val('');
    _this.fileSelector_onChange(obj);
  };

  this.fileSelector_browse = function(obj){
    var jobj = $(obj);
    var jparent = jobj.closest('.jsharmony_cms_fileselector_container');
    var jtext = jparent.find('input.jsharmony_cms_fileselector');
    var fileSelectorType = jparent.data('fileselectortype');
    var val = jtext.val();
    if(fileSelectorType == 'link_browser'){
      _this.openLink(function(url, data) {
        jtext.val(url);
        _this.fileSelector_onChange(obj);
      }, val);
    }
    else if(fileSelectorType == 'media_browser'){
      _this.openMedia(function(url, data) {
        jtext.val(url);
        _this.fileSelector_onChange(obj);
      }, val);
    }
    else XExt.Alert('Invalid File Selector Type: '+fileSelectorType);
  };
};