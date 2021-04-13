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
    XExt.Confirm('Revision: ' + branch_name + '\nDestination: ' + deployment_target_name + '\nContinue?', function(){
      var params = _.pick(xmodel.controller.form.Data,[
        'site_id',
        'branch_id',
        'deployment_target_id',
        'deployment_date',
        'deployment_tag'
      ]);

      var emodelid = xmodel.module_namespace+'Publish_Add_Branch_Exec';
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
    });
  }

})();
