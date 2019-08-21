jsh.App[modelid] = new (function(){
  var _this = this;

  this.openPageEditor = function(obj){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before editing page');

    var rowid = $(obj).find('.xicon').data('rowid');

    var page_id = xmodel.get('page_id', rowid);
    if(!page_id) return XExt.Alert('Please save page before editing');

    var template_id = xmodel.get('template_id', rowid);
    if(!template_id) return XExt.Alert('Please select a template before editing');

    var template = jshInstance.globalparams.templates[template_id];
    if(!template) return XExt.Alert('Template is not defined');
    
    var url = template.editor;
    url = XExt.ReplaceAll(url, '%%%page_id%%%', page_id);
    window.open(url, '_blank', "width=1000,height=800");
  }

})();
