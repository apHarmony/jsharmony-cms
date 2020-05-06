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

module.exports = exports = function(module, funcs){
  var exports = {};

  //Add old and new pages to branch_data.page_keys
  exports.conflicts_getPages = function(branch_data, callback){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    branch_data.page_keys = {};

    var sql_ptypes = [dbtypes.BigInt, dbtypes.BigInt];
    var sql_params = { src_branch_id: branch_data.src_branch_id, dst_branch_id: branch_data.dst_branch_id };
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
    appsrv.ExecRecordset(branch_data._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; return callback(err); }
      if(rslt && rslt[0]){
        _.each(rslt[0], function(page){
          branch_data.page_keys[page.page_key] = page;
          if(
            (page.branch_diff_type=='DST_NEW') ||
            (page.branch_diff_type=='DST_PREV' && !(page.page_key in branch_data.page_keys)) ||
            (page.branch_diff_type=='SRC_NEW' && !(page.page_key in branch_data.page_keys)) ||
            (page.branch_diff_type=='SRC_PREV' && !(page.page_key in branch_data.page_keys))
            ) branch_data.page_keys[page.page_key] = page;
        });
      }
      return callback();
    });
  }

  //Add old and new media to branch_data.media_keys
  exports.conflicts_getMedia = function(branch_data, callback){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    branch_data.media_keys = {};
    var sql_ptypes = [dbtypes.BigInt, dbtypes.BigInt];
    var sql_params = { src_branch_id: branch_data.src_branch_id, dst_branch_id: branch_data.dst_branch_id };
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
    appsrv.ExecRecordset(branch_data._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err) return callback(err);
      if(rslt && rslt[0]){
        _.each(rslt[0], function(media){
          if(
            (media.branch_diff_type=='DST_NEW') ||
            (media.branch_diff_type=='DST_PREV' && !(media.media_key in branch_data.media_keys)) ||
            (media.branch_diff_type=='SRC_NEW' && !(media.media_key in branch_data.media_keys)) ||
            (media.branch_diff_type=='DST_PRV' && !(media.media_key in branch_data.media_keys))
            ) branch_data.media_keys[media.media_key] = media;
        });
      }
      return callback();
    });
  }

  exports.conflicts_page = function(branch_pages, branch_data, callback){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var updated_pages = {};

    async.waterfall([
      //Get updated pages
      function(cb){
        var sql_ptypes = [dbtypes.BigInt, dbtypes.BigInt];
        var sql_params = { src_branch_id: branch_data.src_branch_id, dst_branch_id: branch_data.dst_branch_id };
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
        appsrv.ExecRecordset(branch_data._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql;return cb(err); }
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
                page.compiled.content[key] = funcs.prettyhtml(page.compiled.content[key], pretty_params);
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
            branch_page.src_diff = funcs.diff_pageContent(updated_pages[branch_page.src_orig_page.id], updated_pages[branch_page.src_page.id]);
            branch_page.dst_diff = funcs.diff_pageContent(updated_pages[branch_page.dst_orig_page.id], updated_pages[branch_page.dst_page.id]);
          }
          else if(branch_page.src_branch_page_action && branch_page.src_branch_page_action.toUpperCase()=='UPDATE'){
            branch_page.src_diff = funcs.diff_pageContent(updated_pages[branch_page.src_orig_page.id], updated_pages[branch_page.src_page.id]);
            branch_page.dst_diff = funcs.diff_pageContent(updated_pages[branch_page.src_orig_page.id], updated_pages[branch_page.dst_page.id]);
            if (branch_page.dst_diff) branch_page.dst_diff.diff_with_cmp_branch = true;
          }
          else if(branch_page.dst_branch_page_action && branch_page.dst_branch_page_action.toUpperCase()=='UPDATE'){
            branch_page.src_diff = funcs.diff_pageContent(updated_pages[branch_page.dst_orig_page.id], updated_pages[branch_page.src_page.id]);
            branch_page.dst_diff = funcs.diff_pageContent(updated_pages[branch_page.dst_orig_page.id], updated_pages[branch_page.dst_page.id]);
            if (branch_page.src_diff) branch_page.src_diff.diff_with_cmp_branch = true;
          }
        });
        return cb();
      },
    ], callback);
  }

  exports.conflicts_media = function(branch_media, branch_data, callback){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var media = {};

    async.waterfall([
      //Get all media
      function(cb){
        var sql_ptypes = [dbtypes.BigInt, dbtypes.BigInt];
        var sql_params = { src_branch_id: branch_data.src_branch_id, dst_branch_id: branch_data.dst_branch_id };
        var sql = "select media_id,media_key,media_file_id,media_desc,media_tags,media_type,media_path \
          from "+(module.schema?module.schema+'.':'')+"media media \
          where\
                media.media_id in (select media_id from "+(module.schema?module.schema+'.':'')+"branch_media where branch_id=@src_branch_id and branch_media_action is not null) or \
                media.media_id in (select media_orig_id from "+(module.schema?module.schema+'.':'')+"branch_media where branch_id=@src_branch_id and branch_media_action = 'UPDATE') or\
                media.media_id in (select media_id from "+(module.schema?module.schema+'.':'')+"branch_media src_branch_media where src_branch_media.branch_id=@src_branch_id and src_branch_media.media_key in (select media_key from "+(module.schema?module.schema+'.':'')+"branch_media dst_branch_media where dst_branch_media.branch_id=@dst_branch_id and branch_media_action is not null)) or \
                media.media_id in (select media_id from "+(module.schema?module.schema+'.':'')+"branch_media where branch_id=@dst_branch_id and branch_media_action is not null) or \
                media.media_id in (select media_orig_id from "+(module.schema?module.schema+'.':'')+"branch_media where branch_id=@dst_branch_id and branch_media_action = 'UPDATE') or\
                media.media_id in (select media_id from "+(module.schema?module.schema+'.':'')+"branch_media dst_branch_media where dst_branch_media.branch_id=@dst_branch_id and dst_branch_media.media_key in (select media_key from "+(module.schema?module.schema+'.':'')+"branch_media src_branch_media where src_branch_media.branch_id=@src_branch_id and branch_media_action is not null))";
        appsrv.ExecRecordset(branch_data._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql;return cb(err); }
          if(rslt && rslt[0]){
            _.each(rslt[0], function(media_item){
              media[media_item.media_id] = media_item;
            });
          }
          return cb();
        });
      },

      //Perform media diff
      function(cb){
        _.each(branch_media, function(branch_media_item){
          if(branch_media_item.src_branch_media_action && branch_media_item.src_branch_media_action.toUpperCase()=='UPDATE'
          && branch_media_item.dst_branch_media_action && branch_media_item.dst_branch_media_action.toUpperCase()=='UPDATE'){
            branch_media_item.src_diff = funcs.mediaDiff(media[branch_media_item.src_orig_media.id], media[branch_media_item.src_media.id]);
            branch_media_item.dst_diff = funcs.mediaDiff(media[branch_media_item.dst_orig_media.id], media[branch_media_item.dst_media.id]);
          }
          else if(branch_media_item.src_branch_media_action && branch_media_item.src_branch_media_action.toUpperCase()=='UPDATE'){
            branch_media_item.src_diff = funcs.mediaDiff(media[branch_media_item.src_orig_media.id], media[branch_media_item.src_media.id]);
            branch_media_item.dst_diff = funcs.mediaDiff(media[branch_media_item.src_orig_media.id], media[branch_media_item.dst_media.id]);
            if (branch_media_item.dst_diff) branch_media_item.dst_diff.diff_with_cmp_branch = true;
          }
          else if(branch_media_item.dst_branch_media_action && branch_media_item.dst_branch_media_action.toUpperCase()=='UPDATE'){
            branch_media_item.src_diff = funcs.mediaDiff(media[branch_media_item.dst_orig_media.id], media[branch_media_item.src_media.id]);
            branch_media_item.dst_diff = funcs.mediaDiff(media[branch_media_item.dst_orig_media.id], media[branch_media_item.dst_media.id]);
            if (branch_media_item.src_diff) branch_media_item.src_diff.diff_with_cmp_branch = true;
          }
        });
        return cb();
      },
    ], callback);
  }

  exports.conflicts_menu = function(branch_menus, branch_data, callback){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var menus = {};

    async.waterfall([
      //Get all menus
      function(cb){
        var sql_ptypes = [dbtypes.BigInt, dbtypes.BigInt];
        var sql_params = { src_branch_id: branch_data.src_branch_id, dst_branch_id: branch_data.dst_branch_id };
        var sql = "select menu_id,menu_key,menu_file_id,menu_name,menu_tag,menu_template_id,menu_path \
          from "+(module.schema?module.schema+'.':'')+"menu menu \
          where\
                menu.menu_id in (select menu_id from "+(module.schema?module.schema+'.':'')+"branch_menu where branch_id=@src_branch_id and branch_menu_action is not null) or \
                menu.menu_id in (select menu_orig_id from "+(module.schema?module.schema+'.':'')+"branch_menu where branch_id=@src_branch_id and branch_menu_action = 'UPDATE') or\
                menu.menu_id in (select menu_id from "+(module.schema?module.schema+'.':'')+"branch_menu src_branch_menu where src_branch_menu.branch_id=@src_branch_id and src_branch_menu.menu_key in (select menu_key from "+(module.schema?module.schema+'.':'')+"branch_menu dst_branch_menu where dst_branch_menu.branch_id=@dst_branch_id and branch_menu_action is not null)) or \
                menu.menu_id in (select menu_id from "+(module.schema?module.schema+'.':'')+"branch_menu where branch_id=@dst_branch_id and branch_menu_action is not null) or \
                menu.menu_id in (select menu_orig_id from "+(module.schema?module.schema+'.':'')+"branch_menu where branch_id=@dst_branch_id and branch_menu_action = 'UPDATE') or\
                menu.menu_id in (select menu_id from "+(module.schema?module.schema+'.':'')+"branch_menu dst_branch_menu where dst_branch_menu.branch_id=@dst_branch_id and dst_branch_menu.menu_key in (select menu_key from "+(module.schema?module.schema+'.':'')+"branch_menu src_branch_menu where src_branch_menu.branch_id=@src_branch_id and branch_menu_action is not null))";
        appsrv.ExecRecordset(branch_data._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql;return cb(err); }
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
            menu.menu_items_text = funcs.prettyMenu(menu_content.menu_items, branch_data.page_keys, branch_data.media_keys);
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
            if (branch_menu.dst_diff) branch_menu.dst_diff.diff_with_cmp_branch = true;
          }
          else if(branch_menu.dst_branch_menu_action && branch_menu.dst_branch_menu_action.toUpperCase()=='UPDATE'){
            branch_menu.src_diff = funcs.menuDiff(menus[branch_menu.dst_orig_menu.id], menus[branch_menu.src_menu.id]);
            branch_menu.dst_diff = funcs.menuDiff(menus[branch_menu.dst_orig_menu.id], menus[branch_menu.dst_menu.id]);
            if (branch_menu.src_diff) branch_menu.src_diff.diff_with_cmp_branch = true;
          }
        });
        return cb();
      },
    ], callback);
  }

  exports.conflicts_sitemap = function(branch_sitemaps, branch_data, callback){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var sitemaps = {};

    async.waterfall([
      //Get all sitemaps
      function(cb){
        var sql_ptypes = [dbtypes.BigInt, dbtypes.BigInt];
        var sql_params = { src_branch_id: branch_data.src_branch_id, dst_branch_id: branch_data.dst_branch_id };
        var sql = "select sitemap_id,sitemap_key,sitemap_file_id,sitemap_name,sitemap_type \
          from "+(module.schema?module.schema+'.':'')+"sitemap sitemap \
          where\
                sitemap.sitemap_id in (select sitemap_id from "+(module.schema?module.schema+'.':'')+"branch_sitemap where branch_id=@src_branch_id and branch_sitemap_action is not null) or \
                sitemap.sitemap_id in (select sitemap_orig_id from "+(module.schema?module.schema+'.':'')+"branch_sitemap where branch_id=@src_branch_id and branch_sitemap_action = 'UPDATE') or\
                sitemap.sitemap_id in (select sitemap_id from "+(module.schema?module.schema+'.':'')+"branch_sitemap src_branch_sitemap where src_branch_sitemap.branch_id=@src_branch_id and src_branch_sitemap.sitemap_key in (select sitemap_key from "+(module.schema?module.schema+'.':'')+"branch_sitemap dst_branch_sitemap where dst_branch_sitemap.branch_id=@dst_branch_id and branch_sitemap_action is not null)) or \
                sitemap.sitemap_id in (select sitemap_id from "+(module.schema?module.schema+'.':'')+"branch_sitemap where branch_id=@dst_branch_id and branch_sitemap_action is not null) or \
                sitemap.sitemap_id in (select sitemap_orig_id from "+(module.schema?module.schema+'.':'')+"branch_sitemap where branch_id=@dst_branch_id and branch_sitemap_action = 'UPDATE') or\
                sitemap.sitemap_id in (select sitemap_id from "+(module.schema?module.schema+'.':'')+"branch_sitemap dst_branch_sitemap where dst_branch_sitemap.branch_id=@dst_branch_id and dst_branch_sitemap.sitemap_key in (select sitemap_key from "+(module.schema?module.schema+'.':'')+"branch_sitemap src_branch_sitemap where src_branch_sitemap.branch_id=@src_branch_id and branch_sitemap_action is not null))";
        appsrv.ExecRecordset(branch_data._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql;return cb(err); }
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
            sitemap.sitemap_items_text = funcs.prettySitemap(sitemap_content.sitemap_items, branch_data.page_keys, branch_data.media_keys);
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
            if (branch_sitemap.dst_diff) branch_sitemap.dst_diff.diff_with_cmp_branch = true;
          }
          else if(branch_sitemap.dst_branch_sitemap_action && branch_sitemap.dst_branch_sitemap_action.toUpperCase()=='UPDATE'){
            branch_sitemap.src_diff = funcs.sitemapDiff(sitemaps[branch_sitemap.dst_orig_sitemap.id], sitemaps[branch_sitemap.src_sitemap.id]);
            branch_sitemap.dst_diff = funcs.sitemapDiff(sitemaps[branch_sitemap.dst_orig_sitemap.id], sitemaps[branch_sitemap.dst_sitemap.id]);
            if (branch_sitemap.src_diff) branch_sitemap.src_diff.diff_with_cmp_branch = true;
          }
        });
        return cb();
      },
    ], callback);
  }

  var CONFLICT_DETAIL_TABLES = [
    ['src_orig_', 'src_branch_{item}.{item}_orig_id'],
    ['dst_orig_', 'dst_branch_{item}.{item}_orig_id'],
    ['src_', 'src_branch_{item}.{item}_id'],
    ['dst_', 'dst_branch_{item}.{item}_id'],
    ['merge_', 'dst_branch_{item}.{item}_merge_id'],
  ];

  function selectConflictDetailFields(detailFields) {
    return _.flatMap(CONFLICT_DETAIL_TABLES, function(det) {
      var prefix = det[0];
      var table = prefix + '{item}';
      return (['{item}_id']).concat(detailFields).map(function(field) {
        return table + '.' + field + ' ' + prefix + field;
      });
    }).join(',');
  }

  function selectConflictDetailTables() {
    return CONFLICT_DETAIL_TABLES.map(function(det) {
      var prefix = det[0];
      var id = det[1]
      var table = prefix + '{item}';
      return 'left outer join {tbl_item} ' + table + ' on ' + table + '.{item}_id=' + id;
    }).join(' ');
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

  function rejectDirectAncestorConflicts(collection, objectType, lineage) {
    var parent = {};
    _.each(lineage, function(link) {
      parent[link.id] = link.orig_id;
    });
    return _.filter(collection, function(branch_object){
      var src = branch_object['src_'+objectType];
      var dst = branch_object['dst_'+objectType];
      if (!src || !dst || !src.id || !dst.id) return true;
      var newer = src.id;
      var older = dst.id;
      var cur_depth = 0;
      while (newer && newer > older && cur_depth++ < 200) {
        newer = parent[newer];
      }
      return newer != older;
    });
  }

  exports.conflicts = function(context, src_branch_id, dst_branch_id, callback) {
    var cms = module;
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    var branch_conflicts = {};
    var src_branch_desc = 'Source';
    var dst_branch_desc = 'Destination';
    var branch_data = {
      src_branch_id: src_branch_id,
      dst_branch_id: dst_branch_id,
      deployment_target_params: undefined,
      _DBContext: context
    };

    var sql_ptypes = [dbtypes.BigInt, dbtypes.BigInt];
    var sql_params = { src_branch_id: src_branch_id, dst_branch_id: dst_branch_id };

    async.waterfall([

      function(cb){
        funcs.merge_check_permissions(context, sql_params, cb);
      },

      //Get deployment target params
      function(cb){
        var sql = "select site_editor deployment_target_id,deployment_target_params from "+(module.schema?module.schema+'.':'')+"branch left outer join "+(module.schema?module.schema+'.':'')+"v_my_site on v_my_site.site_id = branch.site_id where branch_id=@dst_branch_id";
        appsrv.ExecRow(context, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql;return cb(err); }
          if(rslt && rslt[0]){
            try{
              branch_data.deployment_target_id = rslt[0].deployment_target_id;
              branch_data.deployment_target_params = JSON.parse(rslt[0].deployment_target_params);
            }
            catch(ex){}
          }
          return cb();
        });
      },

      //Get branch names
      function(cb){
        var sql = "select branch_id, branch_desc from "+(module.schema?module.schema+'.':'')+"v_my_branch_desc where branch_id=@dst_branch_id or branch_id=@src_branch_id";
        appsrv.ExecRecordset(context, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql;return cb(err); }
          if(rslt && rslt[0]){
            _.forEach(rslt[0], function(branch) {
              if(branch.branch_id == src_branch_id) src_branch_desc = branch.branch_desc;
              if(branch.branch_id == dst_branch_id) dst_branch_desc = branch.branch_desc;
            });
          }
          return cb();
        });
      },

      //Run onBeforeConflicts functions
      function(cb){
        async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, branch_item_cb){
          if(!branch_item.conflicts) return branch_item_cb();
          Helper.execif(branch_item.conflicts.onBeforeConflicts,
            function(f){
              branch_item.conflicts.onBeforeConflicts(branch_data, f);
            },
            branch_item_cb
          );
        }, cb);
      },

      //Get all conflicts per branch item type
      function(cb){
        async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, branch_item_cb){
          if(!branch_item.conflicts) return branch_item_cb();

          var sql = "select src_branch_{item}.{item}_key,\
            src_branch_{item}.branch_{item}_action as src_branch_{item}_action,\
            dst_branch_{item}.branch_{item}_action as dst_branch_{item}_action,\
            dst_branch_{item}.{item}_merge_id, dst_branch_{item}.branch_{item}_merge_action, ";

          sql += selectConflictDetailFields(branch_item.conflicts.columns || []);

          sql += " from {tbl_branch_item} src_branch_{item} \
            inner join {tbl_branch_item} dst_branch_{item} on dst_branch_{item}.{item}_key=src_branch_{item}.{item}_key and dst_branch_{item}.branch_id=@dst_branch_id ";

          sql += selectConflictDetailTables();

          sql += " where src_branch_{item}.branch_id=@src_branch_id\
            and jsharmony.nequal(dst_branch_{item}.{item}_id,src_branch_{item}.{item}_id)\
            and ((src_branch_{item}.branch_{item}_action is not null and jsharmony.nequal(src_branch_{item}.{item}_orig_id,dst_branch_{item}.{item}_id))\
            or  (dst_branch_{item}.branch_{item}_action is not null and jsharmony.nequal(dst_branch_{item}.{item}_orig_id,src_branch_{item}.{item}_id))) ";

          if(branch_item.conflicts.sqlwhere) sql += ' and (' + branch_item.conflicts.sqlwhere + ')';

          appsrv.ExecRecordset(context, cms.applyBranchItemSQL(branch_item_type, sql), sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; return cb(err); }
            if(rslt && rslt[0]){
              branch_conflicts[branch_item_type] = rslt[0];
              formatBranchObject(branch_conflicts[branch_item_type], branch_item_type);
            }

            branch_item_cb();
          });
        }, cb);
      },

      //Reject conflicts where one item is a direct decendant of the other
      function(cb){
        async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, branch_item_cb){
          if(!branch_item.conflicts) return branch_item_cb();

          var sql = "select {item}_key [key], {item}_id id, {item}_orig_id orig_id\
            from {tbl_item}\
            where {item}.{item}_key in \
                (select {item}_key \
                  from {tbl_branch_item} \
                  where (branch_id = @src_branch_id and branch_{item}_action is not null) or (branch_id = @dst_branch_id and branch_{item}_action is not null) \
                ) \
              and {item}_id between \
                  (select min({item}_id) \
                    from {tbl_branch_item} \
                    where {item}_id is not null and {item}_key = {tbl_item}.{item}_key and (branch_id = @src_branch_id or branch_id = @dst_branch_id) \
                  ) \
                and \
                  (select max({item}_id) \
                    from {tbl_branch_item} \
                    where {item}_id is not null and {item}_key = {tbl_item}.{item}_key and (branch_id = @src_branch_id or branch_id = @dst_branch_id) \
                  ) \
            ;"

          appsrv.ExecRecordset(context, cms.applyBranchItemSQL(branch_item_type, sql), sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; return cb(err); }
            if(rslt && rslt[0]){
              branch_conflicts[branch_item_type] = rejectDirectAncestorConflicts(branch_conflicts[branch_item_type], branch_item_type, rslt[0]);
            }

            branch_item_cb();
          });
        }, cb);
      },

      //Run onConflicts functions
      function(cb){
        async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, branch_item_cb){
          if(!branch_item.conflicts) return branch_item_cb();
          Helper.execif(branch_item.conflicts.onConflicts,
            function(f){
              branch_item.conflicts.onConflicts(branch_conflicts[branch_item_type], branch_data, f);
            },
            branch_item_cb
          );
        }, cb);
      },

    ], function(err){
      callback(err, {
        _success: 1,
        src_branch_desc: src_branch_desc,
        dst_branch_desc: dst_branch_desc,
        deployment_target_params: branch_data.deployment_target_params,
        branch_conflicts: branch_conflicts,
      });
    });
    return;
  }

  exports.req_conflicts = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};
    
    var Q = req.query;
    var P = req.body;

    var appsrv = this;
    var jsh = module.jsh;
    var XValidate = jsh.XValidate;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Branch_Conflicts');
    
    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    if (verb == 'get') {
      //Validate parameters
      if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      if (!appsrv.ParamCheck('Q', Q, ['&dst_branch_id','&src_branch_id'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

      var dst_branch_id = req.query.dst_branch_id;
      var src_branch_id = req.query.src_branch_id;

      //Check if item is defined
      var sql_ptypes = [dbtypes.BigInt, dbtypes.BigInt];
      var sql_params = { dst_branch_id: dst_branch_id, src_branch_id: src_branch_id };
      var validate = new XValidate();
      var verrors = {};
      validate.AddValidator('_obj.dst_branch_id', 'Destination Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      validate.AddValidator('_obj.src_branch_id', 'Source Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
 
      verrors = _.merge(verrors, validate.Validate('B', sql_params));
      if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

      funcs.conflicts(req._DBContext, src_branch_id, dst_branch_id, function(err, result) {
        if (err != null && err.sql) { appsrv.AppDBError(req, res, err); return; }
        if(err) return Helper.GenError(req, res, -99999, err.toString());
        res.end(JSON.stringify(result));
      });
    }
    else {
      return next();
    }
  }

  exports.req_conflicts_resolve = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};
    
    var Q = req.query;
    var P = req.body;

    var appsrv = this;
    var cms = module;
    var jsh = module.jsh;
    var XValidate = jsh.XValidate;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Branch_Conflicts');
    
    if (!Helper.hasModelAction(req, model, 'U')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    if (verb == 'post') {
      //Validate parameters
      if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      if (!appsrv.ParamCheck('P', P, ['&branch_item_type','&branch_id','&key','&merge_id','&branch_merge_action'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

      var branch_item_type = req.body.branch_item_type;
      var branch_id = req.body.branch_id;
      var key = req.body.key;
      var merge_id = req.body.merge_id;
      var branch_merge_action = req.body.branch_merge_action;

      if(!(branch_item_type in cms.BranchItems)) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

      //Check if item is defined
      var sql_ptypes = [dbtypes.BigInt, dbtypes.BigInt, dbtypes.BigInt, dbtypes.VarChar(32)];
      var sql_params = { branch_id: branch_id, key: key, merge_id: merge_id, branch_merge_action: branch_merge_action };
      var validate = new XValidate();
      var verrors = {};
      validate.AddValidator('_obj.branch_id', 'Branch ID', 'U', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      validate.AddValidator('_obj.key', 'Item Key', 'U', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      validate.AddValidator('_obj.merge_id', 'Merge ID', 'U', [XValidate._v_IsNumeric()]);
      validate.AddValidator('_obj.branch_merge_action', 'Action', 'U', [XValidate._v_MaxLength(32)]);
 
      verrors = _.merge(verrors, validate.Validate('U', sql_params));
      if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

      var sql = "update {tbl_branch_item} set {item}_merge_id=@merge_id, branch_{item}_merge_action=@branch_merge_action where branch_id=@branch_id and {item}_key=@key and ('RW' = (select branch_access from "+(module.schema?module.schema+'.':'')+"v_my_branch_access access where access.branch_id=@branch_id));";
      appsrv.ExecCommand(req._DBContext, cms.applyBranchItemSQL(branch_item_type, sql), sql_ptypes, sql_params, function (err, rslt) {
        if (err != null && err.sql) { appsrv.AppDBError(req, res, err); return; }
        if(err) return Helper.GenError(req, res, -99999, err.toString());
        res.end(JSON.stringify({ '_success': 1 }));
      });
    }
    else {
      return next();
    }
  }

  return exports;
};
