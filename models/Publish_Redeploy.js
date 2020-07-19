jsh.App[modelid] = new (function(){
  var _this = this;

  this.publish = function(){
    if(!xmodel.controller.form.Data.deployment_git_revision) return XExt.Alert('Cannot redeploy - no GIT revision is available for this deployment.');
    if(!xmodel.controller.form.Data.Commit()) return;
    var deployment_target_id = xmodel.get('deployment_target_id');
    var deployment_target_name = XExt.getLOVTxt(xmodel.controller.form.LOVs.deployment_target_id, deployment_target_id);
    var deployment_git_revision = xmodel.controller.form.Data.deployment_git_revision;
    XExt.Confirm('Revision: ' + deployment_git_revision + '\nDestination: ' + deployment_target_name + '\nContinue?', function(){
      var params = _.extend(
        _.pick(xmodel.controller.form.Data,[
          'deployment_target_id',
          'deployment_date',
          'deployment_tag'
        ]),
        { src_deployment_id: xmodel.get('deployment_id') }
      );
      XForm.Post(xmodel.module_namespace+'Publish_Redeploy_Exec', {}, params, function(rslt){
        XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Publish_Listing'); 
      });
    });
  }

})();
