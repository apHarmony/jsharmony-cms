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
      jsh.$root('.Branch_Summary_buttonConflicts').hide();
    }
    var diffModel = jsh.XModels[jsh.$root('.xform'+xmodel.class+' .xsubform_diff .xpanel .xform').first().data('id')];
    var actionsBar = jsh.$root('.'+diffModel.class+'_actions_bar');
    actionsBar.prev('.xform_caption').show();
    var buttonGroup = jsh.$root('.xactions_group.xelem'+xmodel.class+'[data-group="Actions"]');
    actionsBar.html(buttonGroup.html());
  }

  this.renameBranch = function(branch_id){
    var old_branch_name = xmodel.get('branch_name');
    var retry = function(){ _this.renameBranch(branch_id); };
    XExt.Prompt('Please enter a new revision name', old_branch_name, function (rslt) {
      if(rslt === null) return;
      rslt = rslt.trim();
      if(rslt == old_branch_name) return;
      if(!rslt) return XExt.Alert('Please enter a revision name', retry);
      XForm.prototype.XExecutePost('{namespace}Branch_Rename', { branch_id: branch_id, branch_name: rslt }, function(rslt){
        XPage.Refresh();
      });
    });
  }

  this.mergeFromBranch = function(xmodel){
    var xform = xmodel.controller.form;
    var sel = '.'+xmodel.class+'_Merge';

    if(!xmodel.get('dst_branch_id')) return XExt.Alert('Please clone or check out the destination revision');

    XExt.CustomPrompt(sel, jsh.$root(sel)[0].outerHTML, function () { //onInit
      var jprompt = jsh.$root('.xdialogblock ' + sel);

      jsh.$root('.xdialogblock ' + sel + ' .src_branch_desc').html(xform.Data.src_branch_desc);
      jsh.$root('.xdialogblock ' + sel + ' .dst_branch_desc').html(xform.Data.dst_branch_desc);
    }, function (success) { //onAccept
      var jprompt = jsh.$root('.xdialogblock ' + sel);

      var mergeType = 'changes';
      var checked_option = jsh.$root("input[name='"+xmodel.class+'_Merge_Type_option'+"']:checked:visible");
      if(checked_option.length) mergeType = checked_option.val().toLowerCase();



      if (mergeType == 'overwrite') {
        // no conflicts possible
        var params = {
          src_branch_id: xmodel.get('branch_id'),
          dst_branch_id: xmodel.get('dst_branch_id'),
        };
        XForm.Post('/_funcs/merge/'+mergeType, { }, params, function(rslt){
          success();
          XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Sitemap_Listing_Redirect');
        });
      } else {
        var params = {
          src_branch_id: xmodel.get('branch_id'),
          dst_branch_id: xmodel.get('dst_branch_id'),
          merge_type: mergeType,
        };
        XForm.Post('/_funcs/begin_merge/', { }, params, function(rslt){
          success();
          XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Conflicts'+
            '?action=update'+
            '&branch_id='+xmodel.get('dst_branch_id')
          );
        });
      }
    });
  }
})();
