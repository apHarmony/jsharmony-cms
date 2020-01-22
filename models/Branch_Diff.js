jsh.App[modelid] = new (function(){
  var _this = this;

  this.branch_pages = [];
  this.branch_media = [];
  this.branch_redirects = [];
  this.branch_menus = [];
  this.branch_sitemaps = [];
  this.deployment_target_params = {};

  this.onload = function(xmodel, callback){
    var branch_merge_desc = xmodel.get('branch_merge_desc');
    if (typeof branch_merge_desc === 'string' && branch_merge_desc != '') {
      // the element is briefly visible, so you see a flash of yellow if style is staticly set
      $('.branch_merge_desc').css('background-color', 'yellow');
    } else {
      jsh.$root('.branch_merge_desc').hide();
    }
    //Load API Data
    this.loadData();
  }

  this.loadData = function(onComplete){
    var emodelid = '../_funcs/diff';
    XForm.Get(emodelid, { branch_id: xmodel.get('branch_id') }, { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.deployment_target_params = rslt.deployment_target_params;
        _this.branch_pages = rslt.branch_pages;
        _this.branch_media = rslt.branch_media;
        _this.branch_redirects = rslt.branch_redirects;
        _this.branch_menus = rslt.branch_menus;
        _this.branch_sitemaps = rslt.branch_sitemaps;

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
    _.each(_this.branch_pages, function(branch_page){ branch_page.branch_page_action = (branch_page.branch_page_action||'').toString().toUpperCase(); });
    _.each(_this.branch_media, function(branch_media){ branch_media.branch_media_action = (branch_media.branch_media_action||'').toString().toUpperCase(); });
    _.each(_this.branch_menus, function(branch_menu){ branch_menu.branch_menu_action = (branch_menu.branch_menu_action||'').toString().toUpperCase(); });
    _.each(_this.branch_redirects, function(branch_redirect){ branch_redirect.branch_redirect_action = (branch_redirect.branch_redirect_action||'').toString().toUpperCase(); });
    _.each(_this.branch_sitemaps, function(branch_sitemap){ branch_sitemap.branch_sitemap_action = (branch_sitemap.branch_sitemap_action||'').toString().toUpperCase(); });
  }

  this.render = function(){
    var jdiff = jsh.$('.diff_display');

    var mapping = {};
    mapping.page_seo = {
      'title' : 'Title',
      'keywords': 'Keywords',
      'metadesc': 'Meta Description',
      'canonical_url': 'Canonical URL'
    };
    mapping.page = {
      'css': 'CSS',
      'header': 'Header Code',
      'footer': 'Footer Code',
      'page_title': 'Page Title',
      'template_title': 'Template'
    }
    mapping.menu = {
      'menu_name': 'Menu Name',
      'template_title': 'Template',
      'menu_path': 'Menu File Path',
      'menu_items': 'Menu Items'
    }
    mapping.sitemap = {
      'sitemap_name': 'Sitemap Name',
      'sitemap_items': 'Sitemap Items'
    }
    var map = function(key, dict){
      if(mapping[dict] && (key in mapping[dict])) return mapping[dict][key];
      return key;
    }

    var tmpl = jsh.$root('.'+xmodel.class+'_template_Changes_Listing').html();
    jdiff.html(XExt.renderClientEJS(tmpl, {
      _: _,
      jsh: jsh,
      branch_diff: this,
      branch_type: (xmodel.get('branch_type')||'').toString().toUpperCase(),
      XExt: XExt,
      map: map
    }));

    jdiff.find('.new_page').on('click', function(e){ _this.previewPage(this); e.preventDefault(); });
    jdiff.find('.previous_page').on('click', function(e){ _this.previewPage(this); e.preventDefault(); });

    jdiff.find('.new_media').on('click', function(e){ _this.previewMedia(this); e.preventDefault(); });
    jdiff.find('.previous_media').on('click', function(e){ _this.previewMedia(this); e.preventDefault(); });

    jdiff.find('.new_menu').on('click', function(e){ _this.previewMenu(this); e.preventDefault(); });
    jdiff.find('.previous_menu').on('click', function(e){ _this.previewMenu(this); e.preventDefault(); });

    jdiff.find('.new_sitemap').on('click', function(e){ _this.previewSitemap(this); e.preventDefault(); });
    jdiff.find('.previous_sitemap').on('click', function(e){ _this.previewSitemap(this); e.preventDefault(); });
  }

  this.previewPage = function(obj){
    var jobj = $(obj);
    var page_template_id = jobj.data('page_template_id');
    var page_key = jobj.data('page_key');
    var page_filename = jobj.data('page_filename');
    var page_id = jobj.data('page_id');

    if(!page_template_id) return XExt.Alert('Invalid page template');

    jsh.System.OpenPageEditor(page_key, page_filename, page_template_id, { branch_id: xmodel.get('branch_id'), rawEditorDialog: '.'+xmodel.class+'_RawTextEditor', page_id: page_id, deployment_target_params: _this.deployment_target_params  });
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
