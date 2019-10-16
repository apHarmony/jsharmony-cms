jsh.App[modelid] = new (function(){
  var _this = this;

  this.openPageEditor = function(obj){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before editing page');

    var rowid = $(obj).closest('tr').data('id');

    var page_key = xmodel.get('page_key', rowid);
    if(!page_key) return XExt.Alert('Please save page before editing');

    var template_id = xmodel.get('template_id', rowid);
    if(!template_id) return XExt.Alert('Please select a template before editing');

    var template = jshInstance.globalparams.templates[template_id];
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

      XExt.RenderLOV(xform.Data, jsh.$root('.xdialogblock ' + sel + ' .template_id'), xform.LOVs.template_id);

      //Clear Values / Set Defaults
      jprompt.find('.page_filename').val('');
      jprompt.find('.page_title').val('');
      jprompt.find('.template_id').val(jshInstance.globalparams.default_template);
    }, function (success) { //onAccept
      var jprompt = jsh.$root('.xdialogblock ' + sel);

      //Validate File Selected
      var page_filename = jprompt.find('.page_filename').val();
      var page_title = jprompt.find('.page_title').val();
      var template_id = jprompt.find('.template_id').val();

      if (!page_filename) return XExt.Alert('Please enter a file name');
      if (page_filename.indexOf('/') >= 0) return XExt.Alert('File name cannot contain "/" character');
      if (XExt.cleanFileName(page_filename) != page_filename) return XExt.Alert('File name contains invalid characters');

      if (!page_title) return XExt.Alert('Please enter a page title');

      if (!template_id) return XExt.Alert('Please select a template.');

      if (page_filename.indexOf('.') < 0) page_filename += '.html';

      var params = {
        page_path: page_folder + page_filename,
        page_title: page_title,
        template_id: template_id
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

    if(window.opener && jsh._GET.CKEditor){
      window.opener.postMessage('ckeditor:'+JSON.stringify({ page_key: page_key, CKEditorFuncNum: jsh._GET.CKEditorFuncNum }), '*');
      window.close();
    }
    else XExt.Alert('Parent editor not found');
  }

})();
