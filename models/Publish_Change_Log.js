jsh.App[modelid] = new (function(){
  var _this = this;

  _this.onload = function(){
    //Load API Data
    this.loadData();
  };

  _this.loadData = function(){
    var emodelid = '../_funcs/deployment_change_log/'+xmodel.get('deployment_id');
    XForm.Get(emodelid, { }, { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        //Render Log
        if(!(rslt.log||'').trim()){
          $('#'+xmodel.class+'_deployment_change_log').html('-----------');
        }
        else {
          $('#'+xmodel.class+'_deployment_change_log').html(XExt.escapeHTMLBR(rslt.log));
        }
      }
      else XExt.Alert('Error while loading data');
    });
  };

})();