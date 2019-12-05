jsh.App[modelid] = new (function(){
  var _this = this;

  _this.revision_menu_key = undefined;
  _this.revision_menu_id = undefined;

  this.openMenuEditor = function(obj){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before editing menu');

    var rowid = $(obj).closest('tr').data('id');

    var menu_key = xmodel.get('menu_key', rowid);
    if(!menu_key) return XExt.Alert('Please save menu before editing');

    XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Menu_Tree?action=update&menu_key='+menu_key);
  }

  this.previewMenu = function(menu){
    XExt.popupForm(xmodel.namespace+'Menu_Tree_Browse','browse', { menu_key: menu.menu_key, menu_id: menu.menu_id })
  }

  this.viewRevisions = function(obj){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before editing menu');

    var rowid = $(obj).closest('tr').data('id');
    var menu_key = xmodel.get('menu_key', rowid);

    _this.revision_menu_key = menu_key;
    _this.revision_menu_id = xmodel.get('menu_id', rowid);
    jsh.XExt.popupShow(xmodel.namespace + 'Menu_Revision_Listing','revision_menu','Revisions',undefined,jsh.$root('.xform'+xmodel.class+' .revision_menu_xlookup')[0],{
      OnPopupClosed:function(rslt){
        if(rslt && rslt.resultrow && rslt.resultrow.menu_id){
          var menu_id = rslt.resultrow.menu_id;
          XForm.Post(xmodel.namespace+'Menu_Revision_Update',{},{ menu_key: menu_key, menu_id: menu_id }, function(){
            jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} });
          });
        }
      }
    });
  }

})();
