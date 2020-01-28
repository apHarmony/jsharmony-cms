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
    if (!xmodel.get('branch_merge_id')) {
      jsh.$root('.Branch_Summary_buttonConflict').hide();
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

  this.mergeFromBranch = function(xmodel){
    var xform = xmodel.controller.form;
    var sel = '.'+xmodel.class+'_Merge';

    XExt.CustomPrompt(sel, jsh.$root(sel)[0].outerHTML, function () { //onInit
      var jprompt = jsh.$root('.xdialogblock ' + sel);

      jsh.$root('.xdialogblock ' + sel + ' .src_branch_desc').html(xform.Data.src_branch_desc);
      jsh.$root('.xdialogblock ' + sel + ' .dst_branch_desc').html(xform.Data.dst_branch_desc);
    }, function (success) { //onAccept
      var jprompt = jsh.$root('.xdialogblock ' + sel);

      var mergeType = 'changes';
      var checked_option = jsh.$root("input[name='"+xmodel.class+'_Merge_Type_option'+"']:checked:visible");
      if(checked_option.length) mergeType = checked_option.val().toLowerCase();

      var params = {
        src_branch_id: xmodel.get('branch_id'),
        dst_branch_id: xmodel.get('dst_branch_id'),
        merge_type: mergeType,
      };

      if (mergeType == 'overwrite') {
        // no conflicts possible
        XForm.Post('/_funcs/merge/'+mergeType, { }, params, function(rslt){
          success();
          XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Sitemap_Listing_Redirect');
        });
      } else {
        XForm.Post('/_funcs/begin_merge/', { }, params, function(rslt){
          success();
          XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Conflict'+
            '?action=update'+
            '&branch_id='+xmodel.get('dst_branch_id')
          );
        });
      }
    });
  }
})();
