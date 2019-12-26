(function(jsh){
  var XExt = jsh.XExt;
  var _ = jsh._;

  jsh.System.OpenPageEditor = function(page_key, page_name, template, options){
    options = _.extend({ branch_id: undefined, rawEditorDialog: '', page_id: undefined, deployment_target_params: undefined }, options);
    if(template.editor){
      //Open Editor
      var url = template.editor;

      var dtparams = {
        timestamp: (Date.now()).toString()
      };

      var dtparamsstr = '';
      if(options.deployment_target_params) dtparamsstr = options.deployment_target_params;
      else if(jsh.bcrumbs && jsh.bcrumbs.deployment_target_params) dtparamsstr = jsh.bcrumbs.deployment_target_params;
      if(dtparamsstr){
        try{
          dtparams = _.extend(dtparams, JSON.parse(dtparamsstr));
        }
        catch(ex){
          XExt.Alert('Error reading deployment_target_params.  Please make sure the JSON syntax is correct');
          return;
        }
      }

      if(jsh.bcrumbs && jsh.bcrumbs.branch_id) dtparams.branch_id = jsh.bcrumbs.branch_id;

      dtparams = _.extend(dtparams, {
        page_key: page_key,
        page_id: (options.page_id||'')
      });

      for(var key in dtparams){
        url = XExt.ReplaceAll(url, '%%%' + key + '%%%', dtparams[key]);
      }

      window.open(url, '_blank', "width=1000,height=800");
    }
    else {
      //Edit Raw Text

      //Load content from server
      var url = '../_funcs/page/'+page_key;
      if(options.page_id) url += '?page_id=' + options.page_id;
      XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
        if ('_success' in rslt) {
          var page = rslt.page;
          var readonly = !!options.page_id || (rslt.role=='VIEWER');
          //var template = rslt.template;
          //var views = rslt.views;
          //var authors = rslt.authors;
          //var role = rslt.role;
          
          //Display Editor
          var sel = options.rawEditorDialog;
          if(!sel) return XExt.Alert('Raw Text Editor not defined');
          XExt.CustomPrompt(sel, jsh.$root(sel)[0].outerHTML, function () { //onInit
            var jprompt = jsh.$root('.xdialogblock ' + sel);
            jprompt.find('.edit_page_title').text('Edit: '+page_name);
            jprompt.find('.page_content').val(page.content.body||'');
            jprompt.find('.page_content').prop('readonly', readonly);
            jprompt.find('.button_ok').val(readonly?'Close':'Save');
            jprompt.find('.button_cancel').toggle(!readonly);
          }, function (success) { //onAccept
            if(readonly) return success();
            //Save content to server
            var jprompt = jsh.$root('.xdialogblock ' + sel);
            page.content.body = jprompt.find('.page_content').val();
            url = '../_funcs/page/'+page_key;
            XExt.CallAppFunc(url, 'post', page, success, function (err) { });
          });
        }
        else{
          if(onComplete) onComplete(new Error('Error Loading Page'));
          XExt.Alert('Error loading page');
        }
      }, function (err) {
        if(onComplete) onComplete(err);
      });
    }
  }

  jsh.System.PreviewMedia = function(media_key, media_file_id, media_id, media_ext, media_width, media_height){
    var qs = '';
    if(media_id) qs = 'media_id='+media_id;
    else if(media_file_id) qs = 'media_file_id='+media_file_id;
    if(_.includes(['.jpg','.jpeg','.tif','.tiff','.png','.gif','.pdf'], media_ext.toLowerCase())){
      var url = jsh._BASEURL+'_funcs/media/'+media_key+'/'+(qs?'?'+qs:'');
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
      window.open(url,'_blank',"height="+wh+", width="+ww);
    }
    else {
      var url = jsh._BASEURL+'_funcs/media/'+media_key+'/?download'+(qs?'&'+qs:'');
      jsh.getFileProxy().prop('src', url);
    }
  }

})(window.jshInstance);