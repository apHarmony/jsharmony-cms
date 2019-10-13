jsh.App[modelid] = new (function(){
  var _this = this;

  this.SORT = { 'filename': 'File Name', 'date': 'Date', 'description': 'Description', 'size': 'Size' , 'type': 'Type' };
  this.SORT_KEY = { 'filename': 'media_filename', 'date': 'media_uptstmp_raw', 'description': 'media_desc', 'size': 'media_size' , 'type': 'media_ext' };
  this.VIEW = { 'tiles': 'Tiles', 'details': 'Details' };

  this.media_files = [];
  this.selected_media_key = null;
  this.state_default = {
    media_folder: null,
    file_view: 'tiles',
    file_sort: '^filename'
  };
  this.state = _.extend({}, this.state_default);
  this._current_media_folder = null;
  this.loadobj = {};

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

   $(window).bind('resize', _this.onresize);
   _this.refreshLayout();
   _this.renderInfo();
   jsh.$root('.'+xmodel.class+'_file_listing').on('dragenter', _this.file_listing_onDragEnter);
   jsh.$root('.'+xmodel.class+'_file_listing').on('dragleave', _this.file_listing_onDragLeave);
   jsh.$root('.'+xmodel.class+'_file_listing').on('dragover', _this.file_listing_onDragOver);
   jsh.$root('.'+xmodel.class+'_file_listing').on('drop', _this.file_listing_onDrop);
  }

  this.file_listing_dragCounter = 0;

  this.file_listing_onDragEnter = function(e){
    var jobj = $(this);
    _this.file_listing_dragCounter++;
    if(!jobj.hasClass('dragOver')) jobj.addClass('dragOver');
    e.preventDefault();
    e.stopPropagation();
  }

  this.file_listing_onDragLeave = function(e){
    var jobj = $(this);
    _this.file_listing_dragCounter--;
    if(_this.file_listing_dragCounter <= 0){
      _this.file_listing_dragCounter = 0;
      jobj.removeClass('dragOver');
    }
    e.preventDefault();
    e.stopPropagation();
  }

  this.file_listing_onDragOver = function(e){
    e.preventDefault();
    e.stopPropagation();
  }

  this.file_listing_onDrop = function(e){
    var jobj = $(this);
    _this.file_listing_dragCounter = 0;
    jobj.removeClass('dragOver');
    e.preventDefault();
    e.stopPropagation();

    var srcevent = e.originalEvent;
    if(srcevent && srcevent.dataTransfer && srcevent.dataTransfer.files){
      _this.uploadFiles(srcevent.dataTransfer.files);
    }
  }

  this.uploadFiles = function(files, cb){
    XExt.clearDialogs();
    var media_keys = [];
    jsh.async.eachSeries(files, function(file, file_cb){
      _this.uploadFile(file, function(err, rslt){
        if(rslt && rslt.media_key) media_keys.push(rslt.media_key);
        return file_cb();
      });
    }, function(err){
      if(media_keys.length){
        _this.getMediaFileListing({ force: true }, function(){
          _this.selectFile(media_keys[0], { scrollIntoView: true });
          if(cb) return cb(err, media_keys);
        });
      }
      else if(cb) return cb(err, media_keys);
    });
  }

  this.uploadFile = function(file, cb){
    var fd = new FormData();
    fd.append('media_file', file, file.name);
    fd.append('media_path', this.state.media_folder + file.name);

    jsh.xLoader.StartLoading(_this.loadobj);
    $.ajax({
      url: jsh._BASEURL + '_funcs/media/',
      data: fd,
      processData: false,
      contentType: false,
      type: 'PUT',
      dataType: 'json',
      xhrFields: {
        withCredentials: true
      },
      success: function(jdata){
        jsh.xLoader.StopLoading(_this.loadobj);
        if ((jdata instanceof Object) && ('_error' in jdata)) {
          if (jsh.DefaultErrorHandler(jdata._error.Number, jdata._error.Message)) { }
          else if ((jdata._error.Number == -9) || (jdata._error.Number == -5)) { jsh.XExt.Alert(jdata._error.Message); }
          else { jsh.XExt.Alert('Error #' + jdata._error.Number + ': ' + jdata._error.Message); }
          return;
        }
        else if ((jdata instanceof Object) && ('_success' in jdata)) {
          if (cb) cb(null, jdata);
        }
        else {
          jsh.XExt.Alert('Error Uploading File: ' + JSON.stringify(jdata ? jdata : ''));
        }
      },
      error: function (err) { jsh.xLoader.StopLoading(_this.loadobj); console.log(err); XExt.Alert('Error uploading file: '+XExt.stringify(err)); }
    });
  }

  this.onload = function(){
    _this.refreshLayout();
    _this.getMediaFileListing();
  }

  this.ondestroy = function(xmodel){
    $(window).unbind('resize', _this.onresize);
  }

  this.onresize = function(){ _this.refreshLayout(); }

  this.ongetstate = function(){ return _this.state; }

  this.onloadstate = function(xmodel, state){
    _this.state = _.extend({}, _this.state_default, _this.state, state);
    this.setFolderBeforeLoad(state.media_folder);
  }

  this.setFolderBeforeLoad = function(media_folder){
    xmodel.controller.form.Data['media_folder'] = media_folder;
    xmodel.saveUnboundFields(xmodel.controller.form.Data);
  }

  this.refreshLayout = function(){
    var jbrowser = $('.'+xmodel.class+'_browser');

    var wh = $(window).height();
    var top = jbrowser.offset().top;
    var contentheight = wh - top - 20;

    $('.'+xmodel.class+'_browser').css('height',contentheight+'px');
  }

  this.media_folder_onchange = function(obj, newval) {
    var historyParams = {};
    if(_this.state.media_folder===null) historyParams = { replaceHistory: true };
    _this.getMediaFileListing();
    XPage.AddHistory(undefined, undefined, historyParams);
  }

  this.setView = function(view){
    if(!_.includes(_.keys(_this.VIEW),view)) return XExt.Alert('Invalid View: '+view);
    if(_this.state.file_view == view) return;
    _this.state.file_view = view;
    _this.renderListing();
    XPage.AddHistory();
  }

  this.setSort = function(sort){
    if(!_.includes(_.keys(_this.SORT),sort)) return XExt.Alert('Invalid Sort: '+sort);
    var new_sort = '^'+sort;
    if(_this.state.file_sort.substr(1) == sort) _this.state.file_sort = (_this.state.file_sort==new_sort ? 'v'+sort : new_sort);
    else _this.state.file_sort = new_sort;
    _this.renderListing();
    XPage.AddHistory();
  }

  this.getMediaFileListing = function(options, onComplete){
    options = _.extend({ force: false, media_folder: undefined }, options);
    var media_folder = options.media_folder;
    if(typeof media_folder=='undefined') media_folder = xmodel.get('media_folder');

    var sameFolder = false;
    if(_this._current_media_folder == media_folder){
      if(!options.force){ _this.renderListing(); return; }
      sameFolder = true;
    }
    _this.state.media_folder = media_folder;

    var emodelid = xmodel.namespace+'Media_Tree_File_Listing';
    XForm.Post(emodelid, {}, { media_folder: media_folder }, function (rslt) { //On Success
      if(_this.state.media_folder != media_folder) return;
      _this._current_media_folder = media_folder;

      if ('_success' in rslt) {
        //Populate arrays + Render
        
        _this.media_files = rslt[emodelid];
        _.each(_this.media_files, function(media_file){
          media_file.media_uptstmp_raw = moment(media_file.media_uptstmp).valueOf();
        });
        _this.selected_media_key = null;
        var newScroll = 0;
        if(sameFolder) newScroll = $('.'+xmodel.class+'_file_listing_scroll').scrollTop();
        _this.renderListing();
        $('.'+xmodel.class+'_file_listing_scroll').scrollTop(newScroll);
        if (onComplete) onComplete();
      }
      else XExt.Alert('Error while loading data');
    }, function (err) { });
  }

  this.renderListing = function(){
    //Sort Files
    var sorted_media_files = [].concat(_this.media_files);
    var sort_key = _this.SORT_KEY[_this.state.file_sort.substr(1)];
    var sort_dir = (_this.state.file_sort[0]=='v'?-1:1);
    sorted_media_files.sort(function(a,b){
      var aval = a[sort_key];
      var bval = b[sort_key];
      if(aval > bval) return sort_dir*1;
      else if(aval < bval) return sort_dir*-1;
      return 0;
    });

    //Render Files
    var tmpl = jsh.$root('.'+xmodel.class+'_file_listing_template_'+_this.state.file_view).html();
    var jcontainer = jsh.$root('.'+xmodel.class+'_file_listing');
    jcontainer.html(XExt.renderClientEJS(tmpl, { media_files: sorted_media_files, _: _, jsh: jsh }));
    _this.bindEventsListing();
    _this.selectFile(_this.selected_media_key);

    //Update group buttons
    jsh.$root('.xform_button_group_SortBy .xform_button_caption').text('Sort By: '+_this.SORT[_this.state.file_sort.substr(1)]);
    jsh.$root('.xform_button_group_View .xform_button_caption').text('View: '+_this.VIEW[_this.state.file_view]);
  }

  this.bindEventsListing = function(){
    var jcontainer = jsh.$root('.'+xmodel.class+'_file_listing');
    if(_this.state.file_view=='tiles'){
      var jfiles = jcontainer.find('.'+xmodel.class+'_file_tile');
      jfiles.on('click', function(e){ 
        _this.selectFile($(this).data('key'));
        e.preventDefault();
        e.stopImmediatePropagation();
      });
      jfiles.contextmenu(function (e) {
        e.preventDefault();
        e.stopPropagation();
        XExt.ShowContextMenu('.'+xmodel.class+'_file_context_menu', $(this).data('key'));
      });
    }
    else if(_this.state.file_view=='details'){
      var jfiles = jcontainer.find('.'+xmodel.class+'_file_listing_tbl tbody tr');
      jfiles.on('click', function(e){ 
        _this.selectFile($(this).data('key'));
        e.preventDefault();
        e.stopImmediatePropagation();
      });
      jfiles.contextmenu(function (e) {
        e.preventDefault();
        e.stopPropagation();
        XExt.ShowContextMenu('.'+xmodel.class+'_file_context_menu', $(this).data('key'));
      });
      jcontainer.find('.'+xmodel.class+'_file_listing_tbl thead th[data-sort]').on('click', function(e){ 
        _this.setSort($(this).data('sort'));
        e.preventDefault();
        e.stopImmediatePropagation();
      });
    }
    jcontainer.on('click', function(e){
      _this.selectFile(null);
    });
  }

  this.getMediaFile = function(media_key){
    for(var i=0;i<_this.media_files.length;i++){
      if(_this.media_files[i].media_key == media_key) return _this.media_files[i];
    }
    return undefined;
  }

  this.selectFile = function(media_key, options){
    options = _.extend({ scrollIntoView: false }, options);
    _this.selected_media_key = media_key||null;
    var jcontainer = jsh.$root('.'+xmodel.class+'_file_listing');
    jcontainer.find('.selected').removeClass('selected');
    if(_this.state.file_view=='tiles'){
      if(media_key) jcontainer.find('.'+xmodel.class+'_file_tile[data-key='+media_key+']').addClass('selected');
    }
    else if(_this.state.file_view=='details'){
      if(media_key) jcontainer.find('.'+xmodel.class+'_file_listing_tbl tbody tr[data-key='+media_key+']').addClass('selected');
    }
    var media_file = _this.getMediaFile(media_key);
    _this.renderInfo(media_file);
    if(options.scrollIntoView){
      var jselected = jcontainer.find('.selected');
      if(jselected.length) jselected[0].scrollIntoView();
    }
  }

  this.renderInfo = function(media_file){
    //Render Files
    var tmpl = jsh.$root('.'+xmodel.class+'_file_info_template').html();
    var jcontainer = jsh.$root('.'+xmodel.class+'_file_info');

    jcontainer.html(XExt.renderClientEJS(tmpl, { media_file: media_file, _: _, jsh: jsh }));
    _this.bindEventsInfo();
  }

  this.toggleSidebar = function(){
    jsh.$root('.'+xmodel.class+'_file_info').toggle();
  }

  this.bindEventsInfo = function(){
    var jcontainer = jsh.$root('.'+xmodel.class+'_file_info');

    var jpreview = jsh.$root('.'+xmodel.class+'_file_info_preview');
    jpreview.on('click', function(){
      var media_file = _this.getMediaFile(_this.selected_media_key);
      if(_.includes(['.jpg','.jpeg','.tif','.tiff','.png','.gif','.pdf'], media_file.media_ext.toLowerCase())){
        var url = jsh._BASEURL+'_funcs/media/'+media_file.media_key+'/';
        var ww = 800;
        var wh = 600;
        if(media_file.media_width && media_file.media_height){
          var wwr = media_file.media_width / ww;
          var whr = media_file.media_height / wh;
          if((wwr <=1) && (whr <= 1)){ ww = media_file.media_width; wh = media_file.media_height; }
          else if(wwr > whr) wh = media_file.media_height / wwr;
          else ww = media_file.media_width / whr;
        }
        ww = Math.floor(ww);
        wh = Math.floor(wh);
        window.open(url,'_blank',"height="+wh+", width="+ww);
      }
      else {
        var url = jsh._BASEURL+'_funcs/media/'+media_file.media_key+'/?download';
        jsh.getFileProxy().prop('src', url);
      }
    });

    jsh.$root('.'+xmodel.class+'_file_info_download').on('click', function(){
      _this.downloadFile(_this.selected_media_key);
    });

    jsh.$root('.'+xmodel.class+'_file_info_delete').on('click', function(){
      _this.deleteFile(_this.selected_media_key);
    });

    jsh.$root('.'+xmodel.class+'_file_info_rename').on('click', function(){
      _this.renameFile(_this.selected_media_key);
    });
  }

  this.downloadFile = function(media_key){
    var url = jsh._BASEURL+'_funcs/media/'+media_key+'/?download';
    jsh.getFileProxy().prop('src', url);
  }

  this.renameFile = function(media_key){
    var media_file = _this.getMediaFile(media_key);
    var media_path = media_file.media_path;
    var media_ext = media_file.media_ext;
    var base_filename = media_file.media_filename;
    base_filename = base_filename.substr(0, base_filename.length - media_ext.length).trim();
    XExt.Prompt('Please enter a new file name', base_filename, function (rslt) {
      if(rslt === null) return;
      rslt = rslt.trim();
      if(rslt == base_filename) return;
      if(XExt.cleanFileName(rslt) != rslt) return XExt.Alert('Please enter a valid filename');
      XForm.Post(jsh._BASEURL+'_funcs/media/'+media_file.media_key,{},{ media_path: media_file.media_folder + rslt + media_ext }, function(){
        _this.getMediaFileListing({ force: true }, function(){
          _this.selectFile(media_file.media_key, { scrollIntoView: true });
        });
      });
    });
  }

  this.moveFile = function(media_key){
    var media_file = _this.getMediaFile(media_key);
    var media_path = media_file.media_path;
    var media_ext = media_file.media_ext;
    //base_path = base_path.substr(0, base_path.length - media_file.media_ext.length);
    XExt.Prompt('Please enter a new path', media_path, function (rslt) {
      if(rslt === null) return;
      rslt = rslt.trim();
      if(rslt == media_path) return;
      if(rslt[0] != '/') return XExt.Alert('Path must start with "/"');
      if((rslt.length < media_ext.length) || (rslt.substr(rslt.length-media_ext.length) != media_ext)) return XExt.Alert('Cannot modify file extension');
      XForm.Post(jsh._BASEURL+'_funcs/media/'+media_file.media_key,{},{ media_path: rslt }, function(){
        _this.getMediaFileListing({ force: true }, function(){
          jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} }, function(){
            _this.selectFile(media_file.media_key, { scrollIntoView: true });
          });
        });
      });
    });
  }

  this.deleteFile = function(media_key){
    var media_file = _this.getMediaFile(media_key);
    XExt.Confirm('Are you sure you want to delete "'+media_file.media_filename+'"?', function (rslt) {
      XForm.Delete(jsh._BASEURL+'_funcs/media/'+media_file.media_key,{},{}, function(){
        _this.getMediaFileListing({ force: true });
      });
    });
  }

  this.addFile = function(){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before adding media');

    //if(typeof page_folder == 'undefined') page_folder = xmodel.get('page_folder');
    var xform = xmodel.controller.form;
    var sel = '.'+xmodel.class+'_AddMedia';

    XExt.CustomPrompt(sel, jsh.$root(sel)[0].outerHTML, function () { //onInit
      var jprompt = jsh.$root('.xdialogblock ' + sel);

      jprompt.off('.file_upload');
      jprompt.on('dragenter.file_upload', _this.file_listing_onDragEnter);
      jprompt.on('dragleave.file_upload', _this.file_listing_onDragLeave);
      jprompt.on('dragover.file_upload', _this.file_listing_onDragOver);
      jprompt.on('drop.file_upload', _this.file_listing_onDrop);
      jprompt.find('.media_upload').off('change');
      XExt.clearFileInput(jprompt.find('.media_upload')[0]);
      jprompt.find('.media_upload').on('change', function(e){
        _this.uploadFiles(this.files);
      });
    }, function (success) { //onAccept
    }, undefined, undefined, { backgroundClose: true });
  }

  this.addFolder = function(parent_media_folder){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before adding a folder');

    XExt.Prompt('Please enter the subfolder name', '', function (rslt) {
      if(!rslt || !rslt.trim()) return;
      var media_path = parent_media_folder + rslt.trim() + '/';
      if(XExt.cleanFileName(rslt) != rslt) return XExt.Alert('Please enter a valid filename');
      XForm.Post(xmodel.namespace+'Media_Tree_Folder_Add',{},{ media_path: media_path }, function(){
        _this.setFolderBeforeLoad(media_path);
        jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} });
      });
    });
  }

  this.renameFolder = function(media_folder){
    //Get new folder name
    var base_folder_name = XExt.basename(media_folder);
    if(!base_folder_name) return XExt.Alert('Cannot rename this folder');
    //Update all paths to new paths
    XExt.Prompt('Please enter a new folder name', base_folder_name, function (rslt) {
      if(rslt === null) return;
      rslt = rslt.trim();
      if(rslt == base_folder_name) return;
      if(XExt.cleanFileName(rslt) != rslt) return XExt.Alert('Please enter a valid folder name');

      var new_media_folder = XExt.dirname(media_folder) + '/' + rslt + '/';
      XForm.Post(xmodel.namespace+'Media_Tree_Folder_Move',{},{ old_media_folder:media_folder, new_media_folder: new_media_folder }, function(){
        _this.setFolderBeforeLoad(new_media_folder);
        jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} });
      });
    });
  }

  this.moveFolder = function(media_folder){
    //Get new folder name
    //Update all paths to new paths
    XExt.Prompt('Please enter a new path', media_folder, function (rslt) {
      if(rslt === null) return;
      rslt = rslt.trim();
      if(rslt == media_folder) return;
      if(rslt[0] != '/') return XExt.Alert('Path must start with "/"');
      if(rslt.indexOf('//') >=0 ) return XExt.Alert('Invalid path');
      if(rslt.indexOf('/./') >=0 ) return XExt.Alert('Invalid path');
      if(rslt.indexOf('/../') >=0 ) return XExt.Alert('Invalid path');
      if(rslt[rslt.length-1] != '/') rslt += '/';
      XForm.Post(xmodel.namespace+'Media_Tree_Folder_Move',{},{ old_media_folder:media_folder, new_media_folder: rslt }, function(){
        _this.setFolderBeforeLoad(rslt);
        jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} });
      });
    });
  }

  this.deleteFolder = function(media_folder){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before deleting a folder');

    var parent_folder = XExt.dirname(media_folder)+'/';

    XExt.Confirm('Are you sure you want to delete "'+media_folder+'" and all of its contents?', function (rslt) {
      XForm.Post(xmodel.namespace+'Media_Tree_Folder_Delete',{},{ media_folder: media_folder }, function(){
        _this.setFolderBeforeLoad(parent_folder);
        jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} });
      });
    });
  }

})();
