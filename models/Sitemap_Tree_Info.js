jsh.App[modelid] = new (function(){
  var _this = this;

  this.prev_link_type = '';
  this.last_page_info_request_id = 0;
  this.page_info_key = null;

  this.oninit = function(){
    jsh.on('jsh_message', function(event, data){ _this.onmessage(data); });
    _this.bindEvents();
  };

  this.onload = function(){
    _this.page_info_key = null;
    _this.render();
  };

  this.onmessage = function(data){
    data = (data || '').toString();
    if(data.indexOf('cms_file_picker:')==0){
      data = data.substr(16);
      var jdata = JSON.parse(data);
      if(jdata.media_key){
        xmodel.set('sitemap_item_link_dest',jdata.media_key);
        xmodel.set('sitemap_item_link_media',jdata.media_path);
      }
      else if(jdata.page_key){
        xmodel.set('sitemap_item_link_dest',jdata.page_key);
        xmodel.set('sitemap_item_link_page',jdata.page_path);
        _this.updatePageInfo();
      }
    }
  };

  this.sitemap_item_link_type_onchange = function(obj, newval, undoChange){
    XExt.execif(xmodel.get('sitemap_item_link_dest'),
      function(f){
        XExt.Confirm('Changing the link type will clear the current link.  Continue?', f, undoChange);
      },
      function(){
        if(newval != 'PAGE'){
          if(xmodel.get('sitemap_item_link_page')){
            xmodel.set('sitemap_item_link_dest','');
            xmodel.set('sitemap_item_link_page','');
          }
        }
        if(newval != 'MEDIA'){
          if(xmodel.get('sitemap_item_link_media')){
            xmodel.set('sitemap_item_link_dest','');
            xmodel.set('sitemap_item_link_media','');
          }
        }
        if(!newval){
          xmodel.set('sitemap_item_link_dest','');
        }
        _this.render();
        _this.prev_link_type = newval;
      }
    );
  };

  this.sitemap_item_text_onchange = function(obj, newval){
    jsh.App[xmodel.parent].commitInfo();
  };

  this.updatePageInfo = function(force){
    var sitemap_item_link_type = xmodel.get('sitemap_item_link_type');
    if(sitemap_item_link_type!='PAGE') return;

    var page_key = xmodel.get('sitemap_item_link_dest');
    page_key = parseInt(page_key);
    if(!page_key) return;

    if(!force && (page_key == _this.page_info_key)) return;

    _this.page_info_key = page_key;
    var xdpage_options = jsh.XDom('.'+xmodel.class+'_page_options');
    var xdtitle = xdpage_options.get('.page_title');
    var xdtemplate = xdpage_options.get('.page_template');
    var xdpath = xdpage_options.get('.page_path');

    xdtitle.setHtml("<img src='/images/loading.gif' />");
    xdtemplate.setHtml("<img src='/images/loading.gif' />");
    xdpath.setHtml("<img src='/images/loading.gif' />");

    var page_info_request_id = (new Date().getTime()) + '_' + Math.random().toString();
    _this.last_page_info_request_id = page_info_request_id;

    //Get page settings from server
    var execModel = xmodel.module_namespace+'Page_Info';
    var pageQuery = { page_key: page_key, branch_id: null };
    if(jsh.App[xmodel.parent].sitemap_id){
      pageQuery.branch_id = jsh._GET.branch_id;
    }
    XForm.Post(execModel, {}, pageQuery, function(rslt){
      if(_this.last_page_info_request_id != page_info_request_id) return;
      if(!rslt || !rslt[execModel] || !rslt[execModel].length || !rslt[execModel][0]){
        xdtitle.clear();
        xdtemplate.clear();
        xdpath.clear();
      }
      else {
        var page = rslt[execModel][0];
        xdtitle.text = page.page_title;
        var templateText = XExt.getLOVTxt(xmodel.controller.form.LOVs.page_template_id, page.page_template_id)||'';
        if(page.page_template_id=='<Standalone>') templateText += ' ' + (page.page_template_path||'');
        xdtemplate.text = templateText;
        xdpath.text = page.page_path;
      }
    });
  };

  this.render = function(){
    var sitemap_item_link_type = xmodel.get('sitemap_item_link_type');

    var xdtarget_group = jsh.XDom('.'+xmodel.class+'_link_target_group');
    var xddestcaption = jsh.XDom('.sitemap_item_link_dest_caption');
    var xddest_group = jsh.XDom('.'+xmodel.class+'_link_dest_group');
    var xddest_page_group = jsh.XDom('.'+xmodel.class+'_link_page_group');
    var xddest_media_group = jsh.XDom('.'+xmodel.class+'_link_media_group');

    var enable_target = true;
    var enable_dest = false;
    var enable_dest_page = false;
    var enable_dest_media = false;

    var destcaptiontext = 'URL:';
    if(!sitemap_item_link_type){
      enable_target = false;
    }
    else if(sitemap_item_link_type=='URL'){
      enable_dest = true;
    }
    else if(sitemap_item_link_type=='PAGE'){
      enable_dest_page = true;
      destcaptiontext = 'Page:';
    }
    else if(sitemap_item_link_type=='MEDIA'){
      enable_dest_media = true;
      destcaptiontext = 'Media:';
    }
    else if(sitemap_item_link_type=='JS'){
      enable_target = false;
      enable_dest = true;
      destcaptiontext = 'JS:';
    }
    xdtarget_group.style.display = (enable_target);
    xddest_group.style.display = (enable_dest);
    xddest_page_group.style.display = (enable_dest_page);
    xddest_media_group.style.display = (enable_dest_media);
    xddestcaption.text = destcaptiontext;

    var xdpage_options = jsh.XDom('.'+xmodel.class+'_page_options');
    if(!XExt.hasAction(xmodel.actions,'U')) xdpage_options.get('a.page_edit_settings,a.page_duplicate').style.display = false;
    xdpage_options.style.display = (sitemap_item_link_type=='PAGE');

    _this.updatePageInfo();
  };

  this.bindEvents = function(){
    var xdpage_options = jsh.XDom('.'+xmodel.class+'_page_options');
    xdpage_options.get('a').on('click', function(){
      var sitemap_item_id = xmodel.get('sitemap_item_id');
      if(!sitemap_item_id) return XExt.Alert('Sitemap Item ID not initialized');

      var sitemap_item_link_type = xmodel.get('sitemap_item_link_type');
      if(sitemap_item_link_type!='PAGE') return XExt.Alert('Link Type must be set to "Page"');

      var page_key = xmodel.get('sitemap_item_link_dest');
      if(!page_key) return XExt.Alert('Please first select a target page');

      var xdobj = jsh.XDom(this);
      if(xdobj.class.contains('page_edit_content')) jsh.App[xmodel.parent].editPageContent(page_key);
      else if(xdobj.class.contains('page_edit_settings')) jsh.App[xmodel.parent].editPageSettings(page_key, xdobj.attr['data-focus']);
      else if(xdobj.class.contains('page_view_revisions')) jsh.App[xmodel.parent].viewPageRevisions(page_key);
      else if(xdobj.class.contains('page_duplicate')) jsh.App[xmodel.parent].duplicatePage(xmodel.get('sitemap_item_parent_id'), page_key);
    });
    xdpage_options.get('a.page_edit_content').on('mousedown', function(e){
      //Right click
      if(e.which==3){
        //Resolve URL
        var page_key = xmodel.get('sitemap_item_link_dest');
        jsh.App[xmodel.parent].getEditorURL(page_key, function(url){
          jsh.XDom.setAttribute(this, 'href', url || '#');
        });
      }
      else {
        jsh.XDom.setAttribute(this, 'href', '#');
      }
    });
  };

  this.browsePage = function(page_folder){
    XExt.popupForm(xmodel.namespace+'Page_Browser', '', { init_page_key: xmodel.get('sitemap_item_link_dest') });
  };

  this.browseMedia = function(){
    XExt.popupForm(xmodel.namespace+'Media_Browser', '', { init_media_key: xmodel.get('sitemap_item_link_dest') });
  };

})();
