jsh.App[modelid] = new (function(){
  var _this = this;

  this.branch_validate = {};
  this.error_count = 0;

  //Event handler
  this.onRenderedValidate = [
    function(jvalidate){
      jvalidate.find('.view_page').on('click', function(e){ _this.previewPage(this); e.preventDefault(); });

      jvalidate.find('.view_media').on('click', function(e){ _this.previewMedia(this); e.preventDefault(); });

      jvalidate.find('.view_menu').on('click', function(e){ _this.previewMenu(this); e.preventDefault(); });

      jvalidate.find('.view_sitemap').on('click', function(e){ _this.previewSitemap(this); e.preventDefault(); });
    }
  ];
  

  this.onload = function(xmodel, callback){
    //Load API Data
    this.loadData();
  };

  this.loadData = function(onComplete){
    var emodelid = '../_funcs/validate';
    XForm.Get(emodelid, { branch_id: xmodel.get('branch_id') }, { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.branch_validate = rslt.branch_validate;
        _this.error_count = rslt.error_count;

        _this.render();
        if (onComplete) onComplete();
      }
      else XExt.Alert('Error while loading data');
    }, function (err) {
      //Optionally, handle errors
    });
  };

  this.render = function(){
    var jvalidate = jsh.$('.validate_'+xmodel.class);

    var tmpl = jsh.$root('.'+xmodel.class+'_template_validate_listing').html();
    var item_tmpl = {};
    for(var item_type in _this.branch_validate){
      item_tmpl[item_type] = jsh.$root('.'+xmodel.class+'_template_validate_' + item_type).html();
    }
    var renderParams = {
      _: _,
      jsh: jsh,
      branch_validate: _this.branch_validate,
      branch_type: (xmodel.get('branch_type')||'').toString().toUpperCase(),
      XExt: XExt,
    };
    renderParams.renderItemValidate = function(item_type, branch_item){
      var item_params = { branch_item: branch_item };
      item_params['branch_' + item_type] = branch_item;
      return XExt.renderClientEJS(item_tmpl[item_type], _.extend(item_params, renderParams));
    };

    jvalidate.html(XExt.renderClientEJS(tmpl, renderParams));

    XExt.trigger(_this.onRenderedValidate, jvalidate);

    jsh.System.renderEditorSelection(xmodel.controller.getLOV('site_editor'), xmodel.get('site_id'), xmodel.get('sys_user_site_editor'), { containerClass: 'diff_editor_selection_container' });
  };

  this.previewPage = function(obj){
    var jobj = $(obj);
    var page_template_id = jobj.data('page_template_id');
    var page_template_path = jobj.data('page_template_path');
    var page_key = jobj.data('page_key');
    var page_filename = jobj.data('page_filename');
    var page_id = jobj.data('page_id');

    if(!page_template_id) return XExt.Alert('Invalid page template');

    jsh.System.OpenPageEditor(page_key, page_filename, page_template_id, { source: 'branch_validate', branch_id: xmodel.get('branch_id'), rawEditorDialog: '.'+xmodel.class+'_RawTextEditor', page_id: page_id, page_template_path: page_template_path  });
  };

  this.previewMedia = function(obj){
    var jobj = $(obj);
    var media_key = jobj.data('media_key');
    var media_id = jobj.data('media_id');
    var media_ext = jobj.data('media_ext');
    var media_width = jobj.data('media_width');
    var media_height = jobj.data('media_height');
    jsh.System.PreviewMedia(media_key, undefined, media_id, media_ext, media_width, media_height);
  };

  this.previewMenu = function(obj){
    var jobj = $(obj);
    var menu_key = jobj.data('menu_key');
    var menu_id = jobj.data('menu_id');
    XExt.popupForm(xmodel.namespace+'Menu_Tree_Browse','browse', { menu_key: menu_key, menu_id: menu_id, branch_id: xmodel.get('branch_id') });
  };

  this.previewSitemap = function(obj){
    var jobj = $(obj);
    var sitemap_key = jobj.data('sitemap_key');
    var sitemap_id = jobj.data('sitemap_id');
    XExt.popupForm(xmodel.namespace+'Sitemap_Tree_Browse','browse', { sitemap_key: sitemap_key, sitemap_id: sitemap_id, branch_id: xmodel.get('branch_id') });
  };

})();
