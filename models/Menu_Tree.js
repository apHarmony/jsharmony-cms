jsh.App[modelid] = new (function(){
  var _this = this;

  this.menu_key = null;
  this.menu_id = null;
  this.menu_items = [];
  this.selected_menu_item_id = null;
  this.loadobj = {};
  this.has_changes = false;
  this.menu_item_base = {
    menu_item_id: undefined,
    menu_item_parent_id: null,
    menu_item_path: undefined,
    menu_item_depth: undefined,
    menu_item_seq: undefined,
    menu_item_text: '',
    menu_item_type: 'TEXT', //TEXT(default),HTML
    menu_item_tag: undefined,
    menu_item_style: undefined,
    menu_item_class: undefined,
    menu_item_link_type: undefined, //PAGE,MEDIA,URL,JS
    menu_item_link_dest: undefined,
    menu_item_link_page: undefined,
    menu_item_link_media: undefined,
    menu_item_link_target: undefined, //NEWWIN
  }
  this.orig_current_menu_item = null;

  this.oninit = function(){
    jsh.System.RequireBranch(xmodel);
    this.menu_key = jsh._GET.menu_key;
    if(jsh._GET.menu_id) this.menu_id = jsh._GET.menu_id;
    $(window).bind('resize', _this.onresize);
    _this.refreshLayout();
    xmodel.controller.HasUpdates = function(){ return _this.hasUpdates(); }
  }

  this.ondestroy = function(xmodel){
    $(window).unbind('resize', _this.onresize);
  }

  this.onload = function(){
    _this.refreshLayout();
    _this.getMenu();
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

  this.menu_item_id_onchange = function(obj, newval, undoChange, e) {
    if(_this.selected_menu_item_id && !_this.commitInfo()){
      return undoChange();
    }
    this.selectMenuItem(newval);
  }

  this.menu_item_id_onmove = function(dragval, dropval, anchor, e) {
    if(!XExt.hasAction(xmodel.actions,'U')) return;
    if(!dragval || !dropval) return;
    var dragitem = _this.getMenuItem(dragval);
    var dropitem = _this.getMenuItem(dropval);
    if(!dragitem || !dropitem) return;
    if(dragitem == dropitem) return;

    //Move node, based on anchor
    var dragitemidx = _.indexOf(_this.menu_items, dragitem);
    var prev_dragitemidx = dragitemidx;
    var prev_dropitemidx = _.indexOf(_this.menu_items, dropitem);
    var prev_parent_id = dragitem.menu_item_parent_id;

    _this.menu_items.splice(dragitemidx, 1);
    var dropitemidx = _.indexOf(_this.menu_items, dropitem);
    if(anchor[1] == 'full'){
      dragitem.menu_item_parent_id = dropitem.menu_item_id;
      _this.menu_items.splice(dropitemidx + 1, 0, dragitem);
    }
    else if(anchor[1] == 'top'){
      dragitem.menu_item_parent_id = dropitem.menu_item_parent_id;
      _this.menu_items.splice(dropitemidx, 0, dragitem);
    }
    else if(anchor[1] == 'bottom'){
      dragitem.menu_item_parent_id = dropitem.menu_item_parent_id;
      _this.menu_items.splice(dropitemidx + 1, 0, dragitem);
    }

    //Check if any move was actually performed
    dragitemidx = _.indexOf(_this.menu_items, dragitem);
    dropitemidx = _.indexOf(_this.menu_items, dropitem);
    if((dragitemidx==prev_dragitemidx)&&(dropitemidx==prev_dropitemidx)&&(prev_parent_id==dragitem.menu_item_parent_id)){
      /* No Changes */
    }
    else{
      _this.has_changes = true;
      _this.parseMenu();
      _this.renderMenu();
      _this.selectMenuItem(_this.selected_menu_item_id);
    }
  }

  this.getMenu = function(){
    if(!_this.menu_key){ XExt.Alert('Missing menu key'); return; }

    var url = '../_funcs/menu/'+_this.menu_key;
    if(_this.menu_id) url += '?menu_id=' + _this.menu_id;
    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        var menu = rslt.menu;
        _this.parseMenu(rslt.menu);
        _this.renderMenu();
        _this.selectMenuItem(_this.getFirstMenuItemID());
      }
      else{
        XExt.Alert('Error loading menu');
      }
    }, function (err) {
    });
  }

  this.getFirstMenuItemID = function(){
    var rslt = jsh.$root('.menu_item_id.xelem'+xmodel.class).find('.tree_item').first().data('value');
    return rslt||null;
  }

  this.getPrevMenuItemID = function(menu_item_id){
    var menu_item_ids = _.map(jsh.$root('.menu_item_id.xelem'+xmodel.class).find('.tree_item'), function(obj){ return parseInt(obj.getAttribute('data-value')); });
    for(var i=0;i<menu_item_ids.length;i++){
      if(menu_item_ids[i]==menu_item_id){
        if(i==0) return null;
        return menu_item_ids[i-1];
      }
    }
    return null;
  }

  this.parseMenu = function(menu){
    if(menu){
      var menu_items = [];
      if(menu && menu.menu_items) menu_items = menu.menu_items;
      _this.menu_items = menu_items;
    }
    _this.regenerateMenu();
    _this.generateMenuLOV();
  }

  this.regenerateMenu = function(){
    //Validate IDs
    var menu_item_ids = [];
    for(var i=0;i<_this.menu_items.length;i++){
      var menu_item = _this.menu_items[i];
      menu_item.menu_item_seq = i+1;
      if(!menu_item.menu_item_id) return XExt.Alert('Missing menu item ID');
      var prev_menu_item_id = menu_item.menu_item_id;
      menu_item.menu_item_id = parseInt(menu_item.menu_item_id);
      if(prev_menu_item_id.toString() != menu_item.menu_item_id.toString()) return XExt.Alert('Invalid menu item ID: '+prev_menu_item_id.toString());
      if(menu_item.menu_item_id in menu_item_ids) return XExt.Alert('Duplicate menu item ID: '+prev_menu_item_id.toString());
      menu_item_ids[menu_item.menu_item_id] = menu_item;
    }
    //Validate Parent ID's, Reset Paths
    for(var i=0;i<_this.menu_items.length;i++){
      var menu_item = _this.menu_items[i];
      var prev_menu_item_parent_id = menu_item.menu_item_parent_id;
      if(!prev_menu_item_parent_id){
        menu_item.menu_item_parent_id = null;
        menu_item.menu_item_path = '/' + menu_item.menu_item_id.toString() + '/';
        menu_item.menu_item_depth = 1;
      }
      else {
        menu_item.menu_item_parent_id = parseInt(menu_item.menu_item_parent_id);
        if(prev_menu_item_parent_id.toString() != menu_item.menu_item_parent_id.toString()) return XExt.Alert('Invalid parent menu item ID: '+prev_menu_item_parent_id.toString());
        if(!(menu_item.menu_item_parent_id in menu_item_ids)) return XExt.Alert('Invalid parent menu item ID: '+prev_menu_item_id.toString());
        menu_item.menu_item_path = null;
      }
    }
    //Generate paths
    var getMenuItemPath = function(menu_item){
      if(!menu_item.menu_item_path){
        var menu_item_parent = menu_item_ids[menu_item.menu_item_parent_id];
        menu_item.menu_item_path = getMenuItemPath(menu_item_parent) + menu_item.menu_item_id.toString() + '/'
        menu_item.menu_item_depth = menu_item_parent.menu_item_depth + 1;
      }
      return menu_item.menu_item_path;
    }
    for(var i=0;i<_this.menu_items.length;i++){
      getMenuItemPath(_this.menu_items[i]);
    }
    _this.menu_items.sort(function(a,b){
      if(a.menu_item_depth > b.menu_item_depth) return 1;
      if(a.menu_item_depth < b.menu_item_depth) return -1;
      if(a.menu_item_seq > b.menu_item_seq) return 1;
      if(a.menu_item_seq < b.menu_item_seq) return -1;
      return 0;
    });
    for(var i=0;i<_this.menu_items.length;i++){
      menu_item.menu_item_seq = i+1;
    }
  }

  this.generateMenuLOV = function(){
    var lov = [];
    _.each(_this.menu_items, function(menu_item){
      var lov_item = {};
      lov_item[jsh.uimap.code_id] = menu_item.menu_item_id;
      lov_item[jsh.uimap.code_parent_id] = menu_item.menu_item_parent_id;
      lov_item[jsh.uimap.code_val] = menu_item.menu_item_id;
      lov_item[jsh.uimap.code_txt] = (XExt.StripTags(menu_item.menu_item_text)||'').trim();
      lov_item[jsh.uimap.code_icon] = 'folder';
      lov.push(lov_item);
    });

    if(!xmodel.controller.form.Data._LOVs) xmodel.controller.form.Data._LOVs = {};
    xmodel.controller.form.Data._LOVs.menu_item_id = lov;
  }

  this.renderMenu = function(){
    xmodel.controller.form.Render();
    if(_this.selected_menu_item_id){
      xmodel.set('menu_item_id', _this.selected_menu_item_id);
    }
  }

  this.getMenuItem = function(menu_item_id){
    if(!menu_item_id) return null;
    menu_item_id = parseInt(menu_item_id);
    for(var i=0;i<_this.menu_items.length;i++){
      if(_this.menu_items[i].menu_item_id===menu_item_id) return _this.menu_items[i];
    }
    return null;
  }

  this.selectMenuItem = function(menu_item_id){
    if(!menu_item_id){
      jsh.$root('.xsubform.Menu_Tree_Info').hide();
      _this.selected_menu_item_id = null;
      return;
    }
    else {
      menu_item_id = parseInt(menu_item_id);
      if(xmodel.get('menu_item_id') != menu_item_id){
        xmodel.set('menu_item_id', menu_item_id);
        return;
      }
      jsh.$root('.xsubform.Menu_Tree_Info').show();
      if(_this.selected_menu_item_id == menu_item_id) return;
      _this.selected_menu_item_id = menu_item_id;
    }
    var menu_item = _.extend({}, _this.menu_item_base, _this.getMenuItem(menu_item_id));
    if(!menu_item){ XExt.Alert('Menu item '+menu_item_id+' not found'); return; }
    var modelInfo = _this.getModelInfo();

    var xformInfo = modelInfo.controller.form;
    var xdataInfo = xformInfo.Data;
    
    xdataInfo = _.extend(xdataInfo,menu_item);
    xdataInfo._is_insert = false;
    xdataInfo._is_dirty = false;
    xdataInfo._is_deleted = false;
    xdataInfo._orig = null;
    xformInfo.Render();

    _this.orig_current_menu_item = _.extend({}, xdataInfo);

    jsh.App[modelInfo.id].onload();
  }

  this.getModelInfo = function(){
    return jsh.XModels[jsh.XBase[xmodel.namespace+'Menu_Tree_Info'][0]];
  }

  this.checkUpdatesInfo = function(){
    if(!_this.selected_menu_item_id) return true;
    var xmodelInfo = _this.getModelInfo();
    _.each([
      'menu_item_type',
      'menu_item_text',
      'menu_item_link_type',
      'menu_item_link_target',
      'menu_item_link_dest',
      'menu_item_link_page',
      'menu_item_link_media',
      'menu_item_class',
      'menu_item_style',
      'menu_item_tag'
    ], function(key){
      var oldval = _this.orig_current_menu_item[key];
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
    if(!_this.selected_menu_item_id) return true;
    _this.checkUpdatesInfo();
    var xdataInfo = _this.getModelInfo().controller.form.Data;
    if(!xdataInfo.Commit('B')) return false;
    var menu_item = _this.getMenuItem(_this.selected_menu_item_id);
    if(!menu_item) return XExt.Alert('Menu item not found for ID: '+_this.selected_menu_item_id);
    var rerender = (_this.orig_current_menu_item.menu_item_text != xdataInfo.menu_item_text);
    _.each([
      'menu_item_type',
      'menu_item_text',
      'menu_item_link_type',
      'menu_item_link_target',
      'menu_item_link_dest',
      'menu_item_link_page',
      'menu_item_link_media',
      'menu_item_class',
      'menu_item_style',
      'menu_item_tag'
    ], function(key){
      if(key in xdataInfo){
        menu_item[key] = xdataInfo[key];
      }
    });
    _this.orig_current_menu_item = _.extend({}, xdataInfo);
    if(rerender){
      _this.parseMenu();
      _this.renderMenu();
    }
    return true;
  }

  this.deleteMenuItem = function(menu_item_id, force){
    menu_item_id = parseInt(menu_item_id);
    var menu_item = _this.getMenuItem(menu_item_id);
    if(!menu_item) return XExt.Alert('Invalid menu item ID');
    //Find children
    var menu_item_children = [];
    for(var i=0;i<_this.menu_items.length;i++){
      if(_this.menu_items[i].menu_item_parent_id==menu_item.menu_item_id){
        menu_item_children.push(_this.menu_items[i].menu_item_id);
      }
    }
    if(!force){
      XExt.Confirm('Are you sure you want to delete "'+menu_item.menu_item_text+'"'+(menu_item_children.length?' and all of its children':'')+'?', function (rslt) {
        var next_menu_item_id = _this.selected_menu_item_id;
        if(next_menu_item_id == menu_item_id) next_menu_item_id = _this.getPrevMenuItemID(menu_item_id);
        _this.deleteMenuItem(menu_item_id, true);
        _this.parseMenu();
        _this.renderMenu();
        if(!next_menu_item_id || !_this.getMenuItem(next_menu_item_id)) next_menu_item_id = _this.getFirstMenuItemID();
        _this.selected_menu_item_id = null;
        _this.selectMenuItem(next_menu_item_id);
      });
      return;
    }
    _.each(menu_item_children, function(menu_item_id){ _this.deleteMenuItem(menu_item_id, true); });
    //Delete item
    for(var i=0;i<_this.menu_items.length;i++){
      if(_this.menu_items[i]==menu_item){
        _this.menu_items.splice(i,1);
        i--;
      }
    }
    _this.has_changes = true;
  }

  this.addMenuItem = function(menu_item_parent_id){
    if(!_this.commitInfo()) return;

    menu_item_parent_id = parseInt(menu_item_parent_id);
    var menu_item_parent_id = _this.getMenuItem(menu_item_parent_id);
    if(!menu_item_parent_id) menu_item_parent_id = null;

    var max_menu_item_id = 0;
    _.each(_this.menu_items, function(menu_item){ if(menu_item.menu_item_id >= max_menu_item_id) max_menu_item_id = menu_item.menu_item_id; });
    var new_menu_item_id = max_menu_item_id+1;

    var new_menu_item = _.extend({}, _this.menu_item_base);
    new_menu_item.menu_item_id = new_menu_item_id;
    if(menu_item_parent_id){
      new_menu_item.menu_item_parent_id = menu_item_parent_id.menu_item_id;
      new_menu_item.menu_item_path = menu_item_parent_id.menu_item_path+new_menu_item_id.toString()+'/';
    }
    else {
      new_menu_item.menu_item_path = '/'+new_menu_item_id.toString()+'/';
    }

    _this.menu_items.push(new_menu_item);
    _this.has_changes = true;
    _this.parseMenu();
    _this.renderMenu();
    _this.selectMenuItem(new_menu_item_id);
    window.setTimeout(function(){
      jsh.$root('.menu_item_text.xelem'+_this.getModelInfo().class).focus();
      //Scroll menu to item
      var jtree = jsh.$root('.menu_item_id.xelem'+xmodel.class);
      var jselected = jtree.find('.tree_item.selected').first();
      if(jselected.length) XExt.scrollObjIntoView(jtree, jselected);
    },1);
  }

  this.save = function(){
    if(_this.menu_id){ XExt.Alert('Cannot save when previewing a revision'); return; }
    if(!_this.menu_key){ XExt.Alert('Missing menu key'); return; }
    if(!_this.commitInfo()) return;

    var save_menu_items = [];
    for(var i=0;i<_this.menu_items.length;i++){
      var menu_item = _this.menu_items[i];
      var save_menu_item = _.pick(menu_item, [
        'menu_item_id',
        'menu_item_parent_id',
        'menu_item_path',
        'menu_item_text',
        'menu_item_type',
        'menu_item_tag',
        'menu_item_style',
        'menu_item_class',
        'menu_item_link_type',
        'menu_item_link_dest',
        'menu_item_link_target',
      ])
      save_menu_items.push(save_menu_item);
    }
    if(!save_menu_items.length) save_menu_items = '';

    var url = jsh._BASEURL+'_funcs/menu/'+_this.menu_key;
    XForm.Post(url, {}, { menu_items: save_menu_items }, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.has_changes = false;
      }
      else{
        XExt.Alert('Error loading menu');
      }
    }, function (err) {
    });
  }

})();
