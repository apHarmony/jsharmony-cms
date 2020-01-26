(function(jsh){
  var XExt = jsh.XExt;
  var XForm = jsh.XForm;
  var _ = jsh._;

  jsh.System.OpenPageEditor = function(page_key, page_name, page_template_id, options){
    var template = jsh.globalparams.PageTemplates[page_template_id];
    if(!template) return XExt.Alert('Template is not defined');

    options = _.extend({ branch_id: undefined, rawEditorDialog: '', page_id: undefined }, options);

    if(template.editor){
      var params = { page_template_id: page_template_id }
      if(page_key) params.page_key = page_key;
      if(jsh.bcrumbs && jsh.bcrumbs.branch_id) params.branch_id = jsh.bcrumbs.branch_id;
      _.each(['branch_id', 'page_id'], function(key){ if(options[key]) params[key] = options[key]; });

      XForm.Get('../_funcs/editor_url', params, {}, function(rslt){
        if(!rslt || !rslt.editor) return XExt.Alert('Error generating editor URL');

        //Open Editor
        var url = rslt.editor;
        window.open(url, '_blank', "width=1000,height=800");
      });
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