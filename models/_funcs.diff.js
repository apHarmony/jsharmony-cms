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
var DiffMatchPatch = require('diff-match-patch');
var diff2html = require("diff2html").Diff2Html;
var prettyhtml = require('js-beautify').html;

module.exports = exports = function(module, funcs){
  var exports = {};
  
  var dmp = new DiffMatchPatch();

  exports.diff = function (req, res, next) {
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

    var model = jsh.getModel(req, module.namespace + 'Branch_Review');
    
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

      var branch_pages = [];
      var branch_media = [];
      var branch_redirects = [];
      var branch_menus = [];
      var pages = {};
      var media = {};
      var menus = {};
      var page_keys = {};
      var media_keys = {};

      async.waterfall([

        //Get all branch_media
        function(cb){
          var sql = "select branch_media.media_key, branch_media.branch_media_action, branch_media.media_id, branch_media.media_orig_id, \
              old_media.media_path old_media_path, old_media.media_file_id old_media_file_id,\
              new_media.media_path new_media_path, new_media.media_file_id new_media_file_id\
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

        //Get all branch_page
        function(cb){
          var sql = "select branch_page.page_key, branch_page.branch_page_action, branch_page.page_id, branch_page.page_orig_id, \
              old_page.page_path old_page_path, old_page.page_title old_page_title, old_page.page_file_id old_page_file_id,\
              new_page.page_path new_page_path, new_page.page_title new_page_title, new_page.page_file_id new_page_file_id\
            from "+(module.schema?module.schema+'.':'')+"branch_page branch_page \
              left outer join "+(module.schema?module.schema+'.':'')+"page old_page on old_page.page_id=branch_page.page_orig_id \
              left outer join "+(module.schema?module.schema+'.':'')+"page new_page on new_page.page_id=branch_page.page_id \
            where branch_id=@branch_id and branch_page_action is not null and (old_page.page_is_folder=0 or new_page.page_is_folder=0)";
          appsrv.ExecRecordset(req._DBContext, sql, sql_ptypes, sql_params, function (err, rslt) {
            if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
            if(rslt && rslt[0]) branch_pages = rslt[0];
            return cb();
          });
        },

        //Get all pages
        function(cb){
          var sql = "select page_id,page_key,page_file_id,page_title,page_path,page_tags,page_author,page_template_id,page_seo_title,page_seo_canonical_url,page_seo_metadesc,page_review_sts,page_lang \
            from "+(module.schema?module.schema+'.':'')+"page page \
            where page_is_folder = 0 and (\
                    page.page_id in (select page_id from "+(module.schema?module.schema+'.':'')+"branch_page where branch_id=@branch_id and branch_page_action is not null) or \
                    page.page_id in (select page_orig_id from "+(module.schema?module.schema+'.':'')+"branch_page where branch_id=@branch_id and branch_page_action = 'UPDATE') \
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
              var old_page = pages[branch_page.page_orig_id];
              var new_page = pages[branch_page.page_id];
              
              branch_page.diff = {};
              _.each(['css','header','footer'], function(key){
                var diff = funcs.diffHTML(old_page.compiled[key], new_page.compiled[key]);
                if(diff) branch_page.diff[key] = diff;
              });
              var old_content_keys = _.keys(old_page.compiled.content);
              var new_content_keys = _.keys(new_page.compiled.content);
              for(var key in old_page.compiled.content){ if(!(key in new_page.compiled.content)) new_page.compiled.content[key] = ''; }
              for(var key in new_page.compiled.content){ if(!(key in old_page.compiled.content)) old_page.compiled.content[key] = ''; }

              branch_page.diff.content_elements = {};
              for(var key in old_page.template.content_elements){ branch_page.diff.content_elements[key] = old_page.template.content_elements[key].title; }
              for(var key in new_page.template.content_elements){ branch_page.diff.content_elements[key] = new_page.template.content_elements[key].title; }
              
              branch_page.diff.content = {};
              for(var key in old_page.compiled.content){
                var diff = funcs.diffHTML(old_page.compiled.content[key], new_page.compiled.content[key]);
                branch_page.diff.content[key] = diff;
              }
              _.each(['page_title','template_title'], function(key){
                if(old_page[key] != new_page[key]) branch_page.diff[key] = new_page[key];
              });
              branch_page.diff.seo = {};
              _.each(['title','keywords','metadesc','canonical_url'], function(key){
                if(old_page.compiled.seo[key] != new_page.compiled.seo[key]) branch_page.diff.seo[key] = new_page.compiled.seo[key];
              });
            }
          });
          return cb();
        },

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

      ], function(err){
        if(err) return Helper.GenError(req, res, -99999, err.toString());
        res.end(JSON.stringify({
          '_success': 1,
          'branch_pages': branch_pages,
          'branch_redirects': branch_redirects,
          'branch_media': branch_media,
          'branch_menus': branch_menus
        }));
      });
      return;
    }
    else {
      return next();
    }
  }

  exports.diffHTML = function(a, b){
    if(a==b) return '';

    var diff_lines = dmp.diff_linesToChars_(a, b);
    var diff_lineText1 = diff_lines.chars1;
    var diff_lineText2 = diff_lines.chars2;
    var diff_lineArray = diff_lines.lineArray;
    var diff = dmp.diff_main(diff_lineText1, diff_lineText2, false);
    dmp.diff_charsToLines_(diff, diff_lineArray);

    //Generate patch
    var patch_lines = [];
    var source_line = 1;
    var dest_line = 1;
    var last_line = 0;
    if(diff.length){
      last_line = diff.length-1;
      if(diff[last_line][0]==0){}
      else{
        if(diff.length > 1){
          if((diff[last_line-1][0]==0)||(diff[last_line-1][0]==diff[last_line][0])){}
          else last_line-=1;
        }
      }
    }
    
    for(var i=0;i<diff.length;i++){
      var diff_line = diff[i];
      var diff_line_type = diff_line[0];
      var diff_line_text = diff_line[1]||'';
      if((i < last_line) && diff_line_text && (diff_line_text[diff_line_text.length-1]=='\n')) diff_line_text = diff_line_text.substr(0,diff_line_text.length-1);
      var diff_lines = diff_line_text.split('\n');

      var diff_line_prefix = ' ';
      if(diff_line_type==-1) diff_line_prefix = '-';
      else if(diff_line_type==1) diff_line_prefix = '+';
      _.each(diff_lines, function(diff_line){ patch_lines.push(diff_line_prefix + diff_line); });

      diff_line[2] = diff_lines;
      diff_line[3] = source_line;
      diff_line[4] = dest_line;
      if(diff_line_type==0){
        source_line += diff_lines.length;
        dest_line += diff_lines.length;
      }
      else if(diff_line_type==-1){
        source_line += diff_lines.length;
      }
      else if(diff_line_type==1){
        dest_line += diff_lines.length;
      }
    }
    //Create patch
    var source_line = 0;
    var dest_line = 0;
    var patch_batches = [];
    var cur_patch_batch = null;
    for(var i=0;i<patch_lines.length;i++){
      var patch_line = patch_lines[i];
      if(patch_line[0]==' '){
        source_line++;
        dest_line++;
      }
      else if(patch_line[0]=='-') source_line++;
      else if(patch_line[0]=='+') dest_line++;
      if(patch_line[0]==' '){
        if(!cur_patch_batch) continue;
        else{
          cur_patch_batch.lines.push(patch_line);
        }
      }
      else {
        if(cur_patch_batch){ cur_patch_batch.lines.push(patch_line); }
        else {
          //Start patch batch
          cur_patch_batch = {
            lines: [patch_line],
            source_start_line: source_line+1,
            source_end_line: undefined,
            dest_start_line: dest_line+1,
            dest_end_line: undefined,
          };
          if(patch_line[0]=='-') cur_patch_batch.source_start_line--;
          if(patch_line[0]=='+') cur_patch_batch.dest_start_line--;
          if(i>0){
            cur_patch_batch.source_start_line--;
            cur_patch_batch.dest_start_line--;
            cur_patch_batch.lines.unshift(patch_lines[i-1]);
          }
          
        }
      }

      //Check if at end of patch
      if((i==(patch_lines.length-1)) || ((patch_line[0]==' ') && (patch_lines[i+1][0]==' '))){
        //End patch batch
        cur_patch_batch.source_end_line = source_line;
        cur_patch_batch.dest_end_line = dest_line;
        patch_batches.push(cur_patch_batch);
        cur_patch_batch = null;
      }
    }

    var patch = '';
    for(var i=0;i<patch_batches.length;i++){
      var patch_batch = patch_batches[i];
      patch += '@@ -'+patch_batch.source_start_line+','+patch_batch.source_end_line+' +'+patch_batch.dest_start_line+','+patch_batch.dest_end_line+' @@\n';
      patch += patch_batch.lines.join('\n')+'\n';;
    }

    /*
    var patch = dmp.patch_toText(dmp.patch_make(a,diff));    
    var patchlines = patch.split(/\n/);
    for(var i=0;i<patchlines.length;i++){
      var patchline = patchlines[i];
      var patchsplit = patchline.split(/%0A/);
      for(var j=1;j<patchsplit.length;j++){
        if((j < (patchsplit.length-1)) || patchsplit[j]){
          patchsplit[j] = patchsplit[0][0] + patchsplit[j];
        }
      }
      patchline = patchsplit.join('%0A');
      patchlines[i] = patchline;
    }
    patch = patchlines.join('\n');
    */

    patch = decodeURIComponent("--- compare\n+++ compare\n" + patch);
    return Diff2Html.getPrettyHtml(patch, {
      inputFormat: "diff",
      matching: "lines"
    });
    
  }

  exports.formatDiff = function(diff){
    var html = [];
    for (var x = 0; x < diff.length; x++) {
      var op = diff[x][0];
      var text = Helper.escapeHTMLBR(diff[x][1]);
      if(op==DiffMatchPatch.DIFF_INSERT){
        html[x] = '<ins style="background:#e6ffe6;">' + text + '</ins>';
      }
      else if(op==DiffMatchPatch.DIFF_DELETE){
        html[x] = '<del style="background:#ffe6e6;">' + text + '</del>';
      }
      else if(op==DiffMatchPatch.DIFF_EQUAL){
        html[x] = '<span>' + text + '</span>';
      }
    }
    return html.join('');
  }

  return exports;
};
