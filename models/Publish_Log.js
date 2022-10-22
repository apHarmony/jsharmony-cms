jsh.App[modelid] = new (function(){
  var _this = this;

  var initialized = false;
  var isActive = true;
  var sleepsWithoutUpdate = 0;
  var lastLog = '';

  this.onload = function(){
    this.updateButtons(xmodel.get('deployment_sts'));
    //Load API Data
    this.loadData();
  };

  this.ondestroy = function(){
    isActive = false;
  };

  this.updateButtons = function(deployment_sts){
    if(_.includes(['FAILED', 'COMPLETE'], deployment_sts)) jsh.$root('.xform_button_viewChangeLog.xelem'+xmodel.class).show();
    if(_.includes(['FAILED', 'COMPLETE'], deployment_sts)) jsh.$root('.xform_button_downloadZip.xelem'+xmodel.class).show();
    if(_.includes(['COMPLETE'], deployment_sts)) jsh.$root('.xform_button_redeploy.xelem'+xmodel.class).show();
  };

  this.getSleepTime = function(){
    sleepsWithoutUpdate++;
    var minSleepTime = 500;
    var maxSleepTime = 3000;
    var sleepTime = Math.min(
      minSleepTime + sleepsWithoutUpdate * ((maxSleepTime - minSleepTime) / 20),
      maxSleepTime
    );
    return sleepTime;
  };

  this.loadData = function(){
    if(!isActive) return;
    if(jsh._debug) console.log('Loading deployment log '+xmodel.get('deployment_id')); // eslint-disable-line no-console
    var emodelid = '../_funcs/deployment_log/'+xmodel.get('deployment_id');
    XForm.Get(emodelid, { }, { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        var newLog = JSON.stringify(rslt);
        if(newLog != lastLog) sleepsWithoutUpdate = 0;
        lastLog = newLog;
        var deployment_sts = (rslt.deployment.deployment_sts||'').toUpperCase();
        var deployment_sts_txt = rslt.deployment.deployment_sts_txt;
        _this.updateButtons(deployment_sts);
        jsh.$root('.xform_label.deployment_sts.xelem'+xmodel.class).html(deployment_sts_txt);
        //Auto Scroll if within 40px of bottom of screen
        var curDocumentHeight = jsh.XGrid.prototype._getDocumentHeight();
        var auto_scroll = (($(window).height() + $(window).scrollTop()) >= (curDocumentHeight - 50));

        var isRunning = false;
        if(deployment_sts=='RUNNING') isRunning = true;
        else if(deployment_sts=='PENDING') isRunning = true;

        //Render Log
        $('#'+xmodel.class+'_deployment_log').html(XExt.escapeHTMLBR(rslt.log));
        //Add loading animation if RUNNING
        if(isRunning) $('#'+xmodel.class+'_deployment_log').append('<div style="padding-top:4px;"><img src = "/images/loading.gif" /></div>');
        else if(deployment_sts=='COMPLETE'){
          if(rslt.deployment.published_url){
            var jComplete = $('<div style="margin-bottom:15px;"><a class="jsHarmonyCms_action_button" target="_blank" href="'+XExt.escapeHTML(rslt.deployment.published_url)+'">View Deployed Site</a></div>');
            $('#'+xmodel.class+'_deployment_log').after(jComplete);
          }
        }
        //Auto-scroll
        if(auto_scroll && initialized){
          curDocumentHeight = jsh.XGrid.prototype._getDocumentHeight();
          if(curDocumentHeight-$(window).height() > 0) $(window).scrollTop(curDocumentHeight-$(window).height());
        }
        //Auto-refresh
        if(_.includes(['PENDING','RUNNING'], deployment_sts)) setTimeout(function(){ _this.loadData(); }, _this.getSleepTime());

        initialized = true;
      }
      else XExt.Alert('Error while loading data');
    });
  };

})();