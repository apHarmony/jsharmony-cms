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

    var model = jsh.getModel(req, module.namespace + 'Branch_Validate');
    
    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    if (verb == 'get') {
      var branch_id = req.query.branch_id;
      
      //Check if item is defined
      var sql_ptypes = [dbtypes.BigInt];
      var sql_params = { 'branch_id': branch_id };
      var validate = new XValidate();
      var verrors = {};
      validate.AddValidator('_obj.branch_id', 'Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      
      verrors = _.merge(verrors, validate.Validate('B', sql_params));
      if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

      funcs.validateBranchAccess(req, res, branch_id, 'R%', ['AUTHOR','PUBLISHER','WEBMASTER'], function(){
        funcs.validate(req._DBContext, branch_id, function(err, rslt){
          if(err){
            if(err.sql || err.frontend_visible){
              if(err.sql) err.model = model;
              return appsrv.AppDBError(req, res, err);
            }
            else{
              rslt = {
                _success: 1,
                error_count: 1,
                branch_validate: {
                  system: {
                    system: {
                      errors: [err.toString()]
                    }
                  }
                } 
              };
            }
          }
          rslt._success = 1;
          res.end(JSON.stringify(rslt));
        });
      });
    }
    else {
      return next();
    }
  }

  exports.validate_logError = function(item_errors, branch_item_type, item, errtxt){
    var key = item[branch_item_type+'_key'];
    var error_columns = [];
    if(module.BranchItems[branch_item_type] && module.BranchItems[branch_item_type].validate && module.BranchItems[branch_item_type].validate.error_columns) error_columns = module.BranchItems[branch_item_type].validate.error_columns;
    if(!(key in item_errors)) item_errors[key] = _.extend(_.pick(item, error_columns), { errors: [] });
    item_errors[key].errors.push(errtxt);
  }

  exports.validate_logSystemError = function(branchData, errtxt){
    if(!branchData.branch_validate.system) branchData.branch_validate.system = {
      system: { errors: [] }
    };
    branchData.branch_validate.system.system.errors.push(errtxt);
  }

  
  exports.validate = function (dbcontext, branch_id, callback) {
    var jsh = module.jsh;
    var cms = module;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { 'branch_id': branch_id };

    var branch_validate = {};

    var branchData = {
      _DBContext: dbcontext,
      page_keys: {},
      page_templates: null,
      component_templates: null,
      media_keys: {},
      branch_id: branch_id,
      site_id: null,
      site_config: {},
      template_variables: null,
      branch_validate: branch_validate,
      deployment: {},
    };

    async.waterfall([

      //Get site config
      function(cb){
        funcs.getSiteConfig('deployment', branchData.site_id, { }, function(err, siteConfig){
          if(err) return cb(err);
          branchData.site_config = siteConfig || {};
          return cb();
        });
      },

      //Get template_variables for branch
      function(cb){
        var sql = "select site_editor deployment_target_id, v_my_site.deployment_target_template_variables, v_my_branch_desc.site_id, deployment_target_publish_config, deployment_target_publish_path from {schema}.v_my_branch_desc left outer join {schema}.v_my_site on v_my_site.site_id = v_my_branch_desc.site_id left outer join {schema}.deployment_target on deployment_target.deployment_target_id = v_my_site.deployment_target_id where v_my_branch_desc.branch_id=@branch_id";
        appsrv.ExecRow(dbcontext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; return cb(err); }
          if(!rslt || !rslt.length || !rslt[0]) return cb(Helper.NewError('No access to target revision', -11));

          branchData.deployment_target_id = rslt[0].deployment_target_id;
          branchData.site_id = rslt[0].site_id;
          branchData.deployment.deployment_target_publish_path = rslt[0].deployment_target_publish_path || '';

          //Template Variables
          var template_variables = {};
          try{
            if(rslt[0].deployment_target_template_variables) template_variables = _.extend(template_variables, JSON.parse(rslt[0].deployment_target_template_variables));
          }
          catch(ex){
            return deploy_cb('Publish Target has invalid deployment_target_template_variables: '+rslt[0].deployment_target_template_variables);
          }

          var deployment_target_publish_config = {};
          try{
            deployment_target_publish_config = funcs.parseDeploymentTargetPublishConfig(branchData.site_id, rslt[0].deployment_target_publish_config, 'publish');
          }
          catch(ex){
            return deploy_cb('Error parsing deployment_target_publish_config: '+ex.toString());
          }

          funcs.parseTemplateVariables('publish', 'deployment', branchData.site_id, branchData.site_config, template_variables, deployment_target_publish_config, function(err, parsed_template_variables){
            if(err) return cb(err);
            template_variables = parsed_template_variables;
            branchData.template_variables = template_variables;

            //Deployment Target Publish Params
            var publish_params = _.extend(JSON.parse(JSON.stringify(template_variables)), deployment_target_publish_config);
            branchData.publish_params = publish_params;

            return cb();
          });
        });
      },

      //Run onBeforeValidate functions
      function(cb){
        async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, branch_item_cb){
          if(!branch_item.validate) return branch_item_cb();

          //Initialize errors array for this item
          branch_validate[branch_item_type] = {};

          Helper.execif(branch_item.validate.onBeforeValidate,
            function(f){
              branch_item.validate.onBeforeValidate(branch_validate[branch_item_type], branchData, f);
            },
            branch_item_cb
          );
        }, cb);
      },

      //Load Custom Branch Data
      function (cb){
        if(!module.Config.onValidate_LoadData) return cb();
        return module.Config.onValidate_LoadData(jsh, branchData, branchData.template_variables, cb);
      },

      //Get all branch data
      function(cb){
        async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, branch_item_cb){
          if(!branch_item.validate) return branch_item_cb();

          //Run onValidate function
          Helper.execif(branch_item.validate.onValidate,
            function(f){
              branch_item.validate.onValidate(branch_validate[branch_item_type], branchData, f);
            },
            branch_item_cb
          );
        }, cb);
      },
    ], function(err){
      if(err) return callback(err);
      var error_count = 0;
      _.map(branch_validate, function(item_errors){ error_count += _.keys(item_errors).length });
      var rslt = { _success: 1, error_count: error_count, branch_validate: _.pickBy(branch_validate, function(branch_items){ return !_.isEmpty(branch_items); }) };
      return callback(null, rslt);
    });
  }

  exports.validate_getPages = function(item_errors, branchData, callback){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    //Get all pages
    var sql = "\
      select page_id,page_key,page_file_id,page_title,page_path,page_tags,page_author,page_template_id,page_template_path,page_filename,page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_review_sts,page_lang \
        from "+(module.schema?module.schema+'.':'')+"page page where page_is_folder = 0 and page.page_id in (select page_id from "+(module.schema?module.schema+'.':'')+"branch_page where branch_id=@branch_id)\
    ";
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { 'branch_id': branchData.branch_id };
    appsrv.ExecRecordset(branchData._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; return callback(err); }
      if(rslt && rslt[0]){
        var page_paths = {};
        _.each(rslt[0], function(page){
          branchData.page_keys[page.page_key] = page;

          //Find duplicate page_path
          var page_path_upper = (page.page_path||'').trim().toUpperCase();
          if(!page_path_upper) funcs.validate_logError(item_errors, 'page', page, 'Page ID '+page.page_id+' missing page_path');
          else if(page_path_upper in page_paths) funcs.validate_logError(item_errors, 'page', page, 'Duplicate page_path: '+page.page_path);
          else page_paths[page_path_upper] = page;
        });
      }
      return callback();
    });
  }

  exports.validate_getMedia = function(item_errors, branchData, callback){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    //Get all media
    var sql = "\
    select media_id,media_key,media_file_id,media_desc,media_path,media_ext,media_width,media_height \
      from "+(module.schema?module.schema+'.':'')+"media media where media_is_folder=0 and media.media_id in (select media_id from "+(module.schema?module.schema+'.':'')+"branch_media where branch_id=@branch_id)\
    ";
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { 'branch_id': branchData.branch_id };
    appsrv.ExecRecordset(branchData._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; return callback(err); }
      if(rslt && rslt[0]){
        var media_paths = {};
        _.each(rslt[0], function(media){
          branchData.media_keys[media.media_key] = media;

          //Find duplicate media_path
          var media_path_upper = (media.media_path||'').trim().toUpperCase();
          if(!media_path_upper) funcs.validate_logError(item_errors, 'media', media, 'Media ID '+media.media_id+' missing media_path');
          else if(media_path_upper in media_paths) funcs.validate_logError(item_errors, 'media', media, 'Duplicate media_path: '+media.media_path);
          else media_paths[media_path_upper] = media;
        });
      }
      return callback();
    });
  }

  exports.validate_page = function(item_errors, branchData, callback){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    //Validate templates
    _.each(branchData.page_templates, function(page_template, page_template_id){
      _.each(page_template.components, function(component, componentId){
        if(componentId in branchData.component_templates){ funcs.validate_logSystemError(branchData, 'Page template "' + page_template.title + '" has an inline component "' + componentId + '" that is already defined as a site component.'); }
      });
    });

    //Get page file content
    async.eachOfSeries(branchData.page_keys, function(page, page_id, page_cb){
      funcs.getClientPage(branchData._DBContext, page, null, branchData.site_id, { pageTemplates: branchData.page_templates }, function(err, clientPage){
        if(err){ funcs.validate_logError(item_errors, 'page', page, err.toString()); return page_cb(); }
        if(!clientPage) return page_cb(null); 
        page.compiled = clientPage.page;
        page.template = clientPage.template;

        var page_path = null;
        try{
          page_path = funcs.getPageRelativePath(page);
        }
        catch(ex){
          if(ex) funcs.validate_logError(item_errors, 'page', page, ex.toString());
        }
        if(!page_path) funcs.validate_logError(item_errors, 'page', page, 'Page does not have a valid path');

        var allContent = [];
        _.each(['css','header','footer','js'], function(key){ if(!page.template[key]) return; allContent['template '+key] = page.template[key]; });
        _.each(['css','header','footer'], function(key){ if(!page.compiled[key]) return; allContent[key] = page.template[key]; });
        if(page.compiled.content) for(var key in page.compiled.content) allContent[key + ' content'] = page.compiled.content[key];
        for(var key in allContent){
          funcs.replaceBranchURLs(allContent[key], {
            getMediaURL: function(media_key, branchData, getLinkContent){
              if(!(media_key in branchData.media_keys)) throw new Error('<' + key + '>: Link to missing Media ID #'+media_key.toString()+': ...'+getLinkContent()+'...');
              return '';
            },
            getPageURL: function(page_key, branchData, getLinkContent){
              if(!(page_key in branchData.page_keys)) throw new Error('<' + key + '>: Link to missing Page ID #'+page_key.toString()+': ...'+getLinkContent()+'...');
              return '';
            },
            onError: function(err){
              funcs.validate_logError(item_errors, 'page', page, err.toString());
            },
            branchData: branchData,
            replaceComponents: true,
            removeClass: true
          });
        }
        return page_cb(null);
      });
    }, callback);
  }

  exports.validate_media = function(item_errors, branchData, callback){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    //Validate Media Paths
    async.eachOfSeries(branchData.media_keys, function(media, media_id, media_cb){
      var media_path = null;
      try{
        media_path = funcs.getMediaRelativePath(media);
      }
      catch(ex){
        if(ex) funcs.validate_logError(item_errors, 'media', media, ex.toString());
      }
      if(!media_path) funcs.validate_logError(item_errors, 'media', media, 'Media does not have a valid path');

      return media_cb(null);
    }, callback);
  }

  exports.validate_menu = function(item_errors, branchData, callback){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    var menus = {};
    var menu_configs = {};

    async.waterfall([
      //Get all menus
      function(cb){
        var sql = "select menu_id,menu_key,menu_file_id,menu_name,menu_tag \
          from "+(module.schema?module.schema+'.':'')+"menu menu \
          where menu.menu_id in (select menu_id from "+(module.schema?module.schema+'.':'')+"branch_menu where branch_id=@branch_id)";
        var sql_ptypes = [dbtypes.BigInt];
        var sql_params = { 'branch_id': branchData.branch_id };
        appsrv.ExecRecordset(branchData._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; return cb(err); }
          if(rslt && rslt[0]){
            var menu_tags = {};
            _.each(rslt[0], function(menu){
              menus[menu.menu_id] = menu;

              //Find duplicate menu_tag
              var menu_tag_upper = (menu.menu_tag||'').trim().toUpperCase();
              if(!menu_tag_upper) funcs.validate_logError(item_errors, 'menu', menu, 'Menu ID '+menu.menu_id+' missing menu_tag');
              else if(menu_tag_upper in menu_tags) funcs.validate_logError(item_errors, 'menu', menu, 'Duplicate menu_tag: '+menu.menu_tag);
              else menu_tags[menu_tag_upper] = menu;
            });
          }
          return cb();
        });
      },

      //Check for missing menus
      function(cb){
        if(branchData.site_config && branchData.site_config.menus){
          _.each(branchData.site_config.menus, function(site_menu_config){
            if(site_menu_config && site_menu_config.tag) menu_configs[site_menu_config.tag] = site_menu_config;
          });
        }
        var menu_tags = {};
        for(var key in menus){
          var menu = menus[key];
          menu_tags[menu.menu_tag] = menu;
        }
        _.each(menu_configs, function(menu_config, menu_tag){
          if(!(menu_tag in menu_tags)) funcs.validate_logSystemError(branchData, 'A menu with menu tag "' + menu_tag + '" is required by the Site Config.  Please add this missing menu to the site.');
        });
        return cb();
      },

      //Get menu file content
      function(cb){
        async.eachOfSeries(menus, function(menu, menu_id, menu_cb){
          funcs.getClientMenu(menu, function(err, menu_content){
            if(err){ funcs.validate_logError(item_errors, 'menu', menu, err.toString()); return menu_cb(); }

            
            menu.menu_items = menu_content.menu_items||[];

            
            
            //For each menu item
            var menu_config = menu_configs[menu.menu_tag];
            var pretty_menu_items = funcs.prettyMenu(menu_content.menu_items, branchData.page_keys, branchData.media_keys, { text: false });
            for(var i=0;i<menu.menu_items.length;i++){
              var menu_item = menu.menu_items[i];
              var pretty_menu_item = pretty_menu_items[i];
              //Validate URLs
              if((menu_item.menu_item_link_type||'').toString()=='PAGE'){
                var page_key = parseInt(menu_item.menu_item_link_dest);
                if(!(page_key in branchData.page_keys)) funcs.validate_logError(item_errors, 'menu', menu, 'Menu item "' + pretty_menu_item.menu_item + '" links to missing Page ID #'+page_key.toString());
                else menu_item.menu_item_link_dest = branchData.page_keys[page_key];
              }
              else if((menu_item.menu_item_link_type||'').toString()=='MEDIA'){
                var media_key = parseInt(menu_item.menu_item_link_dest);
                if(!(media_key in branchData.media_keys)) funcs.validate_logError(item_errors, 'menu', menu, 'Menu item "' + pretty_menu_item.menu_item + '" links to missing Media ID #'+media_key.toString());
                else menu_item.menu_item_link_dest = branchData.media_keys[media_key];
              }
              //Validate Max Depth
              if(menu_config && menu_config.max_depth){
                var menu_path = menu_item.menu_item_path.split('/');
                var menu_item_depth = 0;
                _.each(menu_path, function(val){ if(val) menu_item_depth++; });
                if(menu_item_depth > menu_config.max_depth) funcs.validate_logError(item_errors, 'menu', menu, 'Menu item "' + pretty_menu_item.menu_item + '" exceeds maximum menu depth of '+menu_config.max_depth.toString());
              }
            }
            
            return menu_cb();
          });
        }, cb);
      },
    ], callback);
  }

  exports.validate_sitemap = function(item_errors, branchData, callback){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    var sitemaps = {};

    async.waterfall([

      //Get all sitemaps
      function(cb){
        var sql = "select sitemap_id,sitemap_key,sitemap_file_id,sitemap_name,sitemap_type \
          from "+(module.schema?module.schema+'.':'')+"sitemap sitemap \
          where sitemap.sitemap_id in (select sitemap_id from "+(module.schema?module.schema+'.':'')+"branch_sitemap where branch_id=@branch_id)";
        var sql_ptypes = [dbtypes.BigInt];
        var sql_params = { 'branch_id': branchData.branch_id };
        appsrv.ExecRecordset(branchData._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; return cb(err); }
          if(rslt && rslt[0]){
            var sitemap_types = {};
            _.each(rslt[0], function(sitemap){
              sitemaps[sitemap.sitemap_id] = sitemap;

              //Find duplicate sitemap_type
              var sitemap_type_upper = (sitemap.sitemap_type||'').trim().toUpperCase();
              if(!sitemap_type_upper) funcs.validate_logError(item_errors, 'sitemap', sitemap, 'Sitemap ID '+sitemap.sitemap_id+' missing sitemap_type');
              else if(sitemap_type_upper in sitemap_types) funcs.validate_logError(item_errors, 'sitemap', sitemap, 'Duplicate sitemap_type: '+sitemap.sitemap_type);
              else sitemap_types[sitemap_type_upper] = sitemap;
            });
          }
          return cb();
        });
      },

      //Get sitemap file content
      function(cb){
        async.eachOfSeries(sitemaps, function(sitemap, sitemap_id, sitemap_cb){
          funcs.getClientSitemap(sitemap, function(err, sitemap_content){
            if(err){ funcs.validate_logError(item_errors, 'sitemap', sitemap, err.toString()); return sitemap_cb(); }

            if(!sitemap_content) return sitemap_cb(null);

            //Validate URLs
            sitemap.sitemap_items = sitemap_content.sitemap_items||[];
            var pretty_sitemap_items = funcs.prettySitemap(sitemap_content.sitemap_items, branchData.page_keys, branchData.media_keys, { text: false });
            for(var i=0;i<sitemap.sitemap_items.length;i++){
              var sitemap_item = sitemap.sitemap_items[i];
              var pretty_sitemap_item = pretty_sitemap_items[i];
              if((sitemap_item.sitemap_item_link_type||'').toString()=='PAGE'){
                var page_key = parseInt(sitemap_item.sitemap_item_link_dest);
                if(!(page_key in branchData.page_keys)){
                  funcs.validate_logError(item_errors, 'sitemap', sitemap, 'Sitemap item "' + pretty_sitemap_item.sitemap_item + '" links to missing Page ID #'+page_key.toString());
                }
                else sitemap_item.sitemap_item_link_dest = branchData.page_keys[page_key];
              }
              else if((sitemap_item.sitemap_item_link_type||'').toString()=='MEDIA'){
                var media_key = parseInt(sitemap_item.sitemap_item_link_dest);
                if(!(media_key in branchData.media_keys)) funcs.validate_logError(item_errors, 'sitemap', sitemap, 'Sitemap item "' + pretty_sitemap_item.sitemap_item + '" links to missing Media ID #'+media_key.toString());
                else sitemap_item.sitemap_item_link_dest = branchData.media_keys[media_key];
              }
            }

            return sitemap_cb();
          });
        }, cb);
      },
    ], callback);
  }

  return exports;
};
