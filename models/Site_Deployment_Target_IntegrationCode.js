jsh.App[modelid] = new (function(){
  var _this = this;

  this.default_deployment_target_publish_config = {};
  this.site_default_page_filename = '';
  this.redirect_listing_path = null;
  this.integration_params = {};

  this.access_key = '';              //Populated onroute
  this.cms_server_url = '';              //Populated onroute
  

  this.onload = function(){
    XForm.Get('/_funcs/deployment_target/defaults', { site_id: xmodel.get('site_id') }, {}, function(rslt){
      _this.default_deployment_target_publish_config = rslt.deployment_target_publish_config;
      _this.site_default_page_filename = rslt.site_default_page_filename;
      _this.redirect_listing_path = rslt.redirect_listing_path;
    }, undefined, { async: false });

    xmodel.set('access_key', _this.access_key);
    xmodel.set('cms_server_url', _this.cms_server_url);

    var deployment_target_publish_config = xmodel.get('deployment_target_publish_config')||'{}';
    try{
      deployment_target_publish_config = JSON.parse(deployment_target_publish_config);
    }
    catch(ex){
      deployment_target_publish_config = {};
    }

    _this.integration_params = { };
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
    if(!XExt.isNullUndefinedEmpty(page_files_path)) _this.integration_params.page_files_path = page_files_path;

    if(_this.site_default_page_filename != 'index.html') _this.integration_params.default_document = 'index.html';

    if(_this.redirect_listing_path) _this.integration_params.redirect_listing_path = _this.redirect_listing_path;

    _this.integration_params.access_keys = [_this.access_key];
    _this.integration_params.cms_server_urls = [_this.cms_server_url];
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

  this.getIntegrationParamsString = function(options){
    options = _.extend({
      access_keys: false,
      cms_server_urls: false,
      params: _this.integration_params,
    }, options);
    var integrationParamsString = '{';
    var firstParam = true;
    for(var key in options.params){
      if((key=='access_keys')&&!options.access_keys) continue;
      if((key=='cms_server_urls')&&!options.cms_server_urls) continue;
      integrationParamsString += (firstParam ? '' : ',')+'\n    '+key+': '+JSON.stringify(options.params[key]);
      firstParam = false;
    }
    integrationParamsString += (firstParam ? '' : '\n') + '}';
    return integrationParamsString;
  }

  this.integration_target_onchange = function(obj, newval, undoChange){
    var tmpl = $('.'+xmodel.class+'_Integration_'+newval).html()||'';

    var params = _.extend({}, _this.integration_params);
    if((newval=='EXPRESSJS_ROUTER')||(newval=='EXPRESSJS_STANDALONE')) params['content_path'] = 'path/to/published_files';

    for(var key in params){
      var val = params[key];
      val = JSON.stringify(val);
      tmpl = XExt.ReplaceAll(tmpl, '%%%'+key.toUpperCase()+'%%%', val);
    }

    tmpl = XExt.ReplaceAll(tmpl, '%%%INTEGRATION_PARAMS_ACCESS_KEYS%%%', _this.getIntegrationParamsString({ access_keys: true, params: params }));
    tmpl = XExt.ReplaceAll(tmpl, '%%%INTEGRATION_PARAMS_CMS_SERVER_URLS%%%', _this.getIntegrationParamsString({ cms_server_urls: true, params: params }));
    jsh.$root('.integration_doc').html(tmpl);
    jsh.$root('.integration_doc').find('.integration_code').each(function(){
      this.style.height = '10px';
      this.style.height = this.scrollHeight+25+'px';
    });
    jsh.$root('.integration_doc').find('.integration_code_copy').off('.integration').on('click.integration', function(e){
      e.preventDefault();
      e.stopImmediatePropagation();
      var obj = $(this).prev()[0];
      obj.select();
      obj.setSelectionRange(0, 99999);
      document.execCommand("copy");
    });
  }

})();
