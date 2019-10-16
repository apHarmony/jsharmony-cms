jsh.App[modelid] = new (function(){
  var _this = this;

  this.isInEditor = false;

  this.oninit = function(){
    /*
    xmodel.controller.grid.OnLoadError = function(err){
      if(err && err.Number==-14){
        XExt.Alert('Please checkout a branch', function(){
          XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Active_Listing', { force: true })
        });
        return true;
      }
    }
    */
    if(jsh._GET.CKEditor){
      jsh.$root('.xbody').addClass('InEditor');
      this.isInEditor = true;
    }

    $(window).bind('resize', _this.onresize);
    _this.refreshLayout();
  }

  this.ondestroy = function(xmodel){
    $(window).unbind('resize', _this.onresize);
  }

  this.onload = function(){
    //jsh.XModels[XBase["C_ECALL"][0]].bindings.FCERT_ID = function () { return xmodel.controller.form.Data.FCERT_ID; };
    _this.refreshLayout();
  }

  this.onresize = function(){ _this.refreshLayout(); }

  this.refreshLayout = function(){
    var jbrowser = $('.'+xmodel.class+'_browser');

    if(!jbrowser.length) return;

    var wh = $(window).height();
    var top = jbrowser.offset().top;
    var contentheight = wh - top - 20;

    $('.'+xmodel.class+'_browser').css('height',contentheight+'px');
  }

  this.page_folder_onchange = function(obj, newval) {
    //xmodel.controller.form.Data.FCERT_ID = newval;
    jsh.XPage.Select({ modelid: 'Page_Tree_Listing', onCancel: function(){} });
  }

})();
