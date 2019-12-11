jsh.App[modelid] = new (function(){
  var _this = this;

  this.branch_pages = [];
  this.branch_media = [];
  this.branch_redirects = [];
  this.branch_menus = [];

  this.onload = function(xmodel, callback){
    //Load API Data
    this.loadData();
  }

  this.loadData = function(onComplete){
    var emodelid = '../_funcs/diff';
    XForm.Get(emodelid, { branch_id: xmodel.get('branch_id') }, { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.branch_pages = rslt.branch_pages;
        _this.branch_media = rslt.branch_media;
        _this.branch_redirects = rslt.branch_redirects;
        _this.branch_menus = rslt.branch_menus;

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
  }

  this.render = function(){
    var jdiff = jsh.$('.diff_'+xmodel.class);

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
    var map = function(key, dict){
      if(mapping[dict] && (key in mapping[dict])) return mapping[dict][key];
      return key;
    }

    var tmpl = jsh.$root('.'+xmodel.class+'_Changes_Listing').html();
    jdiff.html(XExt.renderClientEJS(tmpl, {
      _: _,
      jsh: jsh,
      branch_diff: this,
      XExt: XExt,
      map: map
    }));
  }

})();
