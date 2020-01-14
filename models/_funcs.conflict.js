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

    var model = jsh.getModel(req, module.namespace + 'Branch_Conflict');
    
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
      var branch_sitemaps = [];
      var deployment_target_params = '';
      var updated_pages = {};
      var menus = {};
      var sitemaps = {};
      var page_keys = {};
      var media_keys = {};

      async.waterfall([

        function(cb){
          funcs.check_merge_permissions(req._DBContext, sql_params, cb);
        },

        //Get deployment target params
        function(cb){
          var sql = "select deployment_target_params from "+(module.schema?module.schema+'.':'')+"branch left outer join "+(module.schema?module.schema+'.':'')+"v_my_site on v_my_site.site_id = branch.site_id where branch_id=@dst_branch_id";
          appsrv.ExecScalar(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]) deployment_target_params = rslt[0];
            return cb();
          });
        },

        //Get all branch_media
        function(cb){
          var sql = "select src_branch_media.media_key,\
              src_branch_media.branch_media_action as src_branch_media_action, src_branch_media.media_id as src_media_id, src_branch_media.media_orig_id as src_media_orig_id, src_branch_media.media_orig_id as src_orig_media_id,\
              dst_branch_media.branch_media_action as dst_branch_media_action, dst_branch_media.media_id as dst_media_id, dst_branch_media.media_orig_id as dst_media_orig_id, dst_branch_media.media_orig_id as dst_orig_media_id,\
              dst_branch_media.media_merge_id, dst_branch_media.media_merge_id as merge_media_id, dst_branch_media.branch_media_merge_action, \
              src_orig_media.media_path src_orig_media_path, src_orig_media.media_file_id src_orig_media_file_id, src_orig_media.media_ext src_orig_media_ext, src_orig_media.media_width src_orig_media_width, src_orig_media.media_height src_orig_media_height,\
              dst_orig_media.media_path dst_orig_media_path, dst_orig_media.media_file_id dst_orig_media_file_id, dst_orig_media.media_ext dst_orig_media_ext, dst_orig_media.media_width dst_orig_media_width, dst_orig_media.media_height dst_orig_media_height,\
              src_media.media_path src_media_path, src_media.media_file_id src_media_file_id, src_media.media_ext src_media_ext, src_media.media_width src_media_width, src_media.media_height src_media_height,\
              dst_media.media_path dst_media_path, dst_media.media_file_id dst_media_file_id, dst_media.media_ext dst_media_ext, dst_media.media_width dst_media_width, dst_media.media_height dst_media_height,\
              merge_media.media_path merge_media_path, merge_media.media_file_id merge_media_file_id, merge_media.media_ext merge_media_ext, merge_media.media_width merge_media_width, merge_media.media_height merge_media_height\
            from "+(module.schema?module.schema+'.':'')+"branch_media src_branch_media \
              inner join "+(module.schema?module.schema+'.':'')+"branch_media dst_branch_media on dst_branch_media.media_key=src_branch_media.media_key and dst_branch_media.branch_id=@dst_branch_id \
              left outer join "+(module.schema?module.schema+'.':'')+"media src_orig_media on src_orig_media.media_id=src_branch_media.media_orig_id \
              left outer join "+(module.schema?module.schema+'.':'')+"media dst_orig_media on dst_orig_media.media_id=dst_branch_media.media_orig_id \
              left outer join "+(module.schema?module.schema+'.':'')+"media src_media on src_media.media_id=src_branch_media.media_id \
              left outer join "+(module.schema?module.schema+'.':'')+"media dst_media on dst_media.media_id=dst_branch_media.media_id \
              left outer join "+(module.schema?module.schema+'.':'')+"media merge_media on merge_media.media_id=dst_branch_media.media_merge_id \
            where src_branch_media.branch_id=@src_branch_id\
              and (src_orig_media.media_is_folder=0 or dst_orig_media.media_is_folder=0 or src_media.media_is_folder=0 or dst_media.media_is_folder=0)\
              and ((src_branch_media.branch_media_action is not null and src_branch_media.media_orig_id<>dst_branch_media.media_id)\
               or  (dst_branch_media.branch_media_action is not null and dst_branch_media.media_orig_id<>src_branch_media.media_id))";
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]) branch_media = rslt[0];
            return cb();
          });
        },

        //Get all media
        function(cb){
          var sql = "\
            select 'DST_NEW' branch_diff_type,media_id,media_key,media_file_id,media_desc,media_path \
              from "+(module.schema?module.schema+'.':'')+"media media where media_is_folder=0 and media.media_id in (select media_id from "+(module.schema?module.schema+'.':'')+"branch_media where branch_id=@dst_branch_id)\
            union all \
            select 'DST_PREV' branch_diff_type,media_id,media_key,media_file_id,media_desc,media_path \
              from "+(module.schema?module.schema+'.':'')+"media media where media_is_folder=0 and media.media_id in (select media_orig_id from "+(module.schema?module.schema+'.':'')+"branch_media where branch_id=@dst_branch_id)\
            union all \
            select 'SRC_NEW' branch_diff_type,media_id,media_key,media_file_id,media_desc,media_path \
              from "+(module.schema?module.schema+'.':'')+"media media where media_is_folder=0 and media.media_id in (select media_id from "+(module.schema?module.schema+'.':'')+"branch_media where branch_id=@src_branch_id)\
            union all \
            select 'SRC_PREV' branch_diff_type,media_id,media_key,media_file_id,media_desc,media_path \
              from "+(module.schema?module.schema+'.':'')+"media media where media_is_folder=0 and media.media_id in (select media_orig_id from "+(module.schema?module.schema+'.':'')+"branch_media where branch_id=@src_branch_id)\
          ";
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]){
              _.each(rslt[0], function(media){
                if(
                  (media.branch_diff_type=='DST_NEW') ||
                  (media.branch_diff_type=='DST_PREV' && !(media.media_key in media_keys)) ||
                  (media.branch_diff_type=='SRC_NEW' && !(media.media_key in media_keys)) ||
                  (media.branch_diff_type=='DST_PRV' && !(media.media_key in media_keys))
                  ) media_keys[media.media_key] = media;
              });
            }
            return cb();
          });
        },

        //Get all branch_redirect
        function(cb){
          var sql = "select src_branch_redirect.redirect_key,\
              src_branch_redirect.branch_redirect_action as src_branch_redirect_action, src_branch_redirect.redirect_id as src_redirect_id, src_branch_redirect.redirect_orig_id as src_redirect_orig_id, src_branch_redirect.redirect_orig_id as src_orig_redirect_id, \
              dst_branch_redirect.branch_redirect_action as dst_branch_redirect_action, dst_branch_redirect.redirect_id as dst_redirect_id, dst_branch_redirect.redirect_orig_id as dst_redirect_orig_id, dst_branch_redirect.redirect_orig_id as dst_orig_redirect_id,\
              dst_branch_redirect.redirect_merge_id, dst_branch_redirect.redirect_merge_id as merge_redirect_id, dst_branch_redirect.branch_redirect_merge_action, \
              src_orig_redirect.redirect_url src_orig_redirect_url, src_orig_redirect.redirect_dest src_orig_redirect_dest,\
              dst_orig_redirect.redirect_url dst_orig_redirect_url, dst_orig_redirect.redirect_dest dst_orig_redirect_dest,\
              src_redirect.redirect_url src_redirect_url, src_redirect.redirect_dest src_redirect_dest,\
              dst_redirect.redirect_url dst_redirect_url, dst_redirect.redirect_dest dst_redirect_dest,\
              merge_redirect.redirect_url merge_redirect_url, merge_redirect.redirect_dest merge_redirect_dest\
            from "+(module.schema?module.schema+'.':'')+"branch_redirect src_branch_redirect \
              inner join "+(module.schema?module.schema+'.':'')+"branch_redirect dst_branch_redirect on dst_branch_redirect.redirect_key=src_branch_redirect.redirect_key and dst_branch_redirect.branch_id=@dst_branch_id \
              left outer join "+(module.schema?module.schema+'.':'')+"redirect src_orig_redirect on src_orig_redirect.redirect_id=src_branch_redirect.redirect_orig_id \
              left outer join "+(module.schema?module.schema+'.':'')+"redirect dst_orig_redirect on dst_orig_redirect.redirect_id=dst_branch_redirect.redirect_orig_id \
              left outer join "+(module.schema?module.schema+'.':'')+"redirect src_redirect on src_redirect.redirect_id=src_branch_redirect.redirect_id \
              left outer join "+(module.schema?module.schema+'.':'')+"redirect dst_redirect on dst_redirect.redirect_id=dst_branch_redirect.redirect_id \
              left outer join "+(module.schema?module.schema+'.':'')+"redirect merge_redirect on merge_redirect.redirect_id=dst_branch_redirect.redirect_merge_id \
            where src_branch_redirect.branch_id=@src_branch_id\
              and ((src_branch_redirect.branch_redirect_action is not null and src_branch_redirect.redirect_orig_id<>dst_branch_redirect.redirect_id)\
               or  (dst_branch_redirect.branch_redirect_action is not null and dst_branch_redirect.redirect_orig_id<>src_branch_redirect.redirect_id))";
       appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]) branch_redirects = rslt[0];
            return cb();
          });
        },

        //Get all branch_page
        function(cb){
          var sql = "select src_branch_page.page_key,\
              src_branch_page.branch_page_action as src_branch_page_action, src_branch_page.page_id as src_page_id, src_branch_page.page_orig_id as src_page_orig_id, src_branch_page.page_orig_id as src_orig_page_id,\
              dst_branch_page.branch_page_action as dst_branch_page_action, dst_branch_page.page_id as dst_page_id, dst_branch_page.page_orig_id as dst_page_orig_id, dst_branch_page.page_orig_id as dst_orig_page_id,\
              dst_branch_page.page_merge_id, dst_branch_page.page_merge_id merge_page_id, dst_branch_page.branch_page_merge_action, \
              src_orig_page.page_path src_orig_page_path, src_orig_page.page_title src_orig_page_title, src_orig_page.page_file_id src_orig_page_file_id, src_orig_page.page_filename src_orig_page_filename, src_orig_page.page_template_id src_orig_page_template_id,\
              dst_orig_page.page_path dst_orig_page_path, dst_orig_page.page_title dst_orig_page_title, dst_orig_page.page_file_id dst_orig_page_file_id, dst_orig_page.page_filename dst_orig_page_filename, dst_orig_page.page_template_id dst_orig_page_template_id,\
              src_page.page_path src_page_path, src_page.page_title src_page_title, src_page.page_file_id src_page_file_id, src_page.page_filename src_page_filename, src_page.page_template_id src_page_template_id,\
              dst_page.page_path dst_page_path, dst_page.page_title dst_page_title, dst_page.page_file_id dst_page_file_id, dst_page.page_filename dst_page_filename, dst_page.page_template_id dst_page_template_id,\
              merge_page.page_path merge_page_path, merge_page.page_title merge_page_title, merge_page.page_file_id merge_page_file_id, merge_page.page_filename merge_page_filename, merge_page.page_template_id merge_page_template_id\
            from "+(module.schema?module.schema+'.':'')+"branch_page src_branch_page \
              inner join "+(module.schema?module.schema+'.':'')+"branch_page dst_branch_page on dst_branch_page.page_key=src_branch_page.page_key and dst_branch_page.branch_id=@dst_branch_id \
              left outer join "+(module.schema?module.schema+'.':'')+"page src_orig_page on src_orig_page.page_id=src_branch_page.page_orig_id \
              left outer join "+(module.schema?module.schema+'.':'')+"page dst_orig_page on dst_orig_page.page_id=dst_branch_page.page_orig_id \
              left outer join "+(module.schema?module.schema+'.':'')+"page src_page on src_page.page_id=src_branch_page.page_id \
              left outer join "+(module.schema?module.schema+'.':'')+"page dst_page on dst_page.page_id=dst_branch_page.page_id \
              left outer join "+(module.schema?module.schema+'.':'')+"page merge_page on merge_page.page_id=dst_branch_page.page_merge_id \
            where src_branch_page.branch_id=@src_branch_id\
              and (src_orig_page.page_is_folder=0 or dst_orig_page.page_is_folder=0 or src_page.page_is_folder=0 or dst_page.page_is_folder=0)\
              and ((src_branch_page.branch_page_action is not null and src_branch_page.page_orig_id<>dst_branch_page.page_id)\
               or  (dst_branch_page.branch_page_action is not null and dst_branch_page.page_orig_id<>src_branch_page.page_id))";
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]) branch_pages = rslt[0];
            return cb();
          });
        },

        //Get all pages
        function(cb){
          var sql = "\
            select 'DST_NEW' branch_diff_type,page_id,page_key,page_file_id,page_title,page_path,page_tags,page_author,page_template_id,page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_review_sts,page_lang \
              from "+(module.schema?module.schema+'.':'')+"page page where page_is_folder = 0 and page.page_id in (select page_id from "+(module.schema?module.schema+'.':'')+"branch_page where branch_id=@dst_branch_id) \
            union all \
            select 'DST_PREV' branch_diff_type,page_id,page_key,page_file_id,page_title,page_path,page_tags,page_author,page_template_id,page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_review_sts,page_lang \
              from "+(module.schema?module.schema+'.':'')+"page page where page_is_folder = 0 and page.page_id in (select page_orig_id from "+(module.schema?module.schema+'.':'')+"branch_page where branch_id=@dst_branch_id) \
            union all \
            select 'SRC_NEW' branch_diff_type,page_id,page_key,page_file_id,page_title,page_path,page_tags,page_author,page_template_id,page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_review_sts,page_lang \
              from "+(module.schema?module.schema+'.':'')+"page page where page_is_folder = 0 and page.page_id in (select page_id from "+(module.schema?module.schema+'.':'')+"branch_page where branch_id=@src_branch_id) \
            union all \
            select 'SRC_PREV' branch_diff_type,page_id,page_key,page_file_id,page_title,page_path,page_tags,page_author,page_template_id,page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_review_sts,page_lang \
              from "+(module.schema?module.schema+'.':'')+"page page where page_is_folder = 0 and page.page_id in (select page_orig_id from "+(module.schema?module.schema+'.':'')+"branch_page where branch_id=@src_branch_id) \
          ";
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]){
              _.each(rslt[0], function(page){
                page_keys[page.page_key] = page;
                if(
                  (page.branch_diff_type=='DST_NEW') ||
                  (page.branch_diff_type=='DST_PREV' && !(page.page_key in page_keys)) ||
                  (page.branch_diff_type=='SRC_NEW' && !(page.page_key in page_keys)) ||
                  (page.branch_diff_type=='SRC_PREV' && !(page.page_key in page_keys))
                  ) page_keys[page.page_key] = page;
              });
            }
            return cb();
          });
        },

        //Get updated pages
        function(cb){
          var sql = "select page_id,page_key,page_file_id,page_title,page_path,page_tags,page_author,page_template_id,page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_review_sts,page_lang \
            from "+(module.schema?module.schema+'.':'')+"page page \
            where page_is_folder = 0 and (\
                    page.page_id in (select page_id from "+(module.schema?module.schema+'.':'')+"branch_page where branch_id=@src_branch_id and branch_page_action is not null) or \
                    page.page_id in (select page_orig_id from "+(module.schema?module.schema+'.':'')+"branch_page where branch_id=@src_branch_id and branch_page_action = 'UPDATE') or \
                    page.page_id in (select page_id from "+(module.schema?module.schema+'.':'')+"branch_page src_branch_page where src_branch_page.branch_id=@src_branch_id and src_branch_page.page_key in (select page_key from "+(module.schema?module.schema+'.':'')+"branch_page dst_branch_page where dst_branch_page.branch_id=@dst_branch_id and branch_page_action is not null)) or \
                    page.page_id in (select page_id from "+(module.schema?module.schema+'.':'')+"branch_page where branch_id=@dst_branch_id and branch_page_action is not null) or \
                    page.page_id in (select page_orig_id from "+(module.schema?module.schema+'.':'')+"branch_page where branch_id=@dst_branch_id and branch_page_action = 'UPDATE') or \
                    page.page_id in (select page_id from "+(module.schema?module.schema+'.':'')+"branch_page dst_branch_page where dst_branch_page.branch_id=@dst_branch_id and dst_branch_page.page_key in (select page_key from "+(module.schema?module.schema+'.':'')+"branch_page src_branch_page where src_branch_page.branch_id=@src_branch_id and branch_page_action is not null)) \
                  )";
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]){
              _.each(rslt[0], function(page){
                updated_pages[page.page_id] = page;
              });
            }
            return cb();
          });
        },

        //Get page file content
        function(cb){
          async.eachOfSeries(updated_pages, function(page, page_id, page_cb){
            funcs.getClientPage(page, null, function(err, clientPage){
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
            if(branch_page.src_branch_page_action && branch_page.src_branch_page_action.toUpperCase()=='UPDATE'
            && branch_page.dst_branch_page_action && branch_page.dst_branch_page_action.toUpperCase()=='UPDATE'){
              branch_page.src_diff = funcs.pageDiff(updated_pages[branch_page.src_page_orig_id], updated_pages[branch_page.src_page_id]);
              branch_page.dst_diff = funcs.pageDiff(updated_pages[branch_page.dst_page_orig_id], updated_pages[branch_page.dst_page_id]);
            }
            else if(branch_page.src_branch_page_action && branch_page.src_branch_page_action.toUpperCase()=='UPDATE'){
              branch_page.src_diff = funcs.pageDiff(updated_pages[branch_page.src_page_orig_id], updated_pages[branch_page.src_page_id]);
              branch_page.dst_diff = funcs.pageDiff(updated_pages[branch_page.src_page_orig_id], updated_pages[branch_page.dst_page_id]);
            }
            else if(branch_page.dst_branch_page_action && branch_page.dst_branch_page_action.toUpperCase()=='UPDATE'){
              branch_page.src_diff = funcs.pageDiff(updated_pages[branch_page.dst_page_orig_id], updated_pages[branch_page.src_page_id]);
              branch_page.dst_diff = funcs.pageDiff(updated_pages[branch_page.dst_page_orig_id], updated_pages[branch_page.dst_page_id]);
            }
          });
          return cb();
        },

        //Get all branch_menu
        function(cb){
          var sql = "select src_branch_menu.menu_key,\
              src_branch_menu.branch_menu_action as src_branch_menu_action, src_branch_menu.menu_id as src_menu_id, src_branch_menu.menu_orig_id as src_menu_orig_id, src_branch_menu.menu_orig_id as src_orig_menu_id,\
              dst_branch_menu.branch_menu_action as dst_branch_menu_action, dst_branch_menu.menu_id as dst_menu_id, dst_branch_menu.menu_orig_id as dst_menu_orig_id, dst_branch_menu.menu_orig_id as dst_orig_menu_id,\
              dst_branch_menu.menu_merge_id, dst_branch_menu.menu_merge_id merge_menu_id, dst_branch_menu.branch_menu_merge_action, \
              src_orig_menu.menu_name src_orig_menu_name, src_orig_menu.menu_tag src_orig_menu_tag, src_orig_menu.menu_file_id src_orig_menu_file_id,\
              dst_orig_menu.menu_name dst_orig_menu_name, dst_orig_menu.menu_tag dst_orig_menu_tag, dst_orig_menu.menu_file_id dst_orig_menu_file_id,\
              src_menu.menu_name src_menu_name, src_menu.menu_tag src_menu_tag, src_menu.menu_file_id src_menu_file_id,\
              dst_menu.menu_name dst_menu_name, dst_menu.menu_tag dst_menu_tag, dst_menu.menu_file_id dst_menu_file_id,\
              merge_menu.menu_name merge_menu_name, merge_menu.menu_tag merge_menu_tag, merge_menu.menu_file_id merge_menu_file_id\
            from "+(module.schema?module.schema+'.':'')+"branch_menu src_branch_menu \
              inner join "+(module.schema?module.schema+'.':'')+"branch_menu dst_branch_menu on dst_branch_menu.menu_key=src_branch_menu.menu_key and dst_branch_menu.branch_id=@dst_branch_id \
              left outer join "+(module.schema?module.schema+'.':'')+"menu src_orig_menu on src_orig_menu.menu_id=src_branch_menu.menu_orig_id \
              left outer join "+(module.schema?module.schema+'.':'')+"menu dst_orig_menu on dst_orig_menu.menu_id=dst_branch_menu.menu_orig_id \
              left outer join "+(module.schema?module.schema+'.':'')+"menu src_menu on src_menu.menu_id=src_branch_menu.menu_id \
              left outer join "+(module.schema?module.schema+'.':'')+"menu dst_menu on dst_menu.menu_id=dst_branch_menu.menu_id \
              left outer join "+(module.schema?module.schema+'.':'')+"menu merge_menu on merge_menu.menu_id=dst_branch_menu.menu_merge_id \
            where src_branch_menu.branch_id=@src_branch_id\
              and ((src_branch_menu.branch_menu_action is not null and src_branch_menu.menu_orig_id<>dst_branch_menu.menu_id)\
               or  (dst_branch_menu.branch_menu_action is not null and dst_branch_menu.menu_orig_id<>src_branch_menu.menu_id))";
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
            where\
                  menu.menu_id in (select menu_id from "+(module.schema?module.schema+'.':'')+"branch_menu where branch_id=@src_branch_id and branch_menu_action is not null) or \
                  menu.menu_id in (select menu_orig_id from "+(module.schema?module.schema+'.':'')+"branch_menu where branch_id=@src_branch_id and branch_menu_action = 'UPDATE') or\
                  menu.menu_id in (select menu_id from "+(module.schema?module.schema+'.':'')+"branch_menu src_branch_menu where src_branch_menu.branch_id=@src_branch_id and src_branch_menu.menu_key in (select menu_key from "+(module.schema?module.schema+'.':'')+"branch_menu dst_branch_menu where dst_branch_menu.branch_id=@dst_branch_id and branch_menu_action is not null)) or \
                  menu.menu_id in (select menu_id from "+(module.schema?module.schema+'.':'')+"branch_menu where branch_id=@dst_branch_id and branch_menu_action is not null) or \
                  menu.menu_id in (select menu_orig_id from "+(module.schema?module.schema+'.':'')+"branch_menu where branch_id=@dst_branch_id and branch_menu_action = 'UPDATE') or\
                  menu.menu_id in (select menu_id from "+(module.schema?module.schema+'.':'')+"branch_menu dst_branch_menu where dst_branch_menu.branch_id=@dst_branch_id and dst_branch_menu.menu_key in (select menu_key from "+(module.schema?module.schema+'.':'')+"branch_menu src_branch_menu where src_branch_menu.branch_id=@src_branch_id and branch_menu_action is not null))";
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
            if(branch_menu.src_branch_menu_action && branch_menu.src_branch_menu_action.toUpperCase()=='UPDATE'
            && branch_menu.dst_branch_menu_action && branch_menu.dst_branch_menu_action.toUpperCase()=='UPDATE'){
              branch_menu.src_diff = funcs.menuDiff(menus[branch_menu.src_menu_orig_id], menus[branch_menu.src_menu_id]);
              branch_menu.dst_diff = funcs.menuDiff(menus[branch_menu.dst_menu_orig_id], menus[branch_menu.dst_menu_id]);
            }
            else if(branch_menu.src_branch_menu_action && branch_menu.src_branch_menu_action.toUpperCase()=='UPDATE'){
              branch_menu.src_diff = funcs.menuDiff(menus[branch_menu.src_menu_orig_id], menus[branch_menu.src_menu_id]);
              branch_menu.dst_diff = funcs.menuDiff(menus[branch_menu.src_menu_orig_id], menus[branch_menu.dst_menu_id]);
            }
            else if(branch_menu.dst_branch_menu_action && branch_menu.dst_branch_menu_action.toUpperCase()=='UPDATE'){
              branch_menu.src_diff = funcs.menuDiff(menus[branch_menu.dst_menu_orig_id], menus[branch_menu.src_menu_id]);
              branch_menu.dst_diff = funcs.menuDiff(menus[branch_menu.dst_menu_orig_id], menus[branch_menu.dst_menu_id]);
            }
          });
          return cb();
        },

        //Get all branch_sitemap
        function(cb){
          var sql = "select src_branch_sitemap.sitemap_key,\
              src_branch_sitemap.branch_sitemap_action as src_branch_sitemap_action, src_branch_sitemap.sitemap_id as src_sitemap_id, src_branch_sitemap.sitemap_orig_id as src_sitemap_orig_id, src_branch_sitemap.sitemap_orig_id as src_orig_sitemap_id,\
              dst_branch_sitemap.branch_sitemap_action as dst_branch_sitemap_action, dst_branch_sitemap.sitemap_id as dst_sitemap_id, dst_branch_sitemap.sitemap_orig_id as dst_sitemap_orig_id, dst_branch_sitemap.sitemap_orig_id as dst_orig_sitemap_id,\
              dst_branch_sitemap.sitemap_merge_id, dst_branch_sitemap.sitemap_merge_id merge_sitemap_id, dst_branch_sitemap.branch_sitemap_merge_action, \
              src_orig_sitemap.sitemap_name src_orig_sitemap_name, src_orig_sitemap.sitemap_type src_orig_sitemap_type, src_orig_sitemap.sitemap_file_id src_orig_sitemap_file_id,\
              dst_orig_sitemap.sitemap_name dst_orig_sitemap_name, dst_orig_sitemap.sitemap_type dst_orig_sitemap_type, dst_orig_sitemap.sitemap_file_id dst_orig_sitemap_file_id,\
              src_sitemap.sitemap_name src_sitemap_name, src_sitemap.sitemap_type src_sitemap_type, src_sitemap.sitemap_file_id src_sitemap_file_id,\
              dst_sitemap.sitemap_name dst_sitemap_name, dst_sitemap.sitemap_type dst_sitemap_type, dst_sitemap.sitemap_file_id dst_sitemap_file_id,\
              merge_sitemap.sitemap_name merge_sitemap_name, merge_sitemap.sitemap_type merge_sitemap_type, merge_sitemap.sitemap_file_id merge_sitemap_file_id\
            from "+(module.schema?module.schema+'.':'')+"branch_sitemap src_branch_sitemap \
              inner join "+(module.schema?module.schema+'.':'')+"branch_sitemap dst_branch_sitemap on dst_branch_sitemap.sitemap_key=src_branch_sitemap.sitemap_key and dst_branch_sitemap.branch_id=@dst_branch_id \
              left outer join "+(module.schema?module.schema+'.':'')+"sitemap src_orig_sitemap on src_orig_sitemap.sitemap_id=src_branch_sitemap.sitemap_orig_id \
              left outer join "+(module.schema?module.schema+'.':'')+"sitemap dst_orig_sitemap on dst_orig_sitemap.sitemap_id=dst_branch_sitemap.sitemap_orig_id \
              left outer join "+(module.schema?module.schema+'.':'')+"sitemap src_sitemap on src_sitemap.sitemap_id=src_branch_sitemap.sitemap_id \
              left outer join "+(module.schema?module.schema+'.':'')+"sitemap dst_sitemap on dst_sitemap.sitemap_id=dst_branch_sitemap.sitemap_id \
              left outer join "+(module.schema?module.schema+'.':'')+"sitemap merge_sitemap on merge_sitemap.sitemap_id=dst_branch_sitemap.sitemap_merge_id \
            where src_branch_sitemap.branch_id=@src_branch_id\
              and ((src_branch_sitemap.branch_sitemap_action is not null and src_branch_sitemap.sitemap_orig_id<>dst_branch_sitemap.sitemap_id)\
               or  (dst_branch_sitemap.branch_sitemap_action is not null and dst_branch_sitemap.sitemap_orig_id<>src_branch_sitemap.sitemap_id))";
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]) branch_sitemaps = rslt[0];
            return cb();
          });
        },

        //Get all sitemaps
        function(cb){
          var sql = "select sitemap_id,sitemap_key,sitemap_file_id,sitemap_name,sitemap_type \
            from "+(module.schema?module.schema+'.':'')+"sitemap sitemap \
            where\
                  sitemap.sitemap_id in (select sitemap_id from "+(module.schema?module.schema+'.':'')+"branch_sitemap where branch_id=@src_branch_id and branch_sitemap_action is not null) or \
                  sitemap.sitemap_id in (select sitemap_orig_id from "+(module.schema?module.schema+'.':'')+"branch_sitemap where branch_id=@src_branch_id and branch_sitemap_action = 'UPDATE') or\
                  sitemap.sitemap_id in (select sitemap_id from "+(module.schema?module.schema+'.':'')+"branch_sitemap src_branch_sitemap where src_branch_sitemap.branch_id=@src_branch_id and src_branch_sitemap.sitemap_key in (select sitemap_key from "+(module.schema?module.schema+'.':'')+"branch_sitemap dst_branch_sitemap where dst_branch_sitemap.branch_id=@dst_branch_id and branch_sitemap_action is not null)) or \
                  sitemap.sitemap_id in (select sitemap_id from "+(module.schema?module.schema+'.':'')+"branch_sitemap where branch_id=@dst_branch_id and branch_sitemap_action is not null) or \
                  sitemap.sitemap_id in (select sitemap_orig_id from "+(module.schema?module.schema+'.':'')+"branch_sitemap where branch_id=@dst_branch_id and branch_sitemap_action = 'UPDATE') or\
                  sitemap.sitemap_id in (select sitemap_id from "+(module.schema?module.schema+'.':'')+"branch_sitemap dst_branch_sitemap where dst_branch_sitemap.branch_id=@dst_branch_id and dst_branch_sitemap.sitemap_key in (select sitemap_key from "+(module.schema?module.schema+'.':'')+"branch_sitemap src_branch_sitemap where src_branch_sitemap.branch_id=@src_branch_id and branch_sitemap_action is not null))";
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]){
              _.each(rslt[0], function(sitemap){
                sitemaps[sitemap.sitemap_id] = sitemap;
              });
            }
            return cb();
          });
        },

        //Get sitemap file content
        function(cb){
          async.eachOfSeries(sitemaps, function(sitemap, sitemap_id, sitemap_cb){
            funcs.getClientSitemap(sitemap, function(err, sitemap_content){
              if(err) return sitemap_cb(err);
              if(!sitemap_content) return sitemap_cb(null);
              sitemap.sitemap_items_text = funcs.prettySitemap(sitemap_content.sitemap_items, page_keys, media_keys);
              return sitemap_cb();
            });
          }, cb);
        },

        //Perform sitemap diff
        function(cb){
          _.each(branch_sitemaps, function(branch_sitemap){
            if(branch_sitemap.src_branch_sitemap_action && branch_sitemap.src_branch_sitemap_action.toUpperCase()=='UPDATE'
            && branch_sitemap.dst_branch_sitemap_action && branch_sitemap.dst_branch_sitemap_action.toUpperCase()=='UPDATE'){
              branch_sitemap.src_diff = funcs.sitemapDiff(sitemaps[branch_sitemap.src_sitemap_orig_id], sitemaps[branch_sitemap.src_sitemap_id]);
              branch_sitemap.dst_diff = funcs.sitemapDiff(sitemaps[branch_sitemap.dst_sitemap_orig_id], sitemaps[branch_sitemap.dst_sitemap_id]);
            }
            else if(branch_sitemap.src_branch_sitemap_action && branch_sitemap.src_branch_sitemap_action.toUpperCase()=='UPDATE'){
              branch_sitemap.src_diff = funcs.sitemapDiff(sitemaps[branch_sitemap.src_sitemap_orig_id], sitemaps[branch_sitemap.src_sitemap_id]);
              branch_sitemap.dst_diff = funcs.sitemapDiff(sitemaps[branch_sitemap.src_sitemap_orig_id], sitemaps[branch_sitemap.dst_sitemap_id]);
            }
            else if(branch_sitemap.dst_branch_sitemap_action && branch_sitemap.dst_branch_sitemap_action.toUpperCase()=='UPDATE'){
              branch_sitemap.src_diff = funcs.sitemapDiff(sitemaps[branch_sitemap.dst_sitemap_orig_id], sitemaps[branch_sitemap.src_sitemap_id]);
              branch_sitemap.dst_diff = funcs.sitemapDiff(sitemaps[branch_sitemap.dst_sitemap_orig_id], sitemaps[branch_sitemap.dst_sitemap_id]);
            }
          });
          return cb();
        },

      ], function(err){
        if(err) return Helper.GenError(req, res, -99999, err.toString());
        res.end(JSON.stringify({
          _success: 1,
          deployment_target_params: deployment_target_params,
          branch_pages: branch_pages,
          branch_redirects: branch_redirects,
          branch_media: branch_media,
          branch_menus: branch_menus,
          branch_sitemaps: branch_sitemaps
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
