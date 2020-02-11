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

  var CONFLICT_DETAIL_TABLES = [
    ['src_orig_', 'src_branch_%%%OBJECT%%%.%%%OBJECT%%%_orig_id'],
    ['dst_orig_', 'dst_branch_%%%OBJECT%%%.%%%OBJECT%%%_orig_id'],
    ['src_', 'src_branch_%%%OBJECT%%%.%%%OBJECT%%%_id'],
    ['dst_', 'dst_branch_%%%OBJECT%%%.%%%OBJECT%%%_id'],
    ['merge_', 'dst_branch_%%%OBJECT%%%.%%%OBJECT%%%_merge_id'],
  ];

  function selectConflictDetailFields(detailFields) {
    return _.flatMap(CONFLICT_DETAIL_TABLES, function(det) {
      var prefix = det[0];
      var table = prefix + '%%%OBJECT%%%';
      return detailFields.map(function(suffix) {
        var field = '%%%OBJECT%%%_' + suffix;
        return table + '.' + field + ' ' + prefix + field;
      });
    }).join(',');
  }

  function selectConflictDetailTables() {
    return CONFLICT_DETAIL_TABLES.map(function(det) {
      var prefix = det[0];
      var id = det[1]
      var table = prefix + '%%%OBJECT%%%';
      return 'left outer join {schema}.%%%OBJECT%%% ' + table + ' on ' + table + '.%%%OBJECT%%%_id=' + id;
    }).join(' ');
  }

  function selectConflicts(objectType, detailFields, whereClause) {
    var sqlPrefix = "select src_branch_%%%OBJECT%%%.%%%OBJECT%%%_key,\
      src_branch_%%%OBJECT%%%.branch_%%%OBJECT%%%_action as src_branch_%%%OBJECT%%%_action,\
      dst_branch_%%%OBJECT%%%.branch_%%%OBJECT%%%_action as dst_branch_%%%OBJECT%%%_action,\
      dst_branch_%%%OBJECT%%%.%%%OBJECT%%%_merge_id, dst_branch_%%%OBJECT%%%.branch_%%%OBJECT%%%_merge_action,";

    var sqlFrom =" from {schema}.branch_%%%OBJECT%%% src_branch_%%%OBJECT%%% \
      inner join {schema}.branch_%%%OBJECT%%% dst_branch_%%%OBJECT%%% on dst_branch_%%%OBJECT%%%.%%%OBJECT%%%_key=src_branch_%%%OBJECT%%%.%%%OBJECT%%%_key and dst_branch_%%%OBJECT%%%.branch_id=@dst_branch_id ";

    var sqlWhere = " where src_branch_%%%OBJECT%%%.branch_id=@src_branch_id\
      and nequal(dst_branch_%%%OBJECT%%%.%%%OBJECT%%%_id,src_branch_%%%OBJECT%%%.%%%OBJECT%%%_id)\
      and ((src_branch_%%%OBJECT%%%.branch_%%%OBJECT%%%_action is not null and nequal(src_branch_%%%OBJECT%%%.%%%OBJECT%%%_orig_id,dst_branch_%%%OBJECT%%%.%%%OBJECT%%%_id))\
       or  (dst_branch_%%%OBJECT%%%.branch_%%%OBJECT%%%_action is not null and nequal(dst_branch_%%%OBJECT%%%.%%%OBJECT%%%_orig_id,src_branch_%%%OBJECT%%%.%%%OBJECT%%%_id))) ";

    var sql = sqlPrefix + selectConflictDetailFields(detailFields) + sqlFrom + selectConflictDetailTables() + sqlWhere + whereClause;
    sql = Helper.ReplaceAll(sql, '%%%OBJECT%%%', objectType);
    sql = Helper.ReplaceAll(sql, '{schema}.', module.schema?module.schema+'.':'');
    return sql;
  }


  function propertyPrefixToSubObject(obj, sub) {
    var prefix = sub + '_'
    obj[sub] = {};
    var toDelete = [];
    _.forOwn(obj, function(value, key) {
      if (_.startsWith(key, prefix)) {
        obj[sub][key.replace(prefix, '')] = value;
        toDelete.push(key);
      }
    });
    toDelete.forEach(function(key) {
      delete obj[key];
    });
  }

  function formatBranchObject(collection, objectType) {
    _.each(collection, function(branch_object){
      branch_object['src_branch_'+objectType+'_action'] = (branch_object['src_branch_'+objectType+'_action']||'').toString().toUpperCase();
      branch_object['dst_branch_'+objectType+'_action'] = (branch_object['dst_branch_'+objectType+'_action']||'').toString().toUpperCase();
      propertyPrefixToSubObject(branch_object, 'src_'+objectType);
      propertyPrefixToSubObject(branch_object, 'dst_'+objectType);
      propertyPrefixToSubObject(branch_object, 'src_orig_'+objectType);
      propertyPrefixToSubObject(branch_object, 'dst_orig_'+objectType);
      propertyPrefixToSubObject(branch_object, 'merge_'+objectType);
    });
  }

  exports.conflict = function(context, sql_params, callback) {
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var sql_ptypes = [dbtypes.BigInt, dbtypes.BigInt];

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
        funcs.merge_check_permissions(context, sql_params, cb);
      },

      //Get deployment target params
      function(cb){
        var sql = "select deployment_target_params from "+(module.schema?module.schema+'.':'')+"branch left outer join "+(module.schema?module.schema+'.':'')+"v_my_site on v_my_site.site_id = branch.site_id where branch_id=@dst_branch_id";
        appsrv.ExecScalar(context, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; return cb(err); }
          if(rslt && rslt[0]) deployment_target_params = rslt[0];
          return cb();
        });
      },

      //Get all branch_media
      function(cb){
        var detailFields = [
          'id',
          'path',
          'file_id',
          'ext',
          'width',
          'height',
        ];
        var whereClause = "and (src_orig_media.media_is_folder=0 or dst_orig_media.media_is_folder=0 or src_media.media_is_folder=0 or dst_media.media_is_folder=0)";
        var sql = selectConflicts('media', detailFields, whereClause);
        appsrv.ExecRecordset(context, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; return cb(err); }
          if(rslt && rslt[0]) branch_media = rslt[0];
          formatBranchObject(branch_media, 'media');
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
        appsrv.ExecRecordset(context, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; return cb(err); }
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
        var detailFields = [
          'id',
          'url',
          'dest',
        ];
        var whereClause = '';
        sql = selectConflicts('redirect', detailFields, whereClause);
        appsrv.ExecRecordset(context, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; return cb(err); }
          if(rslt && rslt[0]) branch_redirects = rslt[0];
          formatBranchObject(branch_redirects, 'redirect');
          return cb();
        });
      },

      //Get all branch_page
      function(cb){
        var detailFields = [
          'id',
          'path',
          'title',
          'file_id',
          'filename',
          'template_id',
        ];
        var whereClause = "and (src_orig_page.page_is_folder=0 or dst_orig_page.page_is_folder=0 or src_page.page_is_folder=0 or dst_page.page_is_folder=0)";
        var sql = selectConflicts('page', detailFields, whereClause);
        appsrv.ExecRecordset(context, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; return cb(err); }
          if(rslt && rslt[0]) branch_pages = rslt[0];
          formatBranchObject(branch_pages, 'page');
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
        appsrv.ExecRecordset(context, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; return cb(err); }
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
        appsrv.ExecRecordset(context, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; return cb(err); }
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
            branch_page.src_diff = funcs.pageDiff(updated_pages[branch_page.src_orig_page.id], updated_pages[branch_page.src_page.id]);
            branch_page.dst_diff = funcs.pageDiff(updated_pages[branch_page.dst_orig_page.id], updated_pages[branch_page.dst_page.id]);
          }
          else if(branch_page.src_branch_page_action && branch_page.src_branch_page_action.toUpperCase()=='UPDATE'){
            branch_page.src_diff = funcs.pageDiff(updated_pages[branch_page.src_orig_page.id], updated_pages[branch_page.src_page.id]);
            branch_page.dst_diff = funcs.pageDiff(updated_pages[branch_page.src_orig_page.id], updated_pages[branch_page.dst_page.id]);
          }
          else if(branch_page.dst_branch_page_action && branch_page.dst_branch_page_action.toUpperCase()=='UPDATE'){
            branch_page.src_diff = funcs.pageDiff(updated_pages[branch_page.dst_orig_page.id], updated_pages[branch_page.src_page.id]);
            branch_page.dst_diff = funcs.pageDiff(updated_pages[branch_page.dst_orig_page.id], updated_pages[branch_page.dst_page.id]);
          }
        });
        return cb();
      },

      //Get all branch_menu
      function(cb){
        var detailFields = [
          'id',
          'name',
          'tag',
          'file_id',
        ];
        var whereClause = "";
        var sql = selectConflicts('menu', detailFields, whereClause);
        appsrv.ExecRecordset(context, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; return cb(err); }
          if(rslt && rslt[0]) branch_menus = rslt[0];
          formatBranchObject(branch_menus, 'menu');
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
        appsrv.ExecRecordset(context, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; return cb(err); }
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
            branch_menu.src_diff = funcs.menuDiff(menus[branch_menu.src_orig_menu.id], menus[branch_menu.src_menu.id]);
            branch_menu.dst_diff = funcs.menuDiff(menus[branch_menu.dst_orig_menu.id], menus[branch_menu.dst_menu.id]);
          }
          else if(branch_menu.src_branch_menu_action && branch_menu.src_branch_menu_action.toUpperCase()=='UPDATE'){
            branch_menu.src_diff = funcs.menuDiff(menus[branch_menu.src_orig_menu.id], menus[branch_menu.src_menu.id]);
            branch_menu.dst_diff = funcs.menuDiff(menus[branch_menu.src_orig_menu.id], menus[branch_menu.dst_menu.id]);
          }
          else if(branch_menu.dst_branch_menu_action && branch_menu.dst_branch_menu_action.toUpperCase()=='UPDATE'){
            branch_menu.src_diff = funcs.menuDiff(menus[branch_menu.dst_orig_menu.id], menus[branch_menu.src_menu.id]);
            branch_menu.dst_diff = funcs.menuDiff(menus[branch_menu.dst_orig_menu.id], menus[branch_menu.dst_menu.id]);
          }
        });
        return cb();
      },

      //Get all branch_sitemap
      function(cb){
        var detailFields = [
          'id',
          'name',
          'type',
          'file_id',
        ];
        var whereClause = "";
        var sql = selectConflicts('sitemap', detailFields, whereClause);
        appsrv.ExecRecordset(context, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; return cb(err); }
          if(rslt && rslt[0]) branch_sitemaps = rslt[0];
          formatBranchObject(branch_sitemaps, 'sitemap');
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
        appsrv.ExecRecordset(context, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; return cb(err); }
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
            branch_sitemap.src_diff = funcs.sitemapDiff(sitemaps[branch_sitemap.src_orig_sitemap.id], sitemaps[branch_sitemap.src_sitemap.id]);
            branch_sitemap.dst_diff = funcs.sitemapDiff(sitemaps[branch_sitemap.dst_orig_sitemap.id], sitemaps[branch_sitemap.dst_sitemap.id]);
          }
          else if(branch_sitemap.src_branch_sitemap_action && branch_sitemap.src_branch_sitemap_action.toUpperCase()=='UPDATE'){
            branch_sitemap.src_diff = funcs.sitemapDiff(sitemaps[branch_sitemap.src_orig_sitemap.id], sitemaps[branch_sitemap.src_sitemap.id]);
            branch_sitemap.dst_diff = funcs.sitemapDiff(sitemaps[branch_sitemap.src_orig_sitemap.id], sitemaps[branch_sitemap.dst_sitemap.id]);
          }
          else if(branch_sitemap.dst_branch_sitemap_action && branch_sitemap.dst_branch_sitemap_action.toUpperCase()=='UPDATE'){
            branch_sitemap.src_diff = funcs.sitemapDiff(sitemaps[branch_sitemap.dst_orig_sitemap.id], sitemaps[branch_sitemap.src_sitemap.id]);
            branch_sitemap.dst_diff = funcs.sitemapDiff(sitemaps[branch_sitemap.dst_orig_sitemap.id], sitemaps[branch_sitemap.dst_sitemap.id]);
          }
        });
        return cb();
      },

    ], function(err){
      callback(err, {
        _success: 1,
        deployment_target_params: deployment_target_params,
        branch_pages: branch_pages,
        branch_redirects: branch_redirects,
        branch_media: branch_media,
        branch_menus: branch_menus,
        branch_sitemaps: branch_sitemaps
      });
    });
    return;
  }

  exports.req_conflict = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};
    
    var Q = req.query;
    var P = req.body;

    var appsrv = this;
    var jsh = module.jsh;
    var XValidate = jsh.XValidate;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Branch_Conflict');
    
    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    if (verb == 'get') {
      //Validate parameters
      if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      if (!appsrv.ParamCheck('Q', Q, ['&dst_branch_id','&src_branch_id'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

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

      funcs.conflict(req._DBContext, sql_params, function(err, result) {
        if (err != null && err.sql) { appsrv.AppDBError(req, res, err); return; }
        if(err) return Helper.GenError(req, res, -99999, err.toString());
        res.end(JSON.stringify(result));
      });
    }
    else {
      return next();
    }
  }

  return exports;
};
