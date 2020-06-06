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

var jsHarmonyCMSEditorPicker = require('./jsHarmonyCMS.Editor.Picker.js');

exports = module.exports = function(jsh, cms, toolbarElement){
  var _this = this;

  var $ = jsh.$;
  var _ = jsh._;
  var XExt = jsh.XExt;

  this.isEditing = false;
  this.picker = new jsHarmonyCMSEditorPicker(jsh, cms, this);
  this.defaultConfig = {};
  this.toolbarElement = null;
  this.toolbarElementId = null;

  this.onBeginEdit = null; //function(editor){};
  this.onEndEdit = null; //function(editor){};


  this.editorConfig = {
    base: null,
    full: null,
    text: null
  };

  this.init = function(cb){
    if(!cb) cb = function(){};

    //Initialize Editor
    _this.initializeToolbarElement(toolbarElement);
    XExt.TinyMCE('', undefined, function(){

      //Change text labels
      window.tinymce.addI18n('en', {
        'Media...': 'Video...',
        'Insert / Edit': 'Video...',
        'Insert/edit media': 'Insert/edit video',
        'Insert/Edit Media': 'Insert/Edit Video',
      });

      //Initialize each content editor
      _this.editorConfig.base = _.extend({}, {
        inline: true,
        branding: false,
        browser_spellcheck: true,
        valid_elements: '+*[*],#p',
        entity_encoding: 'numeric',
        plugins: [
          'advlist autolink autoresize lists link image charmap anchor',
          'searchreplace visualblocks code fullscreen wordcount template',
          'insertdatetime media table paste code noneditable jsharmony'
        ],
        toolbar: 'formatselect | forecolor backcolor | bold italic underline | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link  image table fullscreen | jsHarmonyComponents',
        removed_menuitems: 'newdocument',
        image_advtab: true,
        menu: {
          edit: { title: 'Edit', items: 'undo redo | cut copy paste | selectall | searchreplace' },
          view: { title: 'View', items: 'code | visualaid visualchars visualblocks | spellchecker | preview fullscreen' },
          insert: { title: 'Insert', items: 'image link media template codesample inserttable | charmap emoticons hr | pagebreak nonbreaking anchor toc | insertdatetime' },
          format: { title: 'Format', items: 'bold italic underline strikethrough superscript subscript codeformat | formats | forecolor backcolor | removeformat' },
          tools: { title: 'Tools', items: 'spellchecker spellcheckerlanguage | code wordcount' },
          table: { title: 'Table', items: 'inserttable tableprops deletetable row column cell' },
          help: { title: 'Help', items: 'help' }
        },
        file_picker_types: 'file image',
        file_picker_callback: function(cb, value, meta) {
          // Provide file and text for the link dialog
          if (meta.filetype == 'file') _this.picker.openLink(cb, value, meta);
          else if (meta.filetype == 'image') _this.picker.openMedia(cb, value, meta);
        },
        relative_urls: false,
        urlconverter_callback: function(url, node, on_save, name){
          var urlparts = document.createElement('a');
          var urlparts_editor = document.createElement('a');
          urlparts.href = url;
          urlparts_editor.href = document.location;
          if(urlparts.host == urlparts_editor.host){
            url = url.replace(/^[^:]*\:\/{2}[^/]*\/(.*)/, '/$1');
          }
          url = url;
          return url;
        },
        fixed_toolbar_container: '#' + _this.toolbarElementId,
      }, _this.defaultConfig);

      _this.editorConfig.full = _.extend({}, _this.editorConfig.base, {
        init_instance_callback: function(editor){
          editor.on('focus', function(){
            _this.isEditing = editor.id.substr(('jsharmony_cms_content_').length);
            _this.toolbarElement.stop(true).animate({ opacity:1 },300);
            cms.refreshLayout();
            if(_this.onBeginEdit) _this.onBeginEdit(editor);
          });
          editor.on('blur', function(){
            _this.isEditing = false;
            _this.toolbarElement.stop(true).animate({ opacity:0 },300);
            if(_this.onEndEdit) _this.onEndEdit(editor);
          });
          editor.on('jsHarmonyRenderComponent', function(e) {
            var el = $(editor.targetElm).find('[data-component="' + e.componentType + '"][data-component-id="' + e.componentId + '"]')[0];
            if (el) cms.componentController.renderComponent(el);
          });
        }
      });

      _this.editorConfig.text = _.extend({}, _this.editorConfig.base, {
        inline: true,
        branding: false,
        toolbar: '',
        valid_elements: '',
        valid_styles: {
          '*': ''
        },
        menubar: false,
        browser_spellcheck: true
      });

      return cb();
    });
  }

  this.attach = function(config_id, elem_id, options, cb){
    if(!(config_id in _this.editorConfig)) throw new Error('Editor config ' + (config_id||'').toString() + ' not defined');
    var config = _.extend({ selector: '#' + elem_id }, _this.editorConfig[config_id], options);
    if(cb) config.init_instance_callback = XExt.chainToEnd(config.init_instance_callback, cb);
    window.tinymce.init(config);
  }

  this.detach = function(id){
    var editor = window.tinymce.get('jsharmony_cms_content_'+id);
    if(editor){
      if(_this.isEditing == id) editor.fire('blur');
      editor.destroy();
    }
  }

  this.setContent = function(id, val){
    if(cms.readonly){
      //Delay load, so that errors in the HTML do not stop the page loading process
      window.setTimeout(function(){ $('#jsharmony_cms_content_'+id).html(val); },1);
    }
    else {
      var editor = window.tinymce.get('jsharmony_cms_content_'+id);
      if(!editor) throw new Error('Editor not found: '+id);
      if(!_this.isInitialized) editor.undoManager.clear();
      editor.setContent(val);
      if(!_this.isInitialized) editor.undoManager.add();
    }
  }

  this.getContent = function(id){
    var editor = window.tinymce.get('jsharmony_cms_content_'+id);
    if(!editor) throw new Error('Editor not found: '+id);
    return editor.getContent();
  }

  this.initializeToolbarElement = function(element) {
    this.toolbarElement = $(element);
    this.toolbarElementId = this.toolbarElement.attr('id');
    if (!this.toolbarElementId) {
      this.toolbarElementId = '_' + Math.random().toString().replace('.', '');
      this.toolbarElement.attr('id', this.toolbarElementId);
    }
  }
}