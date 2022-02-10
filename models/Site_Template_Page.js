jsh.App[modelid] = new (function(){
  var _this = this;

  _this.onload = function(xmodel) {
    var bcrumbs = jsh.XPage.getBreadcrumbs();

    jsh.$root('.'+xmodel.class+'_Templates_Location .label_fs_page_template_path').toggle(!!bcrumbs.fs_page_template_path);
    jsh.$root('.'+xmodel.class+'_Templates_Location .fs_page_template_path').text(bcrumbs.fs_page_template_path||'');

    var sftp_page_template_path = '';
    if(bcrumbs.sftp_url) sftp_page_template_path = bcrumbs.sftp_url + '/sites/' + XExt.cleanFileName((bcrumbs.site_id||'').toString()+'_'+(bcrumbs.site_name||'')) + '/templates/pages';
    jsh.$root('.'+xmodel.class+'_Templates_Location .label_sftp_page_template_path').toggle(!!sftp_page_template_path);
    jsh.$root('.'+xmodel.class+'_Templates_Location .sftp_page_template_path').text(sftp_page_template_path);
  };

  _this.previewTemplate = function(obj){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before previewing template');

    var rowid = $(obj).closest('tr').data('id');
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
        jsh.System.OpenPageEditorUrl(url);
      }
    });
  };

})();
