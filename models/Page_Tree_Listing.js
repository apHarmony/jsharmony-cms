jsh.App[modelid] = new (function(){
  var _this = this;

  this.oninit = function(xmodel){
    xmodel.controller.grid.OnLoadError = function(err){
      if(err && err.Number==-14){
        XExt.Alert('Please checkout a branch', function(){
          XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Active_Listing', { force: true });
        });
        return true;
      }
    }

    if(XExt.hasAction(xmodel.actions, 'IU')){
      xmodel.controller.grid.NoResultsMessage = "<a href='#' class='xgrid_norecords' onclick=\""+jsh._instance+".App['"+xmodel.id+"'].addPage(); return false;\"><img src='<%-jsh._PUBLICURL%>images/icon_insert.png' alt='Add' title='Add' />Add Page</a>";
    }
    else {
      xmodel.controller.grid.NoResultsMessage = 'Folder is empty';
    }
    xmodel.controller.grid.NoDataMessage = xmodel.controller.grid.NoResultsMessage;
  }

  this.onrowbind = function(xmodel,jobj,datarow){
    if(XExt.hasAction(xmodel.actions, 'IU')){
      var page_key = parseInt(datarow.page_key||0);
      jobj.find('.page_filename').contextmenu(function (e) {
        e.preventDefault();
        e.stopPropagation();
        XExt.ShowContextMenu('.'+xmodel.class+'_file_context_menu', page_key);
      });
    }
  }

  this.openPageEditor = function(obj){ //obj || page_key
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before editing page');

    var rowid = undefined;
    var page_key = undefined;
    if(_.isNumber(obj)){
      page_key = obj;
      if(xmodel.controller.form && xmodel.controller.form.DataSet){
        var rowid = -1;
        for(var i=0;i<xmodel.controller.form.DataSet.length;i++){
          if(xmodel.controller.form.DataSet[i]['page_key']==page_key) rowid = i;
        }
        if(rowid < 0) return XExt.Alert('Page key not found in grid');
      }
    }
    else rowid = $(obj).closest('tr').data('id');

    page_key = xmodel.get('page_key', rowid);
    if(!page_key) return XExt.Alert('Please save page before editing');

    var page_template_id = xmodel.get('page_template_id', rowid);
    if(!page_template_id) return XExt.Alert('Please select a template before editing');

    var template = jshInstance.globalparams.PageTemplates[page_template_id];
    if(!template) return XExt.Alert('Template is not defined');
    
    jsh.System.OpenPageEditor(page_key, xmodel.get('page_filename', rowid), template, '.'+xmodel.class+'_RawTextEditor');
  }

  this.addPage = function(page_folder){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before adding a page');

    if(typeof page_folder == 'undefined') page_folder = xmodel.get('page_folder');
    var xform = xmodel.controller.form;
    var sel = '.'+xmodel.class+'_AddPage';

    XExt.CustomPrompt(sel, jsh.$root(sel)[0].outerHTML, function () { //onInit
      var jprompt = jsh.$root('.xdialogblock ' + sel);

      XExt.RenderLOV(xform.Data, jsh.$root('.xdialogblock ' + sel + ' .page_template_id'), xform.LOVs.page_template_id);

      //Clear Values / Set Defaults
      jprompt.find('.page_filename').val('');
      jprompt.find('.page_title').val('');
      jprompt.find('.page_template_id').val(jshInstance.globalparams.defaultPageTemplate);
    }, function (success) { //onAccept
      var jprompt = jsh.$root('.xdialogblock ' + sel);

      //Validate File Selected
      var page_filename = jprompt.find('.page_filename').val();
      var page_title = jprompt.find('.page_title').val();
      var page_template_id = jprompt.find('.page_template_id').val();

      if (!page_filename) return XExt.Alert('Please enter a file name');
      if (page_filename.indexOf('/') >= 0) return XExt.Alert('File name cannot contain "/" character');
      if (XExt.cleanFileName(page_filename) != page_filename) return XExt.Alert('File name contains invalid characters');

      if (!page_template_id) return XExt.Alert('Please select a template.');

      if (page_filename.indexOf('.') < 0) page_filename += '.html';

      var params = {
        page_path: page_folder + page_filename,
        page_title: page_title,
        page_template_id: page_template_id
      };

      XForm.Put(xmodel.module_namespace+'Page_Tree_Listing', { }, params, function(rslt){
        //Refresh parent
        jsh.XPage.Select({ modelid: 'Page_Tree_Listing', onCancel: function(){} }, success);
      });
    });
  }

  this.sendToEditor = function(obj){
    var rowid = $(obj).closest('tr').data('id');
    var page_key = xmodel.get('page_key', rowid);
    var page_title = xmodel.get('page_title', rowid);
    var page_path = xmodel.get('page_path', rowid);

    if(window.opener && jsh._GET.CKEditor){
      window.opener.postMessage('ckeditor:'+JSON.stringify({ page_key: page_key, CKEditorFuncNum: jsh._GET.CKEditorFuncNum }), '*');
      window.close();
    }
    else {
      var openerJSH = XExt.getOpenerJSH();
      if(!openerJSH) return XExt.Alert('Parent editor not found');
      window.opener.postMessage('cms_link_browser:'+JSON.stringify({ page_key: page_key, page_title: page_title, page_path: page_path  }), '*');
      window.close();
    }
  }

  this.getPage = function(page_key){
    if(xmodel.controller.form && xmodel.controller.form.DataSet){
      var rowid = -1;
      for(var i=0;i<xmodel.controller.form.DataSet.length;i++){
        var page = xmodel.controller.form.DataSet[i];
        if(page['page_key']==page_key) return page;
      }
    }
    return undefined;
  }

  this.renameFile = function(page_key){
    var page = _this.getPage(page_key);
    var page_path = page.page_path;
    var page_filename = page.page_filename;
    XExt.Prompt('Please enter a new file name', page_filename, function (rslt) {
      if(rslt === null) return;
      rslt = rslt.trim();
      if(rslt == page_filename) return;
      if(XExt.cleanFileName(rslt) != rslt) return XExt.Alert('Please enter a valid filename');

      var params = {
        page_path: page.page_folder + rslt,
        page_title: page.page_title,
        page_template_id: page.page_template_id
      };
      XForm.Post(xmodel.module_namespace+'Page_Tree_Listing', { page_key: page_key }, params, function(rslt){
        //Refresh parent
        jsh.XPage.Select({ modelid: 'Page_Tree_Listing', onCancel: function(){} });
      });
    });
  }

  this.moveFile = function(page_key){
    var page = _this.getPage(page_key);
    var page_path = page.page_path;
    XExt.Prompt('Please enter a new path', page_path, function (rslt) {
      if(rslt === null) return;
      rslt = rslt.trim();
      if(rslt == page_path) return;
      if(rslt[0] != '/') return XExt.Alert('Path must start with "/"');

      var params = {
        page_path: rslt,
        page_title: page.page_title,
        page_template_id: page.page_template_id
      };
      XForm.Post(xmodel.module_namespace+'Page_Tree_Listing', { page_key: page_key }, params, function(rslt){
        //Refresh parent
        jsh.XPage.Select({ modelid: 'Page_Tree', onCancel: function(){} });
      });
    });
  }

  this.deleteFile = function(page_key){
    var page = _this.getPage(page_key);
    XExt.Confirm('Are you sure you want to delete "'+page.page_filename+'"?', function (rslt) {
      XForm.Delete(xmodel.module_namespace+'Page_Tree_Listing', { page_key: page_key }, { }, function(rslt){
        //Refresh parent
        jsh.XPage.Select({ modelid: 'Page_Tree_Listing', onCancel: function(){} });
      });
    });
  }

})();
