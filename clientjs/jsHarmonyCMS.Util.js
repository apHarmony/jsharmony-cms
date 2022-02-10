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

exports = module.exports = function(){
  
  this.setHTML = function(jobj, html){
    try{
      jobj.html(html);
    }
    catch(ex){
      console.log(ex); // eslint-disable-line no-console
    }
  };

  this.appendHTML = function(jobj, html){
    try{
      jobj.append(html);
    }
    catch(ex){
      console.log(ex); // eslint-disable-line no-console
    }
  };

  this.refreshParentPageTree = function(page_folder, page_key){
    if(window.opener){
      window.opener.postMessage('jsharmony-cms:refresh_page_folder:'+page_folder, '*');
      if(page_key) window.opener.postMessage('jsharmony-cms:refresh_page_key:'+page_key, '*');
    }
  };

  this.disableControl = function(jctrl){
    jctrl.removeClass('editable');
    jctrl.addClass('uneditable');

    if (jctrl.hasClass('dropdown')) jctrl.prop('disabled', true);
    else if (jctrl.hasClass('checkbox')) jctrl.prop('disabled', true);
    else if(jctrl.hasClass('xtagbox_base')){
      jctrl.prev().addClass('uneditable');
      jctrl.prev().find('input').prop('disabled', true);
    }
    else jctrl.prop('readonly', true);
  };

  this.loadScript = function(url, cb){
    var script = document.createElement('script');
    if(cb) script.onload = cb;
    script.src = url;
    document.head.appendChild(script);
  };

  this.loadCSS = function(url, cb){
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = url;
    link.media = 'all';
    document.head.appendChild(link);
  };

  this.addStyle = function(id, css){
    var style = document.createElement('style');
    style.type = 'text/css';
    style.media = 'all';
    style.id = id;
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  };

  this.removeStyle = function(id){
    var elem = document.getElementById(id);
    if(elem) elem.parentNode.removeChild(elem);
  };
};