(function(jsh){
  var XExt = jsh.XExt;
  var XForm = jsh.XForm;
  var XPage = jsh.XPage;

  jsh.System.RequireBranch = function(xmodel){
    if(xmodel.controller.grid){
      xmodel.controller.grid.OnLoadError = function(err){
        if(err && err.Number==-14){
          XExt.Alert('Please checkout a branch', function(){
            XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Active_Listing', { force: true })
          });
          return true;
        }
      }
    }
    else if(xmodel.controller.form){
      xmodel.controller.form.OnDBError = function(err){
        if(err && err.Number==-14){
          XExt.Alert('Please checkout a branch', function(){
            XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Active_Listing', { force: true })
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

  jsh.System.RejectBranch = function(xmodel){
    XForm.Post(xmodel.module_namespace+'Branch_Review_Reject', { }, { branch_id: xmodel.get('branch_id') }, function(rslt){
      XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Review_Listing');
    });
  }

  function getMergeType(xmodel) {
    var checked_option = jsh.$root("input[name='"+xmodel.class+'_Merge_Type_option'+"']:checked:visible");
    if(checked_option.length) return checked_option.val();
    return 'CHANGES';
  }

  jsh.System.ApproveBranch = function(xmodel){
    var xform = xmodel.controller.form;
    var sel = '.'+xmodel.class+'_Merge';

    XExt.CustomPrompt(sel, jsh.$root(sel)[0].outerHTML, function () { //onInit
      var jprompt = jsh.$root('.xdialogblock ' + sel);

      XExt.RenderLOV(xform.Data, jsh.$root('.xdialogblock ' + sel + ' .dst_branch_id'), xform.LOVs.dst_branch_id);

      //Clear Values / Set Defaults
      jprompt.find('.dst_branch_id').val('');
    }, function (success) { //onAccept
      var jprompt = jsh.$root('.xdialogblock ' + sel);

      //Validate File Selected
      if (!jprompt.find('.dst_branch_id').val()) return XExt.Alert('Please select a target branch for the merge.');

      var mergeType = getMergeType(xmodel);

      var params = {
        src_branch_id: xmodel.get('branch_id'),
        dst_branch_id: jprompt.find('.dst_branch_id').val()
      };

      XForm.Post(xmodel.module_namespace+'Branch_Review_Approve_'+mergeType, { }, params, function(rslt){
        success();
        XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Review_Listing');
      });
    });
  }

  jsh.System.MergeFromBranch = function(xmodel){
    var xform = xmodel.controller.form;
    var sel = '.'+xmodel.class+'_Merge';

    XExt.CustomPrompt(sel, jsh.$root(sel)[0].outerHTML, function () { //onInit
      var jprompt = jsh.$root('.xdialogblock ' + sel);

      jsh.$root('.xdialogblock ' + sel + ' .src_branch_desc').html(xform.Data.src_branch_desc);
      jsh.$root('.xdialogblock ' + sel + ' .dst_branch_desc').html(xform.Data.dst_branch_desc);
    }, function (success) { //onAccept
      var jprompt = jsh.$root('.xdialogblock ' + sel);

      var mergeType = getMergeType(xmodel);

      var params = {
        src_branch_id: xmodel.get('branch_id'),
        dst_branch_id: xmodel.get('dst_branch_id'),
      };

      XForm.Post(xmodel.module_namespace+'Branch_Summary_Merge_'+mergeType, { }, params, function(rslt){
        success();
        XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Active_Listing');
      });
    });
  }

})(window.jshInstance);