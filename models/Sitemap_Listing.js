jsh.App[modelid] = new (function(){
  var _this = this;

  _this.revision_sitemap_key = undefined;
  _this.revision_sitemap_id = undefined;

  this.openSitemapEditor = function(obj){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before editing sitemap');

    var rowid = $(obj).closest('tr').data('id');

    var sitemap_key = xmodel.get('sitemap_key', rowid);
    if(!sitemap_key) return XExt.Alert('Please save sitemap before editing');

    XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Sitemap_Tree?action=update&sitemap_key='+sitemap_key);
  };

  this.previewSitemap = function(sitemap){
    XExt.popupForm(xmodel.namespace+'Sitemap_Tree_Browse','browse', { sitemap_key: sitemap.sitemap_key, sitemap_id: sitemap.sitemap_id });
  };

  this.viewRevisions = function(obj){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before editing sitemap');

    var rowid = $(obj).closest('tr').data('id');
    var sitemap_key = xmodel.get('sitemap_key', rowid);

    _this.revision_sitemap_key = sitemap_key;
    _this.revision_sitemap_id = xmodel.get('sitemap_id', rowid);
    jsh.XExt.popupShow(xmodel.namespace + 'Sitemap_Revision_Listing','revision_sitemap','Revisions',undefined,jsh.$root('.xform'+xmodel.class+' .revision_sitemap_xlookup')[0],{
      OnPopupClosed:function(rslt){
        if(rslt && rslt.resultrow && rslt.resultrow.sitemap_id){
          var sitemap_id = rslt.resultrow.sitemap_id;
          XForm.Post(xmodel.namespace+'Sitemap_Revision_Update',{},{ sitemap_key: sitemap_key, sitemap_id: sitemap_id }, function(){
            jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} });
          });
        }
      }
    });
  };

})();
