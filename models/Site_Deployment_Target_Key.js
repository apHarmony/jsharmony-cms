jsh.App[modelid] = new (function(){
  var _this = this;

  this.downloadPublicKey = function(format){
    var url = jsh._BASEURL+'_funcs/deployment_target/'+xmodel.get('deployment_target_id')+'/public_key?source=js&format='+encodeURIComponent(format);
    jsh.getFileProxy().prop('src', url);
  }

  this.downloadPrivateKey = function(){
    XExt.Confirm('You should not share your private key with anyone.  Are you sure you want to download?', function(){
      var url = jsh._BASEURL+'_funcs/deployment_target/'+xmodel.get('deployment_target_id')+'/private_key?source=js';
      jsh.getFileProxy().prop('src', url);
    });
  }

  this.uploadPrivateKey = function(){
    XExt.popupForm(xmodel.namespace+'Site_Deployment_Target_Key_Upload', 'update', { deployment_target_id: xmodel.get('deployment_target_id') });
  }

})();
