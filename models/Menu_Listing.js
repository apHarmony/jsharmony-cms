jsh.App[modelid] = new (function(){
  var _this = this;

  this.openMenuEditor = function(obj){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before editing menu');

    var rowid = $(obj).closest('tr').data('id');

    var menu_key = xmodel.get('menu_key', rowid);
    if(!menu_key) return XExt.Alert('Please save menu before editing');

    XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Menu_Tree?action=update&menu_key='+menu_key);
  }

})();
