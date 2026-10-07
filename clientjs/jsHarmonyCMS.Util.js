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

exports = module.exports = function(cms){
  
  this.setHTML = function(obj, html){
    try{
      cms.jsh.XDom.setHtml(obj, html);
    }
    catch(ex){
      console.log(ex); // eslint-disable-line no-console
    }
  };

  this.appendHTML = function(obj, html){
    try{
      cms.jsh.XDom.append(obj, html);
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

  this.disableControl = function(ctrl){
    cms.jsh.XDom.class.remove(ctrl, 'editable');
    cms.jsh.XDom.class.add(ctrl, 'uneditable');

    cms.jsh.XDom(ctrl).elements.forEach(function(obj){
      var xdobj = cms.jsh.XDom(obj);
      if (xdobj.class.contains('dropdown') || ((obj.nodeName||'').toUpperCase() =='SELECT')) xdobj.attr.disabled = true;
      else if (xdobj.class.contains('checkbox') || ((obj.type||'').toUpperCase()=='CHECKBOX')) xdobj.attr.disabled = true;
      else if (xdobj.class.contains('radio') || ((obj.type||'').toUpperCase()=='RADIO')) xdobj.attr.disabled = true;
      else if(xdobj.class.contains('xtagbox_base')){
        xdobj.previousSibling().class.add('uneditable');
        xdobj.previousSibling().get('input').attr.disabled = true;
      }
      else xdobj.attr.readonly = true;
    });
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