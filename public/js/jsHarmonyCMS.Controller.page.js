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

(function(cms){
  var _this = this;
  var jsh = cms.jsh;
  var XExt = jsh.XExt;
  var XValidate = jsh.XValidate;
  var $ = jsh.$;
  var _ = jsh._;
  var async = jsh.async;

  this.page_key = undefined;
  this.page_id = undefined;
  this.page_template_id = undefined;

  this.hasChanges = false;
  this.page = null;
  this.template = null;
  this.sitemap = {};
  this.menus = {};
  this.authors = [];
  this.role = '';

  this.init = function(){
    if(jsh._GET['page_key']) _this.page_key = jsh._GET['page_key'];
    if(jsh._GET['page_id']) _this.page_id = jsh._GET['page_id'];
    if(jsh._GET['page_template_id']) _this.page_template_id = jsh._GET['page_template_id'];

    if(_this.page_key){
      this.load(function(err){ cms.loader.StopLoading(); });
    }
    else{
      cms.loader.StopLoading();
      XExt.Alert('Page Key not defined in querystring');
    }
  }

  this.load = function(onComplete){
    var url = '../_funcs/page/'+_this.page_key;

    //Add querystring parameters
    var qs = {};
    if(_this.page_id) qs.page_id = _this.page_id;
    if(cms.branch_id) qs.branch_id = cms.branch_id;
    if(_this.page_template_id) qs.page_template_id = _this.page_template_id;
    if(!_.isEmpty(qs)) url += '?' + $.param(qs);
    
    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      XExt.waitUntil(
        function(){ return (cms.componentController.isInitialized && cms.menuController.isInitialized); },
        function(){
          if ('_success' in rslt) {
            //Populate arrays + create editor
            _this.hasChanges = false;
            $('#jsharmony_cms_editor_bar a.button.save').toggleClass('hasChanges', false);
            _this.page = rslt.page;
            _this.template = rslt.template;
            _this.sitemap = rslt.sitemap;
            _this.menus = rslt.menus||{};
            _this.authors = rslt.authors;
            _this.role = rslt.role;
            cms.views = _.extend(cms.views, rslt.views);
            cms.readonly = (_this.role=='VIEWER')||(page_id);
            XExt.execif(!cms.isInitialized, function(f){
              _this.createWorkspace(f);
            }, function(){
              _this.render();
              if(!cms.isInitialized){
                cms.onTemplateLoaded(function(){
                  cms.isInitialized = true;
                  if(onComplete) onComplete();
                });
              }
              else{ if(onComplete) onComplete(); }
            });
          }
          else{
            if(onComplete) onComplete(new Error('Error Loading Page'));
            XExt.Alert('Error loading page');
          }
        }
      );
    }, function (err) {
      if(onComplete) onComplete(err);
    });
  };

  this.createWorkspace = function(cb){
    if(!_this.page) return;

    //Initialize Page Toolbar
    cms.toolbar.render();

    //Template JS
    var js = (_this.template.js||'');
    if(js) _this.appendHTML($('head'), '<script type="text/javascript">'+js+'</script>');

    //Initialize Settings Controls
    _.each(['tags','author','css','header','footer'], function(key){ $('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_'+key).on('input keyup',function(){ if(!_this.hasChanges) cms.controller.getValues(); }); });
    _.each(['keywords','metadesc','canonical_url'], function(key){ $('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_seo_'+key).on('input keyup',function(){ if(!_this.hasChanges) cms.controller.getValues(); }); });
    $('#jsharmony_cms_editor_bar .page_settings .page_settings_title').on('input keyup', function(){ _this.onTitleUpdate(this); });
    $('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_title').on('input keyup', function(){ _this.onTitleUpdate(this); });
    $('#jsharmony_cms_editor_bar .actions .button.settings').on('click', function(){ cms.toolbar.toggleSettings(); });
    $('#jsharmony_cms_editor_bar .actions .button.save').on('click', function(){ _this.save(); });
    $('#jsharmony_cms_editor_bar .actions .button.autoHideEditorBar').on('click', function(){ cms.toolbar.toggleAutoHide(); });


    //Initialize Tag Control
    XExt.TagBox_Render($('#jsharmony_cms_editor_bar .page_settings_tags_editor'), $('#jsharmony_cms_editor_bar .page_settings_tags'));

    $(window).on('resize', function(){ cms.refreshLayout(); });
    $(window).on('scroll', function(){ cms.refreshLayout(); });
    cms.refreshLayout();

    _.each($('.jsharmony_cms_content'), function(obj){
      var jobj = $(obj);
      if(!jobj.data('id')) XExt.Alert('jsharmony_cms_content area missing data-id attribute');
      if(!obj.id) obj.id = 'jsharmony_cms_content_' + jobj.data('id');
    });

    if(cms.readonly){
      $('.jsharmony_cms_content').prop('contenteditable', false);
      if(cb) return cb();
    }
    else {
      cms.editor.init(function(){
        async.eachSeries($('.jsharmony_cms_content'), function(elem, editor_cb){
          cms.editor.attach('full', elem.id, {}, function(){ return editor_cb(); });
        }, function(err){
          //Initialize the title editor
          cms.editor.attach('text', 'jsharmony_cms_title', {}, function(){ return cb(); });
        });
      });

      $('.jsharmony_cms_content').on('input keyup',function(){ if(!_this.hasChanges) _this.getValues(); });
      $('#jsharmony_cms_title').on('input keyup',function(){ _this.onTitleUpdate(this); });

      $(window).bind('beforeunload', function(){
        _this.getValues();
        if(_this.hasChanges) return 'You have unsaved changes.  Are you sure you want to leave this page?';
      });
    }
  }

  this.render = function(){
    if(!_this.page) return;
    var jeditorbar = $('#jsharmony_cms_editor_bar');

    //Title
    _this.renderTitle();

    //Content
    for(var key in _this.template.content_elements){
      cms.editor.setContent(key, _this.page.content[key])
      if(!cms.readonly) _this.page.content[key] = cms.editor.getContent(key);
    }

    cms.componentController.render();
    cms.menuController.render();

    //CSS
    cms.util.removeStyle('jsharmony_cms_template_style');
    cms.util.removeStyle('jsharmony_cms_page_style');
    cms.util.addStyle('jsharmony_cms_template_style',_this.template.css);
    cms.util.addStyle('jsharmony_cms_page_style',_this.page.css);
    
    //Header
    var header = (_this.template.header||'')+(_this.page.header||'');
    if(header) cms.util.appendHTML($('head'), header);
    
    //Footer
    cms.util.setHTML($('#jsharmony_cms_footer'), (_this.template.footer||'')+(_this.page.footer||''));

    //Page Settings
    var authors = [].concat(_this.authors);
    if(_this.role=='PUBLISHER') authors.unshift({ code_val: '', code_txt: 'Please select...' });
    XExt.RenderLOV(null, jeditorbar.find('.page_settings_author'), authors);
    _.each(['title','tags','author','css','header','footer'], function(key){ jeditorbar.find('.page_settings').find('.page_settings_'+key).val(_this.page[key]||''); });
    _.each(['title','keywords','metadesc','canonical_url'], function(key){ jeditorbar.find('.page_settings').find('.page_settings_seo_'+key).val(_this.page.seo[key]||''); });
    XExt.TagBox_Refresh(jeditorbar.find('.page_settings_tags_editor'), jeditorbar.find('.page_settings_tags'));

    
    if(cms.readonly){
      jeditorbar.find('.save').hide();
      jeditorbar.find('.readonly').show();
      jeditorbar.find('.page_settings_ctrl,textarea,select').each(function(){ cms.util.disableControl($(this)); });
    }
  }

  this.renderTitle = function(src){
    var jsrc = $(src);
    if(!src || (src.id != 'jsharmony_cms_title')){
      if(cms.readonly) $('#jsharmony_cms_title').text(_this.page.title);
      else window.tinymce.get('jsharmony_cms_title').setContent(_this.page.title);
    }
    if(!src || !jsrc.hasClass('page_settings_title')) $('#jsharmony_cms_editor_bar .page_settings .page_settings_title').val(_this.page.title);
    if(!src || !jsrc.hasClass('page_settings_seo_title')) $('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_title').val(_this.page.seo.title);
    $('#jsharmony_cms_editor_bar').find('.title').html('<b>Title:</b> '+XExt.escapeHTML(_this.page.title));
    document.title = (_this.page.seo.title ? _this.page.seo.title : _this.page.title);
    var titleIsVisible = $('#jsharmony_cms_title').is(':visible');
    if(titleIsVisible && !_this.page.title) $('#jsharmony_cms_title').hide();
    else if(!titleIsVisible && _this.page.title) $('#jsharmony_cms_title').show();
  }

  this.onTitleUpdate = function(src, val){
    if(cms.readonly) return;
    var prev_hasChanges = _this.hasChanges;
    var new_page_title = _this.page.title;
    var new_seo_title = _this.page.seo.title;
    var jsrc = $(src);
    if(src.id=='jsharmony_cms_title') new_page_title = window.tinymce.get('jsharmony_cms_title').getContent();
    else if(jsrc.hasClass('page_settings_title')) new_page_title = $('#jsharmony_cms_editor_bar .page_settings .page_settings_title').val();
    else if(jsrc.hasClass('page_settings_seo_title')) new_seo_title = $('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_title').val();
    if(new_page_title != _this.page.title){ _this.page.title = new_page_title; _this.hasChanges = true; }
    if(new_seo_title != _this.page.seo.title){ _this.page.seo.title = new_seo_title; _this.hasChanges = true; }
    _this.renderTitle(src);
    if(_this.hasChanges && !prev_hasChanges) _this.getValues();
  }

  this.getValues = function(){
    if(cms.readonly) return;

    for(var key in _this.template.content_elements){
      var editorContent = cms.editor.getContent(key);
      if(editorContent != _this.page.content[key]){
        _this.page.content[key] = editorContent;
        _this.hasChanges = true;
      }
    }
    _.each(['tags','author','css','header','footer'], function(key){
      var val = $('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_'+key).val();
      if(val != (_this.page[key]||'')){ _this.page[key] = val; _this.hasChanges = true; }
    });
    _.each(['keywords','metadesc','canonical_url'], function(key){
      var val = $('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_seo_'+key).val();
      if(val != (_this.page.seo[key]||'')){ _this.page.seo[key] = val; _this.hasChanges = true; }
    });
    if(_this.hasChanges){
      $('#jsharmony_cms_editor_bar a.button.save').toggleClass('hasChanges', true);
    }
  }

  this.validate = function(){
    //Get updated page data
    _this.getValues();

    //Validate
    var validation = new XValidate(jsh);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_title', '_obj.title', 'Page Title', 'U', [ XValidate._v_MaxLength(1024) ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_tags', '_obj.tags', 'Tags', 'U', [ ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_author', '_obj.author', 'Author', 'U', [ XValidate._v_Required() ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_title', '_obj.seo.title', 'SEO Title Tag', 'U', [ XValidate._v_MaxLength(2048) ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_keywords', '_obj.seo.keywords', 'SEO Meta Keywords', 'U', [ ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_metadesc', '_obj.seo.metadesc', 'SEO Meta Description', 'U', [ ]);
    validation.AddControlValidator('#jsharmony_cms_editor_bar .page_settings .page_settings_seo_canonical_url', '_obj.seo.canonical_url', 'SEO Canonical URL', 'U', [ XValidate._v_MaxLength(2048) ]);

    if(!validation.ValidateControls('U', _this.page)){
      //Open settings if settings have an error
      var settings_error = false;
      _.each(['title','tags','author'], function(key){ if($('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_'+key).hasClass('xinputerror')){ settings_error = true; $('#jsharmony_cms_editor_bar .xtab[for=jsharmony_cms_page_settings_overview]').click(); } });
      if(!settings_error) _.each(['title','keywords','metadesc','canonical_url'], function(key){ if($('#jsharmony_cms_editor_bar .page_settings').find('.page_settings_seo_'+key).hasClass('xinputerror')){ settings_error = true; $('#jsharmony_cms_editor_bar .xtab[for=jsharmony_cms_page_settings_seo]').click(); } });
      if(settings_error){
        cms.toolbar.showSettings();
      }
      return false;
    }
    return true;
  }

  this.save = function(){
    //Validate
    if(!_this.validate()) return;

    //Execute the save function
    var startTime = Date.now();
    cms.loader.StartLoading();
    var url = '../_funcs/page/'+_this.page_key;

    //Add querystring parameters
    var qs = {};
    if(_this.branch_id) qs.branch_id = _this.branch_id;
    if(_this.page_template_id) qs.page_template_id = _this.page_template_id;
    if(!_.isEmpty(qs)) url += '?' + $.param(qs);

    cms.toolbar.hideSettings(true);
    XExt.CallAppFunc(url, 'post', _this.page, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.hasChanges = false;
        _this.load(function(err){
          var timeLeft = 500-(Date.now()-startTime);
          if(timeLeft > 0) window.setTimeout(function(){ cms.loader.StopLoading(); }, timeLeft);
          else cms.loader.StopLoading();
        });
        cms.util.refreshParentPageTree(rslt.page_folder, _this.page_key);
      }
      else{
        cms.loader.StopLoading();
        XExt.Alert('Error loading page');
      }
    }, function (err) {
      cms.loader.StopLoading();
      //Optionally, handle errors
    });
  }

  this.getComponentRenderParameters = function(component_id){
    return {
      _: _,
      escapeHTML: XExt.xejs.escapeHTML,
      page: _this.page,
      template: _this.template,
      sitemap: _this.sitemap,
      getSitemapURL: function(sitemap_item){ return '#'; },
      isInEditor: true,
    }
  }

  this.getMenuRenderParameters = function(menu_tag){
    return {
      _: _,
      escapeHTML: XExt.xejs.escapeHTML,
      page: _this.page,
      template: _this.template,
      sitemap: _this.sitemap,
      getSitemapURL: function(sitemap_item){ return '#'; },
      menu: _this.menus[menu_tag],
      getMenuURL: function(menu_item){ return '#'; },
      isInEditor: true,
    }
  }

  cms.controller = this;

})(jsHarmonyCMSInstance);
