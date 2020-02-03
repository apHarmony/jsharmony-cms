jsh.App[modelid] = new (function(){
  var _this = this;

  _this.rejectBranch = function(xmodel){
    XForm.Post(xmodel.module_namespace+'Branch_Review_Reject', { }, { branch_id: xmodel.get('branch_id') }, function(rslt){
      XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Review_Listing');
    });
  }

  _this.approveBranch = function(xmodel){
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

      var mergeType = 'apply';
      var checked_option = jsh.$root("input[name='"+xmodel.class+'_Merge_Type_option'+"']:checked:visible");
      if(checked_option.length) mergeType = checked_option.val().toLowerCase();
  
      var params = {
        src_branch_id: xmodel.get('branch_id'),
        dst_branch_id: jprompt.find('.dst_branch_id').val(),
        merge_type: mergeType,
      };

      if (mergeType == 'overwrite') {
        // no conflicts possible
        XForm.Post('/_funcs/merge/'+mergeType, { }, params, function(rslt){
          XForm.Post(xmodel.module_namespace+'Branch_Review_Approve', { }, { branch_id: xmodel.get('branch_id') }, function(rslt){
            success();
            XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Review_Listing');
          });
        });
      } else {
        XForm.Post('/_funcs/begin_merge/', { }, params, function(rslt){
          XForm.Post(xmodel.module_namespace+'Branch_Review_Approve', { }, { branch_id: xmodel.get('branch_id') }, function(rslt){
            success();
            XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Conflict'+
              '?action=update'+
              '&branch_id='+jprompt.find('.dst_branch_id').val()
            );
          });
        });
      }
    });
  }
})();
