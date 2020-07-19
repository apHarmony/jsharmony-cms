jsh.App[modelid] = new (function(){
  var _this = this;

  this.prev_link_type = '';
  this.last_page_info_request_id = 0;
  this.page_info_key = null;

  this.oninit = function(){
    jsh.on('jsh_message', function(event, data){ _this.onmessage(data); });
    _this.bindEvents();
  }

  this.onload = function(){
    _this.page_info_key = null;
    _this.render();
  }

  this.onmessage = function(data){
    var data = (data || '').toString();
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
  }

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
  }

  this.sitemap_item_text_onchange = function(obj, newval){
    jsh.App[xmodel.parent].commitInfo();
  }

  this.updatePageInfo = function(force){
    var sitemap_item_link_type = xmodel.get('sitemap_item_link_type');
    if(sitemap_item_link_type!='PAGE') return;

    var page_key = xmodel.get('sitemap_item_link_dest');
    page_key = parseInt(page_key);
    if(!page_key) return;

    if(!force && (page_key == _this.page_info_key)) return;

    _this.page_info_key = page_key;
    var jpage_options = $('.'+xmodel.class+'_page_options');
    var jtitle = jpage_options.find('.page_title');
    var jtemplate = jpage_options.find('.page_template');

    jtitle.html("<img src='/images/loading.gif' />");
    jtemplate.html("<img src='/images/loading.gif' />");

    var page_info_request_id = (new Date().getTime()) + '_' + Math.random().toString();
    _this.last_page_info_request_id = page_info_request_id;

    //Get page properties from server
    var execModel = xmodel.module_namespace+'Page_Tree_Listing';
    XForm.Get(execModel, { rowstart: 0, rowcount: 1, d: JSON.stringify({ page_key: page_key }) }, { }, function(rslt){
      if(_this.last_page_info_request_id != page_info_request_id) return;
      if(!rslt || !rslt[execModel] || !rslt[execModel].length || !rslt[execModel][0]){
        jtitle.text("");
        jtemplate.text("");
      }
      else {
        var page = rslt[execModel][0];
        jtitle.text(page.page_title);
        jtemplate.text(XExt.getLOVTxt(xmodel.controller.form.LOVs.page_template_id, page.page_template_id)||'');
      }
    });
  }

  this.render = function(){
    var sitemap_item_link_type = xmodel.get('sitemap_item_link_type');

    var jtarget = $('.sitemap_item_link_target.xelem'+xmodel.class);
    var jtarget_group = jtarget.add(jtarget.prevUntil('.xelem'+xmodel.class));

    var jdest = $('.sitemap_item_link_dest.xelem'+xmodel.class);
    var jdestcaption = jdest.prev();
    var jdest_group = jdest.add(jdest.prevUntil('.xelem'+xmodel.class));

    var jdest_page = $('.sitemap_item_link_page.xelem'+xmodel.class);
    var jdest_page_group = jdest_page.add(jdest_page.prevUntil('.xelem'+xmodel.class)).add(jdest_page.next('.xelem'+xmodel.class));

    var jdest_media = $('.sitemap_item_link_media.xelem'+xmodel.class);
    var jdest_media_group = jdest_media.add(jdest_media.prevUntil('.xelem'+xmodel.class)).add(jdest_media.next('.xelem'+xmodel.class));

    var enable_target = true;
    var enable_dest = false;
    var enable_dest_page = false;
    var enable_dest_media = false;

    var jdestcaptiontext = 'URL:';
    if(!sitemap_item_link_type){
      enable_target = false;
    }
    else if(sitemap_item_link_type=='URL'){
      enable_dest = true;
    }
    else if(sitemap_item_link_type=='PAGE'){
      enable_dest_page = true;
      jdestcaptiontext = 'Page:';
    }
    else if(sitemap_item_link_type=='MEDIA'){
      enable_dest_media = true;
      jdestcaptiontext = 'Media:';
    }
    else if(sitemap_item_link_type=='JS'){
      enable_target = false;
      enable_dest = true;
      jdestcaptiontext = 'JS:';
    }
    jtarget_group.toggle(enable_target);
    jdest_group.toggle(enable_dest);
    jdest_page_group.toggle(enable_dest_page);
    jdest_media_group.toggle(enable_dest_media);
    jdestcaption.text(jdestcaptiontext);

    var jpage_options = $('.'+xmodel.class+'_page_options');
    if(!XExt.hasAction(xmodel.actions,'U')) jpage_options.find('a').hide();
    jpage_options.toggle(sitemap_item_link_type=='PAGE');

    _this.updatePageInfo();
  }

  this.bindEvents = function(){
    var jpage_options = $('.'+xmodel.class+'_page_options');
    jpage_options.find('a').on('click', function(){
      var sitemap_item_id = xmodel.get('sitemap_item_id');
      if(!sitemap_item_id) return XExt.Alert('Sitemap Item ID not initialized');

      var sitemap_item_link_type = xmodel.get('sitemap_item_link_type');
      if(sitemap_item_link_type!='PAGE') return XExt.Alert('Link Type must be set to "Page"');

      var page_key = xmodel.get('sitemap_item_link_dest');
      if(!page_key) return XExt.Alert('Please first select a target page');

      var jobj = $(this);
      if(jobj.hasClass('page_edit_content')) jsh.App[xmodel.parent].editPageContent(page_key);
      else if(jobj.hasClass('page_edit_properties')) jsh.App[xmodel.parent].editPageProperties(page_key);
      else if(jobj.hasClass('page_view_revisions')) jsh.App[xmodel.parent].viewPageRevisions(page_key);
      else if(jobj.hasClass('page_duplicate')) jsh.App[xmodel.parent].duplicatePage(xmodel.get('sitemap_item_parent_id'), page_key);
    });
  }

  this.browsePage = function(page_folder){
    XExt.popupForm(xmodel.namespace+'Page_Browser', '', { init_page_key: xmodel.get('sitemap_item_link_dest') });
  }

  this.browseMedia = function(){
    XExt.popupForm(xmodel.namespace+'Media_Browser', '', { init_media_key: xmodel.get('sitemap_item_link_dest') });
  }

})();
