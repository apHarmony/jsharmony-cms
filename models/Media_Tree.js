jsh.App[modelid] = new (function(){
  var _this = this;

  this.SORT = { 'filename': 'File Name', 'date': 'Date', 'description': 'Description', 'size': 'Size' , 'type': 'Type' };
  this.SORT_KEY = { 'filename': 'media_filename', 'date': 'media_uptstmp_raw', 'description': 'media_desc', 'size': 'media_size' , 'type': 'media_ext' };
  this.VIEW = { 'tiles': 'Tiles', 'details': 'Details' };

  this.media_files = [];
  this.selected_media_key = null;
  this.selected_media_file = null;
  this.state_default = {
    media_folder: null,
    file_view: 'tiles',
    file_sort: '^filename'
  };
  this.state = _.extend({}, this.state_default);
  this._current_media_folder = null;
  this.loadobj = {};
  this.isInEditor = false;

  this.oninit = function(){
    jsh.System.RequireBranch(xmodel);
    if(this.isInEditor){
      jsh.$root('.xbody').addClass('InEditor');
    }

    $(window).bind('resize', _this.onresize);
    _this.refreshLayout();
    _this.renderInfo();
    var jFileListing = jsh.$root('.'+xmodel.class+'_file_listing');
    jFileListing.on('dragenter', _this.file_listing_onDragEnter);
    jFileListing.on('dragleave', _this.file_listing_onDragLeave);
    jFileListing.on('dragover', _this.file_listing_onDragOver);
    jFileListing.on('drop', _this.file_listing_onDrop.bind(jFileListing[0], null));
  }

  this.ondestroy = function(xmodel){
    $(window).unbind('resize', _this.onresize);
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

  this.file_listing_onDrop = function(replace_media_key, e){
    var jobj = $(this);
    _this.file_listing_dragCounter = 0;
    jobj.removeClass('dragOver');
    e.preventDefault();
    e.stopPropagation();

    if(!XExt.hasAction(xmodel.actions, 'I')){
      return XExt.Alert('Upload permission denied');
    }
    var srcevent = e.originalEvent;
    if(srcevent && srcevent.dataTransfer && srcevent.dataTransfer.files){
      if(replace_media_key){
        _this.uploadReplacementFile(replace_media_key, srcevent.dataTransfer.files);
      }
      else{
        _this.uploadFiles(_this._current_media_folder, srcevent.dataTransfer.files);
      }
    }
  }

  this.uploadFiles = function(media_folder, files, cb){
    XExt.clearDialogs();
    var media_keys = [];
    jsh.async.eachSeries(files, function(file, file_cb){
      _this.uploadFile(media_folder, file, function(err, rslt){
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

  this.uploadFile = function(media_folder, file, cb){
    var fd = new FormData();
    fd.append('media_file', file, file.name);
    fd.append('media_path', media_folder + file.name);

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
      error: function (err) { jsh.xLoader.StopLoading(_this.loadobj); XExt.Alert('Error uploading file: '+XExt.stringify(err)); }
    });
  }

  this.uploadReplacementFile = function(media_key, files, cb){
    if(files.length==0) return XExt.Alert('Please select a file for upload');
    XExt.clearDialogs();
    if(files.length > 1) return XExt.Alert('Please select only one file for for upload');

    var file = files[0];
    var fd = new FormData();
    fd.append('media_file', file, file.name);

    jsh.xLoader.StartLoading(_this.loadobj);
    $.ajax({
      url: jsh._BASEURL + '_funcs/media/' + media_key + '/',
      data: fd,
      processData: false,
      contentType: false,
      type: 'POST',
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
          //Merge data back in to local file
          var existing_media_file = _this.getMediaFile(media_key);
          if(existing_media_file){
            existing_media_file = _.extend(existing_media_file, jdata.media);
          }
          //Refresh images & listing
          _this.renderListing();
        }
        else {
          jsh.XExt.Alert('Error Uploading File: ' + JSON.stringify(jdata ? jdata : ''));
        }
      },
      error: function (err) { jsh.xLoader.StopLoading(_this.loadobj); XExt.Alert('Error uploading file: '+XExt.stringify(err)); }
    });
  }

  this.onload = function(){
    _this.refreshLayout();
    _this.getMediaFileListing();
  }

  this.onresize = function(){ _this.refreshLayout(); }

  this.ongetstate = function(){ return _this.state; }

  this.onloadstate = function(xmodel, state){
    _this.state = _.extend({}, _this.state_default, _this.state, state);
    if(_this.state.media_folder !== null) this.setFolderBeforeLoad(_this.state.media_folder);
  }

  this.setFolderBeforeLoad = function(media_folder){
    xmodel.controller.form.Data['media_folder'] = media_folder;
    xmodel.saveUnboundFields(xmodel.controller.form.Data);
  }

  this.refreshLayout = function(){
    var jbrowser = $('.'+xmodel.class+'_browser');

    if(!jbrowser.length) return;

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
          media_file._is_dirty = false;
        });
        var newScroll = 0;
        if(sameFolder) newScroll = $('.'+xmodel.class+'_file_listing_scroll').scrollTop();
        _this.renderListing({ refresh_sidebar: false });
        _this.selectFile(null);
        $('.'+xmodel.class+'_file_listing_scroll').scrollTop(newScroll);
        if (onComplete) onComplete();
      }
      else XExt.Alert('Error while loading data');
    }, function (err) { });
  }

  this.renderListing = function(options){
    options = _.extend({ refresh_sidebar: true }, options);

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
    var tmpl = jsh.$root('.'+xmodel.class+'_template_file_listing_'+_this.state.file_view).html();
    var jcontainer = jsh.$root('.'+xmodel.class+'_file_listing');
    jcontainer.html(XExt.renderClientEJS(tmpl, { media_files: sorted_media_files, _: _, jsh: jsh }));
    _this.bindEventsListing();
    if(options.refresh_sidebar) _this.selectFile(_this.selected_media_key);

    //Update group buttons
    jsh.$root('.xform_button_group_SortBy .xform_button_caption').text('Sort By: '+_this.SORT[_this.state.file_sort.substr(1)]);
    jsh.$root('.xform_button_group_View .xform_button_caption').text('View: '+_this.VIEW[_this.state.file_view]);
  }

  this.bindEventsListing = function(){
    var jcontainer = jsh.$root('.'+xmodel.class+'_file_listing');
    if(_this.state.file_view=='tiles'){
      var jfiles = jcontainer.find('.'+xmodel.class+'_file_tile');
      jfiles.on('click', function(e){ 
        XExt.HideContextMenu();
        _this.selectFile($(this).data('key'));
        $(this).focus();
        e.preventDefault();
        e.stopImmediatePropagation();
      });
      if(_this.isInEditor) jfiles.on('dblclick', function(e){
        XExt.HideContextMenu();
        _this.sendToEditor($(this).data('key'));
        e.preventDefault();
        e.stopImmediatePropagation();
      });
      jfiles.contextmenu(function(e){
        e.preventDefault();
        e.stopPropagation();
        XExt.ShowContextMenu('.'+xmodel.class+'_file_context_menu', $(this).data('key'));
      });
      jfiles.on('keyup', function(e){
        if(e.keyCode==46){ //Delete key
          _this.deleteFile($(this).data('key'));
        }
      });
      XExt.bindDragSource(jfiles);
    }
    else if(_this.state.file_view=='details'){
      var jfiles = jcontainer.find('.'+xmodel.class+'_file_listing_tbl tbody tr');
      jfiles.on('click', function(e){ 
        _this.selectFile($(this).data('key'));
        e.preventDefault();
        e.stopImmediatePropagation();
      });
      if(_this.isInEditor) jfiles.on('dblclick', function(e){
        _this.sendToEditor($(this).data('key'));
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
      XExt.bindDragSource(jfiles.find('.media_filename a'));
    }
    jcontainer.on('click', function(e){
      _this.selectFile(null);
    });
    jcontainer.off('contextmenu').on('contextmenu',function(e){
      e.preventDefault();
      e.stopPropagation();
      XExt.ShowContextMenu('.'+xmodel.class+'_file_container_context_menu', _this._current_media_folder);
    });
  }

  this.getMediaFile = function(media_key){
    for(var i=0;i<_this.media_files.length;i++){
      if(_this.media_files[i].media_key == media_key) return _this.media_files[i];
    }
    return undefined;
  }

  this.selectFile = function(media_key, options){
    options = _.extend({ scrollIntoView: undefined, force: false }, options);
    if((media_key != _this.selected_media_key) && _this.selected_media_file && !options.force){
      if(_this.selected_media_file._is_dirty){
        return XExt.Confirm('Save changes to previous media file information?', function(){ //Yes
          _this.saveMediaFileInfo(_this.selected_media_file, function(){
            _this.selectFile(media_key, options);
          });
        }, function(){ //No
          _this.selectFile(media_key, _.extend(options, { force: true }));
        });
      }
    }
    _this.selected_media_key = media_key||null;
    _this.selected_media_file = (media_key ? _.extend({}, _this.getMediaFile(media_key)) : null);
    var jcontainer = jsh.$root('.'+xmodel.class+'_file_listing');
    jcontainer.find('.selected').removeClass('selected');
    if(_this.state.file_view=='tiles'){
      if(media_key) jcontainer.find('.'+xmodel.class+'_file_tile[data-key='+media_key+']').addClass('selected');
    }
    else if(_this.state.file_view=='details'){
      if(media_key) jcontainer.find('.'+xmodel.class+'_file_listing_tbl tbody tr[data-key='+media_key+']').addClass('selected');
    }
    _this.renderInfo(_this.selected_media_file);
    if(options.scrollIntoView){
      var jselected = jcontainer.find('.selected');
      if(jselected.length) jselected[0].scrollIntoView();
    }
  }

  this.viewFileDetails = function(media_key){
    _this.toggleSidebar(true);
    _this.selectFile(media_key, { scrollIntoView: true });
  }

  this.renderInfo = function(media_file){
    //Render Files
    var tmpl = jsh.$root('.'+xmodel.class+'_template_file_info').html();
    var jcontainer = jsh.$root('.'+xmodel.class+'_file_info');

    jcontainer.html(XExt.renderClientEJS(tmpl, { media_file: media_file, _: _, jsh: jsh }));

    if(media_file){
      if(XExt.hasAction(xmodel.actions, 'U')){
        jcontainer.find('.media_desc').val(media_file.media_desc);
        XExt.RenderLOV(null, jcontainer.find('.media_type'), xmodel.controller.form.LOVs.media_type);
        jcontainer.find('.media_type').val(media_file.media_type);
        XExt.TagBox_Render(jcontainer.find('.media_tags_editor'), jcontainer.find('.media_tags'));
        jcontainer.find('.media_tags').val(media_file.media_tags);
        XExt.TagBox_Refresh(jcontainer.find('.media_tags_editor'), jcontainer.find('.media_tags'));
      }
      else {
        jcontainer.find('.media_desc').text(media_file.media_desc);
        jcontainer.find('.media_type').text(XExt.getLOVTxt(xmodel.controller.form.LOVs.media_type, media_file.media_type));
        jcontainer.find('.media_tags').text(media_file.media_tags);
      }
    }
    _this.bindEventsInfo();
  }

  this.toggleSidebar = function(show){
    var jinfo = jsh.$root('.'+xmodel.class+'_file_info');
    if(typeof show == 'undefined') show = !_this.isSidebarVisible();
    if(!show) jinfo.css('display','none');
    else jinfo.css('display','flex');
  }

  this.isSidebarVisible = function(){
    return jsh.$root('.'+xmodel.class+'_file_info').is(':visible');
  }

  this.bindEventsInfo = function(){
    var jcontainer = jsh.$root('.'+xmodel.class+'_file_info');

    var jpreview = jsh.$root('.'+xmodel.class+'_file_info_preview');
    jpreview.on('click', function(e){
      _this.previewFile(_this.selected_media_file);
      e.preventDefault();
    });

    jsh.$root('.'+xmodel.class+'_file_info_download').on('click', function(e){
      _this.downloadFile(_this.selected_media_key);
      e.preventDefault();
    });

    jsh.$root('.'+xmodel.class+'_file_info_replace').on('click', function(e){
      _this.replaceFile(_this.selected_media_key);
      e.preventDefault();
    });

    jsh.$root('.'+xmodel.class+'_file_info_delete').on('click', function(e){
      _this.deleteFile(_this.selected_media_key);
      e.preventDefault();
    });

    jsh.$root('.'+xmodel.class+'_file_info_rename').on('click', function(e){
      _this.renameFile(_this.selected_media_key);
      e.preventDefault();
    });

    jsh.$root('.'+xmodel.class+'_file_info_view_revisions').on('click', function(e){
      _this.viewRevisions(_this.selected_media_key);
      e.preventDefault();
    });

    jcontainer.find('.media_desc').on('input keyup', function(){
      _this.setMediaProp('media_desc', $(this).val());
    });

    jcontainer.find('.media_type').on('input keyup', function(){
      _this.setMediaProp('media_type', $(this).val());
    });

    jcontainer.find('.media_tags').on('input keyup', function(){
      _this.setMediaProp('media_tags', $(this).val());
    });

    jcontainer.find('.save_changes').on('click', function(e){
      _this.saveMediaFileInfo();
      e.preventDefault();
    });
  }

  var saveMediaFileInfo_lock = false;
  this.saveMediaFileInfo = function(media_file, onComplete){
    if(!media_file) media_file = _this.selected_media_file;
    if(!onComplete) onComplete = function(rslt){};
    if(!media_file) return;
    if(!media_file._is_dirty) return;
    if(saveMediaFileInfo_lock) return;
    saveMediaFileInfo_lock = true;
    var params = {
      media_path: media_file.media_path,
      media_desc: media_file.media_desc,
      media_type: media_file.media_type,
      media_tags: media_file.media_tags
    };
    XForm.Post(xmodel.namespace+'Media_Tree_Info', { media_key: media_file.media_key }, params, function(rslt){
      saveMediaFileInfo_lock = false;
      _this.setInfoDirty(media_file, false, function(){
        //Get new data from database
        _this.loadInfo(media_file.media_key, onComplete);
      });
    }, function(err){
      saveMediaFileInfo_lock = false;
    });
  }

  this.loadInfo = function(media_key, onComplete){
    var infoModel = xmodel.namespace+'Media_Tree_Info';
    XForm.Get(infoModel, { media_key: media_key }, {}, function(rslt){
      if(rslt && rslt[infoModel]){
        var existing_media_file = _this.getMediaFile(media_key);
        existing_media_file = _.extend(existing_media_file, rslt[infoModel]);
      }
      _this.renderListing();
      if(onComplete) onComplete(rslt);
    });
  }

  this.setInfoDirty = function(media_file, isDirty, cb){
    if(!cb) cb = function(){};
    media_file._is_dirty = isDirty;
    if(media_file == _this.selected_media_file){
      var jSaveChanges = jsh.$root('.'+xmodel.class+'_file_info .save_changes');
      if(jSaveChanges.is(':visible')){
        //Hide "Save Changes"
        if(!isDirty) return jSaveChanges.parent().stop(true).slideUp(400, cb);
      }
      else{
        //Show "Save Changes"
        if(isDirty) return jSaveChanges.parent().stop(true).slideDown(400, cb);
      }
    }
    return cb();
  }

  this.setMediaProp = function(key, val){
    if(!_this.selected_media_file) return;
    if(_this.selected_media_file[key] == val) return;
    _this.selected_media_file[key] = val;
    _this.setInfoDirty(_this.selected_media_file, true);
  }

  this.previewFile = function(media_file){ /* { media_ext, media_id, media_width, media_height, media_key } */
    jsh.System.PreviewMedia(media_file.media_key, undefined, media_file.media_id, media_file.media_ext, media_file.media_width, media_file.media_height);
  }

  this.downloadFile = function(media_key){
    var media_file = _this.getMediaFile(media_key);
    var url = jsh._BASEURL+'_funcs/media/'+media_file.media_key+'/?download&media_file_id='+media_file.media_file_id;
    jsh.getFileProxy().prop('src', url);
  }

  this.viewRevisions = function(media_key){
    if(!_this.checkChangesInfo(media_key, function(){ _this.replaceFile(media_key) })) return;
    var media_file = _this.getMediaFile(media_key);

    xmodel.set('revision_media_key', media_key);
    xmodel.set('revision_media_id', media_file.media_id);
    jsh.XExt.popupShow(xmodel.namespace + 'Media_Revision_Listing','revision_media','Revisions',undefined,jsh.$root('.xform'+xmodel.class+' .revision_media_xlookup')[0],{
      OnControlUpdate:function(obj, rslt){
        if(rslt && rslt.result){
          var media_id = rslt.result;
          XForm.Post(xmodel.namespace+'Media_Revision_Update',{},{ media_key: media_key, media_id: media_id }, function(){
            _this.loadInfo(media_key);
          });
        }
      }
    });
  }

  this.checkChangesInfo = function(new_media_key, retry){
    if((new_media_key == _this.selected_media_key) && _this.selected_media_file){
      if(_this.selected_media_file._is_dirty){
        XExt.Confirm('Save changes to current media file information?', function(){ //Yes
          _this.saveMediaFileInfo(_this.selected_media_file, function(){
            _this.selectFile(_this.selected_media_key);
            retry();
          });
        }, function(){ //No
          _this.selectFile(_this.selected_media_key, { force: true });
          retry();
        });
        return false;
      }
    }
    return true;
  }

  this.replaceFile = function(media_key){
    //Save any pending changes to a media file before replacing
    if(!_this.checkChangesInfo(media_key, function(){ _this.replaceFile(media_key) })) return;

    var media_file = (media_key == _this.selected_media_key) ? _this.selected_media_file : _this.getMediaFile(media_key);
    var xform = xmodel.controller.form;
    var sel = '.'+xmodel.class+'_ReplaceMedia';

    XExt.CustomPrompt(sel, jsh.$root(sel)[0].outerHTML, function () { //onInit
      var jprompt = jsh.$root('.xdialogblock ' + sel);

      jprompt.off('.file_upload');
      jprompt.on('dragenter.file_upload', _this.file_listing_onDragEnter);
      jprompt.on('dragleave.file_upload', _this.file_listing_onDragLeave);
      jprompt.on('dragover.file_upload', _this.file_listing_onDragOver);
      jprompt.on('drop.file_upload', _this.file_listing_onDrop.bind(jprompt[0], media_key));
      jprompt.find('.media_upload').off('change');
      XExt.clearFileInput(jprompt.find('.media_upload')[0]);
      jprompt.find('.media_upload').on('change', function(e){
        _this.uploadReplacementFile(media_key, this.files);
      });
    }, function (success) { //onAccept
    }, undefined, undefined, { backgroundClose: true });
  }

  this.renameFile = function(media_key){
    var media_file = (media_key == _this.selected_media_key) ? _this.selected_media_file : _this.getMediaFile(media_key);
    var media_path = media_file.media_path;
    var media_ext = media_file.media_ext;
    var base_filename = media_file.media_filename;
    base_filename = base_filename.substr(0, base_filename.length - media_ext.length).trim();
    var retry = function(){ _this.renameFile(media_key); };
    XExt.Prompt('Please enter a new file name', base_filename, function (rslt) {
      if(rslt === null) return;
      rslt = rslt.trim();
      if(rslt == base_filename) return;
      if(!rslt) return XExt.Alert('Please enter a file name', retry);
      if(XExt.cleanFileName(rslt) != rslt) return XExt.Alert('Please enter a valid filename', retry);
      media_file.media_path = media_file.media_folder + rslt + media_ext;
      media_file._is_dirty = true;
      _this.saveMediaFileInfo(media_file, function(){
        _this.getMediaFileListing({ force: true }, function(){
          _this.selectFile(media_file.media_key, { scrollIntoView: true });
        });
      });
    });
  }

  this.moveFile = function(media_key, new_media_path){
    new_media_path = new_media_path||'';
    var media_file = (media_key == _this.selected_media_key) ? _this.selected_media_file : _this.getMediaFile(media_key);
    var media_path = media_file.media_path;
    var media_ext = media_file.media_ext;
    //base_path = base_path.substr(0, base_path.length - media_file.media_ext.length);

    XExt.execif(!new_media_path,
      function(f){
        var retry = function(){ _this.moveFile(media_key); };
        XExt.Prompt('Please enter a new path', media_path, function (rslt) {
          if(rslt === null) return;
          rslt = rslt.trim();
          if(rslt == media_path) return;
          if(!rslt) return XExt.Alert('Please enter a file path', retry);
          if(rslt[0] != '/') return XExt.Alert('Path must start with "/"', retry);
          if((rslt.length < media_ext.length) || (rslt.substr(rslt.length-media_ext.length) != media_ext)) return XExt.Alert('Cannot modify file extension', retry);
          new_media_path = rslt;
          f();
        });
      },
      function(){
        media_file.media_path = new_media_path;
        media_file._is_dirty = true;
        _this.saveMediaFileInfo(media_file, function(){
          _this.getMediaFileListing({ force: true }, function(){
            _this.setFolderBeforeLoad(_this._current_media_folder);
            jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} }, function(){
              _this.selectFile(media_file.media_key, { scrollIntoView: true });
            });
          });
        });
      }
    );
  }

  this.deleteFile = function(media_key){
    var media_file = _this.getMediaFile(media_key);
    if(!media_file) return XExt.Alert('Media file not found');
    XExt.Confirm('Are you sure you want to delete "'+media_file.media_filename+'"?', function (rslt) {
      XForm.Delete(jsh._BASEURL+'_funcs/media/'+media_file.media_key,{},{}, function(){
        _this.getMediaFileListing({ force: true });
      });
    });
  }

  this.addFile = function(media_folder){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before adding media');

    if(typeof media_folder == 'undefined') media_folder = xmodel.get('media_folder');
    var xform = xmodel.controller.form;
    var sel = '.'+xmodel.class+'_AddMedia';

    XExt.CustomPrompt(sel, jsh.$root(sel)[0].outerHTML, function () { //onInit
      var jprompt = jsh.$root('.xdialogblock ' + sel);

      jprompt.off('.file_upload');
      jprompt.on('dragenter.file_upload', _this.file_listing_onDragEnter);
      jprompt.on('dragleave.file_upload', _this.file_listing_onDragLeave);
      jprompt.on('dragover.file_upload', _this.file_listing_onDragOver);
      jprompt.on('drop.file_upload', _this.file_listing_onDrop.bind(jprompt[0], null));
      jprompt.find('.media_upload').off('change');
      XExt.clearFileInput(jprompt.find('.media_upload')[0]);
      jprompt.find('.media_upload').on('change', function(e){
        _this.uploadFiles(media_folder, this.files);
      });
    }, function (success) { //onAccept
    }, undefined, undefined, { backgroundClose: true });
  }

  this.addFolder = function(parent_media_folder){
    if (jsh.XPage.GetChanges().length) return XExt.Alert('Please save all changes before adding a folder');

    var retry = function(){ _this.addFolder(parent_media_folder); };
    XExt.Prompt('Please enter the subfolder name', '', function (rslt) {
      if(rslt === null) return;
      rslt = rslt.trim();
      if(!rslt) return XExt.Alert('Please enter a folder name', retry);
      var media_path = parent_media_folder + rslt.trim() + '/';
      if(XExt.cleanFileName(rslt) != rslt) return XExt.Alert('Please enter a valid folder name');
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
    var retry = function(){ _this.renameFolder(media_folder); };
    XExt.Prompt('Please enter a new folder name', base_folder_name, function (rslt) {
      if(rslt === null) return;
      rslt = rslt.trim();
      if(rslt == base_folder_name) return;
      if(!rslt) return XExt.Alert('Please enter a folder name', retry);
      if(XExt.cleanFileName(rslt) != rslt) return XExt.Alert('Please enter a valid folder name');

      var new_media_folder = XExt.dirname(media_folder) + '/' + rslt + '/';
      XForm.Post(xmodel.namespace+'Media_Tree_Folder_Move',{},{ old_media_folder:media_folder, new_media_folder: new_media_folder }, function(){
        _this.setFolderBeforeLoad(new_media_folder);
        jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} });
      });
    });
  }

  this.moveFolder = function(old_media_folder, new_media_folder){
    new_media_folder = new_media_folder||'';

    XExt.execif(!new_media_folder,
      function(f){
        //Get new folder name
        //Update all paths to new paths
        var retry = function(){ _this.moveFolder(old_media_folder); };
        XExt.Prompt('Please enter a new path', old_media_folder, function (rslt) {
          if(rslt === null) return;
          rslt = rslt.trim();
          if(rslt == old_media_folder) return;
          if(!rslt) return XExt.Alert('Please enter a folder path', retry);
          if(rslt[0] != '/') return XExt.Alert('Path must start with "/"');
          if(rslt.indexOf('//') >=0 ) return XExt.Alert('Invalid path');
          if(rslt.indexOf('/./') >=0 ) return XExt.Alert('Invalid path');
          if(rslt.indexOf('/../') >=0 ) return XExt.Alert('Invalid path');
          if(rslt[rslt.length-1] != '/') rslt += '/';
          new_media_folder = rslt;
          f();
        });
      },
      function(){
        XForm.Post(xmodel.namespace+'Media_Tree_Folder_Move',{},{ old_media_folder: old_media_folder, new_media_folder: new_media_folder }, function(){
          _this.setFolderBeforeLoad(new_media_folder);
          jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} });
        });
      }
    );
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

  this.sendToEditor = function(media_key){
    var media_file = _this.getMediaFile(media_key);

    if(window.opener && jsh._GET.CKEditor){
      window.opener.postMessage('ckeditor:'+JSON.stringify({ media_key: media_key, media_file_id: media_file.media_file_id, CKEditorFuncNum: jsh._GET.CKEditorFuncNum }), '*');
      window.close();
    }
    else{
      if(!window.opener) return XExt.Alert('Parent editor not found');
      window.opener.postMessage('cms_file_picker:'+JSON.stringify({ media_key: media_key, media_file_id: media_file.media_file_id, media_desc: media_file.media_desc, media_path: media_file.media_path }), '*');
      window.close();
    }
  }

  this.media_folder_ondrop = function(dropval, anchor, e) {
    if(!XExt.hasAction(xmodel.actions,'U')) return;
    if(!dropval) return;

    var media_folder = dropval;

    var srcevent = e.originalEvent;
    if(srcevent && srcevent.dataTransfer && srcevent.dataTransfer.files){
      _this.uploadFiles(media_folder, srcevent.dataTransfer.files, function(){
        _this.setFolderBeforeLoad(media_folder);
        jsh.XPage.Select({ modelid: xmodel.id, onCancel: function(){} });
      });
    }
  }
  
  this.media_folder_onmove = function(dragval, dropval, anchor, e) {
    if(!XExt.hasAction(xmodel.actions,'U')) return;
    if(!dragval || !dropval) return;
    dragval = dragval.toString();
    dropval = dropval.toString();

    if(dragval=='/') return XExt.Alert('Cannot move root folder');

    if(dragval.indexOf('media_key:')==0){
      //Moving file
      var media_key = parseInt(dragval.substr(10));
      var media_file = _this.getMediaFile(media_key);
      var new_media_path = dropval + media_file.media_filename;
      _this.moveFile(media_key, new_media_path);
    }
    else {
      //Moving folder
      var old_media_folder = dragval;
      var old_media_folder_name = XExt.basename(old_media_folder);
      if(!old_media_folder_name) return;
      var new_media_folder = dropval + old_media_folder_name + '/';
  
      XExt.Confirm('Move "'+old_media_folder+'" to "'+ new_media_folder + '"?', function(){
        _this.moveFolder(old_media_folder, new_media_folder);
      });
    }
  }

})();
