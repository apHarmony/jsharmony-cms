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
var async = require('async');
var prettyhtml = require('js-beautify').html;

module.exports = exports = function(module, funcs){
  var exports = {};
  
  exports.conflict = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};
    
    var Q = req.query;
    var P = {};
    if (req.body && ('data' in req.body)){
      try{ P = JSON.parse(req.body.data); }
      catch(ex){ Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
    }
    var appsrv = this;
    var jsh = module.jsh;
    var XValidate = jsh.XValidate;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Branch_Diff');
    
    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    if (verb == 'get') {
      var dst_branch_id = req.query.dst_branch_id;
      var src_branch_id = req.query.src_branch_id;

      //Check if Asset is defined
      var sql_ptypes = [dbtypes.BigInt, dbtypes.BigInt];
      var sql_params = { 'dst_branch_id': dst_branch_id, 'src_branch_id': src_branch_id };
      var validate = new XValidate();
      var verrors = {};
      validate.AddValidator('_obj.dst_branch_id', 'Destination Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      validate.AddValidator('_obj.src_branch_id', 'Source Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
 
      verrors = _.merge(verrors, validate.Validate('B', sql_params));
      if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

      var branch_pages = [];
      var branch_media = [];
      var branch_redirects = [];
      var branch_menus = [];
      var deployment_target_params = '';
      var pages = {};
      var media = {};
      var menus = {};
      var page_keys = {};
      var media_keys = {};

      async.waterfall([

        //Get deployment target params
        function(cb){
          var sql = "select deployment_target_params from "+(module.schema?module.schema+'.':'')+"branch left outer join "+(module.schema?module.schema+'.':'')+"v_my_site on v_my_site.site_id = branch.site_id where branch_id=@dst_branch_id";
          appsrv.ExecScalar(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]) deployment_target_params = rslt[0];
            return cb();
          });
        },
/*
        //Get all branch_media
        function(cb){
          var sql = "select branch_media.media_key, branch_media.branch_media_action, branch_media.media_id, branch_media.media_orig_id, \
              old_media.media_path old_media_path, old_media.media_file_id old_media_file_id, old_media.media_ext old_media_ext, old_media.media_width old_media_width, old_media.media_height old_media_height,\
              new_media.media_path new_media_path, new_media.media_file_id new_media_file_id, new_media.media_ext new_media_ext, new_media.media_width new_media_width, new_media.media_height new_media_height\
            from "+(module.schema?module.schema+'.':'')+"branch_media branch_media \
              left outer join "+(module.schema?module.schema+'.':'')+"media old_media on old_media.media_id=branch_media.media_orig_id \
              left outer join "+(module.schema?module.schema+'.':'')+"media new_media on new_media.media_id=branch_media.media_id \
            where branch_id=@branch_id and branch_media_action is not null and (old_media.media_is_folder=0 or new_media.media_is_folder=0)";
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]) branch_media = rslt[0];
            return cb();
          });
        },

        //Get all media
        function(cb){
          var sql = "select media_id,media_key,media_file_id,media_desc,media_path \
            from "+(module.schema?module.schema+'.':'')+"media media \
            where media_is_folder=0 and (\
                    media.media_id in (select media_id from "+(module.schema?module.schema+'.':'')+"branch_media where branch_id=@branch_id and branch_media_action is not null) or \
                    media.media_id in (select media_orig_id from "+(module.schema?module.schema+'.':'')+"branch_media where branch_id=@branch_id and branch_media_action = 'UPDATE') \
                  )";
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]){
              _.each(rslt[0], function(media){
                media[media.media_id] = media;
                media_keys[media.media_key] = media;
              });
            }
            return cb();
          });
        },

        //Get all branch_redirect
        function(cb){
          var sql = "select branch_redirect.redirect_key, branch_redirect.branch_redirect_action, branch_redirect.redirect_id, branch_redirect.redirect_orig_id, \
              old_redirect.redirect_url old_redirect_url, old_redirect.redirect_dest old_redirect_dest,\
              new_redirect.redirect_url new_redirect_url, new_redirect.redirect_dest new_redirect_dest\
            from "+(module.schema?module.schema+'.':'')+"branch_redirect branch_redirect \
              left outer join "+(module.schema?module.schema+'.':'')+"redirect old_redirect on old_redirect.redirect_id=branch_redirect.redirect_orig_id \
              left outer join "+(module.schema?module.schema+'.':'')+"redirect new_redirect on new_redirect.redirect_id=branch_redirect.redirect_id \
            where branch_id=@branch_id and branch_redirect_action is not null";
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]) branch_redirects = rslt[0];
            return cb();
          });
        },
*/
        //Get all branch_page
        function(cb){
          var sql = "select src_branch_page.page_key, src_branch_page.branch_page_action, src_branch_page.page_id as src_page_id, src_branch_page.page_orig_id, dst_branch_page.page_id as dst_page_id, \
              old_page.page_path old_page_path, old_page.page_title old_page_title, old_page.page_file_id old_page_file_id, old_page.page_filename old_page_filename, old_page.page_template_id old_page_template_id,\
              src_page.page_path src_page_path, src_page.page_title src_page_title, src_page.page_file_id src_page_file_id, src_page.page_filename src_page_filename, src_page.page_template_id src_page_template_id,\
              dst_page.page_path dst_page_path, dst_page.page_title dst_page_title, dst_page.page_file_id dst_page_file_id, dst_page.page_filename dst_page_filename, dst_page.page_template_id src_page_template_id\
            from "+(module.schema?module.schema+'.':'')+"branch_page src_branch_page \
              inner join "+(module.schema?module.schema+'.':'')+"branch_page dst_branch_page on dst_branch_page.page_key=src_branch_page.page_key and dst_branch_page.branch_id=@dst_branch_id \
              left outer join "+(module.schema?module.schema+'.':'')+"page old_page on old_page.page_id=src_branch_page.page_orig_id \
              left outer join "+(module.schema?module.schema+'.':'')+"page src_page on src_page.page_id=src_branch_page.page_id \
              left outer join "+(module.schema?module.schema+'.':'')+"page dst_page on dst_page.page_id=dst_branch_page.page_id \
            where src_branch_page.branch_id=@src_branch_id and src_branch_page.branch_page_action is not null\
              and (old_page.page_is_folder=0 or src_page.page_is_folder=0 or dst_page.page_is_folder=0)\
              and dst_branch_page.page_id<>src_branch_page.page_orig_id";
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            console.log(rslt);
            if(rslt && rslt[0]) branch_pages = rslt[0];
            return cb();
          });
        },

        //Get all pages
        function(cb){
          var sql = "select page_id,page_key,page_file_id,page_title,page_path,page_tags,page_author,page_template_id,page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_review_sts,page_lang \
            from "+(module.schema?module.schema+'.':'')+"page page \
            where page_is_folder = 0 and (\
                    page.page_id in (select page_id from "+(module.schema?module.schema+'.':'')+"branch_page where branch_id=@src_branch_id and branch_page_action is not null) or \
                    page.page_id in (select page_orig_id from "+(module.schema?module.schema+'.':'')+"branch_page where branch_id=@src_branch_id and branch_page_action = 'UPDATE') or \
                    page.page_id in (select page_id from "+(module.schema?module.schema+'.':'')+"branch_page dst_branch_page where dst_branch_page.branch_id=@dst_branch_id and dst_branch_page.page_key in (select page_key from "+(module.schema?module.schema+'.':'')+"branch_page src_branch_page where src_branch_page.branch_id=@src_branch_id and branch_page_action is not null)) \
                  )";
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]){
              _.each(rslt[0], function(page){
                pages[page.page_id] = page;
                page_keys[page.page_key] = page;
              });
            }
            return cb();
          });
        },

        //Get page file content
        function(cb){
          async.eachOfSeries(pages, function(page, page_id, page_cb){
            funcs.getClientPage(page, function(err, clientPage){
              if(err) return page_cb(err);
              if(!clientPage) return page_cb(null); 
              page.compiled = clientPage.page;
              page.template = clientPage.template;
              if(page.compiled.content){
                var pretty_params = {
                  unformatted: ['code', 'pre'],
                  indent_inner_html: true,
                  indent_char: ' ',
                  indent_size: 2,
                  sep: '\n'
                };
                for(var key in page.compiled.content){
                  page.compiled.content[key] = prettyhtml(page.compiled.content[key], pretty_params);
                }
              }
              page.template_title = clientPage.template.title;
              return page_cb(null);
            });
          }, cb);
        },

        //Perform page diff
        function(cb){

          _.each(branch_pages, function(branch_page){
            if(branch_page.branch_page_action.toUpperCase()=='UPDATE'){
              branch_page.src_diff = funcs.twoWayDiff(pages[branch_page.page_orig_id], pages[branch_page.src_page_id]);
              branch_page.dst_diff = funcs.twoWayDiff(pages[branch_page.page_orig_id], pages[branch_page.dst_page_id]);
            }
          });
          return cb();
        },
