jsh.App[modelid] = new (function(){
  var _this = this;

  this.revision_page_key = undefined;
  this.revision_page_id = undefined;

  this.sitemap_key = null;
  this.sitemap_id = null;
  this.sitemap_items = [];
  this.selected_sitemap_item_id = null;
  this.loadobj = {};
  this.has_changes = false;
  this.first_render = true;
  this.sitemap_item_base = {
    sitemap_item_id: undefined,
    sitemap_item_parent_id: null,
    sitemap_item_path: undefined,
    sitemap_item_depth: undefined,
    sitemap_item_seq: undefined,
    sitemap_item_text: '',
    sitemap_item_type: 'TEXT', //TEXT(default),HTML
    sitemap_item_tag: undefined,
    sitemap_item_style: undefined,
    sitemap_item_class: undefined,
    sitemap_item_exclude_from_breadcrumbs: 0,
    sitemap_item_exclude_from_parent_menu: 0,
    sitemap_item_hide_menu_parents: 0,
    sitemap_item_hide_menu_siblings: 0,
    sitemap_item_hide_menu_children: 0,
    sitemap_item_link_type: undefined, //PAGE,MEDIA,URL,JS
    sitemap_item_link_dest: undefined,
    sitemap_item_link_page: undefined,
    sitemap_item_link_media: undefined,
    sitemap_item_link_target: undefined, //NEWWIN
  }
  this.orig_current_sitemap_item = null;

  this.oninit = function(){
    if(jsh._GET.sitemap_id) {
      this.sitemap_id = jsh._GET.sitemap_id;
    } else {
      jsh.System.RequireBranch(xmodel);
    }
    jsh.on('jsh_message', function(event, data){ _this.onmessage(data); });
    this.sitemap_key = jsh._GET.sitemap_key;
    $(window).bind('resize', _this.onresize);
    _this.refreshLayout();
    xmodel.controller.HasUpdates = function(){ return _this.hasUpdates(); }

    var jtree = jsh.$root('.xelem'+xmodel.class+'.sitemap_item_id');
    jtree.data('ondoubleclick', jsh._instance+'.App['+JSON.stringify(xmodel.id)+'].sitemap_item_id_ondoubleclick(n);');
  }

  this.ondestroy = function(xmodel){
    $(window).unbind('resize', _this.onresize);
  }

  this.onload = function(){
    _this.refreshLayout();
    _this.getSitemap();
  }

  this.onresize = function(){ _this.refreshLayout(); }

  this.refreshLayout = function(){
    var jbrowser = $('.'+xmodel.class+'_browser');

    if(!jbrowser.length) return;

    var wh = $(window).height();
    var top = jbrowser.offset().top;
    var contentheight = wh - top - 20;

    $('.'+xmodel.class+'_browser').css('height',contentheight+'px');
  }

  this.hasUpdates = function(){
    _this.checkUpdatesInfo();
    return _this.has_changes;
  }

  this.onmessage = function(data){
    data = (data || '').toString();
    if(data.indexOf('jsharmony-cms:refresh_page_key:')==0){
      var refresh_page_key = data.substr(31);

      var xmodelInfo = _this.getModelInfo();
      var cur_sitemap_item_link_type = xmodelInfo.get('sitemap_item_link_type');
      var cur_sitemap_item_link_dest = xmodelInfo.get('sitemap_item_link_dest');
      if((cur_sitemap_item_link_type == 'PAGE') && ((cur_sitemap_item_link_dest||'').toString() == refresh_page_key)){
        jsh.App[xmodelInfo.id].updatePageInfo(true);
      }
    }
  }

  this.sitemap_item_id_onchange = function(obj, newval, undoChange, e) {
    if(_this.selected_sitemap_item_id && !_this.commitInfo()){
      return undoChange();
    }
    this.selectSitemapItem(newval);
  }

  this.dragHoveringTop = 0;
  this.dragHoveringBottom = 0;

  this.sitemap_item_id_onmove = function(dragval, dropval, anchor, e) {
    if(!XExt.hasAction(xmodel.actions,'U')) return;
    if(!dragval || !dropval) return;
    if(dragval=='ROOT') return XExt.Alert('Cannot move root node');
    var dragitem = _this.getSitemapItem(dragval);
    if(!dragitem) return;

    var prev_dropitemidx = -1;
    var dropitemidx = -1;

    var dragitemidx = _.indexOf(_this.sitemap_items, dragitem);
    var prev_dragitemidx = dragitemidx;
    var prev_parent_id = dragitem.sitemap_item_parent_id;

    if(dropval=='ROOT'){
      //Drop on root
      _this.sitemap_items.splice(dragitemidx, 1);
      dragitem.sitemap_item_parent_id = null;
      _this.sitemap_items.splice(0, 0, dragitem);
      
      //Check if any move was actually performed
      dragitemidx = _.indexOf(_this.sitemap_items, dragitem);
    }
    else {
      //Drop on another item
      var dropitem = _this.getSitemapItem(dropval);
      if(!dropitem) return;
      if(dragitem == dropitem) return;

      prev_dropitemidx = _.indexOf(_this.sitemap_items, dropitem);

      _this.sitemap_items.splice(dragitemidx, 1);
      dropitemidx = _.indexOf(_this.sitemap_items, dropitem);

      //Move node, based on anchor
      if(anchor[1] == 'full'){
        dragitem.sitemap_item_parent_id = dropitem.sitemap_item_id;
        _this.sitemap_items.splice(dropitemidx + 1, 0, dragitem);
      }
      else if(anchor[1] == 'top'){
        dragitem.sitemap_item_parent_id = dropitem.sitemap_item_parent_id;
        _this.sitemap_items.splice(dropitemidx, 0, dragitem);
      }
      else if(anchor[1] == 'bottom'){
        dragitem.sitemap_item_parent_id = dropitem.sitemap_item_parent_id;
        _this.sitemap_items.splice(dropitemidx + 1, 0, dragitem);
      }

      //Check if any move was actually performed
      dragitemidx = _.indexOf(_this.sitemap_items, dragitem);
      dropitemidx = _.indexOf(_this.sitemap_items, dropitem);
    }

    if((dragitemidx==prev_dragitemidx)&&(dropitemidx==prev_dropitemidx)&&(prev_parent_id==dragitem.sitemap_item_parent_id)){
      /* No Changes */
    }
    else{
      _this.has_changes = true;
      _this.parseSitemap();
      _this.renderSitemap();
      _this.selectSitemapItem(_this.selected_sitemap_item_id, { softSave: true });
    }
  }

  this.sitemap_item_id_context_menu_onrender = function(sitemap_item_id, action){
    if(action=='delete'){
      return (sitemap_item_id != 'ROOT');
    }
    else if(action=='page'){
      sitemap_item_id = parseInt(sitemap_item_id);
      var sitemap_item = _this.getSitemapItem(sitemap_item_id);
      if(!sitemap_item) return false;

      if(sitemap_item.sitemap_item_link_type=='PAGE'){
        var page_key = sitemap_item.sitemap_item_link_dest;
        if(page_key) return true;
      }
      return false;
    }
  }

  this.sitemap_item_id_ondoubleclick = function(sitemap_item_id){
    sitemap_item_id = parseInt(sitemap_item_id);
    var sitemap_item = _this.getSitemapItem(sitemap_item_id);
    if(!sitemap_item) return false;

    if(sitemap_item.sitemap_item_link_type=='PAGE'){
      var page_key = sitemap_item.sitemap_item_link_dest;
      if(page_key) _this.editPageContent(page_key);
    }
  }

  this.getSitemap = function(){
    if(!_this.sitemap_key){ XExt.Alert('Missing sitemap key'); return; }

    var url = '../_funcs/sitemap/'+_this.sitemap_key;
    if(_this.sitemap_id) url += '?sitemap_id=' + _this.sitemap_id;
    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        var sitemap = rslt.sitemap;
        _this.parseSitemap(rslt.sitemap);
        _this.renderSitemap();
        _this.selectSitemapItem(_this.getFirstSitemapItemID());
      }
      else{
        XExt.Alert('Error loading sitemap');
      }
    }, function (err) {
    });
  }

  this.getFirstSitemapItemID = function(){
    var rslt = jsh.$root('.sitemap_item_id.xelem'+xmodel.class).find('.tree_item').first().data('value');
    return rslt||null;
  }

  this.getPrevSitemapItemID = function(sitemap_item_id){
    var sitemap_item_ids = _.map(jsh.$root('.sitemap_item_id.xelem'+xmodel.class).find('.tree_item'), function(obj){ return parseInt(obj.getAttribute('data-value')); });
    for(var i=0;i<sitemap_item_ids.length;i++){
      if(sitemap_item_ids[i]==sitemap_item_id){
        if(i==0) return null;
        return sitemap_item_ids[i-1];
      }
    }
    return null;
  }

  this.parseSitemap = function(sitemap){
    if(sitemap){
      var sitemap_items = [];
      if(sitemap && sitemap.sitemap_items) sitemap_items = sitemap.sitemap_items;
      _this.sitemap_items = sitemap_items;
    }
    _this.regenerateSitemap();
    _this.generateSitemapLOV();
  }

  this.regenerateSitemap = function(){
    //Validate IDs
    var sitemap_item_ids = [];
    for(var i=0;i<_this.sitemap_items.length;i++){
      var sitemap_item = _this.sitemap_items[i];
      sitemap_item.sitemap_item_seq = i+1;
      if(!sitemap_item.sitemap_item_id) return XExt.Alert('Missing sitemap item ID');
      var prev_sitemap_item_id = sitemap_item.sitemap_item_id;
      sitemap_item.sitemap_item_id = parseInt(sitemap_item.sitemap_item_id);
      if(prev_sitemap_item_id.toString() != sitemap_item.sitemap_item_id.toString()) return XExt.Alert('Invalid sitemap item ID: '+prev_sitemap_item_id.toString());
      if(sitemap_item.sitemap_item_id in sitemap_item_ids) return XExt.Alert('Duplicate sitemap item ID: '+prev_sitemap_item_id.toString());
      sitemap_item_ids[sitemap_item.sitemap_item_id] = sitemap_item;
    }
    //Validate Parent ID's, Reset Paths
    for(var i=0;i<_this.sitemap_items.length;i++){
      var sitemap_item = _this.sitemap_items[i];
      var prev_sitemap_item_parent_id = sitemap_item.sitemap_item_parent_id;
      if(!prev_sitemap_item_parent_id){
        sitemap_item.sitemap_item_parent_id = null;
        sitemap_item.sitemap_item_path = '/' + sitemap_item.sitemap_item_id.toString() + '/';
        sitemap_item.sitemap_item_depth = 1;
      }
      else {
        sitemap_item.sitemap_item_parent_id = parseInt(sitemap_item.sitemap_item_parent_id);
        if(prev_sitemap_item_parent_id.toString() != sitemap_item.sitemap_item_parent_id.toString()) return XExt.Alert('Invalid parent sitemap item ID: '+prev_sitemap_item_parent_id.toString());
        if(!(sitemap_item.sitemap_item_parent_id in sitemap_item_ids)) return XExt.Alert('Invalid parent sitemap item ID: '+prev_sitemap_item_id.toString());
        sitemap_item.sitemap_item_path = null;
      }
    }
    //Generate paths
    var getSitemapItemPath = function(sitemap_item){
      if(!sitemap_item.sitemap_item_path){
        var sitemap_item_parent = sitemap_item_ids[sitemap_item.sitemap_item_parent_id];
        sitemap_item.sitemap_item_path = getSitemapItemPath(sitemap_item_parent) + sitemap_item.sitemap_item_id.toString() + '/'
        sitemap_item.sitemap_item_depth = sitemap_item_parent.sitemap_item_depth + 1;
      }
      return sitemap_item.sitemap_item_path;
    }
    for(var i=0;i<_this.sitemap_items.length;i++){
      getSitemapItemPath(_this.sitemap_items[i]);
    }
    _this.sitemap_items.sort(function(a,b){
      if(a.sitemap_item_depth > b.sitemap_item_depth) return 1;
      if(a.sitemap_item_depth < b.sitemap_item_depth) return -1;
      if(a.sitemap_item_seq > b.sitemap_item_seq) return 1;
      if(a.sitemap_item_seq < b.sitemap_item_seq) return -1;
      return 0;
    });
    for(var i=0;i<_this.sitemap_items.length;i++){
      sitemap_item.sitemap_item_seq = i+1;
    }
  }

  this.generateSitemapLOV = function(){
    var lov = [];

    var root_item = {};
    root_item[jsh.uimap.code_id] = 'ROOT';
    root_item[jsh.uimap.code_parent_id] = null;
    root_item[jsh.uimap.code_val] = 'ROOT';
    root_item[jsh.uimap.code_txt] = '(Root)';
    root_item[jsh.uimap.code_icon] = 'folder';
    lov.push(root_item);

    var sitemap_parent_ids = {};
    _.each(_this.sitemap_items, function(sitemap_item){ sitemap_parent_ids[sitemap_item.sitemap_item_parent_id||'ROOT'] = true; });

    _.each(_this.sitemap_items, function(sitemap_item){
      var lov_item = {};
      lov_item[jsh.uimap.code_id] = sitemap_item.sitemap_item_id;
      lov_item[jsh.uimap.code_parent_id] = sitemap_item.sitemap_item_parent_id||'ROOT';
      lov_item[jsh.uimap.code_val] = sitemap_item.sitemap_item_id;
      lov_item[jsh.uimap.code_txt] = (XExt.StripTags(sitemap_item.sitemap_item_text)||'').trim();
      lov_item[jsh.uimap.code_icon] = (sitemap_parent_ids[sitemap_item.sitemap_item_id] ? 'folder' : 'file');
      lov.push(lov_item);
    });

    if(!xmodel.controller.form.Data._LOVs) xmodel.controller.form.Data._LOVs = {};
    xmodel.controller.form.Data._LOVs.sitemap_item_id = lov;
  }

  this.renderSitemap = function(){
    //Render Tree
    xmodel.controller.form.Render();
    //Expand first node on initial render
    if(_this.first_render){
      XExt.TreeExpandNode($('.xelem'+xmodel.class+'.sitemap_item_id.tree'),'ROOT');
    }
    //Select current item in tree
    if(_this.selected_sitemap_item_id){
      xmodel.set('sitemap_item_id', _this.selected_sitemap_item_id);
    }
  }

  this.getSitemapItem = function(sitemap_item_id){
    if(!sitemap_item_id) return null;
    sitemap_item_id = parseInt(sitemap_item_id);
    for(var i=0;i<_this.sitemap_items.length;i++){
      if(_this.sitemap_items[i].sitemap_item_id===sitemap_item_id) return _this.sitemap_items[i];
    }
    return null;
  }

  this.selectSitemapItem = function(sitemap_item_id, options){
    options = _.extend({ softSave: false }, options);
    sitemap_item_id = parseInt(sitemap_item_id || 0);
    if(!sitemap_item_id){
      jsh.$root('.xsubform.Sitemap_Tree_Info').hide();
      _this.selected_sitemap_item_id = null;
      _this.save({ softSave: true });
      return;
    }
    else {
      if(xmodel.get('sitemap_item_id') != sitemap_item_id){
        xmodel.set('sitemap_item_id', sitemap_item_id);
        return;
      }
      jsh.$root('.xsubform.Sitemap_Tree_Info').show();
      if(_this.selected_sitemap_item_id == sitemap_item_id){
        if(options.softSave) _this.save({ softSave: true });
        return;
      }
      _this.selected_sitemap_item_id = sitemap_item_id;
    }
    var sitemap_item = _.extend({}, _this.sitemap_item_base, _this.getSitemapItem(sitemap_item_id));
    if(!sitemap_item){ XExt.Alert('Sitemap item '+sitemap_item_id+' not found'); return; }
    var modelInfo = _this.getModelInfo();

    var xformInfo = modelInfo.controller.form;
    var xdataInfo = xformInfo.Data;
    
    xdataInfo = _.extend(xdataInfo,sitemap_item);
    xdataInfo._is_insert = false;
    xdataInfo._is_dirty = false;
    xdataInfo._is_deleted = false;
    xdataInfo._orig = null;
    xformInfo.Render();

    _this.orig_current_sitemap_item = _.extend({}, xdataInfo);

    jsh.App[modelInfo.id].onload();
    _this.save({ softSave: true });
  }

  this.getModelInfo = function(){
    return jsh.XModels[jsh.XBase[xmodel.namespace+'Sitemap_Tree_Info'][0]];
  }

  this.checkUpdatesInfo = function(){
    if(!_this.selected_sitemap_item_id) return true;
    var xmodelInfo = _this.getModelInfo();
    _.each([
      'sitemap_item_type',
      'sitemap_item_text',
      'sitemap_item_link_type',
      'sitemap_item_link_target',
      'sitemap_item_link_dest',
      'sitemap_item_class',
      'sitemap_item_style',
      'sitemap_item_exclude_from_breadcrumbs',
      'sitemap_item_exclude_from_parent_menu',
      'sitemap_item_hide_menu_parents',
      'sitemap_item_hide_menu_siblings',
      'sitemap_item_hide_menu_children',
      'sitemap_item_tag'
    ], function(key){
      var oldval = _this.orig_current_sitemap_item[key];
      if(XExt.isNullUndefined(oldval)) oldval = '';
      oldval = oldval.toString();

      var newval = xmodelInfo.get(key);
      if(XExt.isNullUndefined(newval)) newval = '';
      newval = newval.toString();

      if(oldval != newval){
        _this.has_changes = true;
      }
    });
    
  }

  this.commitInfo = function(){
    if(!_this.selected_sitemap_item_id) return true;
    _this.checkUpdatesInfo();
    var xdataInfo = _this.getModelInfo().controller.form.Data;
    if(!xdataInfo.Commit('B')) return false;
    var sitemap_item = _this.getSitemapItem(_this.selected_sitemap_item_id);
    if(!sitemap_item) return XExt.Alert('Sitemap item not found for ID: '+_this.selected_sitemap_item_id);
    var rerender = (_this.orig_current_sitemap_item.sitemap_item_text != xdataInfo.sitemap_item_text);
    _.each([
      'sitemap_item_type',
      'sitemap_item_text',
      'sitemap_item_link_type',
      'sitemap_item_link_target',
      'sitemap_item_link_dest',
      'sitemap_item_link_page',
      'sitemap_item_link_media',
      'sitemap_item_class',
      'sitemap_item_style',
      'sitemap_item_exclude_from_breadcrumbs',
      'sitemap_item_exclude_from_parent_menu',
      'sitemap_item_hide_menu_parents',
      'sitemap_item_hide_menu_siblings',
      'sitemap_item_hide_menu_children',
      'sitemap_item_tag'
    ], function(key){
      if(key in xdataInfo){
        sitemap_item[key] = xdataInfo[key];
      }
    });
    _this.orig_current_sitemap_item = _.extend({}, xdataInfo);
    if(rerender){
      _this.parseSitemap();
      _this.renderSitemap();
    }
    return true;
  }

  this.deleteSitemapItem = function(sitemap_item_id, force){
    sitemap_item_id = parseInt(sitemap_item_id);
    var sitemap_item = _this.getSitemapItem(sitemap_item_id);
    if(!sitemap_item){ XExt.Alert('Invalid sitemap item ID'); return; }
    //Find children
    var sitemap_item_children = [];
    for(var i=0;i<_this.sitemap_items.length;i++){
      if(_this.sitemap_items[i].sitemap_item_parent_id==sitemap_item.sitemap_item_id){
        sitemap_item_children.push(_this.sitemap_items[i].sitemap_item_id);
      }
    }
    if(!force){
      XExt.Confirm('Are you sure you want to delete "'+sitemap_item.sitemap_item_text+'"'+(sitemap_item_children.length?' and all of its children':'')+'?', function (rslt) {
        var next_sitemap_item_id = _this.selected_sitemap_item_id;
        if(next_sitemap_item_id == sitemap_item_id) next_sitemap_item_id = _this.getPrevSitemapItemID(sitemap_item_id);
        var deletedPages = _this.deleteSitemapItem(sitemap_item_id, true)||[];
        XExt.execif(deletedPages.length, function(f){
          //Confirm whether to delete the pages from the system
          var msg = "<div style='text-align:left;'>";
          msg += "Permanently delete the following pages?";
          for(var i = 0; i < deletedPages.length; i++){ msg += "<br/>" + deletedPages[i].page_path; }
          msg += "</div>";
          XExt.Confirm(msg, function(){
            //Delete the pages
            var deleteErrors = [];
            async.eachSeries(deletedPages, function(page, page_cb){
              XForm.Delete(xmodel.module_namespace+'Page_Tree_Listing', { page_key: page.page_key }, { }, function(rslt){ //On Success
                return page_cb();
              }, undefined, { OnDBError: function(err){ //On Error
                if(err){
                  var errmsg = 'Error deleting '+page.page_path+' - ';
                  if(err.Number && (err.Number == -3)) errmsg += 'Page not found';
                  else if(err.Message) errmsg += err.Message;
                  else errmsg += err.toString();
                  deleteErrors.push(errmsg);
                }
                page_cb();
                return false;
              } });
            }, function(err){
              var errmsg = '';
              if(err) deleteErrors.push(err.toString());
              if(deleteErrors.length) XExt.Alert(deleteErrors.join('\n'), f);
              else f();
            });
          }, f, { message_type: 'html' });
        }, function(){
          //Reload sitemap and select previous node
          _this.parseSitemap();
          _this.renderSitemap();
          if(!next_sitemap_item_id || !_this.getSitemapItem(next_sitemap_item_id)) next_sitemap_item_id = _this.getFirstSitemapItemID();
          _this.selected_sitemap_item_id = null;
          _this.selectSitemapItem(next_sitemap_item_id);
        });
      });
      return;
    }
    var deletedPages = [];
    if(sitemap_item.sitemap_item_link_type=='PAGE'){
      var page_key = sitemap_item.sitemap_item_link_dest;
      var page_path = sitemap_item.sitemap_item_link_page;
      if(!page_path) page_path = 'Page #' + page_key;
      deletedPages.push({ page_key: page_key, page_path: page_path });
    }
    _.each(sitemap_item_children, function(sitemap_item_id){
      var deletedChildPages = _this.deleteSitemapItem(sitemap_item_id, true);
      for(var i=0; i < deletedChildPages.length; i++) deletedPages.push(deletedChildPages[i]);
    });
    //Delete item
    for(var i=0;i<_this.sitemap_items.length;i++){
      if(_this.sitemap_items[i]==sitemap_item){
        _this.sitemap_items.splice(i,1);
        i--;
      }
    }
    _this.has_changes = true;
    return deletedPages;
  }

  this.getSitemapItemParentID = function(sitemap_item_id){
    if(!_this.commitInfo()) return;

    sitemap_item_id = parseInt(sitemap_item_id);
    var sitemap_item = _this.getSitemapItem(sitemap_item_id);
    if(!sitemap_item){ XExt.Alert('Invalid sitemap item ID'); return; }
    return sitemap_item.sitemap_item_parent_id;
  }

  this.getSitemapItemPageKey = function(sitemap_item_id, f){
    if(!_this.commitInfo()) return;

    sitemap_item_id = parseInt(sitemap_item_id);
    var sitemap_item = _this.getSitemapItem(sitemap_item_id);
    if(!sitemap_item){ XExt.Alert('Invalid sitemap item ID'); return; }
    //Find children
    if(sitemap_item.sitemap_item_link_type!='PAGE'){ XExt.Alert('Sitemap item does not link to a page'); return; }
    var page_key = parseInt(sitemap_item.sitemap_item_link_dest);
    if(!page_key){ XExt.Alert('Sitemap item does not link to a valid page'); return; }
    if(f) f(page_key);
    return page_key;
  }

  this.getDefaultPage = function(){
    if(xmodel.controller.form.LOVs.default_page && xmodel.controller.form.LOVs.default_page[0]) return xmodel.controller.form.LOVs.default_page[0].param_cur_val;
    return '';
  }

  this.addSitemapPage = function(sitemap_item_parent_id){
    if(!_this.commitInfo()) return;

    sitemap_item_parent_id = parseInt(sitemap_item_parent_id);
    var sitemap_item_parent = _this.getSitemapItem(sitemap_item_parent_id);
    if(!sitemap_item_parent) sitemap_item_parent = null;

    //Get Parent Folder Path
    var page_folder = '';
    var cur_parent = sitemap_item_parent;
    while(!page_folder && cur_parent){
      if((cur_parent.sitemap_item_link_type=='PAGE') && cur_parent.sitemap_item_link_page){
        page_folder = XExt.dirname(cur_parent.sitemap_item_link_page);
      }
      else if((cur_parent.sitemap_item_link_type=='URL') && cur_parent.sitemap_item_link_dest){
        page_folder = XExt.dirname(cur_parent.sitemap_item_link_dest);
      }
      cur_parent = _this.getSitemapItem(cur_parent.sitemap_item_parent_id);
    }
    if(!page_folder) page_folder = '/';
    if(page_folder[page_folder.length-1] != '/') page_folder += '/';

    var xform = xmodel.controller.form;
    var sel = '.'+xmodel.class+'_AddPage';

    //Render Dialog for Page
    XExt.CustomPrompt(sel, jsh.$root(sel)[0].outerHTML, function () { //onInit
      var jprompt = jsh.$root('.xdialogblock ' + sel);

      XExt.RenderLOV(xform.Data, jsh.$root('.xdialogblock ' + sel + ' .page_template_id'), xform.LOVs.page_template_id);

      //Clear Values / Set Defaults
      jprompt.find('.page_path').val('');
      jprompt.find('.page_title').val('');
      jprompt.find('.page_template_id').val(jsh.globalparams.defaultPageTemplate);
      jprompt.find('.page_path_default').prop('checked', true);
      jprompt.find('.sitemap_item_text_default').prop('checked', true);

      var jfilename = jprompt.find('.page_path');
      jfilename.prop('readonly', true);
      jfilename.addClass('uneditable');

      var jsitemaptext = jprompt.find('.sitemap_item_text');
      jsitemaptext.prop('readonly', true);
      jsitemaptext.addClass('uneditable');

      var jtitle = jprompt.find('.page_title');
      function getDefaultPageFilename(){ if(!jtitle.val().trim()) return ''; return page_folder + XExt.prettyURL(jtitle.val().trim()) + '/' + _this.getDefaultPage(); }
      jtitle.off('input keyup').on('input keyup', function(){
        if(jprompt.find('.page_path_default').prop('checked')) jfilename.val(getDefaultPageFilename());
        if(jprompt.find('.sitemap_item_text_default').prop('checked')) jsitemaptext.val(jtitle.val());
      });

      jprompt.find('.page_path_default').off('click').on('click', function(){
        if($(this).is(':checked')){
          jfilename.prop('readonly', true);
          jfilename.val(getDefaultPageFilename());
          jfilename.addClass('uneditable');
        }
        else{
          jfilename.prop('readonly', false);
          jfilename.removeClass('uneditable');
        }
      });

      jprompt.find('.sitemap_item_text_default').off('click').on('click', function(){
        if($(this).is(':checked')){
          jsitemaptext.prop('readonly', true);
          jsitemaptext.val(jtitle.val());
          jsitemaptext.addClass('uneditable');
        }
        else{
          jsitemaptext.prop('readonly', false);
          jsitemaptext.removeClass('uneditable');
        }
      });
    }, function (success) { //onAccept
      var jprompt = jsh.$root('.xdialogblock ' + sel);

      //Validate File Selected
      var page_path = jprompt.find('.page_path').val();
      var page_title = jprompt.find('.page_title').val();
      var page_template_id = jprompt.find('.page_template_id').val();
      var sitemap_item_text = jprompt.find('.sitemap_item_text').val();

      if (!page_path) return XExt.Alert('Please enter a page path');
      if (XExt.cleanFilePath(page_path) != page_path) return XExt.Alert('Page path contains invalid characters');

      if (!page_template_id) return XExt.Alert('Please select a template.');

      if (page_path.indexOf('.') < 0) page_path += '.html';

      var params = {
        page_path: page_path,
        page_title: page_title,
        page_template_id: page_template_id
      };

      var execModel = xmodel.module_namespace+'Page_Tree_Listing';
      XForm.Put(execModel, { }, params, function(rslt){
        success();
        
        //Add item to list
        if(!rslt || !rslt[execModel] || !rslt[execModel].page_key) return XExt.Alert('Error creating page');
        var page_key = rslt[execModel].page_key;
        _this.addSitemapItem(sitemap_item_parent_id, {
          sitemap_item_text: sitemap_item_text,
          sitemap_item_link_type: 'PAGE',
          sitemap_item_link_dest: page_key.toString(),
          sitemap_item_link_page: params.page_path
        });
      });
    });
  }

  this.addSitemapItem = function(sitemap_item_parent_id, new_sitemap_item){
    if(!_this.commitInfo()) return;

    sitemap_item_parent_id = parseInt(sitemap_item_parent_id);
    var sitemap_item_parent = _this.getSitemapItem(sitemap_item_parent_id);
    if(!sitemap_item_parent) sitemap_item_parent = null;

    var max_sitemap_item_id = 0;
    _.each(_this.sitemap_items, function(sitemap_item){ if(sitemap_item.sitemap_item_id >= max_sitemap_item_id) max_sitemap_item_id = sitemap_item.sitemap_item_id; });
    var new_sitemap_item_id = max_sitemap_item_id+1;

    new_sitemap_item = _.extend({ }, _this.sitemap_item_base, new_sitemap_item);
    new_sitemap_item.sitemap_item_id = new_sitemap_item_id;
    if(sitemap_item_parent){
      new_sitemap_item.sitemap_item_parent_id = sitemap_item_parent.sitemap_item_id;
      new_sitemap_item.sitemap_item_path = sitemap_item_parent.sitemap_item_path+new_sitemap_item_id.toString()+'/';
    }
    else {
      new_sitemap_item.sitemap_item_path = '/'+new_sitemap_item_id.toString()+'/';
    }

    _this.sitemap_items.push(new_sitemap_item);
    _this.has_changes = true;
    _this.parseSitemap();
    _this.renderSitemap();
    _this.selectSitemapItem(new_sitemap_item_id);
    window.setTimeout(function(){
      jsh.$root('.sitemap_item_text.xelem'+_this.getModelInfo().class).focus();
      //Scroll sitemap to item
      var jtree = jsh.$root('.sitemap_item_id.xelem'+xmodel.class);
      var jselected = jtree.find('.tree_item.selected').first();
      if(jselected.length) XExt.scrollObjIntoView(jtree, jselected);
    },1);
  }

  this.getPageInfo = function(page_key, cb, options){
    options = _.extend({ quiet: false }, options);
    page_key = parseInt(page_key);
    if(!page_key) return XExt.Alert('Page key is required');

    //Get page properties from server
    var execModel = xmodel.module_namespace+'Page_Tree_Listing';
    XForm.Get(execModel, { rowstart: 0, rowcount: 1, d: JSON.stringify({ page_key: page_key }) }, { }, function(rslt){
      if(!rslt || !rslt[execModel] || !rslt[execModel].length){
        if(options.quiet) return cb(null);
        return XExt.Alert('Error loading page');
      }
      var page = rslt[execModel][0];
      return cb(page);
    });
  }

  this.openPageEditor = function(page, options){
    options = _.extend({ readonly: false }, options);

    var page_key = page.page_key;
    var page_id = page.page_id;
    var page_template_id = page.page_template_id;
    var page_filename = page.page_filename||'';

    if(!page_template_id) return XExt.Alert('Invalid page template');

    var editorParams = { source: 'sitemap', rawEditorDialog: '.'+xmodel.class+'_RawTextEditor' };
    if(options.readonly) editorParams.page_id = page_id;

    jsh.System.OpenPageEditor(page_key, page_filename, page_template_id, editorParams);
  }

  this.editPageContent = function(page_key){
    if(!_this.commitInfo()) return;

    page_key = parseInt(page_key);
    if(!page_key) return XExt.Alert('Page key is required');

    //Get page properties from server
    _this.getPageInfo(page_key, function(page){
      _this.openPageEditor(page);
    });
  }

  this.editPageProperties = function(page_key){
    if(!_this.commitInfo()) return;

    page_key = parseInt(page_key);
    if(!page_key) return XExt.Alert('Page key is required');

    var xform = xmodel.controller.form;
    var sel = '.'+xmodel.class+'_PageProprties';

    _this.getPageInfo(page_key, function(page){
      //Render Dialog for Page
      XExt.CustomPrompt(sel, jsh.$root(sel)[0].outerHTML, function () { //onInit
        var jprompt = jsh.$root('.xdialogblock ' + sel);

        XExt.RenderLOV(xform.Data, jsh.$root('.xdialogblock ' + sel + ' .page_template_id'), xform.LOVs.page_template_id);

        //Clear Values / Set Defaults
        jprompt.find('.page_path').val(page.page_path);
        jprompt.find('.page_title').val(page.page_title);
        jprompt.find('.page_template_id').val(page.page_template_id);
      }, function (success) { //onAccept
        var jprompt = jsh.$root('.xdialogblock ' + sel);

        //Validate File Selected
        var page_path = jprompt.find('.page_path').val();
        var page_title = jprompt.find('.page_title').val();
        var page_template_id = jprompt.find('.page_template_id').val();

        if (!page_path) return XExt.Alert('Please enter a page path');
        if (XExt.cleanFilePath(page_path) != page_path) return XExt.Alert('Page path contains invalid characters');

        if (!page_template_id) return XExt.Alert('Please select a template.');

        if (page_path.indexOf('.') < 0) page_path += '.html';

        var params = {
          page_path: page_path,
          page_title: page_title,
          page_template_id: page_template_id
        };

        var execModel = xmodel.module_namespace+'Page_Tree_Listing';
        XForm.Post(execModel, { page_key: page_key }, params, function(rslt){
          success();
          if(!rslt || !rslt[execModel] || !rslt._success) return XExt.Alert('Error updating page');
          
          //Update Info, if applicable
          var xmodelInfo = _this.getModelInfo();
          var cur_sitemap_item_link_type = xmodelInfo.get('sitemap_item_link_type');
          var cur_sitemap_item_link_dest = xmodelInfo.get('sitemap_item_link_dest');
          if((cur_sitemap_item_link_type == 'PAGE') && ((cur_sitemap_item_link_dest||'').toString() == page_key.toString())){
            xmodelInfo.set('sitemap_item_link_page', page_path);
            jsh.App[xmodelInfo.id].updatePageInfo(true);
          }

          //Update URLs of all nodes that reference this page
          for(var i=0;i<_this.sitemap_items.length;i++){
            var sitemap_item = _this.sitemap_items[i];
            var sitemap_item_link_type = sitemap_item.sitemap_item_link_type;
            var sitemap_item_link_dest = (sitemap_item.sitemap_item_link_dest||'').toString();
            if((sitemap_item_link_type=='PAGE') && (sitemap_item_link_dest == page_key.toString())){
              sitemap_item.sitemap_item_link_page = page_path;
            }
          }
          _this.parseSitemap();
          _this.renderSitemap();
        });
      });
    });
  }

  this.viewPageRevisions = function(page_key){
    if(!_this.commitInfo()) return;
    
    page_key = parseInt(page_key);
    if(!page_key) return XExt.Alert('Page key is required');

    _this.getPageInfo(page_key, function(page){
      _this.revision_page_key = page_key;
      _this.revision_page_id = page.page_id;
      jsh.XExt.popupShow(xmodel.namespace + 'Page_Revision_Listing','revision_page','Revisions',undefined,jsh.$root('.xform'+xmodel.class+' .revision_page_xlookup')[0],{
        OnControlUpdate:function(obj, rslt){
          if(rslt && rslt.result){
            var page_id = rslt.result;
            XForm.Post(xmodel.namespace+'Page_Revision_Update',{},{ page_key: page_key, page_id: page_id }, function(){
              //Refresh, if applicable
              var xmodelInfo = _this.getModelInfo();
              var cur_sitemap_item_link_type = xmodelInfo.get('sitemap_item_link_type');
              var cur_sitemap_item_link_dest = xmodelInfo.get('sitemap_item_link_dest');
              if((cur_sitemap_item_link_type == 'PAGE') && ((cur_sitemap_item_link_dest||'').toString() == page_key.toString())){
                jsh.App[xmodelInfo.id].updatePageInfo(true);
              }
            });
          }
        }
      });
    });
  }

  this.previewPage = function(page_file){
    _this.openPageEditor(page_file, { readonly: true });
  }

  this.duplicatePage = function(sitemap_item_parent_id, source_page_key){
    if(!_this.commitInfo()) return;

    source_page_key = parseInt(source_page_key);
    if(!source_page_key) return XExt.Alert('Page key is required');

    _this.getPageInfo(source_page_key, function(source_page){
      sitemap_item_parent_id = parseInt(sitemap_item_parent_id);
      var sitemap_item_parent = _this.getSitemapItem(sitemap_item_parent_id);
      if(!sitemap_item_parent) sitemap_item_parent = null;
  
      //Get Parent Folder Path
      var page_folder = '';
      var cur_parent = sitemap_item_parent;
      while(!page_folder && cur_parent){
        if((cur_parent.sitemap_item_link_type=='PAGE') && cur_parent.sitemap_item_link_page){
          page_folder = XExt.dirname(cur_parent.sitemap_item_link_page);
        }
        else if((cur_parent.sitemap_item_link_type=='URL') && cur_parent.sitemap_item_link_dest){
          page_folder = XExt.dirname(cur_parent.sitemap_item_link_dest);
        }
        cur_parent = _this.getSitemapItem(cur_parent.sitemap_item_parent_id);
      }
      if(!page_folder) page_folder = '/';
      if(page_folder[page_folder.length-1] != '/') page_folder += '/';
  
      var xform = xmodel.controller.form;
      var sel = '.'+xmodel.class+'_DuplicatePage';
  
      //Render Dialog for Page
      XExt.CustomPrompt(sel, jsh.$root(sel)[0].outerHTML, function () { //onInit
        var jprompt = jsh.$root('.xdialogblock ' + sel);
  
        //Clear Values / Set Defaults
        jprompt.find('.source_page_path').val(source_page.page_path);
        jprompt.find('.page_path').val('');
        jprompt.find('.page_title').val(source_page.page_title);
        jprompt.find('.page_path_default').prop('checked', true);
        jprompt.find('.sitemap_item_text_default').prop('checked', true);
  
        var jfilename = jprompt.find('.page_path');
        jfilename.prop('readonly', true);
        jfilename.addClass('uneditable');
  
        var jsitemaptext = jprompt.find('.sitemap_item_text');
        jsitemaptext.prop('readonly', true);
        jsitemaptext.addClass('uneditable');
  
        var jtitle = jprompt.find('.page_title');
        function getDefaultPageFilename(){ if(!jtitle.val().trim()) return ''; return page_folder + XExt.prettyURL(jtitle.val().trim()) + '/' + _this.getDefaultPage(); }
        jtitle.off('input keyup').on('input keyup', function(){
          if(jprompt.find('.page_path_default').prop('checked')) jfilename.val(getDefaultPageFilename());
          if(jprompt.find('.sitemap_item_text_default').prop('checked')) jsitemaptext.val(jtitle.val());
        });

        jsitemaptext.val(source_page.page_title);
        jfilename.val(getDefaultPageFilename());
  
        jprompt.find('.page_path_default').off('click').on('click', function(){
          if($(this).is(':checked')){
            jfilename.prop('readonly', true);
            jfilename.val(getDefaultPageFilename());
            jfilename.addClass('uneditable');
          }
          else{
            jfilename.prop('readonly', false);
            jfilename.removeClass('uneditable');
          }
        });
  
        jprompt.find('.sitemap_item_text_default').off('click').on('click', function(){
          if($(this).is(':checked')){
            jsitemaptext.prop('readonly', true);
            jsitemaptext.val(jtitle.val());
            jsitemaptext.addClass('uneditable');
          }
          else{
            jsitemaptext.prop('readonly', false);
            jsitemaptext.removeClass('uneditable');
          }
        });
      }, function (success) { //onAccept
        var jprompt = jsh.$root('.xdialogblock ' + sel);
  
        //Validate File Selected
        var page_path = jprompt.find('.page_path').val();
        var page_title = jprompt.find('.page_title').val();
        var sitemap_item_text = jprompt.find('.sitemap_item_text').val();
  
        if (!page_path) return XExt.Alert('Please enter a page path');
        if (XExt.cleanFilePath(page_path) != page_path) return XExt.Alert('Page path contains invalid characters');
  
        if (page_path.indexOf('.') < 0) page_path += '.html';
  
        var params = {
          page_key: source_page_key,
          page_path: page_path,
          page_title: page_title
        };

        var execModel = xmodel.module_namespace+'Sitemap_Tree_Page_Duplicate';
        XForm.Post(execModel, {}, params, function(rslt){
          success();
          
          //Add item to list
          if(!rslt || !rslt[execModel] || !rslt[execModel].length || !rslt[execModel][0] || !rslt[execModel][0].page_key) return XExt.Alert('Error creating page');
          var page_key = rslt[execModel][0].page_key;
          _this.addSitemapItem(sitemap_item_parent_id, {
            sitemap_item_text: sitemap_item_text,
            sitemap_item_link_type: 'PAGE',
            sitemap_item_link_dest: page_key.toString(),
            sitemap_item_link_page: params.page_path
          });
        });
      });
    });
  }

  this.save = function(options){
    options = _.extend({ softSave: false }, options);

    if(options.softSave){
      //Previewing a revision
      if(_this.sitemap_id) return;
      //Invalid key
      if(!_this.sitemap_key) return;
      //No changes
      if(!_this.has_changes) return;
    }
    else {
      if(_this.sitemap_id){ XExt.Alert('Cannot save when previewing a revision'); return; }
      if(!_this.sitemap_key){ XExt.Alert('Missing sitemap key'); return; }
      if(!_this.commitInfo()) return;
    }

    var save_sitemap_items = [];
    for(var i=0;i<_this.sitemap_items.length;i++){
      var sitemap_item = _this.sitemap_items[i];
      var save_sitemap_item = _.pick(sitemap_item, [
        'sitemap_item_id',
        'sitemap_item_parent_id',
        'sitemap_item_path',
        'sitemap_item_text',
        'sitemap_item_type',
        'sitemap_item_tag',
        'sitemap_item_style',
        'sitemap_item_class',
        'sitemap_item_exclude_from_breadcrumbs',
        'sitemap_item_exclude_from_parent_menu',
        'sitemap_item_hide_menu_parents',
        'sitemap_item_hide_menu_siblings',
        'sitemap_item_hide_menu_children',
        'sitemap_item_link_type',
        'sitemap_item_link_dest',
        'sitemap_item_link_target',
      ])
      save_sitemap_items.push(save_sitemap_item);
    }
    if(!save_sitemap_items.length) save_sitemap_items = '';

    var url = jsh._BASEURL+'_funcs/sitemap/'+_this.sitemap_key;
    XForm.Post(url, {}, { sitemap_items: JSON.stringify(save_sitemap_items) }, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.has_changes = false;
      }
      else{
        XExt.Alert('Error saving sitemap');
      }
    }, function (err) {
    });
  }

})();
