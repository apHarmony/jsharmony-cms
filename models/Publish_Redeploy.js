jsh.App[modelid] = new (function(){
  var _this = this;

  _this.publish = function(){
    if(!xmodel.controller.form.Data.deployment_git_revision) return XExt.Alert('Cannot redeploy - no GIT revision is available for this deployment.');
    if(!xmodel.controller.form.Data.Commit()) return;
    var deployment_target_id = xmodel.get('deployment_target_id');
    var deployment_target_name = XExt.getLOVTxt(xmodel.controller.form.LOVs.deployment_target_id, deployment_target_id);
    var branch_desc = xmodel.controller.form.Data.branch_desc;
    XExt.Confirm('<b>Revision:</b> ' + XExt.escapeHTML(branch_desc) + '<br/><b>Destination:</b> ' + XExt.escapeHTML(deployment_target_name) + '<br/>Continue?', function(){
      var params = _.extend(
        _.pick(xmodel.controller.form.Data,[
          'deployment_target_id',
          'deployment_date',
          'deployment_tag'
        ]),
        { src_deployment_id: xmodel.get('deployment_id') }
      );


      var emodelid = xmodel.module_namespace+'Publish_Redeploy_Exec';
      XForm.Post(emodelid, {}, params, function(rslt){
        if ('_success' in rslt) {
          var deployment_id = rslt[emodelid][0].deployment_id;

          //Trigger deployment
          emodelid = '../_funcs/deployment/trigger';
          XForm.Get(emodelid, { }, { }, function (rslt) { //On Success
            if ('_success' in rslt) {
              XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Publish_Log?action=update&deployment_id='+deployment_id);
            }
            else XExt.Alert('Error while trigering deployment');
          });
        }
        else XExt.Alert('Error while adding deployment');
      });

    }, undefined, { message_type: 'html' });
  };

})();
