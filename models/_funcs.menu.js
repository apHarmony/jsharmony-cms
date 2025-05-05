/*
Copyright 2019 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/
var Helper = require('jsharmony/Helper');
var HelperFS = require('jsharmony/HelperFS');
var _ = require('lodash');
var path = require('path');
var fs = require('fs');
var async = require('async');

module.exports = exports = function(module, funcs){
  var exports = {};
  var _t = module._t;

  exports.getMenuFile = function(menu_file_id){
    if(!menu_file_id) throw new Error('Invalid menu_file_id');
    return path.join(path.join(module.jsh.Config.datadir,'menu'),menu_file_id.toString()+'.json');
  };

  exports.getClientMenu = function(menu, cb){
    var menu_file_id = menu.menu_file_id;

    //Load Menu Content from disk
    module.jsh.ParseJSON(funcs.getMenuFile(menu_file_id), module.name, 'Menu File ID#'+menu_file_id, function(err, menu_content){
      if(err && !HelperFS.fileNotFound(err)) return cb(err);
      menu_content = menu_content || { menu_items: [] };
      return cb(null,menu_content);
    }, { fatalError: false });
  };

  exports.getMenuUrl = function(menu_item, branchData){
    if((menu_item.menu_item_link_type||'').toString()=='PAGE'){
      var page_key = parseInt(menu_item.menu_item_link_dest);
      if(!branchData) return '#';
      if(!(page_key in branchData.page_keys)) throw new Error('Menu  '+(menu_item.menu_tag||'')+' item '+menu_item.menu_item_path+' :: '+menu_item.menu_item_text+' links to missing Page ID # '+page_key.toString());
      return branchData.page_keys[page_key];
    }
    else if((menu_item.menu_item_link_type||'').toString()=='MEDIA'){
      var media_key = parseInt(menu_item.menu_item_link_dest);
      if(!branchData) return '#';
      if(!(media_key in branchData.media_keys)) throw new Error('Menu '+(menu_item.menu_tag||'')+' item '+menu_item.menu_item_path+' :: '+menu_item.menu_item_text+' links to missing Media ID # '+media_key.toString());
      return branchData.media_keys[media_key];
    }
    return menu_item.menu_item_link_dest;
  };

  exports.getMenuImageUrl = function(menu_item, branchData){
    if (menu_item.menu_item_image) {
      var media_key = parseInt(menu_item.menu_item_image);
      if(!branchData) return '#';
      if(!(media_key in branchData.media_keys)) throw new Error('Menu '+(menu_item.menu_tag||'')+' item '+menu_item.menu_item_path+' :: '+menu_item.menu_item_text+' image links to missing Media ID # '+media_key.toString());
      return branchData.media_keys[media_key];
    }
    return menu_item.menu_item_image;
  };

  exports.createMenuTree = function(menu, branchData){

    menu.menu_items = JSON.parse(JSON.stringify(menu.menu_items||[]));

    //Generate menu item tree
    var menu_item_ids = {};
    for(var i=0;i<menu.menu_items.length;i++){
      var menu_item = menu.menu_items[i];
      menu_item.menu_item_children = [];
      menu_item_ids[menu_item.menu_item_id] = menu_item;

      menu_item.menu_item_type = (menu_item.menu_item_type||'TEXT').toUpperCase();
      menu_item.menu_item_link_type = (menu_item.menu_item_link_type||'').toUpperCase();
      menu_item.menu_item_link_target = (menu_item.menu_item_link_target||'').toUpperCase();

      menu_item.id = menu_item.menu_item_id;
      menu_item.children = menu_item.menu_item_children;

      //html
      menu_item.html = menu_item.menu_item_text;
      if(menu_item.menu_item_type != 'HTML') menu_item.html = Helper.escapeHTML(menu_item.html);
      menu_item.text = Helper.StripTags(menu_item.html);

      menu_item.tag = menu_item.menu_item_tag || '';
      menu_item.menu_tag = menu.menu_tag || '';
      menu_item.class = menu_item.menu_item_class || '';
      menu_item.style = menu_item.menu_item_style || '';

      menu_item.href = '';
      menu_item.onclick = '';
      if(menu_item.menu_item_link_type){
        if(menu_item.menu_item_link_type=='JS'){
          menu_item.href = '#';
          menu_item.onclick = menu_item.menu_item_link_dest + '; return false;';
        } else {
          menu_item.href = funcs.getMenuUrl(menu_item, branchData);
        }
      }

      if(menu_item.menu_item_image){
        menu_item.menu_item_image_path = funcs.getMenuImageUrl(menu_item, branchData);
      }
        
      menu_item.target = ((menu_item.menu_item_link_type != 'JS') && (menu_item.menu_item_link_target == 'NEWWIN')) ? '_blank' : '';
      menu_item.selected = false;
    }

    var menu_item_tree = [];
    _.each(menu.menu_items, function(menu_item){
      if(!menu_item.menu_item_parent_id){
        menu_item_tree.push(menu_item);
        menu_item.parent = null;
      }
      else {
        menu_item_ids[menu_item.menu_item_parent_id].children.push(menu_item);
        menu_item.parent = menu_item_ids[menu_item.menu_item_parent_id];
      }
    });

    function resolveParent(menu_item){
      if(menu_item.parents) return;
      if(!menu_item.parent){
        menu_item.parents = [];
        menu_item.depth = 1;
        return;
      }
      if(!menu_item.parent.parents) resolveParent(menu_item.parent);
      menu_item.parents = menu_item.parent.parents.concat(menu_item.parent);
      menu_item.depth = menu_item.parent.depth + 1;
    }

    _.each(menu.menu_items, function(menu_item){
      resolveParent(menu_item);
      menu_item.getSiblings = function(){
        var siblings = menu_item.parent ? menu_item.parent.children : menu_item_tree;
        return _.filter(siblings, function(sibling){ return sibling.id != menu_item.id; });
      };
    });

    //Add properties to menu
    menu.menu_item_tree = menu_item_tree;
    menu.tree = menu_item_tree;
    menu.items = menu.menu_items;
    menu.tag = menu.menu_tag;
    menu.currentItem = null;
    //Aliases
    menu.topItems = menu.tree;
    menu.allItems = menu.items;
  };
  
  exports.menu = function (req, res, next) {
    var verb = req.method.toLowerCase();
    
    var Q = req.query;
    var P = req.body;
    var appsrv = this;
    var jsh = module.jsh;
    var XValidate = jsh.XValidate;
    var sql = '';
    var sql_ptypes = [];
    var sql_params = {};
    var verrors = {};
    var dbtypes = appsrv.DB.types;
    var validate = null;
    var model = jsh.getModel(req, module.namespace + 'Menu_Tree');

    if(!req.params || !req.params.menu_key) return next();
    var menu_key = req.params.menu_key;

    //Get menu
    sql_ptypes = [dbtypes.BigInt];
    sql_params = { 'menu_key': menu_key };
    validate = new XValidate();
    verrors = {};
    validate.AddValidator('_obj.menu_key', 'Menu Key', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
    validate.AddValidator('_obj.branch_id', 'Branch ID', 'B', [XValidate._v_IsNumeric()]);
    sql = 'select menu_key,menu_file_id,menu_tag';

    if(Q.menu_id){
      sql_ptypes.push(dbtypes.BigInt);
      sql_params.menu_id = Q.menu_id;
      validate.AddValidator('_obj.menu_id', 'Menu ID', 'B', [XValidate._v_IsNumeric()]);
      sql += ' from {schema}.menu where menu_key=@menu_key and menu_id=@menu_id and site_id={schema}.my_current_site_id()';
    }
    else sql += ' from {schema}.v_my_menu where menu_key=@menu_key';
    
    var fields = [];
    var datalockstr = '';
    appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
    sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);
    
    verrors = _.merge(verrors, validate.Validate('B', sql_params));
    if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }
    appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
      if(!rslt || !rslt.length || !rslt[0] || (rslt[0].length != 1)){ return Helper.GenError(req, res, -4, 'Invalid Menu ID'); }
      var menu = rslt[0][0];

      if (verb == 'get'){
        if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }

        if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, ['|menu_id','|branch_id'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        //Return menu
        funcs.getClientMenu(menu, function(err, clientMenu){
          if(err) { Helper.GenError(req, res, -99999, err.toString()); return; }

          var page_keys = {};
          var media_keys = {};
          var branch_id = null;
          var menu_config = {};

          async.waterfall([
            
            //Validate branch access
            function(cb){
              if(!Q.branch_id) return cb();
              sql = "select v_my_branch_access.branch_id,branch_name,site_id from {schema}.v_my_branch_access inner join {schema}.branch_menu on branch_menu.branch_id=v_my_branch_access.branch_id where v_my_branch_access.branch_id=@branch_id and branch_access like 'R%' and (branch_menu.menu_key=@menu_key)";
              appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), [dbtypes.BigInt,dbtypes.BigInt], { menu_key: menu.menu_key, branch_id: Q.branch_id }, function (err, rslt) {
                if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
                if(!rslt || !rslt.length || !rslt[0] || !rslt[0].length){ return Helper.GenError(req, res, -12, 'Could not access Site Revision or Menu'); }
                branch_id = rslt[0][0].branch_id;
                return cb();
              });
            },

            //Get site config
            function(cb){
              funcs.getSiteConfig(req._DBContext, req.gdata.site_id, { continueOnConfigError: true }, function(err, siteConfig){
                if(err) return cb(err);
                var site_config = siteConfig;
                if(site_config && site_config.menus){
                  _.each(site_config.menus, function(site_menu_config){
                    if(site_menu_config && site_menu_config.tag == menu.menu_tag) menu_config = _.pick(site_menu_config, ['max_depth']);
                  });
                }
                return cb();
              });
            },

            //Get list of all page_keys
            function (menu_cb){
              var sql = 'select page.page_key,page.page_path from {schema}.page inner join {schema}.branch_page on branch_page.page_id = page.page_id where branch_id = $ifnull(@branch_id, {schema}.my_current_branch_id()) and page_file_id is not null and page_path is not null';
              appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), [dbtypes.BigInt], { branch_id: branch_id }, function (err, rslt) {
                if (err != null) { err.sql = sql; return menu_cb(err); }
                if(!rslt || !rslt.length || !rslt[0]){ return menu_cb(new Error('Error loading pages')); }
                _.each(rslt[0], function(page){
                  page_keys[page.page_key] = page.page_path;
                });
                return menu_cb();
              });
            },

            //Get list of all media_keys
            function (menu_cb){
              var sql = 'select media.media_key,media.media_path from {schema}.media  inner join {schema}.branch_media on branch_media.media_id = media.media_id where branch_id = $ifnull(@branch_id, {schema}.my_current_branch_id()) and media_file_id is not null and media_path is not null';
              appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), [dbtypes.BigInt], { branch_id: branch_id }, function (err, rslt) {
                if (err != null) { err.sql = sql; return menu_cb(err); }
                if(!rslt || !rslt.length || !rslt[0]){ return menu_cb(new Error('Error loading media')); }
                _.each(rslt[0], function(media){
                  media_keys[media.media_key] = media.media_path;
                });
                return menu_cb();
              });
            },

            //Set menu_item_link_page for PAGE link types
            //Set menu_item_link_media for MEDIA link types
            function(menu_cb){
              for(var i=0;i<clientMenu.menu_items.length;i++){
                var menu_item = clientMenu.menu_items[i];
                var menu_item_link_type = (menu_item.menu_item_link_type||'').toUpperCase();
                if(menu_item_link_type=='PAGE'){
                  var page_key = parseInt(menu_item.menu_item_link_dest);
                  if(page_key in page_keys){
                    menu_item.menu_item_link_page = page_keys[page_key];
                  }
                  else {
                    menu_item.menu_item_link_page = 'PAGE :: '+page_key+' :: Not found';
                  }
                }
                else if(menu_item_link_type=='MEDIA'){
                  var media_key = parseInt(menu_item.menu_item_link_dest);
                  if(media_key in media_keys){
                    menu_item.menu_item_link_media = media_keys[media_key];
                  }
                  else {
                    menu_item.menu_item_link_media = 'MEDIA :: '+media_key+' :: Not found';
                  }
                }
              }
              return menu_cb(null);
            },
            //Set menu_item_image
            function(menu_cb){
              for(var i=0;i<clientMenu.menu_items.length;i++){
                var menu_item = clientMenu.menu_items[i];
                var media_key = parseInt(menu_item.menu_item_image);
                if(!media_key){
                  menu_item.menu_item_image_path = '';
                }
                else if(media_key in media_keys){
                  menu_item.menu_item_image_path = media_keys[media_key];
                }
                else {
                  menu_item.menu_item_image_path = 'MEDIA :: '+media_key+' :: Not found';
                }
              }
              return menu_cb(null);
            },
          ], function(err){
            if(err) { Helper.GenError(req, res, -99999, err.toString()); return; }
            res.type('json');
            res.end(JSON.stringify({
              _success: 1,
              menu: clientMenu,
              menu_config: menu_config || {},
            }));
          });
        });
      }
      else if (verb == 'post'){
        if (!Helper.hasModelAction(req, model, 'U')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }

        //Validate parameters
        if (!appsrv.ParamCheck('P', P, ['&menu_items'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        //XValidate
        var menu_content = P;
        if (_.isString(menu_content.menu_items)){
          try{
            menu_content.menu_items = JSON.parse(menu_content.menu_items);
          }
          catch(ex){
            Helper.GenError(req, res, -4, 'Invalid Parameters');
            return;
          }
        }
        if (!_.isArray(menu_content.menu_items)) menu_content.menu_items = [];
        validate = new XValidate();
        verrors = {};
        validate.AddValidator('_obj.menu_item_id', 'Item ID', 'B', [XValidate._v_Required(), XValidate._v_IsNumeric(true)]);
        validate.AddValidator('_obj.menu_item_parent_id', 'Parent Item ID', 'B', [XValidate._v_IsNumeric(true)]);
        validate.AddValidator('_obj.menu_item_path', 'Path', 'B', [XValidate._v_Required(), XValidate._v_MaxLength(2048)]);
        validate.AddValidator('_obj.menu_item_text', 'Text', 'B', [XValidate._v_MaxLength(2048)]);
        validate.AddValidator('_obj.menu_item_type', 'Item Type', 'B', [XValidate._v_Required(), XValidate._v_InArray(['TEXT','HTML'])]);
        validate.AddValidator('_obj.menu_item_tag', 'Tag', 'B', [XValidate._v_MaxLength(2048)]);
        validate.AddValidator('_obj.menu_item_style', 'CSS Style', 'B', [XValidate._v_MaxLength(2048)]);
        validate.AddValidator('_obj.menu_item_class', 'CSS Class', 'B', [XValidate._v_MaxLength(2048)]);
        validate.AddValidator('_obj.menu_item_link_type', 'Link Type', 'B', [XValidate._v_InArray(['PAGE','MEDIA','URL','JS'])]);
        validate.AddValidator('_obj.menu_item_link_dest', 'Link Destination', 'B', [XValidate._v_MaxLength(2048)]);
        validate.AddValidator('_obj.menu_item_link_target', 'Link Target', 'B', [XValidate._v_InArray(['NEWWIN'])]);
        validate.AddValidator('_obj.menu_item_image', 'Image', 'B', [XValidate._v_MaxLength(2048)]);
        validate.AddValidator('_obj.menu_item_image_path', 'Image Path', 'B', [XValidate._v_MaxLength(2048)]);
        for(var i=0;i<menu_content.menu_items.length;i++){
          var menu_item = menu_content.menu_items[i];
          verrors = _.merge(verrors, validate.Validate('B', menu_item));
          if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, 'Error on item #'+(i+1).toString()+'\n'+verrors[''].join('\n')); return; }
        }

        //Save to database
        sql_ptypes = [dbtypes.BigInt];
        sql_params = {menu_key: menu_key};
        sql = 'update '+(module.schema?module.schema+'.':'')+'v_my_menu set menu_file_id=null where menu_key=@menu_key;';
        sql += 'select menu_file_id from '+(module.schema?module.schema+'.':'')+'v_my_menu where menu_key=@menu_key;';

        fields = [];
        datalockstr = '';
        verrors = {};
        appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
        sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);
        if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }
        
        appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
          if(!rslt || !rslt.length || !rslt[0] || !rslt[0].length || !rslt[0][0]) return Helper.GenError(req, res, -99999, 'Invalid database result');
          menu.menu_file_id = rslt[0][0].menu_file_id;
          //Save to disk
          fs.writeFile(funcs.getMenuFile(menu.menu_file_id), JSON.stringify(menu_content), 'utf8', function(err){
            res.type('json');
            res.end(JSON.stringify({ '_success': 1 }));
          });
        });

        return;
      }
      else return next();
    });
  };

  exports.prettyMenu = function(menu_items, page_keys, media_keys, options){
    options = _.extend({ text: true }, options);
    var rslt = '[\n';
    var rsltarr = [];

    //Generate indexed list of menu items by ID
    var menu_items_by_id = {};
    for(var i=0;i<menu_items.length;i++){
      var menu_item = menu_items[i];
      menu_item.collection_index = i;
      menu_items_by_id[menu_item.menu_item_id] = menu_item;
      if(!menu_item.menu_item_parent_id){
        menu_item.menu_item_path_text = '/' + Helper.StripTags(menu_item.menu_item_text).trim() + '/';
        menu_item.menu_item_collection_index_array = [menu_item.collection_index];
      }
    }

    //Generate text path
    function getTextPath(menu_item){
      if(!menu_item) return '';
      if(!menu_item.menu_item_path_text){
        menu_item.menu_item_parents = getTextPath(menu_items_by_id[menu_item.menu_item_parent_id]);
        menu_item.menu_item_path_text = menu_item.menu_item_parents + Helper.StripTags(menu_item.menu_item_text).trim() + '/';
        
        if(!menu_item.menu_item_collection_index_array){
          menu_item.menu_item_collection_index_array = menu_items_by_id[menu_item.menu_item_parent_id].menu_item_collection_index_array.concat([menu_item.collection_index]);
        }
      }
      menu_item.menu_item_path_array = (menu_item.menu_item_path_text||'').split('/');
      return menu_item.menu_item_path_text;
    }

    //Clone menu_items
    menu_items = JSON.parse(JSON.stringify(menu_items||[]));

    //Get text paths
    _.each(menu_items, function(menu_item){
      getTextPath(menu_item);
    });

    //Sort menu items
    menu_items.sort(function(a,b){
      for(var i=0;i<a.menu_item_collection_index_array.length;i++){
        if(b.menu_item_collection_index_array.length <= i) return 1;
        if(a.menu_item_collection_index_array[i] > b.menu_item_collection_index_array[i]) return 1;
        if(a.menu_item_collection_index_array[i] < b.menu_item_collection_index_array[i]) return -1;
      }
      if(a.menu_item_collection_index_array.length < b.menu_item_collection_index_array.length) return -1;
      return 0;
    });

    _.each(menu_items, function(menu_item){
      //Delete non-essential info
      var menu_item_path = menu_item.menu_item_path_text;
      if(menu_item_path && (menu_item_path[menu_item_path.length-1]=='/')) menu_item_path = menu_item_path.substr(0, menu_item_path.length-1);
      var print_item = {
        menu_item: menu_item_path,
        type: menu_item.menu_item_type,
      };
      var link_type = (menu_item.menu_item_link_type||'').toUpperCase();
      var link_text = '';
      if(link_type){
        link_text = link_type + ' :: ' + menu_item.menu_item_link_dest;
        if(link_type=='PAGE'){
          var page_key = parseInt(menu_item.menu_item_link_dest);
          if(page_key in page_keys) link_text = 'PAGE :: ' + page_keys[page_key].page_path;
        }
        else if(link_type=='MEDIA'){
          let media_key = parseInt(menu_item.menu_item_link_dest);
          if(media_key in media_keys) link_text = 'MEDIA :: ' + media_keys[media_key].media_path;
        }
      }
      if (menu_item.menu_item_image) {
        let media_key = parseInt(menu_item.menu_item_image);
        if(media_key in media_keys) print_item.image = 'MEDIA :: ' + media_keys[media_key].media_path;
      }
      if(link_text){
        print_item.link = link_text;
        if(menu_item.menu_item_link_target) print_item.link_target = menu_item.menu_item_link_target;
      }
      if(menu_item.menu_item_tag) print_item.tag = menu_item.menu_item_tag;
      if(menu_item.menu_item_style) print_item.css_style = menu_item.menu_item_style;
      if(menu_item.menu_item_class) print_item.css_class = menu_item.menu_item_class;

      //Add to array
      rsltarr.push(print_item);
      
      //Generate text
      rslt += '  { ';
      var first_key = true;
      for(var key in print_item){
        if(!first_key) rslt += ', ';
        rslt += key + ': ' + JSON.stringify(print_item[key]);
        first_key = false;
      }
      rslt += ' },\n';
    });
    rslt += ']';
    
    if(options.text) return rslt;
    return rsltarr;
  };

  return exports;
};