/*
        //Get all branch_menu
        function(cb){
          var sql = "select branch_menu.menu_key, branch_menu.branch_menu_action, branch_menu.menu_id, branch_menu.menu_orig_id, \
              old_menu.menu_name old_menu_name, old_menu.menu_tag old_menu_tag, old_menu.menu_file_id old_menu_file_id,\
              new_menu.menu_name new_menu_name, new_menu.menu_tag new_menu_tag, new_menu.menu_file_id new_menu_file_id\
            from "+(module.schema?module.schema+'.':'')+"branch_menu branch_menu \
              left outer join "+(module.schema?module.schema+'.':'')+"menu old_menu on old_menu.menu_id=branch_menu.menu_orig_id \
              left outer join "+(module.schema?module.schema+'.':'')+"menu new_menu on new_menu.menu_id=branch_menu.menu_id \
            where branch_id=@branch_id and branch_menu_action is not null";
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]) branch_menus = rslt[0];
            return cb();
          });
        },

        //Get all menus
        function(cb){
          var sql = "select menu_id,menu_key,menu_file_id,menu_name,menu_tag,menu_template_id,menu_path \
            from "+(module.schema?module.schema+'.':'')+"menu menu \
            where menu.menu_id in (select menu_id from "+(module.schema?module.schema+'.':'')+"branch_menu where branch_id=@branch_id and branch_menu_action is not null) or \
                  menu.menu_id in (select menu_orig_id from "+(module.schema?module.schema+'.':'')+"branch_menu where branch_id=@branch_id and branch_menu_action = 'UPDATE')";
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]){
              _.each(rslt[0], function(menu){
                menus[menu.menu_id] = menu;
              });
            }
            return cb();
          });
        },

        //Get menu file content
        function(cb){
          async.eachOfSeries(menus, function(menu, menu_id, menu_cb){
            funcs.getClientMenu(menu, function(err, menu_content){
              if(err) return menu_cb(err);
              if(!menu_content) return menu_cb(null);
              menu.menu_items_text = funcs.prettyMenu(menu_content.menu_items, page_keys, media_keys);
              menu.template_title = menu_content.template.title;
              return menu_cb();
            });
          }, cb);
        },

        //Perform menu diff
        function(cb){
          _.each(branch_menus, function(branch_menu){
            if(branch_menu.branch_menu_action.toUpperCase()=='UPDATE'){
              var old_menu = menus[branch_menu.menu_orig_id];
              var new_menu = menus[branch_menu.menu_id];
              
              branch_menu.diff = {};
              var menu_items_diff = funcs.diffHTML(old_menu.menu_items_text, new_menu.menu_items_text);
              if(menu_items_diff) branch_menu.diff.menu_items = menu_items_diff;
              _.each(['menu_name','menu_tag','template_title','menu_path'], function(key){
                if(old_menu[key] != new_menu[key]) branch_menu.diff[key] = new_menu[key];
              });
            }
          });
          return cb();
        },
*/
      ], function(err){
        if(err) return Helper.GenError(req, res, -99999, err.toString());
        res.end(JSON.stringify({
          _success: 1,
          deployment_target_params: deployment_target_params,
          branch_pages: branch_pages,
          branch_redirects: branch_redirects,
          branch_media: branch_media,
          branch_menus: branch_menus
        }));
      });
      return;
    }
    else {
      return next();
    }
  }

  return exports;
};
