jsh.App[modelid] = new (function(){
  var _this = this;

  this.editFile = function(obj){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before editing page');

    var rowid = $(obj).closest('tr').data('id');

    var page_key = xmodel.get('page_key', rowid);
    if(!page_key) return XExt.Alert('Please save page before editing');

    var page_template_id = xmodel.get('page_template_id', rowid);
    if(!page_template_id) return XExt.Alert('Please select a template before editing');

    var template = jsh.globalparams.PageTemplates[page_template_id];
    if(!template) return XExt.Alert('Template is not defined');

    jsh.System.OpenPageEditor(page_key, xmodel.get('page_filename', rowid), template, { rawEditorDialog: '.'+xmodel.class+'_RawTextEditor' });
  }

})();
