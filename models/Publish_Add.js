jsh.App[modelid] = new (function(){
  var _this = this;

  this.publish = function(){
    if(!xmodel.controller.form.Data.Commit()) return;
    var deployment_target_id = xmodel.get('deployment_target_id');
    var deployment_target_name = XExt.getLOVTxt(xmodel.controller.form.LOVs.deployment_target_id, deployment_target_id);
    var branch_id = xmodel.get('branch_id');
    var branch_name = XExt.getLOVTxt(xmodel.controller.form.LOVs.branch_id, branch_id);
    XExt.Confirm('Branch: ' + branch_name + '\nDestination: ' + deployment_target_name + '\nContinue?', function(){
      var params = _.pick(xmodel.controller.form.Data,[
        'site_id',
        'branch_id',
        'deployment_target_id',
        'deployment_date',
        'deployment_tag'
      ]);
      XForm.Post(xmodel.module_namespace+'Publish_Add_Exec', {}, params, function(rslt){
        XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Publish_Listing'); 
      });
    });
  }

})();
