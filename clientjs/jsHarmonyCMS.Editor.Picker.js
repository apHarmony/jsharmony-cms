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

exports = module.exports = function(jsh, cms, editor){
  var _this = this;
  var XExt = jsh.XExt;
  var lastMediaPath = undefined;
  var lastLinkPath = undefined;

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
    else if(filePickerType === 'link' && lastLinkPath) {
      if(lastLinkPath.init_media_path) return { init_media_path: lastLinkPath.init_media_path };
      else if(lastLinkPath.init_page_path) return { init_page_path: lastLinkPath.init_page_path };
    } 
    else if (filePickerType === 'media' && lastMediaPath) return { init_media_path: lastMediaPath };

    return {};
  }

  this.openLink = function(cb, value, meta){
    cms.filePickerCallback = cb;
    var qs = _this.getParameters('link', value);
    XExt.popupForm('jsHarmonyCMS/Link_Browser', 'browse', qs, { width: 1100, height: 600 });
  }

  this.openMedia = function(cb, value, meta){
    cms.filePickerCallback = cb;
    var qs = { };
    var linkurl = _this.getParameters('media', value);
    if(linkurl.init_media_key) qs.init_media_key = linkurl.init_media_key;
    else if(linkurl.init_media_path) qs.init_media_path = linkurl.init_media_path;
    XExt.popupForm('jsHarmonyCMS/Media_Browser', 'update', qs, { width: 1100, height: 600 });
  }

  this.onmessage = function(event, data){
    if(data.indexOf('cms_file_picker:')==0){
      if(!cms.filePickerCallback) return true;
      data = data.substr(16);
      var jdata = JSON.parse(data);
      if(cms.onFilePickerCallback && (cms.onFilePickerCallback(jdata))){}
      else if(jdata.media_key){
        lastMediaPath = jdata.media_folder;
        lastLinkPath = { init_media_path: jdata.media_folder };
        cms.filePickerCallback(cms._baseurl+'_funcs/media/'+jdata.media_key+'/?media_file_id='+jdata.media_file_id+'#@JSHCMS', jdata);
      }
      else if(jdata.page_key){
        lastLinkPath = { init_page_path: jdata.page_folder };
        cms.filePickerCallback(cms._baseurl+'_funcs/page/'+jdata.page_key+'/#@JSHCMS', jdata);
      }
      else XExt.Alert('Invalid response from File Browser: '+JSON.stringify(jdata));
      cms.filePickerCallback = null;
      return true;
    }
    return false;
  }
}