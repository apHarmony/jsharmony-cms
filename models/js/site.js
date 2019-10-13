(function(jsh){
  var XExt = jsh.XExt;
  var XForm = jsh.XForm;
  var XPage = jsh.XPage;
 
  jsh.System.ArchiveBranch = function(branch_id) {
    //Save Changes Before Executing
    if (jsh.XPage.GetChanges().length > 0) return XExt.Alert('Please save pending changes before continuing.');

    XExt.Confirm('Are you sure you want to Archive this branch?',function(){
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

})(window.jshInstance);