jsh.App[modelid] = new (function(){
  var _this = this;

  _this.onload = function(xmodel) {
    var bcrumbs = jsh.XPage.getBreadcrumbs();

    jsh.xd('.'+xmodel.class+'_Templates_Location .label_fs_component_template_path').style.display = !!bcrumbs.fs_component_template_path;
    jsh.xd('.'+xmodel.class+'_Templates_Location .fs_component_template_path').text = bcrumbs.fs_component_template_path||'';

    var sftp_component_template_path = '';
    if(bcrumbs.sftp_url) sftp_component_template_path = bcrumbs.sftp_url + '/sites/' + XExt.cleanFileName((bcrumbs.site_id||'').toString()+'_'+(bcrumbs.site_name||'')) + '/templates/components';
    jsh.xd('.'+xmodel.class+'_Templates_Location .label_sftp_component_template_path').style.display = !!sftp_component_template_path;
    jsh.xd('.'+xmodel.class+'_Templates_Location .sftp_component_template_path').text = sftp_component_template_path;
  };

})();
