jsh.App[modelid] = new (function(){
  var _this = this;

  this.onload = function(xmodel) {
    var bcrumbs = jsh.XPage.getBreadcrumbs();

    jsh.$root('.'+xmodel.class+'_Config_Location .label_fs_config_path').toggle(!!bcrumbs.fs_config_path);
    jsh.$root('.'+xmodel.class+'_Config_Location .fs_config_path').text(bcrumbs.fs_config_path||'');

    var sftp_config_path = '';
    if(bcrumbs.sftp_url) sftp_config_path = bcrumbs.sftp_url + '/sites/' + XExt.cleanFileName((bcrumbs.site_id||'').toString()+'_'+(bcrumbs.site_name||'')) + '/templates/site_config.json';
    jsh.$root('.'+xmodel.class+'_Config_Location .label_sftp_config_path').toggle(!!sftp_config_path);
    jsh.$root('.'+xmodel.class+'_Config_Location .sftp_config_path').text(sftp_config_path);
  }

})();
