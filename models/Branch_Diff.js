jsh.App[modelid] = new (function(){
  var _this = this;

  this.branch_pages = [];
  this.branch_media = [];
  this.branch_redirects = [];
  this.branch_menus = [];

  this.onload = function(xmodel, callback){
    //Load API Data
    this.loadData();
  }

  this.loadData = function(onComplete){
    var emodelid = '../_funcs/diff';
    XForm.Get(emodelid, { branch_id: xmodel.get('branch_id') }, { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.branch_pages = rslt.branch_pages;
        _this.branch_media = rslt.branch_media;
        _this.branch_redirects = rslt.branch_redirects;
        _this.branch_menus = rslt.branch_menus;
        _this.render();
        if (onComplete) onComplete();
      }
      else XExt.Alert('Error while loading data');
    }, function (err) {
      //Optionally, handle errors
    });
  }

  this.render = function(){
    var jdiff = jsh.$('.diff_'+xmodel.class);

    jdiff.empty();
    jdiff.append($('<div class="clear"></div>'));

    //=====
    //Pages
    //=====
    _.each(_this.branch_pages, function(branch_page){
      jdiff.append($('<hr/>'));
      var branch_page_action = branch_page.branch_page_action.toUpperCase();
      var title_text = '';
      if(branch_page_action=='ADD'){
        title_text = 'ADDED PAGE &nbsp;&nbsp;&nbsp;'+XExt.escapeHTML(branch_page.new_page_path);
      }
      else if(branch_page_action=='DELETE'){
        title_text = 'DELETED PAGE '+XExt.escapeHTML(branch_page.old_page_path);
      }
      else if(branch_page_action=='UPDATE'){
        title_text = 'UPDATED PAGE '+XExt.escapeHTML(branch_page.new_page_path);
        if(branch_page.new_page_path!=branch_page.old_page_path){
          title_text += '<br/>RENAMED TO ' + XExt.escapeHTML(branch_page.new_page_path);
        }
      }
      jdiff.append($('<h4 class="'+xmodel.class+'_branch_page_path">'+title_text+'</h4>'));

      if(branch_page.diff){
        var seo_map = {
          'title' : 'Title',
          'keywords': 'Keywords',
          'metadesc': 'Meta Description',
          'canonical_url': 'Canonical URL'
        };
        var diff_map = {
          'css': 'CSS',
          'header': 'Header Code',
          'footer': 'Footer Code',
          'body': 'Content',
          'page_title': 'Page Title',
          'template_title': 'Template'
        }
        for(var key in branch_page.diff){
          if(_.includes(['page_title','template_title'],key)){
            jdiff.append($('<div class="'+xmodel.class+'_diff_item"><b>New '+(diff_map[key]||key)+'</b>: '+branch_page.diff[key]+'</div>'));
          }
        }
        for(var key in branch_page.diff.seo){
          jdiff.append($('<div class="'+xmodel.class+'_diff_item"><b>New SEO '+(seo_map[key]||key)+'</b>: '+branch_page.diff.seo[key]+'</div>'));
        }
        for(var key in branch_page.diff){
          if(key=='seo') continue;
          if(_.includes(['page_title','template_title'],key)) continue;
          jdiff.append($('<div class="'+xmodel.class+'_diff_head">'+(diff_map[key]||key)+'</div>'));
          jdiff.append($('<div class="'+xmodel.class+'_diff">'+branch_page.diff[key]+'</div>'));
        }
      }
    });

    //=====
    //Media
    //=====
    _.each(_this.branch_media, function(branch_media){
      jdiff.append($('<hr/>'));
      var branch_media_action = branch_media.branch_media_action.toUpperCase();
      var title_text = '';
      if(branch_media_action=='ADD'){
        title_text = 'ADDED MEDIA &nbsp;&nbsp;&nbsp;'+XExt.escapeHTML(branch_media.new_media_path);
      }
      else if(branch_media_action=='DELETE'){
        title_text = 'DELETED MEDIA '+XExt.escapeHTML(branch_media.old_media_path);
      }
      else if(branch_media_action=='UPDATE'){
        title_text = 'UPDATED MEDIA '+XExt.escapeHTML(branch_media.new_media_path);
        if(branch_media.new_media_path!=branch_media.old_media_path){
          title_text += '<br/>RENAMED TO ' + XExt.escapeHTML(branch_media.new_media_path);
        }
      }
      jdiff.append($('<h4 class="'+xmodel.class+'_branch_media_path">'+title_text+'</h4>'));
    });

    //=========
    //Redirects
    //=========
    _.each(_this.branch_redirects, function(branch_redirect){
      jdiff.append($('<hr/>'));
      var branch_redirect_action = branch_redirect.branch_redirect_action.toUpperCase();
      var title_text = '';
      if(branch_redirect_action=='ADD'){
        title_text = 'ADDED REDIRECT &nbsp;&nbsp;&nbsp;'+XExt.escapeHTML(branch_redirect.new_redirect_url);
      }
      else if(branch_redirect_action=='DELETE'){
        title_text = 'DELETED REDIRECT '+XExt.escapeHTML(branch_redirect.old_redirect_url);
      }
      else if(branch_redirect_action=='UPDATE'){
        title_text = 'UPDATED REDIRECT '+XExt.escapeHTML(branch_redirect.new_redirect_url);
        if(branch_redirect.new_redirect_url!=branch_redirect.old_redirect_url){
          title_text += '<br/>New URL: ' + XExt.escapeHTML(branch_redirect.new_redirect_url);
        }
        if(branch_redirect.new_redirect_dest!=branch_redirect.old_redirect_dest){
          title_text += '<br/>New Destination: ' + XExt.escapeHTML(branch_redirect.new_redirect_dest);
        }
      }
      jdiff.append($('<h4 class="'+xmodel.class+'_branch_redirect_url">'+title_text+'</h4>'));
    });

    //====
    //Menu
    //====
    _.each(_this.branch_menus, function(branch_menu){
      jdiff.append($('<hr/>'));
      var branch_menu_action = branch_menu.branch_menu_action.toUpperCase();
      var title_text = '';
      if(branch_menu_action=='ADD'){
        title_text = 'ADDED MENU &nbsp;&nbsp;&nbsp;'+XExt.escapeHTML(branch_menu.new_menu_tag);
      }
      else if(branch_menu_action=='DELETE'){
        title_text = 'DELETED MENU '+XExt.escapeHTML(branch_menu.old_menu_tag);
      }
      else if(branch_menu_action=='UPDATE'){
        title_text = 'UPDATED MENU '+XExt.escapeHTML(branch_menu.new_menu_tag);
        if(branch_menu.new_menu_tag!=branch_menu.old_menu_tag){
          title_text += '<br/>RENAMED TO ' + XExt.escapeHTML(branch_menu.new_menu_tag);
        }
      }
      jdiff.append($('<h4 class="'+xmodel.class+'_branch_menu_tag">'+title_text+'</h4>'));

      if(branch_menu.diff){
        var diff_map = {
          'menu_name': 'Menu Name',
          'template_title': 'Template',
          'menu_path': 'Menu File Path',
          'menu_items': 'Menu Items'
        }
        for(var key in branch_menu.diff){
          if(_.includes(['menu_name','template_title','menu_path'],key)){
            jdiff.append($('<div class="'+xmodel.class+'_diff_item"><b>New '+(diff_map[key]||key)+'</b>: '+branch_menu.diff[key]+'</div>'));
          }
        }
        for(var key in branch_menu.diff){
          if(!_.includes(['menu_items'],key)) continue;
          jdiff.append($('<div class="'+xmodel.class+'_diff_head">'+(diff_map[key]||key)+'</div>'));
          jdiff.append($('<div class="'+xmodel.class+'_diff">'+branch_menu.diff[key]+'</div>'));
        }
      }
    });

    //Closing Line
    jdiff.append($('<hr/>'));
  }
})();
