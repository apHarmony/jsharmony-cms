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
var _ = require('lodash');
var path = require('path');
var fs = require('fs');
var async = require('async');

module.exports = exports = function(module, funcs){
  var exports = {};

  exports.getMenuFile = function(menu_file_id){
    if(!menu_file_id) throw new Error('Invalid menu_file_id');
    return path.join(path.join(module.jsh.Config.datadir,'menu'),menu_file_id.toString()+'.json');
  }

  exports.getClientMenu = function(menu, cb){
    var appsrv = this;

    var menu_file_id = menu.menu_file_id;
    var menu_template_id = menu.menu_template_id;
    if(!menu_template_id) menu_template_id = module.defaultMenuTemplate;
    var template = module.MenuTemplates[menu_template_id];

    //Load Menu Content from disk
    module.jsh.ParseJSON(funcs.getMenuFile(menu_file_id), module.name, 'Menu File ID#'+menu_file_id, function(err, menu_content){
      if(err) return cb(err);
      
      menu_content = menu_content || { menu_items: [] };
      menu_content.template = {
        title: template.title||'',
        content: {
          body: template.content.body||'',
        }
      }; 
      return cb(null,menu_content);
    });
  }
  
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
    sql = 'select menu_key,menu_file_id,menu_template_id,menu_path';

    if(Q.menu_id){
      sql_ptypes.push(dbtypes.BigInt);
      sql_params.menu_id = Q.menu_id;
      validate.AddValidator('_obj.menu_id', 'Menu ID', 'B', [XValidate._v_IsNumeric()]);
      sql += ' from '+(module.schema?module.schema+'.':'')+'menu where menu_key=@menu_key and menu_id=@menu_id';
    }
    else sql += ' from '+(module.schema?module.schema+'.':'')+'v_my_menu where menu_key=@menu_key';
    
    var fields = [];
    var datalockstr = '';
    appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
    sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);
    
    verrors = _.merge(verrors, validate.Validate('B', sql_params));
    if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }
    appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
      if(!rslt || !rslt.length || !rslt[0] || (rslt[0].length != 1)){ return Helper.GenError(req, res, -4, 'Invalid Menu ID'); }
      var menu = rslt[0][0];

      if (verb == 'get'){
        if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

        if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, ['|menu_id'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        //Return menu
        funcs.getClientMenu(menu, function(err, clientMenu){
          if(err) { Helper.GenError(req, res, -99999, err.toString()); return; }

          var page_keys = {};
          var media_keys = {};

          async.waterfall([

            //Get list of all page_keys
            function (menu_cb){
              var sql = 'select page_key,page_path from '+(module.schema?module.schema+'.':'')+'v_my_page where page_file_id is not null and page_path is not null';
              appsrv.ExecRecordset(req._DBContext, sql, [], {}, function (err, rslt) {
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
              var sql = 'select media_key,media_path from '+(module.schema?module.schema+'.':'')+'v_my_media where media_file_id is not null and media_path is not null';
              appsrv.ExecRecordset(req._DBContext, sql, [], {}, function (err, rslt) {
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
                  if(page_key in page_keys) menu_item.menu_item_link_page = page_keys[page_key];
                }
                else if(menu_item_link_type=='MEDIA'){
                  var media_key = parseInt(menu_item.menu_item_link_dest);
                  if(media_key in media_keys) menu_item.menu_item_link_media = media_keys[media_key];
                }
              }
              return menu_cb(null);
            },
          ], function(err){
            if(err) { Helper.GenError(req, res, -99999, err.toString()); return; }
            res.end(JSON.stringify({ 
              '_success': 1,
              'menu': clientMenu
            }));
          });
        });
      }
      else if (verb == 'post'){
        if (!Helper.hasModelAction(req, model, 'U')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

        //Validate parameters
        if (!appsrv.ParamCheck('P', P, ['&menu_items'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        //XValidate
        var menu_content = P;
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
            res.end(JSON.stringify({ '_success': 1 }));
          });
        });

        return;
      }
      else return next();
    });
  }

  exports.prettyMenu = function(menu_items, page_keys, media_keys, options){
    var options = _.extend({ text: true }, options);
    var rslt = '[\n';
    var rsltarr = [];

    //Generate indexed list of menu items by ID
    var menu_items_by_id = {};
    _.each(menu_items, function(menu_item){
      menu_items_by_id[menu_item.menu_item_id] = menu_item;
      if(!menu_item.menu_item_parent_id){
        menu_item.menu_item_path_text = '/' + Helper.StripTags(menu_item.menu_item_text).trim() + '/';
      }
    });

    //Generate text path
    function getTextPath(menu_item){
      if(!menu_item) return '';
      if(!menu_item.menu_item_path_text){
        menu_item.menu_item_parents = getTextPath(menu_items_by_id[menu_item.menu_item_parent_id]);
        menu_item.menu_item_path_text = menu_item.menu_item_parents + Helper.StripTags(menu_item.menu_item_text).trim() + '/';
      }
      return menu_item.menu_item_path_text;
    }

    //Clone menu_items
    menu_items = JSON.parse(JSON.stringify(menu_items||[]));

    //Get text paths
    _.each(menu_items, function(menu_item){
      getTextPath(menu_item);
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
          var media_key = parseInt(menu_item.menu_item_link_dest);
          if(media_key in media_keys) link_text = 'MEDIA :: ' + media_keys[media_key].media_path;
        }
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
  }

  return exports;
};
