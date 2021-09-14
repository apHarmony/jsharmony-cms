jsh.App[modelid] = new (function(){
  var _this = this;

  this.editFile = function(obj){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before editing page');

    var rowid = $(obj).closest('tr').data('id');

    var page_key = xmodel.get('page_key', rowid);
    if(!page_key) return XExt.Alert('Please save page before editing');

    var page_template_id = xmodel.get('page_template_id', rowid);
    if(!page_template_id) return XExt.Alert('Please select a template before editing');

    var page_template_path = xmodel.get('page_template_path', rowid);

    jsh.System.OpenPageEditor(page_key, xmodel.get('page_filename', rowid), page_template_id, { source: 'page_listing', rawEditorDialog: '.'+xmodel.class+'_RawTextEditor', page_template_path: page_template_path });
  }

})();
