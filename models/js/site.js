(function(jsh){
  var XExt = jsh.XExt;
  var _ = jsh._;

  jsh.System.OpenPageEditor = function(page_key, page_name, template, options){
    options = _.extend({ rawEditorDialog: '', page_id: undefined }, options);
    if(template.editor){
      //Open Editor
      var url = template.editor;

      if(jsh.bcrumbs && jsh.bcrumbs.deployment_target_params){
        var dtparams = null;
        try{
          dtparams = JSON.parse(jsh.bcrumbs.deployment_target_params);
        }
        catch(ex){
          XExt.Alert('Error reading deployment target param.  Please make sure the JSON syntax is correct');
          return;
        }
        if(dtparams){
          for(var key in dtparams){
            url = XExt.ReplaceAll(url, '%%%' + key + '%%%', dtparams[key]);
          }
        }
      }

      url = XExt.ReplaceAll(url, '%%%page_key%%%', page_key);
      url = XExt.ReplaceAll(url, '%%%page_id%%%', (options.page_id||''));
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
            jprompt.find('.page_content').val(page.body||'');
            jprompt.find('.page_content').prop('readonly', readonly);
            jprompt.find('.button_ok').val(readonly?'Close':'Save');
            jprompt.find('.button_cancel').toggle(!readonly);
          }, function (success) { //onAccept
            if(readonly) return success();
            //Save content to server
            var jprompt = jsh.$root('.xdialogblock ' + sel);
            page.body = jprompt.find('.page_content').val();
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

})(window.jshInstance);