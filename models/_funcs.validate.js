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

  exports.validate_req = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};
    
    var Q = req.query;
    var P = {};
    if (req.body && ('data' in req.body)){
      try{ P = JSON.parse(req.body.data); }
      catch(ex){ Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
    }
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var XValidate = jsh.XValidate;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Branch_Diff');
    
    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    if (verb == 'get') {
      var branch_id = req.query.branch_id;
      
      //Check if Asset is defined
      var sql_ptypes = [dbtypes.BigInt];
      var sql_params = { 'branch_id': branch_id };
      var validate = new XValidate();
      var verrors = {};
      validate.AddValidator('_obj.branch_id', 'Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      
      verrors = _.merge(verrors, validate.Validate('B', sql_params));
      if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

      funcs.validate(req._DBContext, branch_id, function(err, rslt){
        if(err){
          if(err.sql){
            err.model = model;
            return appsrv.AppDBError(req, res, err);
          }
          else return Helper.GenError(req, res, -99999, err.toString());
        }
        rslt._success = 1;
        res.end(JSON.stringify(rslt));
      });
    }
    else {
      return next();
    }
  }
  
  exports.validate = function (dbcontext, branch_id, callback) {
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { 'branch_id': branch_id };
  
    var page_errors = {};
    var media_errors = {};
    var menu_errors = {};
    var sitemap_errors = {};

    var menus = {};
    var sitemaps = {};
    var page_keys = {};
    var media_keys = {};
    var deployment_target_params = {};

    var branchData = {
      page_keys: page_keys,
      media_keys: media_keys
    };

    function logPageError(page, errtxt){
      var page_key = page.page_key;
      if(!(page_key in page_errors)) page_errors[page_key] = _.extend(_.pick(page, ['page_id','page_key','page_title','page_path','page_template_id','page_filename']), { errors: [] });
      page_errors[page_key].errors.push(errtxt);
    }

    function logMediaError(media, errtxt){
      var media_key = media.media_key;
      if(!(media_key in media_errors)) media_errors[media_key] = _.extend(_.pick(media, ['media_id','media_key','media_desc','media_path','media_ext','media_width','media_height']), { errors: [] });
      media_errors[media_key].errors.push(errtxt);
    }

    function logMenuError(menu, errtxt){
      var menu_key = menu.menu_key;
      if(!(menu_key in menu_errors)) menu_errors[menu_key] = _.extend(_.pick(menu, ['menu_id','menu_key','menu_name','menu_tag','menu_path']), { errors: [] });
      menu_errors[menu_key].errors.push(errtxt);
    }

    function logSitemapError(sitemap, errtxt){
      var sitemap_key = sitemap.sitemap_key;
      if(!(sitemap_key in sitemap_errors)) sitemap_errors[sitemap_key] = _.extend(_.pick(sitemap, ['sitemap_id','sitemap_key','sitemap_name','sitemap_type']), { errors: [] });
      sitemap_errors[sitemap_key].errors.push(errtxt);
    }

    async.waterfall([

      //Get deployment_target_params for branch
      function(cb){
        var sql = "select deployment_target_params from "+(module.schema?module.schema+'.':'')+"v_my_branch_desc left outer join "+(module.schema?module.schema+'.':'')+"v_my_site on v_my_site.site_id = v_my_branch_desc.site_id where branch_id=@branch_id";
        appsrv.ExecScalar(dbcontext, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; return cb(err); }
          if(rslt && rslt[0]){
            try{
              deployment_target_params = JSON.parse(rslt[0]);
            }
            catch(ex){}
          }
          return cb();
        });
      },
      
      //Get all media
      function(cb){
        var sql = "\
          select media_id,media_key,media_file_id,media_desc,media_path,media_ext,media_width,media_height \
            from "+(module.schema?module.schema+'.':'')+"media media where media_is_folder=0 and media.media_id in (select media_id from "+(module.schema?module.schema+'.':'')+"branch_media where branch_id=@branch_id)\
        ";
        appsrv.ExecRecordset(dbcontext, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; return cb(err); }
          if(rslt && rslt[0]){
            _.each(rslt[0], function(media){
              media_keys[media.media_key] = media;
            });
          }
          return cb();
        });
      },

      //Get all pages
      function(cb){
        var sql = "\
          select page_id,page_key,page_file_id,page_title,page_path,page_tags,page_author,page_template_id,page_filename,page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_review_sts,page_lang \
            from "+(module.schema?module.schema+'.':'')+"page page where page_is_folder = 0 and page.page_id in (select page_id from "+(module.schema?module.schema+'.':'')+"branch_page where branch_id=@branch_id)\
        ";
        appsrv.ExecRecordset(dbcontext, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; return cb(err); }
          if(rslt && rslt[0]){
            _.each(rslt[0], function(page){
              page_keys[page.page_key] = page;
            });
          }
          return cb();
        });
      },
      
      //Load Custom Branch Data
      function (cb){
        if(!module.Config.onValidate_LoadData) return cb();
        return module.Config.onValidate_LoadData(jsh, branchData, deployment_target_params, cb);
      },

      //Get page file content
      function(cb){
        async.eachOfSeries(page_keys, function(page, page_id, page_cb){
          funcs.getClientPage(page, null, function(err, clientPage){
            if(err){ logPageError(page, err.toString()); return page_cb(); }
            if(!clientPage) return page_cb(null); 
            page.compiled = clientPage.page;
            page.template = clientPage.template;

            var page_path = null;
            try{
              page_path = funcs.getPageRelativePath(page);
            }
            catch(ex){
              if(ex) logPageError(page, ex.toString());
            }
            if(!page_path) logPageError(page, 'Page does not have a valid path');

            var allContent = [];
            _.each(['css','header','footer','js'], function(key){ if(!page.template[key]) return; allContent['template '+key] = page.template[key]; });
            _.each(['css','header','footer'], function(key){ if(!page.compiled[key]) return; allContent[key] = page.template[key]; });
            if(page.compiled.content) for(var key in page.compiled.content) allContent[key + ' content'] = page.compiled.content[key];
            for(var key in allContent){
              funcs.replaceBranchURLs(allContent[key], {
                getMediaURL: function(media_key, branchData, getLinkContent){
                  if(!(media_key in media_keys)) throw new Error('<' + key + '>: Link to missing Media ID #'+media_key.toString()+': ...'+getLinkContent()+'...');
                  return '';
                },
                getPageURL: function(page_key, branchData, getLinkContent){
                  if(!(page_key in page_keys)) throw new Error('<' + key + '>: Link to missing Page ID #'+page_key.toString()+': ...'+getLinkContent()+'...');
                  return '';
                },
                onError: function(err){
                  logPageError(page, err.toString());
                },
                branchData: branchData,
                removeClass: true
              });
            }
            return page_cb(null);
          });
        }, cb);
      },

      //Validate Media Paths
      function(cb){
        async.eachOfSeries(media_keys, function(media, media_id, media_cb){
          var media_path = null;
          try{
            media_path = funcs.getMediaRelativePath(media);
          }
          catch(ex){
            if(ex) logMediaError(media, ex.toString());
          }
          if(!media_path) logMediaError(media, 'Media does not have a valid path');

          return media_cb(null);
        }, cb);
      },

      //Get all menus
      function(cb){
        var sql = "select menu_id,menu_key,menu_file_id,menu_name,menu_tag,menu_template_id,menu_path \
          from "+(module.schema?module.schema+'.':'')+"menu menu \
          where menu.menu_id in (select menu_id from "+(module.schema?module.schema+'.':'')+"branch_menu where branch_id=@branch_id and branch_menu_action is not null) or \
                menu.menu_id in (select menu_orig_id from "+(module.schema?module.schema+'.':'')+"branch_menu where branch_id=@branch_id and branch_menu_action = 'UPDATE')";
        appsrv.ExecRecordset(dbcontext, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; return cb(err); }
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
            if(err){ logMenuError(menu, err.toString()); return menu_cb(); }

            var menu_path = null;
            try{
              menu_path = funcs.getMenuRelativePath(menu);
            }
            catch(ex){
              if(ex) logMenuError(menu, ex.toString());
            }
            if(!menu_path) logMenuError(menu, 'Menu does not have a valid path');

            if(!menu_content) return menu_cb(null);

            //Validate URLs
            menu.menu_items = menu_content.menu_items||[];
            var pretty_menu_items = funcs.prettyMenu(menu_content.menu_items, page_keys, media_keys, { text: false });
            for(var i=0;i<menu.menu_items.length;i++){
              var menu_item = menu.menu_items[i];
              var pretty_menu_item = pretty_menu_items[i];
              if((menu_item.menu_item_link_type||'').toString()=='PAGE'){
                var page_key = parseInt(menu_item.menu_item_link_dest);
                if(!(page_key in page_keys)) logMenuError(menu, 'Menu item "' + pretty_menu_item.menu_item + '" links to missing Page ID #'+page_key.toString());
                else menu_item.menu_item_link_dest = page_keys[page_key];
              }
              else if((menu_item.menu_item_link_type||'').toString()=='MEDIA'){
                var media_key = parseInt(menu_item.menu_item_link_dest);
                if(!(media_key in media_keys)) logMenuError(menu, 'Menu item "' + pretty_menu_item.menu_item + '" links to missing Media ID #'+media_key.toString());
                else menu_item.menu_item_link_dest = media_keys[media_key];
              }
            }
            
            return menu_cb();
          });
        }, cb);
      },

      //Get all sitemaps
      function(cb){
        var sql = "select sitemap_id,sitemap_key,sitemap_file_id,sitemap_name,sitemap_type \
          from "+(module.schema?module.schema+'.':'')+"sitemap sitemap \
          where sitemap.sitemap_id in (select sitemap_id from "+(module.schema?module.schema+'.':'')+"branch_sitemap where branch_id=@branch_id and branch_sitemap_action is not null) or \
                sitemap.sitemap_id in (select sitemap_orig_id from "+(module.schema?module.schema+'.':'')+"branch_sitemap where branch_id=@branch_id and branch_sitemap_action = 'UPDATE')";
        appsrv.ExecRecordset(dbcontext, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; return cb(err); }
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
            if(err){ logSitemapError(sitemap, err.toString()); return sitemap_cb(); }

            if(!sitemap_content) return sitemap_cb(null);

            //Validate URLs
            sitemap.sitemap_items = sitemap_content.sitemap_items||[];
            var pretty_sitemap_items = funcs.prettySitemap(sitemap_content.sitemap_items, page_keys, media_keys, { text: false });
            for(var i=0;i<sitemap.sitemap_items.length;i++){
              var sitemap_item = sitemap.sitemap_items[i];
              var pretty_sitemap_item = pretty_sitemap_items[i];
              if((sitemap_item.sitemap_item_link_type||'').toString()=='PAGE'){
                var page_key = parseInt(sitemap_item.sitemap_item_link_dest);
                if(!(page_key in page_keys)) logSitemapError(sitemap, 'Sitemap item "' + pretty_sitemap_item.sitemap_item + '" links to missing Page ID #'+page_key.toString());
                else sitemap_item.sitemap_item_link_dest = page_keys[page_key];
              }
              else if((sitemap_item.sitemap_item_link_type||'').toString()=='MEDIA'){
                var media_key = parseInt(sitemap_item.sitemap_item_link_dest);
                if(!(media_key in media_keys)) logSitemapError(sitemap, 'Sitemap item "' + pretty_sitemap_item.sitemap_item + '" links to missing Media ID #'+media_key.toString());
                else sitemap_item.sitemap_item_link_dest = media_keys[media_key];
              }
            }

            return sitemap_cb();
          });
        }, cb);
      },

    ], function(err){
      if(err) return callback(err);
      var error_count = 0;
      error_count += _.keys(page_errors).length;
      error_count += _.keys(media_errors).length;
      error_count += _.keys(menu_errors).length;
      error_count += _.keys(sitemap_errors).length;
      return callback(null, {
        page_errors: page_errors,
        media_errors: media_errors,
        menu_errors: menu_errors,
        sitemap_errors: sitemap_errors,
        error_count: error_count
      });
    });
  }

  return exports;
};
