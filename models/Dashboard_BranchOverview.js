jsh.App[modelid] = new (function(){
  var _this = this;

  //Member variables
  this.branch_data = [];

  this.oninit = function(xmodel){
    if(!jsh.globalparams.site_id){
      $('.xform'+xmodel.class).closest('.xsubform').hide();
      return;
    }
    //Load API Data
    this.loadData();
  };

  this.loadData = function(onComplete){
    var emodelid = xmodel.namespace+'Dashboard_BranchOverview_Data';
    XForm.prototype.XExecutePost(emodelid, { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        //Populate arrays + Render
        _this.branch_data = rslt[emodelid];
        _this.render();
        if (onComplete) onComplete();
      }
      else XExt.Alert('Error while loading data');
    }, function (err) {
      //Optionally, handle errors
    });
  };

  this.render = function(){
    var tmpl = jsh.$root('.'+xmodel.class+'_template_QuickLinks').html();
    var jContent = jsh.$root('.'+xmodel.class+'_content');

    jContent.html(XExt.renderClientEJS(tmpl, { _: _, jsh: jsh, branch_data: _this.branch_data }));
  };

})();