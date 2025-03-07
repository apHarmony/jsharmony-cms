/*
Copyright 2021 apHarmony

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
var async = require('async');

module.exports = exports = function(module, funcs){
  var exports = {};
  var _t = module._t;

  function parseSearchQuery(str){
    str = (str || '').toString().trim().toLowerCase();
    if(!str) return null;
    var keywords = [];
    var quotedKeywords = str.split('"');
    for(var i=0;i<quotedKeywords.length;i++){
      var quotedKeyword = quotedKeywords[i].trim();
      if(!quotedKeyword) continue;
      if((i%2)==1){
        keywords.push(quotedKeyword.trim());
      }
      else {
        var subKeywords = quotedKeyword.split(/[\s,]+/);
        _.each(subKeywords, function(subKeyword){ subKeyword = subKeyword.trim();  if(subKeyword) keywords.push(subKeyword); });
      }
    }
    return keywords;
  }

  exports.searchContent = function(query, str){
    var score = [];
    if(!str) return null;
    str = str.toString().toLowerCase();
    var hasScore = false;
    for(var i=0;i<query.length;i++){
      var keyword = query[i];
      var keywordScore = 0;
      var idx = -1;
      while((idx = str.indexOf(keyword, idx+1)) >= 0) keywordScore++;
      score.push(keywordScore * keyword.length);
      if(keywordScore > 0) hasScore = true;
    }
    if(!hasScore) return null;
    return score;
  };

  exports.mergeSearchScore = function(scoreSrc, scoreDest, factor){
    if(typeof factor == 'undefined') factor = 1;
    var rslt = scoreSrc;
    if(!scoreSrc) rslt = [];
    for(var i=0;i<scoreDest.length;i++){
      if(i >= rslt.length) rslt.push(0);
      rslt[i] += scoreDest[i] * factor;
    }
    return rslt;
  };

  exports.search = function(req, res, next){
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};

    var Q = req.query;
    var P = {};

    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var cms = module;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Page_Search');

    if (!Helper.hasModelAction(req, model, 'B')) return Helper.GenError(req, res, -11, _t('Invalid Model Access'));
    
    //Validate parameters
    if (!appsrv.ParamCheck('Q', Q, ['&query','|itemType'])) return Helper.GenError(req, res, -4, 'Invalid Parameters');
    if (!appsrv.ParamCheck('P', P, [])) return Helper.GenError(req, res, -4, 'Invalid Parameters');

    var query = parseSearchQuery(Q.query);
    if(!query || !query.length) return Helper.GenError(req, res, -4, 'Invalid Parameters');

    var itemType = Q.itemType || null;

    if (verb == 'get') {
      jsh.AppSrv.ExecRow(req._DBContext, cms.funcs.replaceSchema('select {schema}.my_current_site_id() site_id, {schema}.my_current_branch_id() branch_id'), [], {}, function (err, rslt) {
        if(err) return Helper.GenError(req, res, -99999, err.toString());
  
        if (!rslt || !rslt.length || !rslt[0] || !rslt[0].site_id) return Helper.GenError(req, res, -1, 'Please check out a site');
        if (!rslt[0].branch_id) return Helper.GenError(req, res, -1, 'Please check out a revision');

        var site_id = rslt[0].site_id;
        var branch_id = rslt[0].branch_id;

        funcs.validateBranchAccess(req, res, branch_id, 'R%', undefined, function(){

          var searchData = {
            _DBContext: req._DBContext,
            query: query,
            site_id: site_id,
            branch_id: branch_id,
            media_keys: {},
            page_keys: {},
            results: [],
            site_config: {},
          };
          var sql_ptypes = [dbtypes.BigInt];
          var sql_params = { 'branch_id': branch_id };
          
          async.waterfall([
            //Get site_config
            function(search_cb){
              funcs.getSiteConfig(req._DBContext, site_id, { continueOnConfigError: true }, function(err, siteConfig){
                if(err) return search_cb(err);
                searchData.site_config = siteConfig || {};
                return search_cb();
              });
            },
            //Search pages
            function(search_cb){
              async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, search_item_cb){
                if(!branch_item.search) return search_item_cb();
                Helper.execif(branch_item.search.columns,
                  function(f){
                    var sql = 'select branch_{item}.{item}_key,branch_{item}.{item}_id,';
                    sql += _.map(branch_item.search.columns || [], function(colname){ return '{item}.'+colname; }).join(',');

                    sql += ' from {tbl_branch_item} branch_{item}';
                    sql += ' left outer join {tbl_item} {item} on {item}.{item}_id = branch_{item}.{item}_id';
          
                    sql += ' where branch_{item}.branch_id=@branch_id and branch_{item}.{item}_id is not null';
                    
                    appsrv.ExecRecordset(req._DBContext, cms.applyBranchItemSQL(branch_item_type, sql), sql_ptypes, sql_params, function (err, rslt) {
                      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
                      if(!rslt || !rslt.length || !rslt[0]){ return search_cb(new Error('Error loading revision data')); }
                      searchData[branch_item_type] = rslt[0];
                      return f();
                    });
                  },
                  search_item_cb
                );
              }, search_cb);
            },
            function(search_cb){
              //Search items
              async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, search_item_cb){
                if(!branch_item.search) return search_item_cb();
                Helper.execif(branch_item.search.onBeforeSearch,
                  function(f){
                    branch_item.search.onBeforeSearch(searchData[branch_item_type], searchData, f);
                  },
                  search_item_cb
                );
              }, search_cb);
            },
            function(search_cb){
              //Search items
              async.eachOfSeries(cms.BranchItems, function(branch_item, branch_item_type, search_item_cb){
                if(itemType && (itemType != branch_item_type)) return search_item_cb();
                if(!branch_item.search) return search_item_cb();
                Helper.execif(branch_item.search.onSearch,
                  function(f){
                    branch_item.search.onSearch(searchData[branch_item_type], searchData, f);
                  },
                  search_item_cb
                );
              }, search_cb);
            },
          ], function(err){
            if(err) return Helper.GenError(req, res, -99999, err.toString());
            for(var i=0;i<searchData.results.length;i++){
              searchData.results[i].id = i+1;
              searchData.results[i].score = Math.round(Math.log10(searchData.results[i].score)*10000)/100000;
            }
            res.end(JSON.stringify({ '_success': 1, results: searchData.results }));
          });
        });
      });
      return;
    }
    return Helper.GenError(req, res, -4, 'Invalid Operation');
  };

  exports.search_getPages = function(searchItems, searchData, callback){
    var publish_params = {
      site_default_page_filename: '',
      page_subfolder: '',
      media_subfolder: '',
      url_prefix: '/',
    };

    _.each(searchItems, function(page){
      var page_cmspath = '';
      try{
        var relativePath = funcs.getPageRelativePath(page, publish_params);
        if(!relativePath) return;
        page_cmspath = publish_params.url_prefix + publish_params.page_subfolder + relativePath;
        if(!Helper.isNullUndefined(publish_params.url_prefix_page_override)){ page_cmspath = publish_params.url_prefix_page_override + relativePath; }
      }
      catch(ex){ /* Do nothing */ }

      if(page_cmspath){
        searchData.page_keys[page.page_key] = page_cmspath;
        if(path.basename(page_cmspath)==publish_params.site_default_page_filename){
          var base_page_dir = publish_params.url_prefix + publish_params.page_subfolder;
          if(!Helper.isNullUndefined(publish_params.url_prefix_page_override)){ base_page_dir = publish_params.url_prefix_page_override; }
          var page_dir = ((page_cmspath==base_page_dir+publish_params.site_default_page_filename) ? base_page_dir : path.dirname(page_cmspath)+'/');
          if(!page_dir) page_dir = './';
          searchData.page_keys[page.page_key] = page_dir;
        }
      }
    });

    return callback();
  };

  exports.search_getMedia = function(searchItems, searchData, callback){
    var publish_params = {
      site_default_page_filename: '',
      media_subfolder: '',
      url_prefix: '/',
    };

    for(var media_id in searchItems){
      var media = searchItems[media_id];
      var media_urlpath = '';
      try{
        var relativePath = funcs.getMediaRelativePath(media, publish_params);
        if(!relativePath) return callback(new Error('Media has no path: '+media.media_key));
        media_urlpath = publish_params.url_prefix + publish_params.media_subfolder + relativePath;
        if(!Helper.isNullUndefined(publish_params.url_prefix_media_override)){ media_urlpath = publish_params.url_prefix_media_override + relativePath; }
      }
      catch(ex){ /* Do nothing */ }

      if(media_urlpath) searchData.media_keys[media.media_key] = media_urlpath;
    }

    return callback();
  };

  exports.search_pages = function(searchItems, searchData, callback){
    async.eachOf(searchItems, function(page, page_id, page_cb){
      if(page.page_is_folder) return page_cb();
      //Calculate page metadata score
      var score = {};
      _.each(['page_path','page_title','page_tags'], function(key){
        var itemScore = exports.searchContent(searchData.query, page[key]);
        if(itemScore) score[key] = itemScore;
      });
      Helper.execif(page.page_file_id,
        function(done){
          funcs.getClientPage(searchData._DBContext, page, null, searchData.site_id, { includeAllExtraContent: true, ignoreInvalidPageTemplate: true, pageTemplates: false }, function(err, clientPage){
            if(err) return page_cb(err);
            if(!clientPage || !clientPage.page) return done();

            //Replace URLs
            function replaceURLs(content, scoreKey){
              //Search Component Attributes
              function searchComponentAttribute(val){
                var itemScore = exports.searchContent(searchData.query, val);
                if(itemScore){
                  if(scoreKey.indexOf('content.')==0){
                    if(!score.content) score.content = [];
                    score.content[key] = exports.mergeSearchScore(score.content[key], itemScore, 0.5);
                  }
                  else {
                    score[key] = exports.mergeSearchScore(score[key], itemScore, 0.5);
                  }
                }
                return content;
              }
              var rslt = funcs.replaceBranchURLs(content, _.extend({ replaceComponents: true }, {
                getMediaURL: function(media_key, thumbnail_id){
                  if(!(media_key in searchData.media_keys)) return '';
                  if(thumbnail_id) return funcs.appendThumbnail(searchData.media_keys[media_key], thumbnail_id, searchData.site_config.media_thumbnails && searchData.site_config.media_thumbnails[thumbnail_id]);
                  return searchData.media_keys[media_key];
                },
                getPageURL: function(page_key){
                  if(!(page_key in searchData.page_keys)) return '';
                  return searchData.page_keys[page_key];
                },
                onComponentData: searchComponentAttribute,
                onComponentProperties: searchComponentAttribute,
                searchData: searchData
              }));
              return rslt;
            }
            var contentPage = clientPage.page;
            if(contentPage.content) for(var key in contentPage.content){ contentPage.content[key] = replaceURLs(contentPage.content[key], 'content.'+key); }
            _.each(['css','header','footer'], function(key){
              if(contentPage[key]) contentPage[key] = replaceURLs(contentPage[key], key);
            });

            //Calculate page content score
            _.each(clientPage.page.content, function(val, key){
              var itemScore = exports.searchContent(searchData.query, val);

              if(itemScore){
                if(!score.content) score.content = [];
                score.content[key] = exports.mergeSearchScore(score.content[key], itemScore);
              }
            });

            if(clientPage.page.seo){
              _.each(['title','keywords','metadesc','canonical_url'], function(key){
                if(!clientPage.page.seo[key]) return;
                var itemScore = exports.searchContent(searchData.query, clientPage.page.seo[key]);
                if(itemScore) score['seo_'+key] = itemScore;
              });
            }

            _.each(['title','header','footer','css'], function(key){
              if(!clientPage.page[key]) return;
              var itemScore = exports.searchContent(searchData.query, clientPage.page[key]);
              if(itemScore) score[key] = exports.mergeSearchScore(score[key], itemScore);
            });

            _.each(clientPage.page.properties, function(val, key){
              var itemScore = exports.searchContent(searchData.query, val);
              if(itemScore){
                if(!score.properties) score.properties = [];
                score.properties[key] = itemScore;
              }
            });
            
            return done();
          });
        },
        function(){
          //Calculate weighted score
          var weightedScore = [];
          for(var key in score){
            if(key=='content'){
              for(var subkey in score.content){
                exports.mergeSearchScore(weightedScore, score.content[subkey]);
              }
            }
            else if(key=='properties'){
              for(let subkey in score.properties){
                exports.mergeSearchScore(weightedScore, score.properties[subkey]);
              }
            }
            else if(_.includes(['header','footer','css'], key)){ exports.mergeSearchScore(weightedScore, score[key], 0.5); }
            else exports.mergeSearchScore(weightedScore, score[key], 2);
          }
          var finalScore = exports.collapseSearchScore(searchData.query, weightedScore);
          if(finalScore > 0){
            searchData.results.push({
              type: 'page',
              type_desc: 'Page',
              path: page.page_path,
              title: page.page_title,
              data: JSON.stringify(_.pick(page,['page_key','page_template_id','page_template_path','page_filename'])),
              score: finalScore,
            });
          }
          return page_cb(null);
        }
      );
    }, callback);
  };

  exports.collapseSearchScore = function(query, mergedScore){
    var finalScore = 0;
    var missingScore = false;
    for(var i=0;i<mergedScore.length;i++){
      if(mergedScore[i]==0) missingScore = true;
      finalScore += mergedScore[i];
    }
    if(missingScore || (mergedScore.length < query.length)) return 0;
    return finalScore;
  };

  exports.search_media = function(searchItems, searchData, callback){
    async.eachOf(searchItems, function(media, media_id, media_cb){
      if(media.media_is_folder) return media_cb();
      //Calculate media score
      var score = {};
      _.each(['media_path','media_ext','media_width','media_height','media_desc','media_tags','media_type'], function(key){
        var itemScore = exports.searchContent(searchData.query, media[key]);
        if(itemScore) score[key] = itemScore;
      });
      
      //Calculate weighted score
      var weightedScore = [];
      for(var key in score){
        exports.mergeSearchScore(weightedScore, score[key], 3);
      }
      var finalScore = exports.collapseSearchScore(searchData.query, weightedScore);
      if(finalScore > 0){
        searchData.results.push({
          type: 'media',
          type_desc: 'Media',
          path: media.media_path,
          title: media.media_desc,
          data: JSON.stringify(_.pick(media,['media_key','media_ext','media_width','media_height'])),
          score: finalScore,
        });
      }
      return media_cb(null);
    }, callback);
    
  };

  return exports;
};
