jsh.App[modelid] = new (function(){
  var _this = this;

  this.onload = function(){
    function autoSelectOneDropdownItem(fieldName, jobj){
      if(jobj.val()) return;
      var allOptions = [];
      jobj.find('option').each(function(){ var val = $(this).attr('value'); if(val) allOptions.push(val); });
      if(allOptions.length==1) xmodel.set(fieldName, allOptions[0]);
    }
    //Wait for LOVs to update
    setTimeout(function(){
      autoSelectOneDropdownItem('deployment_target_id', jsh.$root('.deployment_target_id.xelem'+xmodel.class));
    }, 1);
  }

  this.publish = function(){
    if(!xmodel.controller.form.Data.Commit()) return;
    var deployment_target_id = xmodel.get('deployment_target_id');
    var deployment_target_name = XExt.getLOVTxt(xmodel.controller.form.LOVs.deployment_target_id, deployment_target_id);
    var branch_name = xmodel.controller.form.Data.branch_desc;
    XExt.Confirm('Branch: ' + branch_name + '\nDestination: ' + deployment_target_name + '\nContinue?', function(){
      var params = _.pick(xmodel.controller.form.Data,[
        'site_id',
        'branch_id',
        'deployment_target_id',
        'deployment_date',
        'deployment_tag'
      ]);
      XForm.Post(xmodel.module_namespace+'Publish_Add_Branch_Exec', {}, params, function(rslt){
        XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Publish_Listing'); 
      });
    });
  }

})();
