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

  exports.getSitemapFile = function(sitemap_file_id){
    if(!sitemap_file_id) throw new Error('Invalid sitemap_file_id');
    return path.join(path.join(module.jsh.Config.datadir,'sitemap'),sitemap_file_id.toString()+'.json');
  }

  exports.getClientSitemap = function(sitemap, cb){
    var appsrv = this;

    var sitemap_file_id = sitemap.sitemap_file_id;

    //Load Sitemap Content from disk
    module.jsh.ParseJSON(funcs.getSitemapFile(sitemap_file_id), module.name, 'Sitemap File ID#'+sitemap_file_id, function(err, sitemap_content){
      sitemap_content = sitemap_content || { sitemap_items: [] };
      return cb(null,sitemap_content);
    });
  }
  
  exports.sitemap = function (req, res, next) {
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
    var model = jsh.getModel(req, module.namespace + 'Sitemap_Tree');

    if(!req.params || !req.params.sitemap_key) return next();
    var sitemap_key = req.params.sitemap_key;

    //Get sitemap
    sql_ptypes = [dbtypes.BigInt];
    sql_params = { 'sitemap_key': sitemap_key };
    validate = new XValidate();
    verrors = {};
    validate.AddValidator('_obj.sitemap_key', 'Sitemap Key', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
    sql = 'select sitemap_key,sitemap_file_id';

    if(Q.sitemap_id){
      sql_ptypes.push(dbtypes.BigInt);
      sql_params.sitemap_id = Q.sitemap_id;
      validate.AddValidator('_obj.sitemap_id', 'Sitemap ID', 'B', [XValidate._v_IsNumeric()]);
      sql += ' from '+(module.schema?module.schema+'.':'')+'sitemap where sitemap_key=@sitemap_key and sitemap_id=@sitemap_id';
    }
    else sql += ' from '+(module.schema?module.schema+'.':'')+'v_my_sitemap where sitemap_key=@sitemap_key';
    
    var fields = [];
    var datalockstr = '';
    appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
    sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);
    
    verrors = _.merge(verrors, validate.Validate('B', sql_params));
    if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }
    appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
      if(!rslt || !rslt.length || !rslt[0] || (rslt[0].length != 1)){ return Helper.GenError(req, res, -4, 'Invalid Sitemap ID'); }
      var sitemap = rslt[0][0];

      if (verb == 'get'){
        if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

        if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, ['|sitemap_id'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        //Return sitemap
        funcs.getClientSitemap(sitemap, function(err, clientSitemap){
          if(err) { Helper.GenError(req, res, -99999, err.toString()); return; }

          var page_keys = {};
          var media_keys = {};

          async.waterfall([

            //Get list of all page_keys
            function (sitemap_cb){
              var sql = 'select page_key,page_path from '+(module.schema?module.schema+'.':'')+'v_my_page where page_file_id is not null and page_path is not null';
              appsrv.ExecRecordset(req._DBContext, sql, [], {}, function (err, rslt) {
                if (err != null) { err.sql = sql; return sitemap_cb(err); }
                if(!rslt || !rslt.length || !rslt[0]){ return sitemap_cb(new Error('Error loading pages')); }
                _.each(rslt[0], function(page){
                  page_keys[page.page_key] = page.page_path;
                });
                return sitemap_cb();
              });
            },

            //Get list of all media_keys
            function (sitemap_cb){
              var sql = 'select media_key,media_path from '+(module.schema?module.schema+'.':'')+'v_my_media where media_file_id is not null and media_path is not null';
              appsrv.ExecRecordset(req._DBContext, sql, [], {}, function (err, rslt) {
                if (err != null) { err.sql = sql; return sitemap_cb(err); }
                if(!rslt || !rslt.length || !rslt[0]){ return sitemap_cb(new Error('Error loading media')); }
                _.each(rslt[0], function(media){
                  media_keys[media.media_key] = media.media_path;
                });
                return sitemap_cb();
              });
            },

            //Set sitemap_item_link_page for PAGE link types
            //Set sitemap_item_link_media for MEDIA link types
            function(sitemap_cb){
              for(var i=0;i<clientSitemap.sitemap_items.length;i++){
                var sitemap_item = clientSitemap.sitemap_items[i];
                var sitemap_item_link_type = (sitemap_item.sitemap_item_link_type||'').toUpperCase();
                if(sitemap_item_link_type=='PAGE'){
                  var page_key = parseInt(sitemap_item.sitemap_item_link_dest);
                  if(page_key in page_keys){
                    sitemap_item.sitemap_item_link_page = page_keys[page_key];
                  }
                }
                else if(sitemap_item_link_type=='MEDIA'){
                  var media_key = parseInt(sitemap_item.sitemap_item_link_dest);
                  if(media_key in media_keys) sitemap_item.sitemap_item_link_media = media_keys[media_key];
                }
              }
              return sitemap_cb(null);
            },
          ], function(err){
            if(err) { Helper.GenError(req, res, -99999, err.toString()); return; }
            res.end(JSON.stringify({ 
              '_success': 1,
              'sitemap': clientSitemap
            }));
          });
        });
      }
      else if (verb == 'post'){
        if (!Helper.hasModelAction(req, model, 'U')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

        //Validate parameters
        if (!appsrv.ParamCheck('P', P, ['&sitemap_items'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        //XValidate
        var sitemap_content = P;
        if (!_.isArray(sitemap_content.sitemap_items)) sitemap_content.sitemap_items = [];
        validate = new XValidate();
        verrors = {};
        validate.AddValidator('_obj.sitemap_item_id', 'Item ID', 'B', [XValidate._v_Required(), XValidate._v_IsNumeric(true)]);
        validate.AddValidator('_obj.sitemap_item_parent_id', 'Parent Item ID', 'B', [XValidate._v_IsNumeric(true)]);
        validate.AddValidator('_obj.sitemap_item_path', 'Path', 'B', [XValidate._v_Required(), XValidate._v_MaxLength(2048)]);
        validate.AddValidator('_obj.sitemap_item_text', 'Text', 'B', [XValidate._v_MaxLength(2048)]);
        validate.AddValidator('_obj.sitemap_item_type', 'Item Type', 'B', [XValidate._v_Required(), XValidate._v_InArray(['TEXT','HTML'])]);
        validate.AddValidator('_obj.sitemap_item_tag', 'Tag', 'B', [XValidate._v_MaxLength(2048)]);
        validate.AddValidator('_obj.sitemap_item_style', 'CSS Style', 'B', [XValidate._v_MaxLength(2048)]);
        validate.AddValidator('_obj.sitemap_item_class', 'CSS Class', 'B', [XValidate._v_MaxLength(2048)]);
        validate.AddValidator('_obj.sitemap_item_link_type', 'Link Type', 'B', [XValidate._v_InArray(['PAGE','MEDIA','URL','JS'])]);
        validate.AddValidator('_obj.sitemap_item_link_dest', 'Link Destination', 'B', [XValidate._v_MaxLength(2048)]);
        validate.AddValidator('_obj.sitemap_item_link_target', 'Link Target', 'B', [XValidate._v_InArray(['NEWWIN'])]);
        validate.AddValidator('_obj.sitemap_item_exclude_from_breadcrumbs', 'Exclude from Breadcrumbs', 'B', [XValidate._v_IsNumeric(true),XValidate._v_InArray([0,1])]);
        validate.AddValidator('_obj.sitemap_item_exclude_from_parent_menu', 'Exclude from Parent Menu', 'B', [XValidate._v_IsNumeric(true),XValidate._v_InArray([0,1])]);
        for(var i=0;i<sitemap_content.sitemap_items.length;i++){
          var sitemap_item = sitemap_content.sitemap_items[i];
          verrors = _.merge(verrors, validate.Validate('B', sitemap_item));
          if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, 'Error on item #'+(i+1).toString()+'\n'+verrors[''].join('\n')); return; }
        }

        //Save to database
        sql_ptypes = [dbtypes.BigInt];
        sql_params = {sitemap_key: sitemap_key};
        sql = 'update '+(module.schema?module.schema+'.':'')+'v_my_sitemap set sitemap_file_id=null where sitemap_key=@sitemap_key;';
        sql += 'select sitemap_file_id from '+(module.schema?module.schema+'.':'')+'v_my_sitemap where sitemap_key=@sitemap_key;';

        fields = [];
        datalockstr = '';
        verrors = {};
        appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
        sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);
        if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }
        
        appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
          if(!rslt || !rslt.length || !rslt[0] || !rslt[0].length || !rslt[0][0]) return Helper.GenError(req, res, -99999, 'Invalid database result');
          sitemap.sitemap_file_id = rslt[0][0].sitemap_file_id;
          //Save to disk
          fs.writeFile(funcs.getSitemapFile(sitemap.sitemap_file_id), JSON.stringify(sitemap_content), 'utf8', function(err){
            res.end(JSON.stringify({ '_success': 1 }));
          });
        });

        return;
      }
      else return next();
    });
  }

  exports.prettySitemap = function(sitemap_items, page_keys, media_keys){
    var rslt = '[\n';

    //Generate indexed list of sitemap items by ID
    var sitemap_items_by_id = {};
    _.each(sitemap_items, function(sitemap_item){
      sitemap_items_by_id[sitemap_item.sitemap_item_id] = sitemap_item;
      if(!sitemap_item.sitemap_item_parent_id){
        sitemap_item.sitemap_item_path_text = '/' + Helper.StripTags(sitemap_item.sitemap_item_text) + '/';
      }
    });

    //Generate text path
    function getTextPath(sitemap_item){
      if(!sitemap_item) return '';
      if(!sitemap_item.sitemap_item_path_text){
        sitemap_item.sitemap_item_parents = getTextPath(sitemap_items_by_id[sitemap_item.sitemap_item_parent_id]);
        sitemap_item.sitemap_item_path_text = sitemap_item.sitemap_item_parents + Helper.StripTags(sitemap_item.sitemap_item_text) + '/';
      }
      return sitemap_item.sitemap_item_path_text;
    }
    _.each(sitemap_items, function(sitemap_item){
      getTextPath(sitemap_item);
    });

    //Clone sitemap_items
    sitemap_items = JSON.parse(JSON.stringify(sitemap_items||[]));

    _.each(sitemap_items, function(sitemap_item){
      //Delete non-essential info
      var sitemap_item_path = sitemap_item.sitemap_item_path_text;
      if(sitemap_item_path && (sitemap_item_path[sitemap_item_path.length-1]=='/')) sitemap_item_path = sitemap_item_path.substr(0, sitemap_item_path.length-1);
      var print_item = {
        sitemap_item: sitemap_item_path,
        type: sitemap_item.sitemap_item_type,
      };
      var link_type = (sitemap_item.sitemap_item_link_type||'').toUpperCase();
      var link_text = '';
      if(link_type){
        link_text = link_type + ' :: ' + sitemap_item.sitemap_item_link_dest;
        if(link_type=='PAGE'){
          var page_key = parseInt(sitemap_item.sitemap_item_link_dest);
          if(page_key in page_keys) link_text = 'PAGE :: ' + page_keys[page_key].page_path;
        }
        else if(link_type=='MEDIA'){
          var media_key = parseInt(sitemap_item.sitemap_item_link_dest);
          if(media_key in media_keys) link_text = 'MEDIA :: ' + media_keys[media_key].media_path;
        }
      }
      if(link_text){
        print_item.link = link_text;
        if(sitemap_item.sitemap_item_link_target) print_item.link_target = sitemap_item.sitemap_item_link_target;
      }
      if(sitemap_item.sitemap_item_tag) print_item.tag = sitemap_item.sitemap_item_tag;
      if(sitemap_item.sitemap_item_style) print_item.css_style = sitemap_item.sitemap_item_style;
      if(sitemap_item.sitemap_item_class) print_item.css_class = sitemap_item.sitemap_item_class;
      if(sitemap_item.sitemap_item_exclude_from_breadcrumbs) print_item.exclude_from_breadcrumbs = sitemap_item.sitemap_item_exclude_from_breadcrumbs;
      if(sitemap_item.sitemap_item_exclude_from_parent_menu) print_item.exclude_from_parent_menu = sitemap_item.sitemap_item_exclude_from_parent_menu;
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
    return rslt;
  }

  return exports;
};
