jsh.App[modelid] = new (function(){
  var _this = this;

  this.isInEditor = false;
  this.state_default = {
    page_folder: null
  };
  this.state = _.extend({}, this.state_default);

  this.oninit = function(){
    /*
    xmodel.controller.grid.OnLoadError = function(err){
      if(err && err.Number==-14){
        XExt.Alert('Please checkout a branch', function(){
          XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Active_Listing', { force: true })
        });
        return true;
      }
    }
    */
    if(jsh._GET.CKEditor){
      jsh.$root('.xbody').addClass('InEditor');
      this.isInEditor = true;
    }

    $(window).bind('resize', _this.onresize);
    jsh.on('jsh_message', function(event, data){ _this.onMessage(data); });
    _this.refreshLayout();
  }

  this.onMessage = function(data){
    data = (data || '').toString();
    if(data.indexOf('jsharmony-cms:refresh:')==0){
      var refresh_folder = data.substr(22);
      if(_this.state.page_folder == refresh_folder){
        jsh.XPage.Select({ modelid: 'Page_Tree_Listing', onCancel: function(){} });
      }
    }
  }

  this.ondestroy = function(xmodel){
    $(window).unbind('resize', _this.onresize);
  }

  this.onload = function(){
    //jsh.XModels[XBase["C_ECALL"][0]].bindings.FCERT_ID = function () { return xmodel.controller.form.Data.FCERT_ID; };
    _this.refreshLayout();
    _this.state.page_folder = xmodel.get('page_folder');
  }

  this.ongetstate = function(){ return _this.state; }

  this.onloadstate = function(xmodel, state){
    _this.state = _.extend({}, _this.state_default, _this.state, state);
    this.setFolderBeforeLoad(state.page_folder);
  }

  this.setFolderBeforeLoad = function(page_folder){
    xmodel.controller.form.Data['page_folder'] = page_folder;
    xmodel.saveUnboundFields(xmodel.controller.form.Data);
  }

  this.onresize = function(){ _this.refreshLayout(); }

  this.refreshLayout = function(){
    var jbrowser = $('.'+xmodel.class+'_browser');

    if(!jbrowser.length) return;

    var wh = $(window).height();
    var top = jbrowser.offset().top;
    var contentheight = wh - top - 20;

    $('.'+xmodel.class+'_browser').css('height',contentheight+'px');
  }

  this.page_folder_onchange = function(obj, newval) {
    var historyParams = {};
    if(_this.state.page_folder===null) historyParams = { replaceHistory: true };
    _this.state.page_folder = newval;
    jsh.XPage.Select({ modelid: 'Page_Tree_Listing', onCancel: function(){} });
    XPage.AddHistory(undefined, undefined, historyParams);
  }

  this.addFolder = function(parent_page_folder){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before adding a folder');

    XExt.Prompt('Please enter the subfolder name', '', function (rslt) {
      if(!rslt || !rslt.trim()) return;
      var page_path = parent_page_folder + rslt.trim() + '/';
      if(XExt.cleanFileName(rslt) != rslt) return XExt.Alert('Please enter a valid filename');
      XForm.Post(xmodel.namespace+'Page_Tree_Folder_Add',{},{ page_path: page_path }, function(){
        _this.setFolderBeforeLoad(page_path);
        jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} });
      });
    });
  }

  this.renameFolder = function(page_folder){
    //Get new folder name
    var base_folder_name = XExt.basename(page_folder);
    if(!base_folder_name) return XExt.Alert('Cannot rename this folder');
    //Update all paths to new paths
    XExt.Prompt('Please enter a new folder name', base_folder_name, function (rslt) {
      if(rslt === null) return;
      rslt = rslt.trim();
      if(rslt == base_folder_name) return;
      if(XExt.cleanFileName(rslt) != rslt) return XExt.Alert('Please enter a valid folder name');

      var new_page_folder = XExt.dirname(page_folder) + '/' + rslt + '/';
      XForm.Post(xmodel.namespace+'Page_Tree_Folder_Move',{},{ old_page_folder:page_folder, new_page_folder: new_page_folder }, function(){
        _this.setFolderBeforeLoad(new_page_folder);
        jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} });
      });
    });
  }

  this.moveFolder = function(page_folder){
    //Get new folder name
    //Update all paths to new paths
    XExt.Prompt('Please enter a new path', page_folder, function (rslt) {
      if(rslt === null) return;
      rslt = rslt.trim();
      if(rslt == page_folder) return;
      if(rslt[0] != '/') return XExt.Alert('Path must start with "/"');
      if(rslt.indexOf('//') >=0 ) return XExt.Alert('Invalid path');
      if(rslt.indexOf('/./') >=0 ) return XExt.Alert('Invalid path');
      if(rslt.indexOf('/../') >=0 ) return XExt.Alert('Invalid path');
      if(rslt[rslt.length-1] != '/') rslt += '/';
      XForm.Post(xmodel.namespace+'Page_Tree_Folder_Move',{},{ old_page_folder:page_folder, new_page_folder: rslt }, function(){
        _this.setFolderBeforeLoad(rslt);
        jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} });
      });
    });
  }

  this.deleteFolder = function(page_folder){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before deleting a folder');

    var parent_folder = XExt.dirname(page_folder)+'/';

    XExt.Confirm('Are you sure you want to delete "'+page_folder+'" and all of its contents?', function (rslt) {
      XForm.Post(xmodel.namespace+'Page_Tree_Folder_Delete',{},{ page_folder: page_folder }, function(){
        _this.setFolderBeforeLoad(parent_folder);
        jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} });
      });
    });
  }

})();
