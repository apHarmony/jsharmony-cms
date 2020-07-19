(function(jsh){
  var XExt = jsh.XExt;
  var XForm = jsh.XForm;
  var XPage = jsh.XPage;

  jsh.System.RequireBranch = function(xmodel){
    if(xmodel.controller.grid){
      xmodel.controller.grid.OnLoadError = function(err){
        if(err && err.Number==-14){
          XExt.Alert('Please checkout a branch', function(){
            XExt.navTo(jsh._BASEURL+'{namespace}Branch_Active_Listing', { force: true })
          });
          return true;
        }
      }
    }
    else if(xmodel.controller.form){
      xmodel.controller.form.OnDBError = function(err){
        if(err && err.Number==-14){
          XExt.Alert('Please checkout a branch', function(){
            XExt.navTo(jsh._BASEURL+'{namespace}Branch_Active_Listing', { force: true })
          });
          return false;
        }
      }
    }
  }

  jsh.System.ViewBranchSummary = function(xmodel, branch_id) {
    if(branch_id) XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Summary?action=update&branch_id='+encodeURIComponent(branch_id), { force: true })
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

  jsh.System.SubmitBranch = function(xmodel, branch_id) {
    //Save Changes Before Executing
    if (jsh.XPage.GetChanges().length > 0) return XExt.Alert('Please save pending changes before continuing.');

    XExt.Confirm('Are you sure you want to submit this branch for publishing review?',function(){
      XForm.prototype.XExecutePost('{namespace}Branch_Submit_Review', { branch_id: branch_id }, function(rslt){
        if(jsh.XBase[xmodel.module_namespace+'Branch_Active_Listing']) XPage.Refresh();
        else XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Active_Listing');
      });
    });
  }
})(window.jshInstance);