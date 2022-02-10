jsh.App[modelid] = new (function(){
  var _this = this;

  _this.template_page_template_selection = $('.xctrl_page_template_selection_template').html();

  this.oninit = function(xmodel){
    jsh.System.RequireBranch(xmodel);

    if(XExt.hasAction(xmodel.actions, 'IU')){
      xmodel.controller.grid.NoResultsMessage = "<a href='#' class='xgrid_norecords' onclick=\""+jsh._instance+".App['"+xmodel.id+"'].addFile(); return false;\"><img src='<%-jsh._PUBLICURL%>images/icon_insert.png' alt='Add' title='Add' />Add Page</a>";
    }
    else {
      xmodel.controller.grid.NoResultsMessage = 'Folder is empty';
    }
    xmodel.controller.grid.NoDataMessage = xmodel.controller.grid.NoResultsMessage;

    if(XExt.hasAction(xmodel.actions, 'IU')){
      jsh.$root('.xtbl.xform'+xmodel.class).closest('.xsubform').off('contextmenu').on('contextmenu',function(e){
        e.preventDefault();
        e.stopPropagation();
        XExt.ShowContextMenu('.'+xmodel.class+'_file_container_context_menu', xmodel.get('page_folder'));
      });
    }
  };

  this.onrowbind = function(xmodel,jobj,datarow){
    if(XExt.hasAction(xmodel.actions, 'IU')){
      var page_key = parseInt(datarow.page_key||0);
      jobj.find('.page_filename').contextmenu(function (e) {
        e.preventDefault();
        e.stopPropagation();
        XExt.ShowContextMenu('.'+xmodel.class+'_file_context_menu', page_key);
      });
      XExt.bindDragSource(jobj.find('.page_filename a'));
    }
  };

  this.page_template_selection_render = function(obj, data, enabled){
    $(obj).toggleClass('standalone', (data.page_template_id=='<Standalone>'));
    return XExt.renderEJS(_this.template_page_template_selection, xmodel.id, {
      data: data,
      obj: obj,
      editable: (enabled===true),
    });
  };

  this.page_template_selection_id_onChange = function(obj){
    var page_template_id = $(obj).val();
    var rowid = XExt.XModel.GetRowID(modelid, obj);
    var page_template_path = xmodel.get('page_template_path', rowid) || null;
    var isExistingPage = (page_template_id=='<Standalone>');
    XExt.execif(isExistingPage,
      function(f){
        _this.page_template_selection_path_popup(obj, page_template_path,
          function(_page_template_path){ //Accept
            page_template_path = _page_template_path;
            return f();
          },
          function(){ //Cancel
            $(obj).val(xmodel.get('page_template_id', rowid));
          }
        );
      },
      function(){
        $(obj).closest('.page_template').toggleClass('standalone', isExistingPage);
        xmodel.set('page_template_path', isExistingPage?page_template_path:null, rowid);
        xmodel.set('page_template_id', page_template_id, rowid);
        jsh.$root('.xrow_'+xmodel.class+'[data-id='+rowid+'] .page_template_selection_id').addClass('updated');
      }
    );
  };

  this.page_template_selection_path_popup = function(obj, val, onAccept, onCancel){
    var rowid = XExt.XModel.GetRowID(modelid, obj);
    var prev_page_template_path = xmodel.get('page_template_path', rowid);
    if(!onAccept) onAccept = function(page_template_path){
      if(page_template_path == prev_page_template_path) return;
      xmodel.set('page_template_path', page_template_path, rowid);
      jsh.$root('.xrow_'+xmodel.class+'[data-id='+rowid+'] .page_template_selection_id').addClass('updated');
    };
    if(!onCancel) onCancel = function(){};

    if(typeof val == 'undefined') val = xmodel.get('page_template_path', rowid);
    XExt.Prompt('Template URL', val, function(rslt){
      if(rslt===''){
        return XExt.Alert('Template URL is required for <Standalone> Templates', function(){
          _this.page_template_selection_path_popup(obj, val, onAccept, onCancel);
        });
      }
      else if(!rslt) return onCancel();
      else return onAccept(rslt);
    });
  };

  this.viewFileActions = function(obj){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before editing page');

    var jobj = $(obj);
    var rowid = jobj.closest('tr').data('id');
    var page_key = xmodel.get('page_key', rowid);
    
    if(!page_key) return XExt.Alert('Please save changes');

    var jpos = jobj.offset();
    event.preventDefault();
    event.stopImmediatePropagation();
    XExt.ShowContextMenu('.'+xmodel.class+'_file_context_menu', page_key, undefined, { top: jpos.top + jobj.find('img').outerHeight() + 6, left: jpos.left - 1 });
  };

  this.editFile = function(obj){ //obj || page_key
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before editing page');

    var rowid = undefined;
    var page_key = undefined;
    if(_.isNumber(obj)){
      page_key = obj;
      if(xmodel.controller.form && xmodel.controller.form.DataSet){
        rowid = -1;
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

    var page_template_path = xmodel.get('page_template_path', rowid);

    jsh.System.OpenPageEditor(page_key, xmodel.get('page_filename', rowid), page_template_id, { source: 'page_tree', rawEditorDialog: '.'+xmodel.class+'_RawTextEditor', page_template_path: page_template_path });
  };

  this.page_filename_onclick = function(obj){
    if(xmodel.parent && jsh.App[xmodel.parent].isInEditor){
      return _this.sendToEditor(obj);
    }
    else {
      return _this.editFile(obj);
    }
  };

  this.previewFile = function(page_file){
    var page_key = page_file.page_key;
    var page_id = page_file.page_id;
    var page_template_id = page_file.page_template_id;
    var page_template_path = page_file.page_template_path;
    var page_filename = page_file.page_filename||'';

    if(!page_template_id) return XExt.Alert('Invalid page template');

    jsh.System.OpenPageEditor(page_key, page_filename, page_template_id, { source: 'page_tree', rawEditorDialog: '.'+xmodel.class+'_RawTextEditor', page_id: page_id, page_template_path: page_template_path });
  };

  this.addFile = function(page_folder){
    var orig_page_folder = page_folder;
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before adding a page');

    if(typeof page_folder == 'undefined') page_folder = xmodel.get('page_folder');
    var xform = xmodel.controller.form;
    var sel = '.'+xmodel.class+'_AddFile';

    XExt.CustomPrompt(sel, jsh.$root(sel)[0].outerHTML, function () { //onInit
      var jprompt = jsh.$dialogBlock(sel);

      XExt.RenderLOV(xform.Data, jsh.$dialogBlock(sel + ' .page_template_id'), xform.LOVs.page_template_id);

      //Clear Values / Set Defaults
      jprompt.find('.page_filename').val('');
      jprompt.find('.page_title').val('');
      jprompt.find('.page_template_id').val(jsh.XPage.getBreadcrumbs().site_default_page_template_id);
      jprompt.find('.page_template_path').val('');
      jprompt.find('.site_default_page_filename').text(jsh.XPage.getBreadcrumbs().site_default_page_filename);

      var jfilename = jprompt.find('.page_filename');
      jprompt.find('.page_filename_default_document').off('click').on('click', function(){
        if($(this).is(':checked')){
          jfilename.prop('readonly', true);
          jfilename.val(jsh.App[xmodel.parent].getDefaultPage());
          jfilename.addClass('uneditable');
        }
        else{
          jfilename.prop('readonly', false);
          jfilename.val('');
          jfilename.removeClass('uneditable');
        }
      });

      var jTemplateId = jprompt.find('.page_template_id');
      var toggleTemplatePath = function(){ jprompt.find('.page_template_path_container').toggle(jTemplateId.val()=='<Standalone>'); jsh.XWindowResize(); };
      jTemplateId.off('.template_path').on('change.template_path', function(e){ toggleTemplatePath(); });
      toggleTemplatePath();
    }, function (success) { //onAccept
      var jprompt = jsh.$dialogBlock(sel);

      //Validate File Selected
      var page_filename = jprompt.find('.page_filename').val();
      var page_title = jprompt.find('.page_title').val();
      var page_template_id = jprompt.find('.page_template_id').val();
      var page_template_path = jprompt.find('.page_template_path').val();

      if (!page_filename) return XExt.Alert('Please enter a file name');
      if (page_filename.indexOf('/') >= 0) return XExt.Alert('File name cannot contain "/" character');
      if (XExt.cleanFileName(page_filename) != page_filename) return XExt.Alert('File name contains invalid characters');

      if (!page_template_id) return XExt.Alert('Please select a template.');

      if (page_template_id=='<Standalone>'){
        if (!page_template_path) return XExt.Alert('Please enter a page Template URL.');
      }
      else page_template_path = null;

      if (page_filename.indexOf('.') < 0) page_filename += '.html';

      var params = {
        page_path: page_folder + page_filename,
        page_title: page_title,
        page_template_id: page_template_id,
        page_template_path: page_template_path,
      };

      XForm.Put(xmodel.module_namespace+'Page_Tree_Listing', { }, params, function(rslt){
        //Refresh parent
        if(orig_page_folder){
          jsh.App[xmodel.parent].setFolderBeforeLoad(orig_page_folder);
          jsh.XPage.Select({ modelid: xmodel.parent, onCancel: function(){} }, success);
        }
        else{
          jsh.XPage.Select({ modelid: 'Page_Tree_Listing', onCancel: function(){} }, success);
        }
      });
    });
  };

  this.sendToEditor = function(obj){
    var rowid = $(obj).closest('tr').data('id');
    var page_key = xmodel.get('page_key', rowid);
    var page_title = xmodel.get('page_title', rowid);
    var page_path = xmodel.get('page_path', rowid);
    var page_folder = xmodel.get('page_folder', rowid);

    if(window.opener && jsh._GET.CKEditor){
      window.opener.postMessage('ckeditor:'+JSON.stringify({ page_key: page_key, CKEditorFuncNum: jsh._GET.CKEditorFuncNum }), '*');
      window.close();
    }
    else {
      if(!window.opener) return XExt.Alert('Parent editor not found');
      window.opener.postMessage('cms_file_picker:'+JSON.stringify({ page_key: page_key, page_title: page_title, page_path: page_path, page_folder: page_folder }), '*');
      window.close();
    }
  };

  this.getPage = function(page_key){
    var page_index = _this.getPageIndex(page_key);
    if(typeof page_index !== 'undefined') return xmodel.controller.form.DataSet[page_index];
    return undefined;
  };

  this.getPageIndex = function(page_key){
    if(xmodel.controller.form && xmodel.controller.form.DataSet){
      for(var i=0;i<xmodel.controller.form.DataSet.length;i++){
        var page = xmodel.controller.form.DataSet[i];
        if(page.page_key==page_key) return i;
      }
    }
    return undefined;
  };

  this.duplicateFile = function(page_key){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before duplicating a file');

    var page = _this.getPage(page_key);
    if(!page) return XExt.Alert('Invalid page');
    var page_filename = page.page_filename;
    var retry = function(){ _this.duplicateFile(page_key); };
    XExt.Prompt('Please enter the new file name', page_filename, function (rslt) {
      if(rslt === null) return;
      rslt = rslt.trim();
      if(!rslt) return XExt.Alert('Please enter a file name', retry);
      if(XExt.cleanFileName(rslt) != rslt) return XExt.Alert('Please enter a valid filename', retry);

      var params = {
        page_key: page_key,
        page_path: page.page_folder + rslt
      };
      XForm.Post(xmodel.module_namespace+'Page_Tree_File_Duplicate', {}, params, function(rslt){
        //Refresh parent
        jsh.XPage.Select({ modelid: 'Page_Tree_Listing', onCancel: function(){} });
      });
    });
  };

  this.viewRevisions = function(page_key){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before viewing revisions');

    var page = _this.getPage(page_key);

    jsh.App[xmodel.parent].revision_page_key = page_key;
    jsh.App[xmodel.parent].revision_page_id = page.page_id;
    jsh.XExt.popupShow(xmodel.namespace + 'Page_Revision_Listing','revision_page','Revisions',undefined,jsh.$root('.xform'+jsh.XModels[xmodel.parent].class+' .revision_page_xlookup')[0],{
      OnControlUpdate:function(obj, rslt){
        if(rslt && rslt.result){
          var page_id = rslt.result;
          XForm.Post(xmodel.namespace+'Page_Revision_Update',{},{ page_key: page_key, page_id: page_id }, function(){
            jsh.XPage.Select({ modelid: 'Page_Tree_Listing', onCancel: function(){} });
          });
        }
      }
    });
  };

  this.renameFile = function(page_key){
    var page = _this.getPage(page_key);
    var page_filename = page.page_filename;
    var retry = function(){ _this.renameFile(page_key); };
    XExt.Prompt('Please enter the new file name', page_filename, function (rslt) {
      if(rslt === null) return;
      rslt = rslt.trim();
      if(rslt == page_filename) return;
      if(!rslt){ return XExt.Alert('Please enter a file name', retry); }
      if(XExt.cleanFileName(rslt) != rslt) return XExt.Alert('Please enter a valid filename', retry);

      var params = {
        page_path: page.page_folder + rslt,
        page_title: page.page_title,
        page_template_id: page.page_template_id,
        page_template_path: page.page_template_path,
      };
      XForm.Post(xmodel.module_namespace+'Page_Tree_Listing', { page_key: page_key }, params, function(rslt){
        //Refresh parent
        jsh.XPage.Select({ modelid: 'Page_Tree_Listing', onCancel: function(){} });
      });
    });
  };

  this.moveFile = function(page_key, new_page_path){
    new_page_path = new_page_path||'';
    var page = _this.getPage(page_key);
    var page_path = page.page_path;

    XExt.execif(!new_page_path,
      function(f){
        var retry = function(){ _this.moveFile(page_key); };
        XExt.Prompt('Please enter a new path', page_path, function (rslt) {
          if(rslt === null) return;
          rslt = rslt.trim();
          if(rslt == page_path) return;
          if(!rslt) return XExt.Alert('Please enter a file name', retry);
          if(rslt[0] != '/') return XExt.Alert('Path must start with "/"', retry);
          new_page_path = rslt;
          f();
          
        });
      },
      function(){
        var params = {
          page_path: new_page_path,
          page_title: page.page_title,
          page_template_id: page.page_template_id,
          page_template_path: page.page_template_path,
        };
        XForm.Post(xmodel.module_namespace+'Page_Tree_Listing', { page_key: page_key }, params, function(rslt){
          //Refresh parent
          //var page_folder = XExt.dirname(new_page_path) + '/';
          //if(new_page_path[new_page_path.length-1] == '/') page_folder = new_page_path;
          _this.reloadParent(xmodel.get('page_folder'), function(){
            if(!xmodel.get('page_folder')){
              _this.reloadParent('/');
            }
          });
        });
      }
    );
  };

  this.reloadParent = function(page_folder, cb){
    jsh.App[xmodel.parent].setFolderBeforeLoad(page_folder);
    jsh.XPage.Select({ modelid: xmodel.parent, onCancel: function(){} }, cb);
  };

  this.deleteFile = function(page_key){
    var page = _this.getPage(page_key);
    XExt.Confirm('Are you sure you want to delete "'+page.page_filename+'"?', function (rslt) {
      XForm.Delete(xmodel.module_namespace+'Page_Tree_Listing', { page_key: page_key }, { }, function(rslt){
        //Refresh parent
        jsh.XPage.Select({ modelid: 'Page_Tree_Listing', onCancel: function(){} });
      });
    });
  };

})();
