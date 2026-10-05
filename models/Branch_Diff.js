jsh.App[modelid] = new (function(){
  var _this = this;

  this.field_mapping = {};

  this.branch_diff = {};

  //Event handler
  this.onRenderedDiff = [
    function(diff){
      jsh.XDom(diff, '.new_page').on('click', function(e){ _this.previewPage(this); e.preventDefault(); });
      jsh.XDom(diff, '.previous_page').on('click', function(e){ _this.previewPage(this); e.preventDefault(); });

      jsh.XDom(diff, '.new_media').on('click', function(e){ _this.previewMedia(this); e.preventDefault(); });
      jsh.XDom(diff, '.previous_media').on('click', function(e){ _this.previewMedia(this); e.preventDefault(); });

      jsh.XDom(diff, '.new_menu').on('click', function(e){ _this.previewMenu(this); e.preventDefault(); });
      jsh.XDom(diff, '.previous_menu').on('click', function(e){ _this.previewMenu(this); e.preventDefault(); });

      jsh.XDom(diff, '.new_sitemap').on('click', function(e){ _this.previewSitemap(this); e.preventDefault(); });
      jsh.XDom(diff, '.previous_sitemap').on('click', function(e){ _this.previewSitemap(this); e.preventDefault(); });
    }
  ];

  this.onload = function(xmodel, callback){
    var branch_merge_desc = xmodel.get('branch_merge_desc');
    if (typeof branch_merge_desc === 'string' && branch_merge_desc != '') {
      // the element is briefly visible, so you see a flash of yellow if style is staticly set
      jsh.xd('.branch_merge_desc').style['background-color'] = 'yellow';
    } else {
      jsh.xd('.branch_merge_desc').style.display = false;
    }
    jsh.System.renderEditorSelection(xmodel.controller.getLOV('site_editor'), xmodel.get('site_id'), xmodel.get('sys_user_site_editor'), { containerClass: 'diff_editor_selection_container' });
    //Load API Data
    this.loadData();
  };

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
  };

  this.processData = function(){
    for(var item_type in _this.branch_diff){
      _.each(_this.branch_diff[item_type], function(item){
        item['branch_'+item_type+'_action'] = (item['branch_'+item_type+'_action']||'').toString().toUpperCase();
      });
    }
  };

  this.render = function(){
    var xddiff = jsh.XDom('.diff_display');

    var map = function(key, dict){
      if(_this.field_mapping[dict] && (key in _this.field_mapping[dict])) return _this.field_mapping[dict][key];
      return key;
    };

    var tmpl = jsh.xd('.'+xmodel.class+'_template_diff_listing').html;
    var item_tmpl = {};
    for(var item_type in _this.branch_diff){
      item_tmpl[item_type] = jsh.xd('.'+xmodel.class+'_template_diff_' + item_type).html;
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
    };

    xddiff.html = XExt.renderClientEJS(tmpl, renderParams);

    XExt.trigger(_this.onRenderedDiff, xddiff.element);
  };

  this.previewPage = function(obj){
    var xdobj = jsh.XDom(obj);
    var page_template_id = xdobj.data['page_template_id'];
    var page_template_path = xdobj.data['page_template_path'];
    var page_key = xdobj.data['page_key'];
    var page_filename = xdobj.data['page_filename'];
    var page_id = xdobj.data['page_id'];

    if(!page_template_id) return XExt.Alert('Invalid page template');

    jsh.System.OpenPageEditor(page_key, page_filename, page_template_id, { source: 'branch_diff', branch_id: xmodel.get('branch_id'), rawEditorDialog: '.'+xmodel.class+'_RawTextEditor', page_id: page_id, page_template_path: page_template_path  });
  };

  this.previewMedia = function(obj){
    var xdobj = jsh.XDom(obj);
    var media_key = xdobj.data['media_key'];
    var media_id = xdobj.data['media_id'];
    var media_ext = xdobj.data['media_ext'];
    var media_width = xdobj.data['media_width'];
    var media_height = xdobj.data['media_height'];
    jsh.System.PreviewMedia(media_key, undefined, media_id, media_ext, media_width, media_height);
  };

  this.previewMenu = function(obj){
    var xdobj = jsh.XDom(obj);
    var menu_key = xdobj.data['menu_key'];
    var menu_id = xdobj.data['menu_id'];
    XExt.popupForm(xmodel.namespace+'Menu_Tree_Browse','browse', { menu_key: menu_key, menu_id: menu_id, branch_id: xmodel.get('branch_id') });
  };

  this.previewSitemap = function(obj){
    var xdobj = jsh.XDom(obj);
    var sitemap_key = xdobj.data['sitemap_key'];
    var sitemap_id = xdobj.data['sitemap_id'];
    XExt.popupForm(xmodel.namespace+'Sitemap_Tree_Browse','browse', { sitemap_key: sitemap_key, sitemap_id: sitemap_id, branch_id: xmodel.get('branch_id') });
  };

})();
