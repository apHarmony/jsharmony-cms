jsh.App[modelid] = new (function(){
  var _this = this;

  this.pageData = [];
  this.itemType = null;
  this.LOVs = { };
  this.onOpenItem = [];

  this.oninit = function(){
  };

  this.onload = function(){
    $('.'+xmodel.class+'_submit').off('click').on('click', function(){
      var query = $('.'+xmodel.class+'_query').val().trim();
      _this.search(query);
    });
    $('.'+xmodel.class+'_query').on('keydown', function (e) { if (e.keyCode == 13) { $('.'+xmodel.class+'_submit').trigger('click'); } });
    $('.'+xmodel.class+'_query').focus();
  };

  this.initGrid = function(callback){
    if(!callback) callback = function(){};
    if('Search_Grid' in jsh.XModels) return callback(); //Grid already loaded

    //Define the grid in-memory
    XPage.LoadVirtualModel($('.'+xmodel.class+'_grid_container')[0], {
      'id': 'Search_Grid',
      'layout': 'grid',
      'title': '',
      'parent': xmodel.id,
      'unbound': true,
      'actions': 'B',
      'sort': ['vscore'],
      'hide_system_buttons': ['export','search'],
      'noresultsmessage':  'No results found for search phrase',
      'js': function(){ //This function is virtual and cannot reference any variables outside its scope
        var _this = this;
        //var modelid = [current model id];
        //var xmodel = [current model];
        var apiGrid = new jsh.XAPI.Grid.Static(modelid);
        var apiForm = new jsh.XAPI.Form.Static(modelid);

        _this.oninit = function(xmodel){
        };

        _this.onload = function(xmodel){
        };

        _this.getapi = function(xmodel, apitype){
          if(apitype=='grid') return apiGrid;
          else if(apitype=='form') return apiForm;
        };

        _this.openItem = function(obj){
          var rowid = $(obj).closest('tr').data('id');
      
          var itemData = xmodel.get('data', rowid);
          itemData = (itemData ? JSON.parse(itemData) : {});
          var itemType = xmodel.get('type', rowid);
          var itemPath = xmodel.get('path', rowid);
          var itemTitle = xmodel.get('title', rowid);
          jsh.App[xmodel.parent].openItem(itemType, itemPath, itemTitle, itemData);
        };
      },
      'oninit':'_this.oninit(xmodel);',
      'onload':'_this.onload(xmodel);',
      'getapi':'return _this.getapi(xmodel, apitype);',
      'fields': [
        {'name': 'id', 'type': 'bigint', 'key': true, 'control':'hidden', 'disable_search': true },
        {'name': 'params', 'type': 'varchar', 'control':'hidden', 'disable_search': true },
        {'name': 'type', 'type': 'varchar', 'control':'hidden', 'disable_search': true },
        {'name': 'type_desc', 'caption':'Type', 'type': 'varchar', 'control':'label' },
        {'name': 'path', 'caption':'Path', 'type': 'varchar', 'control':'label', 'link': '#', 'link_onclick':'_this.openItem(this); return false;' },
        {'name': 'title', 'caption':'Title', 'type': 'varchar', 'control':'label' },
        {'name': 'score', 'caption':'Score', 'type': 'float', 'control':'label' },
      ]
    }, function(childModel){
      jsh.XModels['Search_Grid'].getapi('grid').dataset = _this.pageData;
      jsh.XModels['Search_Grid'].getapi('form').dataset = _this.pageData;
      callback();
    });
  };

  //Render Grid
  this.renderGrid = function(){
    jsh.XModels['Search_Grid'].controller.Render();
  };

  this.search = function(query){
    if(!query){ return XExt.Alert('Please enter a search phrase'); }
    _this.initGrid(function(){
      _this.api_search(query);
    });
  };


  /////////
  // API //
  /////////

  this.api_search = function(query, onComplete){
    XExt.CallAppFunc('../_funcs/search', 'get', { query: query, itemType: _this.itemType }, function (rslt) { //On Success
      if ('_success' in rslt) {

        //Populate arrays + Render
        _this.pageData.splice(0);
        for(var i=0;i<rslt.results.length;i++) _this.pageData.push(rslt.results[i]);

        _this.renderGrid();
        if (onComplete) onComplete();
      }
      else XExt.Alert('Error while searching');
    }, function (err) {
      //Additional error handling
    });
  };

  this.openItem = function(itemType, itemPath, itemTitle, itemData){
    for(var i=0;i<_this.onOpenItem.length;i++){
      if(_this.onOpenItem[i](itemType, itemPath, itemTitle, itemData)) return;
    }
    if(itemType == 'page'){
      jsh.System.OpenPageEditor(itemData.page_key, itemData.page_filename, itemData.page_template_id, { source: 'search', rawEditorDialog: '.'+xmodel.class+'_RawTextEditor', page_template_path: itemData.page_template_path });
    }
    else if(itemType == 'media'){
      jsh.System.PreviewMedia(itemData.media_key, undefined, undefined, itemData.media_ext, itemData.media_width, itemData.media_height);
    }
    else XExt.Alert('Item "'+itemType+'" not supported');
  };

})();
