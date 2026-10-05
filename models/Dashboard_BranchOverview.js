jsh.App[modelid] = new (function(){
  var _this = this;

  //Member variables
  this.branch_data = [];

  this.oninit = function(xmodel){
    if(!jsh.globalparams.site_id){
      jsh.XDom('.xform'+xmodel.class).parent('.xsubform').style.display = false;
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
    var tmpl = jsh.xd('.'+xmodel.class+'_template_QuickLinks').element.outerHTML;
    var xdContent = jsh.xd('.'+xmodel.class+'_content');

    xdContent.setHtml(XExt.renderClientEJS(tmpl, { _: _, jsh: jsh, branch_data: _this.branch_data }));
  };

})();