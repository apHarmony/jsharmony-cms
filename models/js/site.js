(function(jsh){
  var XExt = jsh.XExt;
  var XForm = jsh.XForm;
  var XPage = jsh.XPage;
  var _ = jsh._;

  jsh.System.RequireBranch = function(xmodel){
    if(xmodel.controller.grid){
      xmodel.controller.grid.OnLoadError = function(err){
        if(err && err.Number==-14){
          XExt.Alert('Please checkout a branch', function(){
            XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Active_Listing', { force: true })
          });
          return true;
        }
      }
    }
    else if(xmodel.controller.form){
      xmodel.controller.form.OnDBError = function(err){
        if(err && err.Number==-14){
          XExt.Alert('Please checkout a branch', function(){
            XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Active_Listing', { force: true })
          });
          return false;
        }
      }
    }
  }

  jsh.System.ArchiveBranch = function(branch_id) {
    //Save Changes Before Executing
    if (jsh.XPage.GetChanges().length > 0) return XExt.Alert('Please save pending changes before continuing.');

    XExt.Confirm('Are you sure you want to Archive this branch?  Archived branches cannot be submitted for publishing.',function(){
      XForm.prototype.XExecutePost('{namespace}Branch_Archive', { branch_id: branch_id }, function(rslt){
        XPage.Refresh();
      });
    });
  }

  jsh.System.PublishBranch = function(branch_id) {
    //Save Changes Before Executing
    if (jsh.XPage.GetChanges().length > 0) return XExt.Alert('Please save pending changes before continuing.');

    XExt.Confirm('Are you sure you want to submit this branch for publishing review?',function(){
      XForm.prototype.XExecutePost('{namespace}Branch_Publish', { branch_id: branch_id }, function(rslt){
        XPage.Refresh();
      });
    });
  }

  jsh.System.OpenPageEditor = function(page_key, page_name, template, options){
    options = _.extend({ rawEditorDialog: '', page_id: undefined }, options);
    if(template.editor){
      //Open Editor
      var url = template.editor;

      var dtparams = {
        timestamp: (Date.now()).toString()
      };

      if(jsh.bcrumbs && jsh.bcrumbs.deployment_target_params){
        try{
          dtparams = _.extend(dtparams, JSON.parse(jsh.bcrumbs.deployment_target_params));
        }
        catch(ex){
          XExt.Alert('Error reading deployment target param.  Please make sure the JSON syntax is correct');
          return;
        }
      }

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