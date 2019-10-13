jsh.App[modelid] = new (function(){
  var _this = this;

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
  }

  this.onload = function(){
    //jsh.XModels[XBase["C_ECALL"][0]].bindings.FCERT_ID = function () { return xmodel.controller.form.Data.FCERT_ID; };
  }

  this.page_folder_onchange = function(obj, newval) {
    //xmodel.controller.form.Data.FCERT_ID = newval;
    jsh.XPage.Select({ modelid: 'Page_Tree_Listing', onCancel: function(){} });
  }

})();
