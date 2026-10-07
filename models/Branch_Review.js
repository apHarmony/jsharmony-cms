jsh.App[modelid] = new (function(){
  var _this = this;

  _this.rejectBranch = function(xmodel){
    XForm.Post(xmodel.module_namespace+'Branch_Review_Reject', { }, { branch_id: xmodel.get('branch_id') }, function(rslt){
      XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Active_Listing');
    });
  };

  _this.approveBranch = function(xmodel){
    var xform = xmodel.controller.form;
    var sel = '.'+xmodel.class+'_Merge';

    XExt.CustomPrompt(sel, jsh.xd(sel).outerHTML, function () { //onInit
      var xdprompt = jsh.xdDialogBlock.get(sel);

      XExt.RenderLOV(xform.Data, jsh.xdDialogBlock.get(sel + ' .dst_branch_id').element, xform.LOVs.dst_branch_id);

      //Clear Values / Set Defaults
      xdprompt.get('.dst_branch_id').value = '';
    }, function (success) { //onAccept
      var xdprompt = jsh.xdDialogBlock.get(sel);

      //Validate File Selected
      if (!xdprompt.get('.dst_branch_id').value) return XExt.Alert('Please select a target revision for the merge.');

      var mergeType = 'apply';
      var xdchecked_option = jsh.xd("input[name='"+xmodel.class+'_Merge_Type_option'+"']").filter(function(el) {return el.checked && jsh.XDom.isVisible(el);});
      if(xdchecked_option.length) mergeType = xdchecked_option.value.toLowerCase();

      if (mergeType == 'overwrite') {
        // no conflicts possible
        let params = {
          src_branch_id: xmodel.get('branch_id'),
          dst_branch_id: xdprompt.get('.dst_branch_id').value,
        };
        XForm.Post('/_funcs/merge/'+mergeType, { }, params, function(rslt){
          XForm.Post(xmodel.module_namespace+'Branch_Review_Approve', { }, { branch_id: xmodel.get('branch_id') }, function(rslt){
            success();
            XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Active_Listing');
          });
        });
      } else {
        let params = {
          src_branch_id: xmodel.get('branch_id'),
          dst_branch_id: xdprompt.get('.dst_branch_id').value,
          merge_type: mergeType,
        };
        XForm.Post('/_funcs/begin_merge/', { }, params, function(rslt){
          XForm.Post(xmodel.module_namespace+'Branch_Review_Approve', { }, { branch_id: xmodel.get('branch_id') }, function(rslt){
            success();
            XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Conflicts'+
              '?action=update'+
              '&branch_id='+params.dst_branch_id
            );
          });
        });
      }
    });
  };
})();
