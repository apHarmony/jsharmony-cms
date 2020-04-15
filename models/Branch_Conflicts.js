jsh.App[modelid] = new (function(){
  var _this = this;

  this.field_mapping = {};

  this.branch_conflicts = {};

  this.deployment_target_params = {};
  this.numConflicts = 0;
  this.numResolved = 0;
  this.numUnresolved = 0;

  this.onRenderedConflicts = [
    function(jdiff){
      jdiff.find('.preview_page').on('click', function(e){ _this.previewPage(this); e.preventDefault(); });
      jdiff.find('.preview_media').on('click', function(e){ _this.previewMedia(this); e.preventDefault(); });
      jdiff.find('.preview_menu').on('click', function(e){ _this.previewMenu(this); e.preventDefault(); });
      jdiff.find('.preview_sitemap').on('click', function(e){ _this.previewSitemap(this); e.preventDefault(); });

      _.each(_this.branch_conflicts, function(branch_items, item_type){
        jdiff.find('.button_resolve_'+item_type).on('click', function(e){ _this.resolveConflict(this, item_type); e.preventDefault(); });
        jdiff.find('.button_unresolve_'+item_type).on('click', function(e){ _this.resolveConflict(this, item_type); e.preventDefault(); });
      });
    }
  ];

  this.onload = function(xmodel, callback){
    //Load API Data
    this.loadData();
  }

  this.loadData = function(onComplete){
    var emodelid = '../_funcs/conflicts';
    XForm.Get(emodelid, { src_branch_id: xmodel.get('branch_merge_id'), dst_branch_id: xmodel.get('branch_id') }, { }, function (rslt) { //On Success
      if ('_success' in rslt) {

        _this.deployment_target_params = rslt.deployment_target_params;
        _this.branch_conflicts = rslt.branch_conflicts;
        _this.processData();
        

        if (_this.numConflicts <= 0) {
          _this.executeMerge();
        } else {
          _this.render();
        }
        if (onComplete) onComplete();
      }
      else XExt.Alert('Error while loading data');
    }, function (err) {
      //Optionally, handle errors
    });
  }

  this.processData = function(){
    _this.numConflicts = 0;
    _this.numResolved = 0;
    _this.numUnresolved = 0;

    for(var item_type in _this.branch_conflicts){
      var branch_items = _this.branch_conflicts[item_type];
      _.each(branch_items, function(item){
        item['branch_'+item_type+'_action'] = (item['branch_'+item_type+'_action']||'').toString().toUpperCase();
      });
      _this.numConflicts += branch_items.length;
      _this.numUnresolved = _this.numUnresolved + branch_items.filter(function(branch_item) {return branch_item[item_type + '_merge_id'] == null && branch_item[item_type + '_merge_action'] == null;}).length;
    }

    _this.numResolved = _this.numConflicts - _this.numUnresolved;
  }

  this.render = function(){
    var jdiff = jsh.$('.conflict_display');

    var map = function(key, dict){
      if(_this.field_mapping[dict] && (key in _this.field_mapping[dict])) return _this.field_mapping[dict][key];
      return key;
    }

    var tmpl = jsh.$root('.'+xmodel.class+'_template_diff_listing').html();
    var templates = {};
    var item_tmpl = {};
    for(var item_type in _this.branch_conflicts){
      item_tmpl[item_type] = jsh.$root('.'+xmodel.class+'_template_diff_' + item_type).html();
    }
    var renderParams = {
      _: _,
      jsh: jsh,
      branch_conflicts: _this.branch_conflicts,
      branch_type: (xmodel.get('branch_type')||'').toString().toUpperCase(),
      numConflicts: _this.numConflicts,
      numResolved: _this.numResolved,
      numUnresolved: _this.numUnresolved,
      XExt: XExt,
      map: map,
    };
    renderParams.renderItemConflicts = function(item_type, branch_item){
      var item_params = { branch_item: branch_item };
      item_params['branch_' + item_type] = branch_item;
      return XExt.renderClientEJS(item_tmpl[item_type], _.extend(item_params, renderParams));
    }
    renderParams.renderTemplate = function(path, data){
      var t = templates[path];
      if (!t) {
        t = templates[path] = jsh.$root('.'+xmodel.class+'_template_'+path).html();
      }
      if (t) {
        return XExt.renderClientEJS(t, _.extend(data, renderParams));
      } else {
        throw "Template '"+path+"' not found";
      }
    };

    jdiff.html(XExt.renderClientEJS(tmpl, renderParams));

    XExt.trigger(_this.onRenderedConflicts, jdiff);

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

  this.resolveConflict = function(obj, item_type){
    var jobj = $(obj);

    var params = {
      branch_item_type: item_type,
      branch_id: xmodel.get('branch_id'),
      key: jobj.data('key'),
      merge_id: jobj.data('id'),
      branch_merge_action: jobj.data('branch_action'),
    };

    XForm.Post('/_funcs/conflicts/resolve', {}, params, function(rslt){
      _this.loadData();
    });
  }

  this.executeMerge = function(obj){
    if (_this.unresolved > 0) return XExt.Alert('Please resolve all conflicts first.');

    var params = {
      src_branch_id: xmodel.get('branch_merge_id'),
      dst_branch_id: xmodel.get('branch_id')
    };
    var mergeType = xmodel.get('branch_merge_type').toLowerCase();

    XForm.Post('/_funcs/merge/'+mergeType, { }, params, function(rslt){
      XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Active_Listing');
    });
  }

  this.abortMerge = function(obj){
    var params = {
      branch_id: xmodel.get('branch_id'),
    };

    XForm.Post(xmodel.module_namespace+'Branch_Conflicts_Abort', {}, params, function(rslt){
      XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Active_Listing');
    });
  }
})();
