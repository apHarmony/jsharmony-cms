jsh.App[modelid] = new (function(){
  var _this = this;

  this.default_deployment_target_publish_config = {};
  this.site_default_page_filename = '';

  this.access_key = '';    //Populated onroute
  this.server_url = '';    //Populated onroute
  this.client_params = {}; //Populated onroute

  this.onload = function(){
    XForm.Get('/_funcs/deployment_target/defaults', { site_id: xmodel.get('site_id') }, {}, function(rslt){
      _this.default_deployment_target_publish_config = rslt.deployment_target_publish_config;
      _this.site_default_page_filename = rslt.site_default_page_filename;
    }, undefined, { async: false });

    xmodel.set('access_key', _this.access_key);
    xmodel.set('server_url', _this.server_url);

    var deployment_target_publish_config = xmodel.get('deployment_target_publish_config')||'{}';
    try{
      deployment_target_publish_config = JSON.parse(deployment_target_publish_config);
    }
    catch(ex){
      deployment_target_publish_config = {};
    }

    var client_js_params = { };
    var page_files_path = undefined;
    var dtparams = {
      url_prefix: undefined,
      page_subfolder: undefined,
      url_prefix_page_override: undefined,
    };
    for(var key in dtparams){
      if(key in deployment_target_publish_config) dtparams[key] = deployment_target_publish_config[key];
      else if(key in _this.default_deployment_target_publish_config){
        if((key == 'url_prefix') && (_this.default_deployment_target_publish_config.url_prefix == '/')){ }
        else {
          dtparams[key] = _this.default_deployment_target_publish_config[key];
        }
      }
    }
    if(!XExt.isNullUndefinedEmpty(dtparams.url_prefix) || !XExt.isNullUndefinedEmpty(dtparams.page_subfolder)){
      page_files_path = XExt.isNullUndefinedEmpty(dtparams.url_prefix) ? '/' : (dtparams.url_prefix || '');
      page_files_path += (dtparams.page_subfolder || '');
    }
    if(!XExt.isNullUndefinedEmpty(page_files_path)) client_js_params.page_files_path = page_files_path;

    if(_this.site_default_page_filename != 'index.html') client_js_params.default_document = 'index.html';

    client_js_params.access_keys = [_this.access_key];

    var code_client_js = [
      '<script type="text/javascript" src="/jsHarmonyCmsClient.js"></'+'script>',
      '<script type="text/javascript">var cmsClient = new jsHarmonyCmsClient('+JSON.stringify(client_js_params)+');</'+'script>',
    ].join("\n");
    jsh.$root('.integration_code_client_js').val(code_client_js);

    jsh.$root('.integration_code_copy').off('.integration').on('click.integration', function(e){
      e.preventDefault();
      e.stopImmediatePropagation();
      var obj = $(this).prev()[0];
      obj.select();
      obj.setSelectionRange(0, 99999);
      document.execCommand("copy");
    });
  }

  this.regenerateAccessKey = function(){
    if(!xmodel.controller.form.Data.Commit()) return; 

    XExt.Confirm('<div style="text-align:left;">Regenerating the key will cause any integrations that use an access key on this deployment target to stop working.<br/><br/>Existing integrations will need to be updated with a new access key.<br/><br/>Continue?</div>', function(){

      XForm.Post('../_funcs/deployment_target/'+xmodel.get('deployment_target_id')+'/regenerate_access_key', {}, {},
        function(rslt){
          XPage.Refresh();
        }
      );

    }, undefined, {
      message_type: 'html',
      button_ok_caption: 'Continue',
      button_no_caption: 'Cancel'
    });
  }

})();
