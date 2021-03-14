jsh.App[modelid] = new (function(){
  var _this = this;

  var initialized = false;
  var isActive = true;

  this.onload = function(){
    //Load API Data
    this.loadData();
  };

  this.ondestroy = function(){
    isActive = false;
  }

  this.loadData = function(){
    if(!isActive) return;
    console.log('Loading deployment log '+xmodel.get('deployment_id'));
    var emodelid = '../_funcs/deployment_log/'+xmodel.get('deployment_id');
    XForm.Get(emodelid, { }, { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        var deployment_sts = (rslt.deployment.deployment_sts||'').toUpperCase();
        //Auto Scroll if within 40px of bottom of screen
        var curDocumentHeight = jsh.XGrid.prototype._getDocumentHeight();
        var auto_scroll = (($(window).height() + $(window).scrollTop()) >= (curDocumentHeight - 50));

        //Render Log
        $('#'+xmodel.class+'_deployment_log').html(XExt.escapeHTMLBR(rslt.log));
        //Add loading animation if RUNNING
        if(deployment_sts=='RUNNING') $('#'+xmodel.class+'_deployment_log').append('<div style="padding-top:4px;"><img src = "/images/loading.gif" /></div>');
        //Auto-scroll
        if(auto_scroll && initialized){
          var curDocumentHeight = jsh.XGrid.prototype._getDocumentHeight();
          if(curDocumentHeight-$(window).height() > 0) $(window).scrollTop(curDocumentHeight-$(window).height());
        }
        //Auto-refresh
        if(_.includes(['PENDING','RUNNING'], deployment_sts)) setTimeout(function(){ _this.loadData(); }, 3000);

        initialized = true;
      }
      else XExt.Alert('Error while loading data');
    });
  }

})();