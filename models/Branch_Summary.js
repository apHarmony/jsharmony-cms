jsh.App[modelid] = new (function(){
  var _this = this;

  this.oninit = function(xmodel){
    if (xmodel.get('branch_sts') != 'ACTIVE') {
      jsh.$('.Branch_Summary_buttonPublish').hide();
    }
  }

})();
