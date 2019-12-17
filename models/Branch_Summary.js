jsh.App[modelid] = new (function(){
  var _this = this;

  this.oninit = function(xmodel){
    if (xmodel.get('branch_sts') != 'ACTIVE') {
      jsh.$root('.Branch_Summary_buttonPublish').hide();
      jsh.$root('.Branch_Summary_buttonArchive').hide();
    }
    if(xmodel.get('branch_access')!='RW'){
      jsh.$root('.Branch_Summary_buttonRename').hide();
      jsh.$root('.Branch_Summary_buttonDelete').hide();
    }
    if (xmodel.get('branch_is_checked_out') == 1) {
      jsh.$root('.Branch_Summary_buttonMerge').hide();
      jsh.$root('.Branch_Summary_buttonCheckout').hide();
    }
  }

  this.renameBranch = function(branch_id){
    var old_branch_name = xmodel.get('branch_name');
    var retry = function(){ _this.renameBranch(branch_id); };
    XExt.Prompt('Please enter a new branch name', old_branch_name, function (rslt) {
      if(rslt === null) return;
      rslt = rslt.trim();
      if(rslt == old_branch_name) return;
      if(!rslt) return XExt.Alert('Please enter a branch name', retry);
      XForm.prototype.XExecutePost('{namespace}Branch_Rename', { branch_id: branch_id, branch_name: rslt }, function(rslt){
        XPage.Refresh();
      });
    });
  }

})();
