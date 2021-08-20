jsh.App[modelid] = new (function(){
  var _this = this;

  this.sftp_url = '';   //Populated onroute
  this.sftp_user = '';  //Populated onroute
  

  this.onload = function(){
    var bcrumbs = jsh.XPage.getBreadcrumbs();
    var jinfo = jsh.$root('.sftp_info');
    if(!_this.sftp_url) jinfo.html(XExt.escapeHTML('SFTP is not enabled for this site.  To enable SFTP, set the CMS config.sftp.enabled property to true.'));
    else {
      var full_sftp_url = _this.sftp_url + '/sites/' + XExt.cleanFileName((bcrumbs.site_id||'').toString()+'_'+(bcrumbs.site_name||''));
      jsh.$root('.sftp_info').html([
        '<b>SFTP URL:</b> <a href="' + XExt.escapeHTML(full_sftp_url) + '" target="_blank">' + XExt.escapeHTML(full_sftp_url) + '</a><br/>',
        '<b>Username:</b> ' + XExt.escapeHTML(_this.sftp_user) + '<br/>',
        '<b>Password:</b> ' + XExt.escapeHTML('<Your CMS Login Password>') + '<br/>',
      ].join(''));
    }
  }

})();
