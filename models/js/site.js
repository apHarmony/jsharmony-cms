(function(jsh){
  var XExt = jsh.XExt;
  var XForm = jsh.XForm;
  var _ = jsh._;
  var $ = jsh.$;
  var async = jsh.async;

  jsh.System.onOpenPageEditor = []; //function(callback, page_key, page_filename, page_template_id, options){}

  jsh.System.OpenPageEditorUrl = function(url){
    return XExt.createWindow(url, '_blank', 'width=1195,height=800');
  };

  jsh.System.OpenPageEditor = function(page_key, page_filename, page_template_id, options){
    options = _.extend({
      source: undefined,
      branch_id: undefined,
      site_id: undefined,
      rawEditorDialog: '',
      page_id: undefined,
      page_template_path: undefined,
      getURL: false,
      async: true,
      devMode: false,
      onComplete: undefined, //function(err, url){}
    }, options);

    async.waterfall([
      function(cb){
        XExt.triggerAsync(jsh.System.onOpenPageEditor, cb, page_key, page_filename, page_template_id, options);
      }
    ], function(err){
      if(err){
        if(options.onComplete) options.onComplete(err);
        return;
      }
      var params = { page_template_id: page_template_id };
      if(page_key) params.page_key = page_key;
      if(options.page_template_path) params.page_template_path = options.page_template_path;
      if(jsh.bcrumbs && jsh.bcrumbs.branch_id) params.branch_id = jsh.bcrumbs.branch_id;
      _.each(['branch_id', 'site_id', 'page_id', 'devMode'], function(key){ if(options[key]) params[key] = options[key]; });

      XForm.Get('../_funcs/editor_url', params, {}, function(template){
        if(!template){
          let errmsg = 'Template is not defined';
          if(options.getURL && options.onComplete) return options.onComplete(new Error(errmsg));
          return XExt.Alert(errmsg);
        }
        else if(template.raw){
          //Raw Text has no dedicated editor
          if(options.getURL && options.onComplete) return options.onComplete(null, null, template);

          //Edit Raw Text

          //Load content from server
          var url = '../_funcs/page/'+page_key;
          var qs = {};
          if(options.page_id) qs.page_id = options.page_id;
          if(options.branch_id) qs.branch_id = options.branch_id;
          if(!_.isEmpty(qs)) url += '?' + $.param(qs);
          XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
            if ('_success' in rslt) {
              var page = rslt.page;
              var readonly = !!options.page_id || (rslt.role=='VIEWER');
              //var pagetemplate = rslt.template;
              //var views = rslt.views;
              //var authors = rslt.authors;
              //var role = rslt.role;
              
              //Display Editor
              var sel = options.rawEditorDialog;
              if(!sel) return XExt.Alert('Raw Text Editor not defined');
              XExt.CustomPrompt(sel, jsh.$root(sel)[0].outerHTML, function () { //onInit
                var jprompt = jsh.$dialogBlock(sel);
                jprompt.find('.edit_page_title').text('Edit: '+page_filename);
                jprompt.find('.page_content').val(page.content.body||'');
                jprompt.find('.page_content').prop('readonly', readonly);
                jprompt.find('.button_ok').val(readonly?'Close':'Save');
                jprompt.find('.button_cancel').toggle(!readonly);
              }, function (success) { //onAccept
                if(readonly) return success();
                //Save content to server
                var jprompt = jsh.$dialogBlock(sel);
                page.content.body = jprompt.find('.page_content').val();
                url = '../_funcs/page/'+page_key;
                XExt.CallAppFunc(url, 'post', page, success, function (err) { });
              });
            }
            else{
              if(options.onComplete) options.onComplete(new Error('Error Loading Page'));
              XExt.Alert('Error loading page');
            }
          }, function (err) {
            if(options.onComplete) options.onComplete(err);
          });
        }
        else if(template.editor){
          //Open Editor
          url = template.editor;
          if(options.getURL && options.onComplete) return options.onComplete(null, url, template);
          jsh.System.OpenPageEditorUrl(url);
        }
        else{
          let errmsg = 'Error generating editor URL';
          if(options.getURL && options.onComplete) return options.onComplete(new Error(errmsg));
          return XExt.Alert(errmsg);
        }
      }, undefined, { async: options.async });
    });
  };

  jsh.System.PreviewMedia = function(media_key, media_file_id, media_id, media_ext, media_width, media_height){
    var qs = '';
    if(media_id) qs = 'media_id='+media_id;
    else if(media_file_id) qs = 'media_file_id='+media_file_id;
    if(_.includes(['.jpg','.jpeg','.tif','.tiff','.png','.gif','.pdf','.svg'], media_ext.toLowerCase())){
      let url = jsh._BASEURL+'_funcs/media/'+media_key+'/'+(qs?'?'+qs:'');
      var ww = 800;
      var wh = 600;
      if(media_width && media_height){
        var wwr = media_width / ww;
        var whr = media_height / wh;
        if((wwr <=1) && (whr <= 1)){ ww = media_width; wh = media_height; }
        else if(wwr > whr) wh = media_height / wwr;
        else ww = media_width / whr;
      }
      ww = Math.floor(ww);
      wh = Math.floor(wh);
      XExt.createWindow(url, '_blank', 'width='+ww+',height='+wh);
    }
    else {
      let url = jsh._BASEURL+'_funcs/media/'+media_key+'/?download'+(qs?'&'+qs:'');
      jsh.getFileProxy().prop('src', url);
    }
  };

  jsh.System.viewPageTemplates = function(){
    var site_id = jsh.globalparams.site_id;
    if(!site_id) return XExt.Alert('No site currently checked out');
    var tabs = {};
    tabs['{namespace}Site_Tabs'] = '{namespace}Site_Template_Page';
    var qs = {
      site_id:site_id,
      tabs: JSON.stringify(tabs)
    };
    XExt.popupForm('{namespace}Site_Tabs', 'update', qs);
  };

  jsh.System.applyRoles = function(){
    if(jsh.globalparams.isWebmaster) jsh.$root('.jsHarmonyCms_role_WEBMASTER').removeClass('jsHarmonyCms_role_WEBMASTER');
  };

  jsh.System.renderEditorSelection = function(LOV_site_editor, site_id, sys_user_site_editor, options){
    if(!LOV_site_editor || (LOV_site_editor.length <= 2)) return;
    options = _.extend({ after: null, container: null, containerClass: '', }, options);
    var jcontainer = null;
    if(options.container) jcontainer = jsh.$root(options.container);
    else if(options.containerClass && jsh.$root('.'+options.containerClass).length) jcontainer = jsh.$root('.'+options.containerClass);
    else if(options.after){
      jcontainer = $('<div></div>');
      if(options.containerClass) jcontainer.addClass(options.containerClass);
      jsh.$root(options.after).after(jcontainer);
    }
    else throw new Error('Either options.container, options.after, or an existing options.containerClass is required');

    jcontainer.html(jsh.RenderEJS(jsh.GetEJS('jsHarmonyCMS.EditorSelection'),{
      LOV_site_editor: LOV_site_editor,
      sys_user_site_editor: sys_user_site_editor,
    }));
    var jEditorSelection = jcontainer.find('.editor_selection');
    XExt.RenderLOV(null, jEditorSelection, LOV_site_editor);
    jEditorSelection.val(sys_user_site_editor);
    jEditorSelection.on('change', function(){
      var new_sys_user_site_editor = $(this).val();
      jsh.System.updateEditor(site_id, new_sys_user_site_editor);
    });
  };

  jsh.System.updateEditor = function(site_id, sys_user_site_editor){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before adding a folder');

    XForm.Post('{namespace}Site_Editor',{},{ site_id: site_id, sys_user_site_editor: sys_user_site_editor }, function(){
    });
  };

  jsh.System.renderCurrentSite = function(site_id, site_name){
    jsh.globalparams.site_id = site_id;
    jsh.globalparams.site_name = site_name;

    if({is_submodule}) return; // eslint-disable-line no-undef, no-constant-condition

    //Render site dropdown in header
    jsh.$root('.xlogo .xsublogo').html(XExt.renderEJS(jsh.GetEJS('jsHarmonyCMS.SiteSelection')));
    jsh.$root('.xlogo .xsublogo').attr('onclick','return false;').off('click').on('click', function(e){
      var jobj = $(this);
      e.preventDefault();
      e.stopImmediatePropagation();

      if(jobj.hasClass('selected') || jsh.$root('.jsHarmonyCms_site_selection_dropdown').is(':visible')){
        jsh.$root('.jsHarmonyCms_site_selection_dropdown').remove();
        return;
      }

      var execModel = '{namespace}Site_Listing';
      XForm.Get(execModel, { rowstart: 0, rowcount: 99999 }, { }, function(rslt){
        if(!rslt || !rslt[execModel] || !rslt[execModel].length || !rslt[execModel][0]){
          XExt.Alert('No sites found');
        }
        else {
          var sites = rslt[execModel];
          jsh.$root('.jsHarmonyCms_site_selection_dropdown').remove();
          jsh.root.append(XExt.renderEJS(jsh.$root('.jsHarmonyCms_template_site_selection_dropdown').html(), undefined, { sites: sites }));
          var jpos = jobj.find('.jsHarmonyCms_site_selection').offset();
          XExt.ShowContextMenu('.jsHarmonyCms_site_selection_dropdown', undefined, undefined, { top: jpos.top + jobj.outerHeight() - 1, left: jpos.left - 1 });
        }
      });
    });
  };

  jsh.on('jsh_render_init', function(){
    jsh.System.renderCurrentSite(jsh.globalparams.site_id, jsh.globalparams.site_name);
  });

  jsh.System.setCurrentSite = function(site_id, source){
    if(site_id == jsh.globalparams.site_id) return;
    var url = jsh._BASEURL + '_funcs/site/checkout?' + $.param({site_id:site_id, source: source});
    window.location.href = url;
  };

  jsh.System.DownloadDeployment = function(deployment_id) {
    //Save Changes Before Executing
    if (jsh.XPage.GetChanges().length > 0) return XExt.Alert('Please save pending changes before continuing.');

    var request_id = (new Date().getTime());
    var url = jsh._BASEURL+'_funcs/deployment/download/'+deployment_id+'?source=js&request_id='+request_id;

    //Add events to monitor status
    var jsproxyid = 'cms_deployment_download_'+deployment_id.toString()+'_'+request_id.toString();
    var loadObj = {};
    jsh.xLoader.StartLoading(loadObj);
    function waitForLoad(){
      if(!loadObj) return;
      var cookieVals = XExt.GetCookie(jsproxyid);
      if(cookieVals.length){
        jsh.xLoader.StopLoading(loadObj);
        loadObj = null;
        return;
      }
      else{
        return setTimeout(waitForLoad, 100);
      }
    }
    waitForLoad();

    jsh.jsproxy_hooks[jsproxyid] = function(err, data){
      jsh.xLoader.StopLoading(loadObj);
      loadObj = null;
      if(err) return XExt.Alert('Error #' + err.Number + ': ' + err.Message);
    };

    jsh.getFileProxy().prop('src', url);
  };

})(window['{req.jshsite.instance}']);