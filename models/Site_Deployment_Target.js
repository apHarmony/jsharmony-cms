jsh.App[modelid] = new (function(){
  var _this = this;

  this.default_deployment_target_publish_config = {};

  var parse_url_cache = {};
  var previous_config = '';

  _this.template_configurator = jsh.XDom('.xctrl_deployment_target_publish_configurator_template').html;

  _this.oninit = function(){
    _this.configurator_render();
    jsh.XDom('.src_deployment_target_publish_config_view_previous').style.display = !jsh.is_insert;
  };

  _this.onload = function(){
    XForm.Get('/_funcs/deployment_target/defaults', { site_id: xmodel.get('site_id') }, {}, function(rslt){
      _this.default_deployment_target_publish_config = rslt.deployment_target_publish_config;
    }, undefined, { async: false });
    var xdata = xmodel.controller.form.Data;
    var orig_path = xdata['deployment_target_publish_path'] || '<Not set>';
    var orig_config = xdata['deployment_target_publish_config'] || '{}';
    try{ orig_config = JSON.stringify(JSON.parse(orig_config),null,2); }
    catch(ex){ /* Do nothing */ }
    if(orig_config=='{}') orig_config = '{\n}';
    previous_config = [
      '<div style="text-decoration:underline;padding:0 0 5px 0;font-weight:bold;">Previous Publish Path</div>',
      XExt.escapeHTML(orig_path),
      '<div style="text-decoration:underline;padding:10px 0 0 0;font-weight:bold;">Previous Publish Config</div>',
      '<pre>'+XExt.escapeHTML(orig_config)+'</pre>',
    ].join('\n');

    _this.configurator_setvalue(xdata['deployment_target_publish_path'], xdata['deployment_target_publish_config']);
  };

  _this.configurator_getContainer = function(){ return jsh.xd('.xform'+xmodel.class+' .deployment_target_publish_configurator'); };

  _this.getDeploymentType = function(){ return _this.configurator_getContainer().get('.deployment_type').value; };

  _this.configurator_render = function(){
    var xdcontainer = _this.configurator_getContainer();
    xdcontainer.html = XExt.renderEJS(_this.template_configurator, xmodel.id);

    var xddeployment_type = xdcontainer.get('.deployment_type');
    XExt.RenderLOV(null, xddeployment_type.element, [
      { code_val: '', code_txt: '(No Publish Target)' },
      { code_val: 's3', code_txt: 'Amazon S3' },
      { code_val: 'cmshost', code_txt: 'CMS Deployment Host' },
      { code_val: 'ftp', code_txt: 'FTP' },
      { code_val: 'ftps', code_txt: 'FTPS' },
      { code_val: 'file', code_txt: 'Local Filesystem' },
      { code_val: 'git_https', code_txt: 'Git HTTPS' },
      { code_val: 'git_ssh', code_txt: 'Git SSH' },
      { code_val: 'sftp', code_txt: 'SFTP' },
    ]);
    xddeployment_type.on('keyup change', function(e){ _this.configurator_updateDeploymentType(); });

    xdcontainer.get('.downloadPublicKey').on('click', function(e){
      e.preventDefault();
      e.stopImmediatePropagation();
      var tabs = {};
      tabs[xmodel.namespace+'Site_Deployment_Target_Tabs'] = xmodel.namespace+'Site_Deployment_Target_Key';
      XExt.navTo(jsh._BASEURL+xmodel.namespace+'Site_Deployment_Target_Tabs?'+jsh.XExt.escapeQuery({action:'update',deployment_target_id:xmodel.get('deployment_target_id'), tabs: JSON.stringify(tabs)}));
    });

    xdcontainer.get('.edit_button').on('click', function(e){
      e.preventDefault();
      e.stopImmediatePropagation();
      var target = this.getAttribute('data-target');

      if(jsh.XDom.class.contains(this, 'editing')){
        _this.disableEditing(this);
        var xdinput = xdcontainer.get('[data-elem="'+target+'"]');
        xdinput.value = _this.default_deployment_target_publish_config[target]||'';
      }
      else {
        _this.enableEditing(this);
      }
    });

    xdcontainer.get('.parse_url').on('blur', function(e){
      if(!jsh.XDom.isVisible(this)) return;
      _this.updateUrl(_.trim(this.value));
    });

    xdcontainer.get('[data-elem="git_config.options"]').attr.placeholder = JSON.stringify({
      'user.email': 'cms@localhost',
      'user.name': 'CMS',
    },null,2);

    xdcontainer.get('.xctrl_deployment_target_publish_configurator .xtab[for="xctrl_deployment_target_publish_configurator_json"]').on('click', function(e){
      var err_str = _this.configurator_validate().join('\n');
      if(err_str){
        e.preventDefault();
        e.stopImmediatePropagation();
        return XExt.Alert(err_str);
      }
      _this.generateJSON();
    });
    xdcontainer.get('.xctrl_deployment_target_publish_configurator .xtab[for="xctrl_deployment_target_publish_configurator_wizard"]').on('click', function(e){
      var err_str = _this.configurator_validate().join('\n');
      if(err_str){
        e.preventDefault();
        e.stopImmediatePropagation();
        return XExt.Alert(err_str);
      }
      _this.configurator_setvalue(xmodel.get('deployment_target_publish_path'), xmodel.get('deployment_target_publish_config'));
    });
    xdcontainer.get('.src_deployment_target_publish_config_view_previous').on('click', function(e){
      e.preventDefault();
      e.stopImmediatePropagation();
      XExt.Alert(previous_config,null, { escapeHTML: false });
    });
  };

  _this.host_id_onSelected = function(popupData){
    var xdcontainer = _this.configurator_getContainer();
    if(!popupData.result) return;
    xdcontainer.get('.deployment_type_container_cmshost [data-path-elem="hostid"]').value = popupData.result;
  };

  _this.configurator_updateDeploymentType = function(val){
    var xdcontainer = _this.configurator_getContainer();
    if(val) xdcontainer.get('.deployment_type').value = val;
    else val = xdcontainer.get('.deployment_type').value;
    xdcontainer.get('.deployment_type_container').omit(function(el) { return jsh.XDom.class.contains(el, '.deployment_type_container_'+val);}).style.display = false;
    xdcontainer.get('.deployment_type_container_'+val).style.display = true;
  };

  _this.configurator_setvalue = function(publish_path, publish_config){
    publish_path = publish_path || '';
    publish_config = publish_config || '';
    var xdcontainer = _this.configurator_getContainer();
    xdcontainer.get('.src_deployment_target_publish_path').value = publish_path;
    var parsed_config = {};
    if (publish_config) {
      try {
        parsed_config = JSON.parse(publish_config);
        publish_config = _.isEmpty(parsed_config)?'{\n}':JSON.stringify(parsed_config,null,2);
      }
      catch(ex){ /* Do nothing */ }
    }
    xdcontainer.get('.src_deployment_target_publish_config').value = publish_config;


    //Parse URL
    var pathParts = publish_path.split('://');
    var protocol = pathParts[0].toLowerCase();
    if(!_.includes(['s3','cmshost','ftp','ftps','file','git_https','git_ssh','sftp'], protocol)) protocol = '';
    _this.configurator_updateDeploymentType(protocol);

    if(protocol){
      _this.updateUrl(publish_path, { override: true });

      var xdDeploymentType = xdcontainer.get('.deployment_type_container_'+protocol);
      if(protocol=='s3'){ (function(){
        var s3_config = parsed_config.s3_config||{};
        xdDeploymentType.get('[data-elem="s3_config.accessKeyId"]').value = s3_config.accessKeyId||'';
        xdDeploymentType.get('[data-elem="s3_config.secretAccessKey"]').value = s3_config.secretAccessKey||'';
        xdDeploymentType.get('[data-elem="s3_config.upload_params"]').value = (_.isEmpty(s3_config.upload_params)?'{\n}':JSON.stringify(s3_config.upload_params,null,2));
        _.each(['accessKeyId','secretAccessKey','upload_params'], function(key){ delete s3_config[key]; });
        if(_.isEmpty(s3_config)) delete parsed_config.s3_config;
      })(); }
      else if(protocol=='cmshost'){ (function(){
        var cmshost_config = parsed_config.cmshost_config||{};
        xdDeploymentType.get('[data-elem="cmshost_config.download_remote_templates"]').element.checked = !!cmshost_config.download_remote_templates;
        xdDeploymentType.get('[data-elem="cmshost_config.remote_timeout"]').value = cmshost_config.remote_timeout||'';
        _.each(['download_remote_templates','remote_timeout'], function(key){ delete cmshost_config[key]; });
        if(_.isEmpty(cmshost_config)) delete parsed_config.cmshost_config;
      })(); }
      else if(protocol=='file'){ (function(){
        var fs_config = parsed_config.fs_config||{};
        xdDeploymentType.get('[data-elem="fs_config.delete_excess_files"]').element.checked = !!fs_config.delete_excess_files;
        _.each(['delete_excess_files'], function(key){ delete fs_config[key]; });
        if(_.isEmpty(fs_config)) delete parsed_config.fs_config;
      })(); }
      else if(protocol=='git_https'){ (function(){
        var git_config = parsed_config.git_config||{};
        xdDeploymentType.get('[data-elem="git_config.branch"]').value = git_config.branch||'';
        xdDeploymentType.get('[data-elem="git_config.options"]').value = (_.isEmpty(git_config.options)?'{\n}':JSON.stringify(git_config.options,null,2));
        _.each(['branch','options'], function(key){ delete git_config[key]; });
        if(_.isEmpty(git_config)) delete parsed_config.git_config;
      })(); }
      else if(protocol=='git_ssh'){ (function(){
        var git_config = parsed_config.git_config||{};
        xdDeploymentType.get('[data-elem="git_config.branch"]').value = git_config.branch||'';
        xdDeploymentType.get('[data-elem="git_config.options"]').value = (_.isEmpty(git_config.options)?'{\n}':JSON.stringify(git_config.options,null,2));
        _.each(['branch','options'], function(key){ delete git_config[key]; });
        if(_.isEmpty(git_config)) delete parsed_config.git_config;
      })(); }
      else if((protocol=='ftp')||(protocol=='ftps')||(protocol=='sftp')){ (function(){
        var ftp_config = parsed_config.ftp_config||{};
        xdDeploymentType.get('[data-elem="ftp_config.overwrite_all"]').element.checked = !!ftp_config.overwrite_all;
        xdDeploymentType.get('[data-elem="ftp_config.delete_excess_files"]').element.checked = !!ftp_config.delete_excess_files;
        if((protocol=='ftp')||(protocol=='ftps')) xdDeploymentType.get('[data-elem="ftp_config.compression"]').element.checked = !!ftp_config.compression;
        if(protocol=='ftps') xdDeploymentType.get('[data-elem="ftp_config.ignore_certificate_errors"]').element.checked = !!ftp_config.ignore_certificate_errors;
        _.each(['overwrite_all','delete_excess_files','compression','ignore_certificate_errors'], function(key){ delete ftp_config[key]; });
        if(_.isEmpty(ftp_config)) delete parsed_config.ftp_config;
      })(); }
    }
    xdcontainer.get('[data-elem="url_prefix"]').value = parsed_config.url_prefix;
    xdcontainer.get('[data-elem="published_url"]').value = parsed_config.published_url;
    xdcontainer.get('[data-elem="url_prefix_page_override"]').value = parsed_config.url_prefix_page_override;
    xdcontainer.get('[data-elem="url_prefix_media_override"]').value = parsed_config.url_prefix_media_override;
    xdcontainer.get('[data-elem="page_subfolder"]').value = parsed_config.page_subfolder;
    xdcontainer.get('[data-elem="media_subfolder"]').value = parsed_config.media_subfolder;
    xdcontainer.get('[data-elem="publish_local_templates"]').element.checked = !!parsed_config.publish_local_templates;
    xdcontainer.get('[data-elem="ignore_remote_template_certificate"]').element.checked = !!parsed_config.ignore_remote_template_certificate;

    _.forEach(xdcontainer.get('.edit_button').elements, function(el){
      var target = el.getAttribute('data-target');
      if(target in parsed_config) _this.enableEditing(el);
      else{
        _this.disableEditing(el);
        var xdinput = xdcontainer.get('[data-elem="'+target+'"]');
        xdinput.value = _this.default_deployment_target_publish_config[target]||'';
      }
    });

    var ext_config = JSON.parse(JSON.stringify(parsed_config));
    _.each(['url_prefix','published_url','url_prefix_page_override','url_prefix_media_override','page_subfolder','media_subfolder','publish_local_templates','ignore_remote_template_certificate'], function(key){ delete ext_config[key]; });
    xdcontainer.get('[data-elem="ext_config"]').value = (_.isEmpty(ext_config)?'{\n}':JSON.stringify(ext_config,null,2));
  };

  _this.enableEditing = function(ctrl){
    var xdcontainer = _this.configurator_getContainer();
    var target = ctrl.getAttribute('data-target');
    jsh.XDom.class.add(ctrl, 'editing');
    var xdinput = xdcontainer.get('[data-elem="'+target+'"]');
    xdinput.attr.readonly = false;
    xdinput.class.remove('uneditable');
  };

  _this.disableEditing = function(ctrl){
    var xdcontainer = _this.configurator_getContainer();
    var target = ctrl.getAttribute('data-target');
    jsh.XDom.class.remove(ctrl, 'editing');
    var xdinput = xdcontainer.get('[data-elem="'+target+'"]');
    xdinput.attr.readonly = true;
    xdinput.class.add('uneditable');
  };

  _this.updateUrl = function(url, options){
    options = _.extend({ override: false }, options);
    var protocol = _this.getDeploymentType();
    var xdcontainer = _this.configurator_getContainer();
    var xdDeploymentType = xdcontainer.get('.deployment_type_container_'+protocol);
    var deployment_type_url = '';

    if(!url) return;

    if(url.indexOf('//')==0) url = protocol+':' + url;
    if((url.indexOf('://') < 0) || (url.indexOf('://') > url.indexOf('/'))) url = protocol+'://' + url;

    if(protocol=='s3'){
      if(url.toLowerCase().indexOf('s3://')==0) url = url.substr(5);
      xdDeploymentType.get('[data-path-elem="bucket"]').value = url;
    }
    else if(protocol=='cmshost'){
      if(url.toLowerCase().indexOf('cmshost://')==0) url = url.substr(10);
      xdDeploymentType.get('[data-path-elem="hostid"]').value = url;
    }
    else if(protocol=='file'){
      if(url.toLowerCase().indexOf('file://')==0) url = url.substr(7);
      xdDeploymentType.get('[data-path-elem="path"]').value = url;
    }
    else {
      var parsed_url = _this.parse_url(url);

      if(!parsed_url) return;
      if(!parsed_url.hostname) return;

      if(protocol=='git_https'){
        deployment_type_url = 'https://'+parsed_url.hostname+(parsed_url.port?':'+parsed_url.port:'')+(parsed_url.path||'');
        xdDeploymentType.get('[data-path-elem="url"]').value = deployment_type_url;
        if(parsed_url.username || options.override) xdDeploymentType.get('[data-path-elem="username"]').value = parsed_url.username||'';
        if(parsed_url.password || options.override) xdDeploymentType.get('[data-path-elem="password"]').value = parsed_url.password||'';
      }
      else if(protocol=='git_ssh'){
        deployment_type_url = 'ssh://'+parsed_url.hostname+(parsed_url.port?':'+parsed_url.port:'')+(parsed_url.path||'');
        xdDeploymentType.get('[data-path-elem="url"]').value = deployment_type_url;
        if(parsed_url.username || options.override) xdDeploymentType.get('[data-path-elem="username"]').value = parsed_url.username||'';
      }
      else if((protocol=='ftp')||(protocol=='ftps')||(protocol=='sftp')){
        xdDeploymentType.get('[data-path-elem="hostname"]').value = parsed_url.hostname;
        deployment_type_url = protocol+'://'+parsed_url.hostname;
        if(parsed_url.port || options.override) xdDeploymentType.get('[data-path-elem="port"]').value = parsed_url.port||'';
        if(parsed_url.username || options.override) xdDeploymentType.get('[data-path-elem="username"]').value = parsed_url.username||'';
        if(parsed_url.password || options.override) xdDeploymentType.get('[data-path-elem="password"]').value = parsed_url.password||'';
        if(parsed_url.path || options.override){
          if(!options.override && (parsed_url.path =='/') &&xdDeploymentType.get('[data-path-elem="path"]').value){ /* Do nothing */ }
          else xdDeploymentType.get('[data-path-elem="path"]').value = parsed_url.path||'';
        }
      }
      if(deployment_type_url != url) _this.parse_url(deployment_type_url);
    }
  };

  _this.parse_url = function(url, depth){
    var parsed_url = null;
    if(!url) return null;

    var protocol = _this.getDeploymentType();
    if(url.indexOf('//')==0) url = protocol+':' + url;
    if((url.indexOf('://') < 0) || (url.indexOf('://') > url.indexOf('/'))) url = protocol+'://' + url;

    if(url in parse_url_cache) return parse_url_cache[url];
    XForm.Post('/_funcs/deployment_target/parse_url', {}, { url: url }, function(rslt){
      parsed_url = (rslt && rslt.urlparts) || null;
      if(parsed_url) parse_url_cache[url] = parsed_url;
    }, undefined, { async: false });
    return parsed_url;
  };

  _this.generateJSON = function(){
    if(!jsh.xd('.xctrl_deployment_target_publish_configurator .xtab.selected[for="xctrl_deployment_target_publish_configurator_wizard"]').length) return;

    //Pull JSON from form
    var generated_config = {};
    var generated_url = '';
    var xdcontainer = _this.configurator_getContainer();

    //Deployment Info
    var protocol = _this.getDeploymentType();
    var xdDeploymentType = xdcontainer.get('.deployment_type_container_'+protocol);
    if(protocol=='s3'){ (function(){
      var bucket = _.trim(xdDeploymentType.get('[data-path-elem="bucket"]').value);
      if(bucket){
        generated_url = 's3://' + bucket;
      }

      var s3_config = {};
      var s3_config_upload_params_str = _.trim(xdDeploymentType.get('[data-elem="s3_config.upload_params"]').value);
      if(s3_config_upload_params_str){
        var s3_config_upload_params = {};
        try{
          s3_config_upload_params = JSON.parse(s3_config_upload_params_str);
        }
        catch(ex){
          s3_config_upload_params = {};
        }
        if(!_.isEmpty(s3_config_upload_params)) s3_config.upload_params = s3_config_upload_params;
      }
      _.each(['accessKeyId','secretAccessKey'], function(key){
        var val = xdDeploymentType.get('[data-elem="s3_config.'+key+'"]').value;
        if(val) s3_config[key] = val;
      });
      if(!_.isEmpty(s3_config)) generated_config.s3_config = s3_config;
    })(); }
    else if(protocol=='cmshost'){ (function(){
      var path = _.trim(xdDeploymentType.get('[data-path-elem="hostid"]').value);
      if(path){
        generated_url = 'cmshost://' + path;
      }

      var cmshost_config = {};
      _.each(['download_remote_templates'], function(key){
        var val = xdDeploymentType.get('[data-elem="cmshost_config.'+key+'"]').element.checked;
        if(val) cmshost_config[key] = true;
      });
      var remote_timeout = _.trim(xdDeploymentType.get('[data-elem="cmshost_config.remote_timeout"]').value);
      if(parseInt(remote_timeout).toString() != remote_timeout) remote_timeout = '';
      if(remote_timeout) cmshost_config.remote_timeout = remote_timeout;
      if(!_.isEmpty(cmshost_config)) generated_config.cmshost_config = cmshost_config;
    })(); }
    else if(protocol=='file'){ (function(){
      var path = _.trim(xdDeploymentType.get('[data-path-elem="path"]').value);
      if(path){
        generated_url = 'file://' + path;
      }

      var fs_config = {};
      _.each(['delete_excess_files'], function(key){
        var val = xdDeploymentType.get('[data-elem="fs_config.'+key+'"]').element.checked;
        if(val) fs_config[key] = true;
      });
      if(!_.isEmpty(fs_config)) generated_config.fs_config = fs_config;
    })(); }
    else if(protocol=='git_https'){ (function(){
      var parsed_url = _.trim(_this.parse_url(xdDeploymentType.get('[data-path-elem="url"]').value));
      var username = _.trim(xdDeploymentType.get('[data-path-elem="username"]').value);
      var password = _.trim(xdDeploymentType.get('[data-path-elem="password"]').value);
      if(parsed_url){
        generated_url = 'git_https://';
        var generated_username = parsed_url.username || username;
        if(generated_username){
          generated_url += username;
          var generated_password = parsed_url.password || password;
          if(generated_password) generated_url += ':' + generated_password;
          generated_url += '@';
        }
        generated_url += parsed_url.hostname+(parsed_url.port?':'+parsed_url.port:'')+(parsed_url.path||'');
      }

      var git_config = {};
      var git_config_options_str = _.trim(xdDeploymentType.get('[data-elem="git_config.options"]'));
      if(git_config_options_str){
        var git_config_options = {};
        try{
          git_config_options = JSON.parse(git_config_options_str);
        }
        catch(ex){
          git_config_options = {};
        }
        if(!_.isEmpty(git_config_options)) git_config.options = git_config_options;
      }
      var git_branch = xdDeploymentType.get('[data-elem="git_config.branch"]').value;
      if(git_branch) git_config.branch = git_branch;
      if(!_.isEmpty(git_config)) generated_config.git_config = git_config;
    })(); }
    else if(protocol=='git_ssh'){ (function(){
      var parsed_url = _this.parse_url(_.trim(xdDeploymentType.get('[data-path-elem="url"]').value));
      var username = _.trim(xdDeploymentType.get('[data-path-elem="username"]').value);
      if(parsed_url){
        generated_url = 'git_ssh://';
        if(parsed_url.auth) generated_url += parsed_url.auth + '@';
        else if(username) {
          generated_url += username + '@';
        }
        generated_url += parsed_url.hostname+(parsed_url.port?':'+parsed_url.port:'')+(parsed_url.path||'');
      }

      var git_config = {};
      var git_config_options_str = _.trim(xdDeploymentType.get('[data-elem="git_config.options"]').value);
      if(git_config_options_str){
        var git_config_options = {};
        try{
          git_config_options = JSON.parse(git_config_options_str);
        }
        catch(ex){
          git_config_options = {};
        }
        if(!_.isEmpty(git_config_options)) git_config.options = git_config_options;
      }
      var git_branch = xdDeploymentType.get('[data-elem="git_config.branch"]').value;
      if(git_branch) git_config.branch = git_branch;
      if(!_.isEmpty(git_config)) generated_config.git_config = git_config;
    })(); }
    else if((protocol=='ftp')||(protocol=='ftps')||(protocol=='sftp')){ (function(){
      var parsed_url = _this.parse_url(_.trim(xdDeploymentType.get('[data-path-elem="hostname"]').value));
      var port = _.trim(xdDeploymentType.get('[data-path-elem="port"]').value);
      if(parseInt(port).toString() != port) port = '';
      var username = _.trim(xdDeploymentType.get('[data-path-elem="username"]').value);
      var password = _.trim(xdDeploymentType.get('[data-path-elem="password"]').value);
      var path = _.trim(xdDeploymentType.get('[data-path-elem="path"]').value);
      if(parsed_url){
        generated_url = protocol+'://';
        var generated_username = parsed_url.username || username;
        if(generated_username){
          generated_url += username;
          var generated_password = parsed_url.password || password;
          if(generated_password) generated_url += ':' + generated_password;
          generated_url += '@';
        }
        var generated_port = (parsed_url.port || port || '').toString();
        var generated_path = parsed_url.path || path;
        if((parsed_url.path == '/') && path && (path != '/')) generated_path = path;
        generated_url += parsed_url.hostname+(generated_port?':'+generated_port:'')+(generated_path||'');
      }

      var ftp_config = {};
      _.each(['overwrite_all','delete_excess_files','compression','ignore_certificate_errors'], function(key){
        var el = xdDeploymentType.get('[data-elem="ftp_config.'+key+'"]').element;
        var val = el && el.checked;
        if(val) ftp_config[key] = true;
      });
      if(!_.isEmpty(ftp_config)) generated_config.ftp_config = ftp_config;
    })(); }
    //URLs and Advanced Options
    _.each(['url_prefix','published_url','url_prefix_page_override','url_prefix_media_override','page_subfolder','media_subfolder'], function(key){
      var val = xdcontainer.get('[data-elem="'+key+'"]').value;
      var xdeditbtn = xdcontainer.get('.edit_button[data-target="'+key+'"]');
      if(xdeditbtn.length){
        if(xdeditbtn.class.contains('editing')) generated_config[key] = val;
      }
      else{
        if(val) generated_config[key] = val;
      }
    });
    _.each(['publish_local_templates','ignore_remote_template_certificate'], function(key){
      var el = xdcontainer.get('[data-elem="'+key+'"]').element;
      var val = el && el.checked;
      if(val) generated_config[key] = true;
    });
    //ext_config
    var ext_config = _.trim(xdcontainer.get('[data-elem="ext_config"]').value);
    if(ext_config){
      try{
        ext_config = JSON.parse(ext_config);
      }
      catch(ex){
        ext_config = {};
      }
      for(var key in ext_config){
        if(!(key in generated_config)) generated_config[key] = ext_config[key];
        else if(_.includes(['s3_config','cmshost_config','fs_config','git_config','ftp_config'], key) && _.isObject(ext_config[key]) && _.isObject(generated_config[key])){
          for(var subkey in ext_config[key]){
            if(!(subkey in generated_config[key])) generated_config[key][subkey] = ext_config[key][subkey];
          }
        }
      }
    }
    if(_this.configurator_validate().length){
      xmodel.controller.form.Data._is_dirty = true;
    }
    else {
      xdcontainer.get('.src_deployment_target_publish_path').value = generated_url;
      xdcontainer.get('.src_deployment_target_publish_config').value = (_.isEmpty(generated_config)?'{\n}':JSON.stringify(generated_config,null,2));
    }
  };

  _this.configurator_getvalue = function(){
    _this.generateJSON();
    var xdcontainer = _this.configurator_getContainer();
    var publish_path = xdcontainer.get('.src_deployment_target_publish_path').value;
    if(!publish_path) publish_path = null;
    var publish_config = _.trim(xdcontainer.get('.src_deployment_target_publish_config').value);
    if (publish_config) {
      try{
        var publish_config_obj = JSON.parse(publish_config);
        if(!publish_config_obj || _.isEmpty(publish_config_obj)) publish_config = null;
        else publish_config = JSON.stringify(publish_config_obj);
      }
      catch(ex){ /* Do nothing */ }
    }
    return {
      publish_path: publish_path,
      publish_config: publish_config,
    };
  };

  _this.validate_json = function(errors, caption, val){
    var str = (val||'').trim();
    try{
      if(str) JSON.stringify(JSON.parse(str));
    }
    catch(ex){
      errors.push('Invalid '+(caption||'JSON')+': '+ex.toString());
      return false;
    }
    return true;
  };

  _this.configurator_validate = function(){
    var errors = [];
    var xdcontainer = _this.configurator_getContainer();
    var settingsTab = !!jsh.xd('.xctrl_deployment_target_publish_configurator .xtab.selected[for="xctrl_deployment_target_publish_configurator_wizard"]').length;
    if(settingsTab){
      var protocol = _this.getDeploymentType();
      var xdDeploymentType = xdcontainer.get('.deployment_type_container_'+protocol);
      if(protocol=='s3'){ (function(){
        if(!_.trim(xdDeploymentType.get('[data-path-elem="bucket"]').value)) errors.push('Bucket is required for Amazon S3 deployment');
        if(!_.trim(xdDeploymentType.get('[data-elem="s3_config.accessKeyId"]').value)) errors.push('Access Key is required for Amazon S3 deployment');
        if(!_.trim(xdDeploymentType.get('[data-elem="s3_config.secretAccessKey"]').value)) errors.push('Secret Key is required for Amazon S3 deployment');
        if(!_this.validate_json(errors, 'File Upload Settings', xdDeploymentType.get('[data-elem="s3_config.upload_params"]').value)) return;
      })(); }
      else if(protocol=='cmshost'){ (function(){
        if(!_.trim(xdDeploymentType.get('[data-path-elem="hostid"]').value)) errors.push('Host ID is required for CMS Host deployment');
        var remote_timeout = xdDeploymentType.get('[data-elem="cmshost_config.remote_timeout"]').value;
        if(remote_timeout && (remote_timeout != (parseInt(remote_timeout)).toString())) errors.push('Invalid '+protocol.toUpperCase()+' remote_timeout');
      })(); }
      else if(protocol=='file'){ (function(){
        if(!_.trim(xdDeploymentType.get('[data-path-elem="path"]').value)) errors.push('Path is required for Local Filesystem deployment');
      })(); }
      else if(protocol=='git_https'){ (function(){
        if(!_.trim(xdDeploymentType.get('[data-path-elem="url"]').value)) errors.push('Git URL is required for Git HTTPS deployment');
        if(!_this.validate_json(errors, 'Git Config', xdDeploymentType.get('[data-elem="git_config.options"]').value)) return;
      })(); }
      else if(protocol=='git_ssh'){ (function(){
        if(!_.trim(xdDeploymentType.get('[data-path-elem="url"]').value)) errors.push('Git URL is required for Git SSH deployment');
        if(!_this.validate_json(errors, 'Git Config', xdDeploymentType.get('[data-elem="git_config.options"]').value)) return;
      })(); }
      else if((protocol=='ftp')||(protocol=='ftps')||(protocol=='sftp')){ (function(){
        if(!_.trim(xdDeploymentType.get('[data-path-elem="hostname"]').value)) errors.push('Hostname is required for '+protocol.toUpperCase()+' deployment');
        var port = xdDeploymentType.get('[data-path-elem="port"]').value;
        if(port && (port != (parseInt(port)).toString())) errors.push('Invalid '+protocol.toUpperCase()+' port');
        var path = _.trim(xdDeploymentType.get('[data-path-elem="path"]').value);
        if(path && (path[0] != '/')) errors.push(protocol.toUpperCase()+' Path must begin with "/"');
      })(); }
      if(errors.length) return errors;
      var page_subfolder = xdcontainer.get('[data-elem="page_subfolder"]').value;
      if(page_subfolder && (page_subfolder[page_subfolder.length-1] != '/')) errors.push('Page Files Subfolder should end with "/"');
      var media_subfolder = xdcontainer.get('[data-elem="media_subfolder"]').value;
      if(media_subfolder && (media_subfolder[media_subfolder.length-1] != '/')) errors.push('Media Files Subfolder should end with "/"');
      if(!_this.validate_json(errors, 'Extended Config', xdcontainer.get('[data-elem="ext_config"]').value)) return errors;
    }
    else {
      //JSON tab
      if(!_this.validate_json(errors, 'Publish Config', xdcontainer.get('.src_deployment_target_publish_config').value)) return errors;
    }
    return errors;
  };

  _this.deployment_target_publish_path_getvalue = function(val, field, xmodel){
    return _this.configurator_getvalue().publish_path;
  };

  _this.deployment_target_publish_config_getvalue = function(val, field, xmodel){
    return _this.configurator_getvalue().publish_config;
  };

})();
