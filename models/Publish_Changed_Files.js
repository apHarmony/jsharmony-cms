jsh.App[modelid] = new (function(){
  var _this = this;

  this.onload = function(){
    //Load API Data
    this.loadData();
  };

  this.loadData = function(){
    var emodelid = '../_funcs/deployment_change_log/'+xmodel.get('deployment_id');
    XForm.Get(emodelid, { }, { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        //Render Log
        $('#'+xmodel.class+'_deployment_change_log').html(XExt.escapeHTMLBR(rslt.log));
      }
      else XExt.Alert('Error while loading data');
    });
  }

})();