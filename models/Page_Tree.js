jsh.App[modelid] = new (function(){
  var _this = this;
  
  _this.revision_page_key = undefined;
  _this.revision_page_id = undefined;

  this.isInEditor = false;
  this.state_default = {
    page_folder: null
  };
  this.state = _.extend({}, this.state_default);

  this.oninit = function(){
    jsh.System.applyRoles();
    jsh.System.RequireBranch(xmodel);
    if(this.isInEditor){
      jsh.$root('.xbody').addClass('InEditor');
    }

    $(window).bind('resize', _this.onresize);
    jsh.on('jsh_message', function(event, data){ _this.onmessage(data); });
    _this.refreshLayout();
  };

  this.onmessage = function(data){
    data = (data || '').toString();
    if(data.indexOf('jsharmony-cms:refresh_page_folder:')==0){
      var refresh_folder = data.substr(34);
      if(_this.state.page_folder == refresh_folder){
        jsh.XPage.Select({ modelid: 'Page_Tree_Listing', onCancel: function(){} });
      }
    }
  };

  this.ondestroy = function(xmodel){
    $(window).unbind('resize', _this.onresize);
  };

  this.onload = function(){
    var bcrumbs = jsh.XPage.getBreadcrumbs();
    _this.refreshLayout();
    _this.state.page_folder = xmodel.get('page_folder');
    $('.' + xmodel.class + '_page_listing_header_path').text(_this.state.page_folder);
    jsh.System.renderEditorSelection(xmodel.controller.getLOV('site_editor'), bcrumbs.site_id, bcrumbs.sys_user_site_editor, { after: jsh.$root('.bcrumbs_branch_body'), containerClass: 'bcrumbs_editor_selection_container' });
  };

  this.ongetstate = function(){ return _this.state; };

  this.onloadstate = function(xmodel, state){
    _this.state = _.extend({}, _this.state_default, _this.state, state);
    if(_this.state.page_folder !== null) this.setFolderBeforeLoad(_this.state.page_folder);
  };

  this.setFolderBeforeLoad = function(page_folder){
    xmodel.controller.form.Data['page_folder'] = page_folder;
    xmodel.saveUnboundFields(xmodel.controller.form.Data);
  };

  this.onresize = function(){ _this.refreshLayout(); };

  this.refreshLayout = function(){
    var jbrowser = $('.'+xmodel.class+'_browser');

    if(!jbrowser.length) return;

    var wh = $(window).height();
    var top = jbrowser.offset().top;
    var contentheight = wh - top - 20;

    $('.'+xmodel.class+'_browser').css('height',contentheight+'px');
  };

  this.page_folder_onchange = function(obj, newval) {
    var historyParams = {};
    if(_this.state.page_folder===null) historyParams = { replaceHistory: true };
    _this.state.page_folder = newval;
    $('.' + xmodel.class + '_page_listing_header_path').text(_this.state.page_folder);
    jsh.XPage.Select({ modelid: 'Page_Tree_Listing', onCancel: function(){} });
    XPage.AddHistory(undefined, undefined, historyParams);
  };

  this.previewPage = function(page_file){
    jsh.App[xmodel.namespace+'Page_Tree_Listing'].previewFile(page_file);
  };

  this.addFolder = function(parent_page_folder){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before adding a folder');

    var retry = function(){ _this.addFolder(parent_page_folder); };
    XExt.Prompt('Please enter the subfolder name', '', function (rslt) {
      if(rslt === null) return;
      rslt = rslt.trim();
      if(!rslt) return XExt.Alert('Please enter a folder name', retry);
      var page_path = parent_page_folder + rslt.trim() + '/';
      if(XExt.cleanFileName(rslt) != rslt) return XExt.Alert('Please enter a valid filename', retry);
      XForm.Post(xmodel.namespace+'Page_Tree_Folder_Add',{},{ page_path: page_path }, function(){
        _this.setFolderBeforeLoad(page_path);
        jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} });
      });
    });
  };

  this.renameFolder = function(page_folder){
    //Get new folder name
    var base_folder_name = XExt.basename(page_folder);
    if(!base_folder_name) return XExt.Alert('Cannot rename this folder');
    //Update all paths to new paths
    var retry = function(){ _this.renameFolder(page_folder); };
    XExt.Prompt('Please enter a new folder name', base_folder_name, function (rslt) {
      if(rslt === null) return;
      rslt = rslt.trim();
      if(rslt == base_folder_name) return;
      if(!rslt) return XExt.Alert('Please enter a folder name', retry);
      if(XExt.cleanFileName(rslt) != rslt) return XExt.Alert('Please enter a valid folder name', retry);

      var new_page_folder = XExt.dirname(page_folder) + '/' + rslt + '/';
      XForm.Post(xmodel.namespace+'Page_Tree_Folder_Move',{},{ old_page_folder:page_folder, new_page_folder: new_page_folder }, function(){
        _this.setFolderBeforeLoad(new_page_folder);
        jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} });
      });
    });
  };

  this.moveFolder = function(old_page_folder, new_page_folder){
    new_page_folder = new_page_folder||'';

    XExt.execif(!new_page_folder,
      function(f){
        //Get new folder name
        //Update all paths to new paths
        var retry = function(){ _this.moveFolder(old_page_folder); };
        XExt.Prompt('Please enter a new path', old_page_folder, function (rslt) {
          if(rslt === null) return;
          rslt = rslt.trim();
          if(rslt == old_page_folder) return;
          if(!rslt) return XExt.Alert('Please enter a folder path', retry);
          if(rslt[0] != '/') return XExt.Alert('Path must start with "/"', retry);
          if(rslt.indexOf('//') >=0 ) return XExt.Alert('Invalid path', retry);
          if(rslt.indexOf('/./') >=0 ) return XExt.Alert('Invalid path', retry);
          if(rslt.indexOf('/../') >=0 ) return XExt.Alert('Invalid path', retry);
          if(rslt[rslt.length-1] != '/') rslt += '/';
          new_page_folder = rslt;
          f();
        });
      },
      function(){
        XForm.Post(xmodel.namespace+'Page_Tree_Folder_Move',{},{ old_page_folder: old_page_folder, new_page_folder: new_page_folder }, function(){
          _this.setFolderBeforeLoad(new_page_folder);
          jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} });
        });
      }
    );
  };

  this.deleteFolder = function(page_folder){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before deleting a folder');

    var parent_folder = XExt.dirname(page_folder)+'/';

    XExt.Confirm('Are you sure you want to delete "'+page_folder+'" and all of its contents?', function (rslt) {
      XForm.Post(xmodel.namespace+'Page_Tree_Folder_Delete',{},{ page_folder: page_folder }, function(){
        _this.setFolderBeforeLoad(parent_folder);
        jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} });
      });
    });
  };

  this.getDefaultPage = function(){
    return jsh.XPage.getBreadcrumbs().site_default_page_filename;
  };

  this.page_folder_onmove = function(dragval, dropval, anchor, e) {
    if(!XExt.hasAction(xmodel.actions,'U')) return;
    if(!dragval || !dropval) return;
    dragval = dragval.toString();
    dropval = dropval.toString();

    if(dragval=='/') return XExt.Alert('Cannot move root folder');

    if(dragval.indexOf('page_key:')==0){
      //Moving file
      var page_key = parseInt(dragval.substr(9));
      var listingmodel = jsh.XModels[xmodel.namespace+'Page_Tree_Listing'];
      var page = jsh.App[listingmodel.id].getPage(page_key);
      var new_page_path = dropval + page.page_filename;
      jsh.App[listingmodel.id].moveFile(page_key, new_page_path);
    }
    else {
      //Moving folder
      var old_page_folder = dragval;
      var old_page_folder_name = XExt.basename(old_page_folder);
      if(!old_page_folder_name) return;
      var new_page_folder = dropval + old_page_folder_name + '/';
  
      XExt.Confirm('Move "'+old_page_folder+'" to "'+ new_page_folder + '"?', function(){
        _this.moveFolder(old_page_folder, new_page_folder);
      });
    }
  };

})();
