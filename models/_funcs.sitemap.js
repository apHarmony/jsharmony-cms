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

  exports.getSitemapFile = function(sitemap_file_id){
    if(!sitemap_file_id) throw new Error('Invalid sitemap_file_id');
    return path.join(path.join(module.jsh.Config.datadir,'sitemap'),sitemap_file_id.toString()+'.json');
  }

  exports.getClientSitemap = function(sitemap, cb){
    var appsrv = this;

    var sitemap_file_id = sitemap.sitemap_file_id;

    //Load Sitemap Content from disk
    module.jsh.ParseJSON(funcs.getSitemapFile(sitemap_file_id), module.name, 'Sitemap File ID#'+sitemap_file_id, function(err, sitemap_content){
      if(err && !HelperFS.fileNotFound(err)) return cb(err);
      
      sitemap_content = sitemap_content || { sitemap_items: [] };
      return cb(null,sitemap_content);
    }, { fatalError: false });
  }

  exports.getSampleSitemap = function(){
    var rslt = {
      "sitemap_items":[
        {sitemap_item_id:"1",sitemap_item_parent_id:"",sitemap_item_path:"/1/",sitemap_item_text:"Sample Sitemap",sitemap_item_link_type:"PAGE",sitemap_item_link_dest:"1"},
        {sitemap_item_id:"2",sitemap_item_parent_id:"1",sitemap_item_path:"/1/2/",sitemap_item_text:"Page A",sitemap_item_hide_menu_parents:"1",sitemap_item_hide_menu_siblings:"1",sitemap_item_link_type:"PAGE",sitemap_item_link_dest:"2"},
        {sitemap_item_id:"11",sitemap_item_parent_id:"2",sitemap_item_path:"/1/2/11/",sitemap_item_text:"Subpage A-1",sitemap_item_link_type:"PAGE",sitemap_item_link_dest:"10"},
        {sitemap_item_id:"3",sitemap_item_parent_id:"1",sitemap_item_path:"/1/3/",sitemap_item_text:"Page B",sitemap_item_link_type:"PAGE",sitemap_item_link_dest:"3"},
        {sitemap_item_id:"4",sitemap_item_parent_id:"3",sitemap_item_path:"/1/3/4/",sitemap_item_text:"Subpage B-1",sitemap_item_link_type:"PAGE",sitemap_item_link_dest:"4"},
        {sitemap_item_id:"5",sitemap_item_parent_id:"3",sitemap_item_path:"/1/3/5/",sitemap_item_text:"Subpage B-2",sitemap_item_link_type:"PAGE",sitemap_item_link_dest:"5"},
        {sitemap_item_id:"12",sitemap_item_parent_id:"5",sitemap_item_path:"/1/3/5/12",sitemap_item_text:"Leaf Page B-2.a",sitemap_item_link_type:"PAGE",sitemap_item_link_dest:"21"},
        {sitemap_item_id:"13",sitemap_item_parent_id:"5",sitemap_item_path:"/1/3/5/13",sitemap_item_text:"Leaf Page B-2.b",sitemap_item_link_type:"PAGE",sitemap_item_link_dest:"22"},
        {sitemap_item_id:"6",sitemap_item_parent_id:"3",sitemap_item_path:"/1/3/6/",sitemap_item_text:"Subpage B-3",sitemap_item_link_type:"PAGE",sitemap_item_link_dest:"6"},
        {sitemap_item_id:"7",sitemap_item_parent_id:"3",sitemap_item_path:"/1/3/7/",sitemap_item_text:"Subpage B-4",sitemap_item_link_type:"PAGE",sitemap_item_link_dest:"7"},
        {sitemap_item_id:"8",sitemap_item_parent_id:"1",sitemap_item_path:"/1/8/",sitemap_item_text:"Page C",sitemap_item_link_type:"PAGE",sitemap_item_link_dest:"8"},
        {sitemap_item_id:"9",sitemap_item_parent_id:"",sitemap_item_path:"/9/",sitemap_item_text:"Hidden Area",sitemap_item_exclude_from_breadcrumbs:"1",sitemap_item_exclude_from_parent_menu:"1",sitemap_item_link_type:"",sitemap_item_link_dest:""},
        {sitemap_item_id:"10",sitemap_item_parent_id:"9",sitemap_item_path:"/9/10/",sitemap_item_text:"Hidden Page",sitemap_item_link_type:"PAGE",sitemap_item_link_dest:"9"}
      ]
    };
    _.each(rslt.sitemap_items, function(sitemap_item){
      var defaults = {
        sitemap_item_type: 'TEXT',
        sitemap_item_tag: '',
        sitemap_item_style: '',
        sitemap_item_class: '',
        sitemap_item_exclude_from_breadcrumbs: '0',
        sitemap_item_exclude_from_parent_menu: '0',
        sitemap_item_hide_menu_parents: '0',
        sitemap_item_hide_menu_siblings: '0',
        sitemap_item_hide_menu_children: '0',
        sitemap_item_link_target: '',
      };
      for(var key in defaults) if(!(key in sitemap_item)) sitemap_item[key] = defaults[key];
    });
    return funcs.getPageSitemapRelatives(rslt, 4);
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
    validate.AddValidator('_obj.branch_id', 'Branch ID', 'B', [XValidate._v_IsNumeric()]);
    sql = 'select sitemap_key,sitemap_file_id';

    if(Q.sitemap_id){
      sql_ptypes.push(dbtypes.BigInt);
      sql_params.sitemap_id = Q.sitemap_id;
      validate.AddValidator('_obj.sitemap_id', 'Sitemap ID', 'B', [XValidate._v_IsNumeric()]);
      sql += ' from {schema}.sitemap where sitemap_key=@sitemap_key and sitemap_id=@sitemap_id and site_id={schema}.my_current_site_id()';
    }
    else sql += ' from {schema}.v_my_sitemap where sitemap_key=@sitemap_key';
    
    var fields = [];
    var datalockstr = '';
    appsrv.getDataLockSQL(req, model, fields, sql_ptypes, sql_params, verrors, function (datalockquery) { datalockstr += ' and ' + datalockquery; });
    sql = Helper.ReplaceAll(sql, '%%%DATALOCKS%%%', datalockstr);
    
    verrors = _.merge(verrors, validate.Validate('B', sql_params));
    if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }
    appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
      if(!rslt || !rslt.length || !rslt[0] || (rslt[0].length != 1)){ return Helper.GenError(req, res, -4, 'Invalid Sitemap ID'); }
      var sitemap = rslt[0][0];

      if (verb == 'get'){
        if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

        if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, ['|sitemap_id','|branch_id'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        //Return sitemap
        funcs.getClientSitemap(sitemap, function(err, clientSitemap){
          if(err) { Helper.GenError(req, res, -99999, err.toString()); return; }

          var page_keys = {};
          var media_keys = {};
          var branch_id = null;

          async.waterfall([

            //Validate branch access
            function(cb){
              if(!Q.branch_id) return cb();
              sql = "select v_my_branch_access.branch_id,branch_name,site_id from {schema}.v_my_branch_access inner join {schema}.branch_sitemap on branch_sitemap.branch_id=v_my_branch_access.branch_id where v_my_branch_access.branch_id=@branch_id and branch_access like 'R%' and (branch_sitemap.sitemap_key=@sitemap_key)";
              appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), [dbtypes.BigInt,dbtypes.BigInt], { sitemap_key: sitemap.sitemap_key, branch_id: Q.branch_id }, function (err, rslt) {
                if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
                if(!rslt || !rslt.length || !rslt[0] || !rslt[0].length){ return Helper.GenError(req, res, -12, 'Could not access Site Revision or Sitemap'); }
                branch_id = rslt[0][0].branch_id;
                return cb();
              });
            },

            //Get list of all page_keys
            function (sitemap_cb){
              var sql = 'select page.page_key,page.page_path from {schema}.page inner join {schema}.branch_page on branch_page.page_id = page.page_id where branch_id = $ifnull(@branch_id, {schema}.my_current_branch_id()) and page_file_id is not null and page_path is not null';
              appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), [dbtypes.BigInt], { branch_id: branch_id }, function (err, rslt) {
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
              var sql = 'select media.media_key,media.media_path from {schema}.media  inner join {schema}.branch_media on branch_media.media_id = media.media_id where branch_id = $ifnull(@branch_id, {schema}.my_current_branch_id()) and media_file_id is not null and media_path is not null';
              appsrv.ExecRecordset(req._DBContext, funcs.replaceSchema(sql), [dbtypes.BigInt], { branch_id: branch_id }, function (err, rslt) {
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
                  else{
                    sitemap_item.sitemap_item_link_page = 'PAGE :: '+page_key+' :: Not found';
                  }
                }
                else if(sitemap_item_link_type=='MEDIA'){
                  var media_key = parseInt(sitemap_item.sitemap_item_link_dest);
                  if(media_key in media_keys){
                    sitemap_item.sitemap_item_link_media = media_keys[media_key];
                  }
                  else {
                    sitemap_item.sitemap_item_link_media = 'MEDIA :: '+media_key+' :: Not found';
                  }
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
        if (_.isString(sitemap_content.sitemap_items)){
          try{
            sitemap_content.sitemap_items = JSON.parse(sitemap_content.sitemap_items);
          }
          catch(ex){
            Helper.GenError(req, res, -4, 'Invalid Parameters');
            return;
          }
        }
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
        validate.AddValidator('_obj.sitemap_item_exclude_from_parent_menu', 'Exclude from Parent / Sibling Menus', 'B', [XValidate._v_IsNumeric(true),XValidate._v_InArray([0,1])]);
        validate.AddValidator('_obj.sitemap_item_hide_menu_parents', 'Menu: Hide Parents', 'B', [XValidate._v_IsNumeric(true),XValidate._v_InArray([0,1])]);
        validate.AddValidator('_obj.sitemap_item_hide_menu_siblings', 'Menu: Hide Siblings', 'B', [XValidate._v_IsNumeric(true),XValidate._v_InArray([0,1])]);
        validate.AddValidator('_obj.sitemap_item_hide_menu_children', 'Menu: Hide Children', 'B', [XValidate._v_IsNumeric(true),XValidate._v_InArray([0,1])]);
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

  exports.prettySitemap = function(sitemap_items, page_keys, media_keys, options){
    var options = _.extend({ text: true }, options);
    var rslt = '[\n';
    var rsltarr = [];

    //Generate indexed list of sitemap items by ID
    var sitemap_items_by_id = {};
    for(var i=0;i<sitemap_items.length;i++){
      var sitemap_item = sitemap_items[i];
      sitemap_item.collection_index = i;
      sitemap_items_by_id[sitemap_item.sitemap_item_id] = sitemap_item;
      if(!sitemap_item.sitemap_item_parent_id){
        sitemap_item.sitemap_item_path_text = '/' + Helper.StripTags(sitemap_item.sitemap_item_text).trim() + '/';
        sitemap_item.sitemap_item_collection_index_array = [sitemap_item.collection_index];
      }
    }

    //Generate text path
    function getTextPath(sitemap_item){
      if(!sitemap_item) return '';
      if(!sitemap_item.sitemap_item_path_text){
        sitemap_item.sitemap_item_parents = getTextPath(sitemap_items_by_id[sitemap_item.sitemap_item_parent_id]);
        sitemap_item.sitemap_item_path_text = sitemap_item.sitemap_item_parents + Helper.StripTags(sitemap_item.sitemap_item_text).trim() + '/';

        if(!sitemap_item.sitemap_item_collection_index_array){
          sitemap_item.sitemap_item_collection_index_array = sitemap_items_by_id[sitemap_item.sitemap_item_parent_id].sitemap_item_collection_index_array.concat([sitemap_item.collection_index]);
        }
      }
      return sitemap_item.sitemap_item_path_text;
    }

    //Clone sitemap_items
    sitemap_items = JSON.parse(JSON.stringify(sitemap_items||[]));

    //Get text paths
    _.each(sitemap_items, function(sitemap_item){
      getTextPath(sitemap_item);
    });

    if(options.text){
      //Sort sitemap items
      sitemap_items.sort(function(a,b){
        for(var i=0;i<a.sitemap_item_collection_index_array.length;i++){
          if(b.sitemap_item_collection_index_array.length <= i) return 1;
          if(a.sitemap_item_collection_index_array[i] > b.sitemap_item_collection_index_array[i]) return 1;
          if(a.sitemap_item_collection_index_array[i] < b.sitemap_item_collection_index_array[i]) return -1;
        }
        if(a.sitemap_item_collection_index_array.length < b.sitemap_item_collection_index_array.length) return -1;
        return 0;
      });
    }

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
      if(sitemap_item.sitemap_item_exclude_from_breadcrumbs && (sitemap_item.sitemap_item_exclude_from_breadcrumbs!='0')) print_item.exclude_from_breadcrumbs = sitemap_item.sitemap_item_exclude_from_breadcrumbs;
      if(sitemap_item.sitemap_item_exclude_from_parent_menu && (sitemap_item.sitemap_item_exclude_from_parent_menu!='0')) print_item.exclude_from_parent_menu = sitemap_item.sitemap_item_exclude_from_parent_menu;
      if(sitemap_item.sitemap_item_hide_menu_parents && (sitemap_item.sitemap_item_hide_menu_parents!='0')) print_item.hide_menu_parents = sitemap_item.sitemap_item_hide_menu_parents;
      if(sitemap_item.sitemap_item_hide_menu_siblings && (sitemap_item.sitemap_item_hide_menu_siblings!='0')) print_item.hide_menu_siblings = sitemap_item.sitemap_item_hide_menu_siblings;
      if(sitemap_item.sitemap_item_hide_menu_children && (sitemap_item.sitemap_item_hide_menu_children!='0')) print_item.hide_menu_children = sitemap_item.sitemap_item_hide_menu_children;
      
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

  exports.getPageSitemapRelatives = function(sitemap, page_key){
    /*
    Returns:
      self
      parents (hierarchy from current node to root) (+ siblings for each parent)
      siblings
      children

      * siblings arrays include the item itself
    */

    if(!sitemap) return {};
    var sitemap_items = _.cloneDeep(sitemap.sitemap_items || []);

    page_key = (page_key||'').toString();

    function parseSitemapBool(val){
      if(typeof val == 'undefined') return false;
      if(val === '1') return true;
      if(val === 1) return true;
      if(val === true) return true;
      return false;
    }

    var sitemap_items_by_id = {};
    for(var i=0;i<sitemap_items.length;i++){
      var sitemap_item = sitemap_items[i];
      sitemap_item.sitemap_item_id = (sitemap_item.sitemap_item_id||'').toString();
      sitemap_item.sitemap_item_link_dest = (sitemap_item.sitemap_item_link_dest||'').toString();
      sitemap_item.sitemap_item_parent_id = (sitemap_item.sitemap_item_parent_id||'').toString();
      sitemap_items_by_id[sitemap_item.sitemap_item_id.toString()] = sitemap_item;
      sitemap_item.sitemap_item_exclude_from_breadcrumbs = parseSitemapBool(sitemap_item.sitemap_item_exclude_from_breadcrumbs);
      sitemap_item.sitemap_item_exclude_from_parent_menu = parseSitemapBool(sitemap_item.sitemap_item_exclude_from_parent_menu);
      sitemap_item.sitemap_item_hide_menu_parents = parseSitemapBool(sitemap_item.sitemap_item_hide_menu_parents);
      sitemap_item.sitemap_item_hide_menu_siblings = parseSitemapBool(sitemap_item.sitemap_item_hide_menu_siblings);
      sitemap_item.sitemap_item_hide_menu_children = parseSitemapBool(sitemap_item.sitemap_item_hide_menu_children);
    }

    //Get full parent hierarchy from current item to root
    function getParents(sitemap_item){
      var rslt = [];
      var curParent = sitemap_items_by_id[sitemap_item.sitemap_item_parent_id];
      while(curParent){
        curParent.sitemap_item_siblings = [];
        rslt.unshift(curParent);
        curParent = sitemap_items_by_id[curParent.sitemap_item_parent_id];
      }
      return rslt;
    }

    //Get sitemap item
    var current_item = null;
    var matching_items = [];
    for(var i=0;i<sitemap_items.length;i++){
      var sitemap_item = sitemap_items[i];
      if((sitemap_item.sitemap_item_link_type=='PAGE') && (sitemap_item.sitemap_item_link_dest==page_key)){ matching_items.push(sitemap_item); }
    }
    if(matching_items.length == 1){
      //If one matching item with that page_key is found, use that item
      current_item = matching_items[0];
    }
    else if(matching_items.length > 1){
      //If multiple items found with the same page_key, use the lowest node of the first traversal
      //  -- ex. If 1st match = "About Us", and 2nd match = "About Us -> Overview", return "Overview"
      //  -- ex. If 1st match = "About Us", and 2nd match = "Services -> Overview", return "About Us" (since Services is not a child of About Us)
      var matching_items_hierarchy = [];
      for(var i=0;i<matching_items.length;i++){
        var sitemap_item_parents = getParents(matching_items[i]);
        var sitemap_item_hierarchy = [matching_items[i].sitemap_item_id];
        _.each(sitemap_item_parents, function(parent){ sitemap_item_hierarchy.push(parent.sitemap_item_id); });
        matching_items_hierarchy.push(sitemap_item_hierarchy);
      }
      while(
          (matching_items.length > 1) &&
          (matching_items[1].sitemap_item_parent_id && _.includes(matching_items_hierarchy[0], matching_items[1].sitemap_item_parent_id))
        ){ matching_items.shift(); matching_items_hierarchy.shift(); }
        current_item = matching_items[0];
    }

    var parents = null;
    var children = null;
    var breadcrumbs = null;
    //Get parents, children, and siblings of the current item
    if(current_item){
      current_item.sitemap_item_siblings = [];

      function removeSiblings(sitemap_item){
        sitemap_item = _.clone(sitemap_item);
        delete sitemap_item.sitemap_item_siblings;
        return sitemap_item;
      }

      //Get parents of current item
      parents = getParents(current_item);

      children = [];
      for(var i=0;i<sitemap_items.length;i++){
        var sitemap_item = sitemap_items[i];

        //Get children of current item
        if(sitemap_item.sitemap_item_parent_id==current_item.sitemap_item_id){ children.push(sitemap_item); }

        //Get siblings of current item
        if(!sitemap_item.sitemap_item_exclude_from_parent_menu && (sitemap_item.sitemap_item_parent_id==current_item.sitemap_item_parent_id)){ current_item.sitemap_item_siblings.push(removeSiblings(sitemap_item)); }
        //Get siblings of each parent in the hierarchy from current item to root
        for(var j=0;j<parents.length;j++){
          if(!sitemap_item.sitemap_item_exclude_from_parent_menu && (sitemap_item.sitemap_item_parent_id==parents[j].sitemap_item_parent_id)){ parents[j].sitemap_item_siblings.push(removeSiblings(sitemap_item)); }
        }
      }

      //Process hide_menu_children
      if(current_item.sitemap_item_hide_menu_children) children = [];

      //Process hide_menu_siblings
      if(current_item.sitemap_item_hide_menu_siblings || !current_item.sitemap_item_siblings.length) current_item.sitemap_item_siblings = [removeSiblings(current_item)];
      for(var i=0;i<parents.length;i++){
        var parent = parents[i];
        if(parent.sitemap_item_hide_menu_siblings || !parent.sitemap_item_siblings.length) parent.sitemap_item_siblings = [removeSiblings(parent)];
      }

      //Process hide_menu_parents
      breadcrumbs = [];
      _.each(parents, function(parent){
        if(!parent.sitemap_item_exclude_from_breadcrumbs) breadcrumbs.push(parent);
      });
      breadcrumbs.push(current_item);
      if(current_item.sitemap_item_hide_menu_parents) parents = [];
      for(var i=parents.length-1;i>=0;i--){
        var parent = parents[i];
        if(parent.sitemap_item_hide_menu_parents){
          parents.splice(0, i);
          break;
        }
      }
    }
    else if(!page_key){
      return {
        self: null,
        parents: null,
        breadcrumbs: null,
        children: null,
        sitemap_items: sitemap_items,
      };
    }

    var rslt = {
      self: current_item,
      parents: parents,
      breadcrumbs: breadcrumbs,
      children: children,
    };
    return JSON.parse(JSON.stringify(rslt));
  }

  exports.getSitemapUrl = function(sitemap_item, branchData){

    if((sitemap_item.sitemap_item_link_type||'').toString()=='PAGE'){
      var page_key = parseInt(sitemap_item.sitemap_item_link_dest);
      if(!branchData) return '#';
      if(!(page_key in branchData.page_keys)) throw new Error('Sitemap item  '+sitemap_item.sitemap_item_path+' :: '+sitemap_item.sitemap_item_text+' links to missing Page ID # '+page_key.toString());
      return branchData.page_keys[page_key];
    }
    else if((sitemap_item.sitemap_item_link_type||'').toString()=='MEDIA'){
      var media_key = parseInt(sitemap_item.sitemap_item_link_dest);
      if(!branchData) return '#';
      if(!(media_key in branchData.media_keys)) throw new Error('Sitemap item '+sitemap_item.sitemap_item_path+' :: '+sitemap_item.sitemap_item_text+' links to missing Media ID # '+media_key.toString());
      return branchData.media_keys[media_key];
    }
    return sitemap_item.sitemap_item_link_dest;
  }

  exports.createSitemapTree = function(sitemap, branchData){
    //Input:
    //  self + siblings
    //  parents + siblings
    //  children

    //***Populate children, siblings, parent
    //parent.siblings
    //parent.children
    //parent.parent
    //self.siblings
    //self.children
    //self.parent

    if(sitemap.self){
      //self.parent
      if(sitemap.parents && sitemap.parents.length) sitemap.self.parent = sitemap.parents[sitemap.parents.length-1];
      else sitemap.self.parent = null;

      //self.children
      sitemap.self.children = sitemap.children || [];
      //self.children.siblings
      for(var i=0;i<sitemap.self.children.length;i++){
        var child = sitemap.self.children[i];
        child.siblings = sitemap.self.children;
        child.parent = sitemap.self;
      }

      //self.siblings
      sitemap.self.siblings = sitemap.self.sitemap_item_siblings || [sitemap.self];
      for(var i=0;i<sitemap.self.siblings.length;i++){
        var sibling = sitemap.self.siblings[i];
        //Replace self in sitemap.self.siblings
        if(sibling.sitemap_item_id == sitemap.self.sitemap_item_id) sitemap.self.siblings[i] = sitemap.self;
        else{
          sibling.parent = sitemap.self.parent;
          sibling.children = [];
        }
      }
    }
    else if(sitemap.sitemap_items){
      //Generate sitemap tree
      var sitemap_item_parents = {};
      _.each(sitemap.sitemap_items, function(sitemap_item){
        sitemap_item_parents[(sitemap_item.sitemap_item_id||'').toString()] = sitemap_item;
        sitemap_item.children = [];
      });
      _.each(sitemap.sitemap_items, function(sitemap_item){
        var parent_id = (sitemap_item.sitemap_item_parent_id||'').toString()
        if(parent_id){
          sitemap_item.parent = sitemap_item_parents[parent_id];
          sitemap_item.siblings = [];
          if(sitemap_item.parent && !sitemap_item.sitemap_item_exclude_from_parent_menu){
            sitemap_item.siblings = sitemap_item.parent.children.slice();
            _.each(sitemap_item.parent.children, function(sibling){
              sibling.siblings.push(sitemap_item);
            });
            sitemap_item.parent.children.push(sitemap_item);
          }
        }
      });
    }

    //Replace self in each sitemap.parents.siblings
    if(sitemap.parents){
      for(var i=0;i<sitemap.parents.length;i++){
        var parent = sitemap.parents[i];

        //parent.parent
        if(i==0) parent.parent = null;
        else parent.parent = sitemap.parents[i-1];

        //parent.siblings
        parent.siblings = parent.sitemap_item_siblings || [parent];
        for(var j=0;j<parent.siblings.length;j++){
          if(parent.siblings[j].sitemap_item_id == parent.sitemap_item_id) parent.siblings[j] = parent;
        }
      }
      for(var i=0;i<sitemap.parents.length;i++){
        var parent = sitemap.parents[i];
        //parent.children
        if(i==(sitemap.parents.length-1)) parent.children = sitemap.self.siblings;
        else parent.children = sitemap.parents[i+1].siblings;
      }
    }

    //Generate tree and root
    if(sitemap.parents && sitemap.parents.length){
      sitemap.tree = [sitemap.parents[0]];
      sitemap.root = sitemap.parents[0];
    }
    else if(sitemap.self){
      sitemap.root = sitemap.self;
      sitemap.tree = sitemap.self.siblings;
    }
    else if(sitemap.sitemap_items){
      sitemap.tree = _.filter(sitemap.sitemap_items, function(sitemap_item){ return !sitemap_item.sitemap_item_parent_id && !sitemap_item.sitemap_item_exclude_from_parent_menu; });
    }
    else sitemap.tree = null;

    //Populate allItems
    sitemap.allItems = [];
    if(sitemap.sitemap_items){
      var addToAllItems = function(sitemap_item){
        sitemap.allItems.push(sitemap_item);
        _.each(sitemap_item.children, function(child_item){ addToAllItems(child_item); });
      }
      _.each(sitemap.tree, function(sitemap_item){ addToAllItems(sitemap_item); });
    }
    else {
      _.each(sitemap.parents, function(parent){
        _.each(parent.siblings, function(sibling){ sitemap.allItems.push(sibling); });
      });
      if(sitemap.self){
        _.each(sitemap.self.siblings, function(sibling){ sitemap.allItems.push(sibling); });
        _.each(sitemap.self.children, function(child){ sitemap.allItems.push(child); });
      }
    }
    

    //Populate id and item fields
    var itemsToProcess = sitemap.sitemap_items || sitemap.allItems;
    _.each(sitemap.breadcrumbs, function(sitemap_item){
      if(!_.includes(itemsToProcess, sitemap_item)) itemsToProcess.push(sitemap_item);
    });
    _.each(itemsToProcess, function(sitemap_item){
      sitemap_item.id = sitemap_item.sitemap_item_id;

      sitemap_item.sitemap_item_type = (sitemap_item.sitemap_item_type||'TEXT').toUpperCase();
      sitemap_item.sitemap_item_link_type = (sitemap_item.sitemap_item_link_type||'').toUpperCase();
      sitemap_item.sitemap_item_link_target = (sitemap_item.sitemap_item_link_target||'').toUpperCase();

      //html
      sitemap_item.html = sitemap_item.sitemap_item_text;
      if(sitemap_item.sitemap_item_type != 'HTML') sitemap_item.html = Helper.escapeHTML(sitemap_item.html);
      sitemap_item.text = Helper.StripTags(sitemap_item.html);

      sitemap_item.tag = sitemap_item.sitemap_item_tag || '';
      sitemap_item.sitemap_tag = sitemap.sitemap_tag || '';
      sitemap_item.class = sitemap_item.sitemap_item_class || '';
      sitemap_item.style = sitemap_item.sitemap_item_style || '';

      sitemap_item.href = '';
      sitemap_item.onclick = '';
      if(sitemap_item.sitemap_item_link_type){
        if(sitemap_item.sitemap_item_link_type=='JS'){
          sitemap_item.href = '#';
          sitemap_item.onclick = sitemap_item.sitemap_item_link_dest + '; return false;';
        } else {
          sitemap_item.href = funcs.getSitemapUrl(sitemap_item, branchData);
        }
      }
        
      sitemap_item.target = ((sitemap_item.sitemap_item_link_type != 'JS') && (sitemap_item.sitemap_item_link_target == 'NEWWIN')) ? '_blank' : '';
      sitemap_item.selected = (sitemap_item.sitemap_item_id === (sitemap.self && sitemap.self.sitemap_item_id));
    });

    //Populate parents, depth
    function resolveParent(sitemap_item){
      if(sitemap_item.parents) return;
      if(!sitemap_item.parent){
        sitemap_item.parents = [];
        sitemap_item.depth = 1;
        return;
      }
      if(!sitemap_item.parent.parents) resolveParent(sitemap_item.parent);
      sitemap_item.parents = sitemap_item.parent.parents.concat(sitemap_item.parent);
      sitemap_item.depth = sitemap_item.parent.depth + 1;
    }

    _.each(sitemap.allItems, function(sitemap_item){
      resolveParent(sitemap_item);
      sitemap_item.getSiblings = function(){
        var siblings = sitemap_item.parent ? sitemap_item.parent.children : sitemap.tree;
        return _.filter(siblings, function(sibling){ return sibling.id != sitemap_item.id; });
      }
    });

    
    //Debugging - Render Tree
    //(function renderTree(sitemap_items, prefix){
    //  prefix = prefix || '';
    //  _.each(sitemap_items, function(sitemap_item){
    //    console.log(prefix+(sitemap_item.selected?'*':'')+sitemap_item.sitemap_item_text);
    //    renderTree(sitemap_item.children, prefix + '  ');
    //  });
    //})(sitemap.tree);
    //console.log('---------');


    //Aliases
    sitemap.topItems = sitemap.tree;
    sitemap.currentItem = sitemap.self;
    sitemap.item = sitemap.self;
  }

  return exports;
};
