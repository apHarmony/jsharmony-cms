jsh.App[modelid] = new (function(){
  var _this = this;

  this.previewTemplate = function(obj){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before previewing template');

    var rowid = $(obj).closest('tr').data('id');
    var site_template_location = xmodel.get('site_template_location', rowid);
    var site_template_path = xmodel.get('site_template_path', rowid);
    var site_template_name = xmodel.get('site_template_name', rowid);
    
    //Get editor url
    jsh.System.OpenPageEditor(null, null, site_template_name, {
      getURL: true,
      async: false,
      devMode: true,
      site_id: xmodel.get('site_id'),
      onComplete: function(err, url, template){
        if(err) return XExt.Alert(err.toString());
        if(template && template.raw) return XExt.Alert('Raw Text / Raw HTML Templates use an inline editor');
        if(!url) return XExt.Alert(site_template_name + ' template does not have an editor defined');
        window.open(url, '_blank', "width=1195,height=800");
      }
    });
  }

})();
