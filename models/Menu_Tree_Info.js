jsh.App[modelid] = new (function(){
  var _this = this;

  this.prev_link_type = '';

  this.oninit = function(){
    jsh.on('jsh_message', function(event, data){ _this.onmessage(data); });
  };

  this.onload = function(){
    _this.updateEnabledState();
    _this.updateImagePreview();
  };

  this.onmessage = function(data){
    data = (data || '').toString();
    if(data.indexOf('cms_file_picker:')==0){
      data = data.substr(16);
      var jdata = JSON.parse(data);
      if(jdata.media_key){
        if(jdata.media_target == 'menu_item_link_dest'){
          xmodel.set('menu_item_link_dest',jdata.media_key);
          xmodel.set('menu_item_link_media',jdata.media_path);
        }
        else if(jdata.media_target == 'menu_item_image'){
          xmodel.set('menu_item_image',jdata.media_key);
          xmodel.set('menu_item_image_path',jdata.media_path);
          _this.updateImagePreview();
        }
      } else if(jdata.page_key){
        xmodel.set('menu_item_link_dest',jdata.page_key);
        xmodel.set('menu_item_link_page',jdata.page_path);
      }
    }
  };

  this.menu_item_link_type_onchange = function(obj, newval, undoChange){
    XExt.execif(xmodel.get('menu_item_link_dest'),
      function(f){
        XExt.Confirm('Changing the link type will clear the current link.  Continue?', f, undoChange);
      },
      function(){
        if(newval != 'PAGE'){
          if(xmodel.get('menu_item_link_page')){
            xmodel.set('menu_item_link_dest','');
            xmodel.set('menu_item_link_page','');
          }
        }
        if(newval != 'MEDIA'){
          if(xmodel.get('menu_item_link_media')){
            xmodel.set('menu_item_link_dest','');
            xmodel.set('menu_item_link_media','');
          }
        }
        if(!newval){
          xmodel.set('menu_item_link_dest','');
        }
        _this.updateEnabledState();
        _this.prev_link_type = newval;
      }
    );
  };

  this.menu_item_text_onchange = function(obj, newval){
    jsh.App[xmodel.parent].commitInfo();
  };

  this.updateEnabledState = function(){
    var menu_item_link_type = xmodel.get('menu_item_link_type');

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
    if(!menu_item_link_type){
      enable_target = false;
    }
    else if(menu_item_link_type=='URL'){
      enable_dest = true;
    }
    else if(menu_item_link_type=='PAGE'){
      enable_dest_page = true;
      destcaptiontext = 'Page:';
    }
    else if(menu_item_link_type=='MEDIA'){
      enable_dest_media = true;
      destcaptiontext = 'Media:';
    }
    else if(menu_item_link_type=='JS'){
      enable_target = false;
      enable_dest = true;
      destcaptiontext = 'JS:';
    }
    xdtarget_group.style.display = enable_target;
    xddest_group.style.display = enable_dest;
    xddest_page_group.style.display = enable_dest_page;
    xddest_media_group.style.display = enable_dest_media;
    xddestcaption.text = destcaptiontext;
  };

  this.browsePage = function(){
    XExt.popupForm(xmodel.namespace+'Page_Browser', '', { init_page_key: xmodel.get('menu_item_link_dest') });
  };

  this.browseMedia = function(){
    XExt.popupForm(xmodel.namespace+'Media_Browser', '', { init_media_key: xmodel.get('menu_item_link_dest'), media_target: 'menu_item_link_dest' });
  };

  this.browseImage = function(){
    XExt.popupForm(xmodel.namespace+'Media_Browser', '', { init_media_key: xmodel.get('menu_item_image'), media_target: 'menu_item_image' });
  };

  this.clearImage = function(){
    xmodel.set('menu_item_image', '');
    xmodel.set('menu_item_image_path', '');
    _this.updateImagePreview();
  };

  this.updateImagePreview = function(){
    var xdpreview = jsh.XDom('.'+xmodel.class+'_menu_image_preview');
    var menu_item_image = xmodel.get('menu_item_image');
    var image_preview_url = '';
    xdpreview.clear();
    if(menu_item_image){
      image_preview_url = jsh._BASEURL+'_funcs/media/'+menu_item_image+'/file_preview';
      xdpreview.append('<img style="max-width:200px;padding-top:40px;display:block;margin:0 auto;" />');
      xdpreview.get('img').attr.src = image_preview_url;
    }
  };
})();
