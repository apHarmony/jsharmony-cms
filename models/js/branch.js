(function(jsh){
  var XExt = jsh.XExt;
  var XForm = jsh.XForm;
  var XPage = jsh.XPage;

  jsh.System.RequireBranch = function(xmodel){
    function showNoBranchMessage(){
      XExt.Alert('Please clone or checkout a revision', function(){
        XExt.navTo(jsh._BASEURL+'{namespace}Branch_Active_Listing', { force: true });
      });
    }

    function showNoSiteMessage(){
      XExt.Alert('Please checkout a site', function(){
        XExt.navTo(jsh._BASEURL+'{namespace}Site_Listing', { force: true });
      });
    }
    
    if(xmodel.controller.grid){
      xmodel.controller.grid.OnLoadError = function(err){
        if(!jsh.globalparams.site_id){
          showNoSiteMessage();
          return true;
        }
        if(err && err.Number==-14){
          showNoBranchMessage();
          return true;
        }
      };
    }
    else if(xmodel.controller.form){
      xmodel.controller.form.OnDBError = function(err){
        if(!jsh.globalparams.site_id){
          showNoSiteMessage();
          return false;
        }
        if(err && err.Number==-14){
          showNoBranchMessage();
          return false;
        }
      };
    }
  };

  jsh.System.RequireSite = function(xmodel){
    function showNoSiteMessage(){
      XExt.Alert('Please checkout a site', function(){
        XExt.navTo(jsh._BASEURL+'{namespace}Site_Listing', { force: true });
      });
    }

    if(!jsh.globalparams.site_id) return showNoSiteMessage();

    if(xmodel.controller.grid){
      xmodel.controller.grid.OnLoadError = function(err){
        if(err && err.Number==-14){
          showNoSiteMessage();
          return true;
        }
      };
    }
    else if(xmodel.controller.form){
      xmodel.controller.form.OnDBError = function(err){
        if(err && err.Number==-14){
          showNoSiteMessage();
          return false;
        }
      };
    }
  };

  jsh.System.ViewBranchSummary = function(xmodel, branch_id) {
    if(branch_id) XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Summary?action=update&branch_id='+encodeURIComponent(branch_id), { force: true });
    else XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Active_Listing', { force: true });
  };

  jsh.System.ArchiveBranch = function(branch_id) {
    //Save Changes Before Executing
    if (jsh.XPage.GetChanges().length > 0) return XExt.Alert('Please save pending changes before continuing.');

    XExt.Confirm('Are you sure you want to Archive this revision?  Archived revisions cannot be submitted for publishing.',function(){
      XForm.prototype.XExecutePost('{namespace}Branch_Archive', { branch_id: branch_id }, function(rslt){
        XPage.Refresh();
      });
    });
  };

  jsh.System.DownloadBranch = function(branch_id) {
    //Save Changes Before Executing
    if (jsh.XPage.GetChanges().length > 0) return XExt.Alert('Please save pending changes before continuing.');

    var url = jsh._BASEURL+'_funcs/branch/download/'+branch_id+'?source=js';
    jsh.getFileProxy().prop('src', url);
  };

  jsh.System.CheckoutBranch = function(xmodel, branch_id, branch_type) {
    //Save Changes Before Executing
    if (jsh.XPage.GetChanges().length > 0) return XExt.Alert('Please save pending changes before continuing.');

    XExt.execif(branch_type=='PUBLIC',
      function(f){
        XExt.Confirm('<div style="text-align:left;">Instead of checking out a release, it is recommended to:<br/><br/>1. Clone a Release to a local Revision<br/>2. Make changes in your local Revision<br/>3. Submit for publish review when changes are complete.<br/><br/>Are you sure you want to checkout this release?</div>', f, undefined, { message_type: 'html' });
      },
      function(){
        XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Checkout?action=update&branch_id='+encodeURIComponent(branch_id), { force: true });
      }
    );
  };

  jsh.System.UploadBranch = function(site_id, branch_type, branch_name, branch_content) {
    XForm.Post('../_funcs/branch/upload', {},
      {
        site_id: site_id,
        branch_type: branch_type,
        branch_name: branch_name,
        branch_content: branch_content,
      },
      function(rslt){
        XExt.Alert('Upload completed successfully', function(){
          //Redirect to page listing
          XExt.navTo(jsh._BASEURL+'{namespace}Sitemap_Listing_Redirect', { force: true });
        });
      }
    );
  };

  jsh.System.SubmitBranch = function(xmodel, branch_id) {
    //Save Changes Before Executing
    if (jsh.XPage.GetChanges().length > 0) return XExt.Alert('Please save pending changes before continuing.');

    XExt.Confirm('Are you sure you want to submit this revision for publishing review?',function(){
      XForm.prototype.XExecutePost('{namespace}Branch_Submit_Review', { branch_id: branch_id }, function(rslt){
        if(jsh.XBase[xmodel.module_namespace+'Branch_Active_Listing']) XPage.Refresh();
        else XExt.navTo(jsh._BASEURL+xmodel.module_namespace+'Branch_Active_Listing');
      });
    });
  };
})(window['{req.jshsite.instance}']);