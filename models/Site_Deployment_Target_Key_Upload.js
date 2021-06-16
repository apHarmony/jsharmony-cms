jsh.App[modelid] = new (function(){
  var _this = this;

  this.uploadPrivateKey = function(){
    debugger;
    if(!xmodel.controller.form.Data.Commit()) return; 
    XForm.Post('../_funcs/deployment_target/'+xmodel.get('deployment_target_id')+'/private_key', {}, 
      {
        private_key: xmodel.get('private_key'),
      },
      function(rslt){
        XExt.Alert('Upload completed successfully', function(){
          window.onbeforeunload = null;
          jsh.cancelExit = true;
          window.close();
        });
      }
    );
  }

})();
