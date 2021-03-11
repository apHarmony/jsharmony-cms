jsh.App[modelid] = new (function(){
  var _this = this;

  this.field_mapping = {};

  this.branch_diff = {};

  //Event handler
  this.onRenderedDiff = [
    function(jdiff){
      jdiff.find('.new_page').on('click', function(e){ _this.previewPage(this); e.preventDefault(); });
      jdiff.find('.previous_page').on('click', function(e){ _this.previewPage(this); e.preventDefault(); });

      jdiff.find('.new_media').on('click', function(e){ _this.previewMedia(this); e.preventDefault(); });
      jdiff.find('.previous_media').on('click', function(e){ _this.previewMedia(this); e.preventDefault(); });

      jdiff.find('.new_menu').on('click', function(e){ _this.previewMenu(this); e.preventDefault(); });
      jdiff.find('.previous_menu').on('click', function(e){ _this.previewMenu(this); e.preventDefault(); });

      jdiff.find('.new_sitemap').on('click', function(e){ _this.previewSitemap(this); e.preventDefault(); });
      jdiff.find('.previous_sitemap').on('click', function(e){ _this.previewSitemap(this); e.preventDefault(); });
    }
  ];

  this.onload = function(xmodel, callback){
    var branch_merge_desc = xmodel.get('branch_merge_desc');
    if (typeof branch_merge_desc === 'string' && branch_merge_desc != '') {
      // the element is briefly visible, so you see a flash of yellow if style is staticly set
      $('.branch_merge_desc').css('background-color', 'yellow');
    } else {
      jsh.$root('.branch_merge_desc').hide();
    }
    jsh.System.renderEditorSelection(xmodel.controller.getLOV('site_editor'), xmodel.get('site_id'), xmodel.get('sys_user_site_editor'), { containerClass: 'diff_editor_selection_container' });
    //Load API Data
    this.loadData();
  }

  this.loadData = function(onComplete){
    var emodelid = '../_funcs/diff';
    XForm.Get(emodelid, { branch_id: xmodel.get('branch_id') }, { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.branch_diff = rslt.branch_diff || {};

        _this.processData();
        _this.render();
        if (onComplete) onComplete();
      }
      else XExt.Alert('Error while loading data');
    }, function (err) {
      //Optionally, handle errors
    });
  }

  this.processData = function(){
    for(var item_type in _this.branch_diff){
      _.each(_this.branch_diff[item_type], function(item){
        item['branch_'+item_type+'_action'] = (item['branch_'+item_type+'_action']||'').toString().toUpperCase();
      });
    }
  }

  this.render = function(){
    var jdiff = jsh.$('.diff_display');

    var map = function(key, dict){
      if(_this.field_mapping[dict] && (key in _this.field_mapping[dict])) return _this.field_mapping[dict][key];
      return key;
    }

    var tmpl = jsh.$root('.'+xmodel.class+'_template_diff_listing').html();
    var item_tmpl = {};
    for(var item_type in _this.branch_diff){
      item_tmpl[item_type] = jsh.$root('.'+xmodel.class+'_template_diff_' + item_type).html();
    }
    var renderParams = {
      _: _,
      jsh: jsh,
      branch_diff: _this.branch_diff,
      branch_type: (xmodel.get('branch_type')||'').toString().toUpperCase(),
      XExt: XExt,
      map: map,
    };
    renderParams.renderItemDiff = function(item_type, branch_item){
      var item_params = { branch_item: branch_item };
      item_params['branch_' + item_type] = branch_item;
      return XExt.renderClientEJS(item_tmpl[item_type], _.extend(item_params, renderParams));
    }

    jdiff.html(XExt.renderClientEJS(tmpl, renderParams));

    XExt.trigger(_this.onRenderedDiff, jdiff);
  }

  this.previewPage = function(obj){
    var jobj = $(obj);
    var page_template_id = jobj.data('page_template_id');
    var page_key = jobj.data('page_key');
    var page_filename = jobj.data('page_filename');
    var page_id = jobj.data('page_id');

    if(!page_template_id) return XExt.Alert('Invalid page template');

    jsh.System.OpenPageEditor(page_key, page_filename, page_template_id, { source: 'branch_diff', branch_id: xmodel.get('branch_id'), rawEditorDialog: '.'+xmodel.class+'_RawTextEditor', page_id: page_id  });
  }

  this.previewMedia = function(obj){
    var jobj = $(obj);
    var media_key = jobj.data('media_key');
    var media_id = jobj.data('media_id');
    var media_ext = jobj.data('media_ext');
    var media_width = jobj.data('media_width');
    var media_height = jobj.data('media_height');
    jsh.System.PreviewMedia(media_key, undefined, media_id, media_ext, media_width, media_height);
  }

  this.previewMenu = function(obj){
    var jobj = $(obj);
    var menu_key = jobj.data('menu_key');
    var menu_id = jobj.data('menu_id');
    XExt.popupForm(xmodel.namespace+'Menu_Tree_Browse','browse', { menu_key: menu_key, menu_id: menu_id })
  }

  this.previewSitemap = function(obj){
    var jobj = $(obj);
    var sitemap_key = jobj.data('sitemap_key');
    var sitemap_id = jobj.data('sitemap_id');
    XExt.popupForm(xmodel.namespace+'Sitemap_Tree_Browse','browse', { sitemap_key: sitemap_key, sitemap_id: sitemap_id })
  }

})();
