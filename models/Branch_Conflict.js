jsh.App[modelid] = new (function(){
  var _this = this;

  this.branch_pages = [];
  this.branch_media = [];
  this.branch_redirects = [];
  this.branch_menus = [];
  this.branch_sitemaps = [];
  this.deployment_target_params = {};
  this.conflicts = 0;
  this.resolved = 0;
  this.unresolved = 0;

  this.onload = function(xmodel, callback){
    //Load API Data
    this.loadData();
  }

  this.loadData = function(onComplete){
    var emodelid = '../_funcs/conflict';
    XForm.Get(emodelid, { src_branch_id: xmodel.get('branch_merge_id'), dst_branch_id: xmodel.get('branch_id') }, { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.deployment_target_params = rslt.deployment_target_params;

        _this.branch_pages = rslt.branch_pages;
        _this.conflicts = _this.conflicts + rslt.branch_pages.length;
        _this.unresolved = _this.unresolved + rslt.branch_pages.filter(function(bp) {return bp.page_merge_id == null && bp.branch_page_merge_action == null;}).length;

        _this.branch_media = rslt.branch_media;
        _this.conflicts = _this.conflicts + rslt.branch_media.length;
        _this.unresolved = _this.unresolved + rslt.branch_media.filter(function(bm) {return bm.media_merge_id == null && bm.branch_media_merge_action == null;}).length;

        _this.branch_redirects = rslt.branch_redirects;
        _this.conflicts = _this.conflicts + rslt.branch_redirects.length;
        _this.unresolved = _this.unresolved + rslt.branch_redirects.filter(function(br) {return br.redirect_merge_id == null && br.branch_redirect_merge_action == null;}).length;

        _this.branch_menus = rslt.branch_menus;
        _this.conflicts = _this.conflicts + rslt.branch_menus.length;
        _this.unresolved = _this.unresolved + rslt.branch_menus.filter(function(bm) {return bm.menu_merge_id == null && bm.branch_menu_merge_action == null;}).length;

        _this.branch_sitemaps = rslt.branch_sitemaps;
        _this.conflicts = _this.conflicts + rslt.branch_sitemaps.length;
        _this.unresolved = _this.unresolved + rslt.branch_sitemaps.filter(function(bs) { return bs.sitemap_merge_id == null && bs.branch_sitemap_merge_action == null;}).length;

        _this.resolved = _this.conflicts - _this.unresolved;

        _this.render();
        if (onComplete) onComplete();
      }
      else XExt.Alert('Error while loading data');
    }, function (err) {
      //Optionally, handle errors
    });
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

    var tmpl = jsh.$root('.'+xmodel.class+'_Changes_Listing').html();
    var templates = {};

    var ejsenv = {
      _: _,
      jsh: jsh,
      XExt: XExt,
    };

    function render(t, data) {
      return jsh.ejs.compile(t, {client: true, delimiter: '#'})(_.assign(data, ejsenv), null, include);
    }

    function include(path, data) {
      var t = templates[path];
      if (!t) {
        t = templates[path] = jsh.$root('.'+xmodel.class+'_'+path).html();
      }
      if (t) {
        return render(t, data);
      } else {
        throw "Template '"+path+"' not found";
      }
    }

    jdiff.html(render(tmpl, {
      branch_diff: this,
      branch_type: (xmodel.get('branch_type')||'').toString().toUpperCase(),
      map,
    }));

    jdiff.find('.preview_page').on('click', function(e){ _this.previewPage(this); e.preventDefault(); });
    jdiff.find('.button_pick_page').on('click', function(e){ _this.pickPage(this); e.preventDefault(); });
    jdiff.find('.button_unresolve_page').on('click', function(e){ _this.pickPage(this); e.preventDefault(); });

    jdiff.find('.preview_media').on('click', function(e){ _this.previewMedia(this); e.preventDefault(); });
    jdiff.find('.button_pick_media').on('click', function(e){ _this.pickMedia(this); e.preventDefault(); });
    jdiff.find('.button_unresolve_media').on('click', function(e){ _this.pickMedia(this); e.preventDefault(); });

    jdiff.find('.preview_menu').on('click', function(e){ _this.previewMenu(this); e.preventDefault(); });
    jdiff.find('.button_pick_menu').on('click', function(e){ _this.pickMenu(this); e.preventDefault(); });
    jdiff.find('.button_unresolve_menu').on('click', function(e){ _this.pickMenu(this); e.preventDefault(); });

    jdiff.find('.preview_sitemap').on('click', function(e){ _this.previewSitemap(this); e.preventDefault(); });
    jdiff.find('.button_pick_sitemap').on('click', function(e){ _this.pickSitemap(this); e.preventDefault(); });
    jdiff.find('.button_unresolve_sitemap').on('click', function(e){ _this.pickSitemap(this); e.preventDefault(); });

    jdiff.find('.button_pick_redirect').on('click', function(e){ _this.pickRedirect(this); e.preventDefault(); });
    jdiff.find('.button_unresolve_redirect').on('click', function(e){ _this.pickRedirect(this); e.preventDefault(); });

    jdiff.find('.button_execute_merge').on('click', function(e){ _this.executeMerge(this); e.preventDefault(); });
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

  this.pickPage = function(obj){
    var jobj = $(obj);

    var query = {
      branch_id: xmodel.get('branch_id'),
      page_key: jobj.data('page_key'),
    };
    var params = {
      page_merge_id: jobj.data('page_id'),
      branch_page_merge_action: jobj.data('branch_page_action'),
    };

    XForm.Post(xmodel.module_namespace+'Branch_Conflict_Resolve_Page', query, params, function(rslt){
      window.location.reload();
    });
  }

  this.pickMedia = function(obj){
    var jobj = $(obj);

    var query = {
      branch_id: xmodel.get('branch_id'),
      media_key: jobj.data('media_key'),
    };
    var params = {
      media_merge_id: jobj.data('media_id'),
      branch_media_merge_action: jobj.data('branch_media_action'),
    };

    XForm.Post(xmodel.module_namespace+'Branch_Conflict_Resolve_Media', query, params, function(rslt){
      window.location.reload();
    });
  }

  this.pickMenu = function(obj){
    var jobj = $(obj);

    var query = {
      branch_id: xmodel.get('branch_id'),
      menu_key: jobj.data('menu_key'),
    };
    var params = {
      menu_merge_id: jobj.data('menu_id'),
      branch_menu_merge_action: jobj.data('branch_menu_action'),
    };

    XForm.Post(xmodel.module_namespace+'Branch_Conflict_Resolve_Menu', query, params, function(rslt){
      window.location.reload();
    });
  }

  this.pickRedirect = function(obj){
    var jobj = $(obj);

    var query = {
      branch_id: xmodel.get('branch_id'),
      redirect_key: jobj.data('redirect_key'),
    };
    var params = {
      redirect_merge_id: jobj.data('redirect_id'),
      branch_redirect_merge_action: jobj.data('branch_redirect_action'),
    };

    XForm.Post(xmodel.module_namespace+'Branch_Conflict_Resolve_Redirect', query, params, function(rslt){
      window.location.reload();
    });
  }

  this.pickSitemap = function(obj){
    var jobj = $(obj);

    var query = {
      branch_id: xmodel.get('branch_id'),
      sitemap_key: jobj.data('sitemap_key'),
    };
    var params = {
      sitemap_merge_id: jobj.data('sitemap_id'),
      branch_sitemap_merge_action: jobj.data('branch_sitemap_action'),
    };

    XForm.Post(xmodel.module_namespace+'Branch_Conflict_Resolve_Sitemap', query, params, function(rslt){
      window.location.reload();
    });
  }

  this.executeMerge = function(obj){
    if (_this.unresolved > 0) return XExt.Alert('Please resolve all conflicts first.');

    var params = {
      src_branch_id: xmodel.get('branch_merge_id'),
      dst_branch_id: xmodel.get('branch_id')
    };
    var mergeType = xmodel.get('merge_type');

    XForm.Post('/_funcs/merge/'+mergeType, { }, params, function(rslt){
      XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Review_Listing');
    });
  }

  this.abortMerge = function(obj){
    var params = {
      branch_id: xmodel.get('branch_id'),
    };

    XForm.Post(xmodel.module_namespace+'Branch_Conflict_Abort', {}, params, function(rslt){
      XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Review_Listing');
    });
  }
})();
