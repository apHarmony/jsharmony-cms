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

var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var os = require('os');
var express = require('jsharmony/lib/express');
var cookieParser = require('jsharmony/lib/cookie-parser');
var https = require('https');
var http = require('http');
var webpath = require('path').posix;
var fspath = require('path');
var Helper = require('jsharmony/Helper');
var HelperFS = require('jsharmony/HelperFS');
var URL = require('url').URL;

function jsHarmonyCMSPreviewServer(cms){
  this.cms = cms;
  this.jsh = cms.jsh;
}

jsHarmonyCMSPreviewServer.prototype.Run = function(run_cb){
  if(!run_cb) run_cb = function(){};
  var _this = this;
  var jsh = _this.jsh;
  var config = jsh.Config;
  var cms = _this.cms;
  var dbtypes = jsh.AppSrv.DB.types;

  var port = cms.Config.preview_server.serverPort;
  var siteConfig = jsh.Sites['main'];
  
  var isHTTPS = !!config.server.https_key;
  if(isHTTPS){
    var https_options = {
      key: fs.readFileSync(config.server.https_key),
      cert: fs.readFileSync(config.server.https_cert),
    };
    if(config.server.https_ca) https_options.ca = fs.readFileSync(config.server.https_ca);
  }

  if(!_this.cms.Config.preview_server.serverIp){
    jsh.Log.error('Invalid CMS Config: Preview Server is enabled, but missing cms.Config.preview_server.serverIp');
    return run_cb();
  }
  
  var app = express();
  app.jsh = jsh;

  function setNoCache(req, res){
    if (req.headers['user-agent'] && req.headers['user-agent'].match(/Trident\//)) {
      //Add Cache header for IE
      res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
    }
  }

  if(siteConfig.cookiesalt) app.use('/', cookieParser(siteConfig.cookiesalt, { path: siteConfig.baseurl }));
  else app.use('/', cookieParser({ path: siteConfig.baseurl }));

  app.use(_this.jsh.Log.express.with({ pathPrefix: 'PREVIEWSERVER:' }));
  app.set('view engine', 'ejs');

  app.all('*', function (req, res, next) {
    req.jshsite = siteConfig;
    req.baseurl = jsh.Servers['default'].getURL((req.headers.host||'').split(':')[0]);
    //Delete jQuery Anti-Cache timestamp
    if('_' in req.query) delete req.query['_'];
    setNoCache(req,res);
    res.setHeader('X-UA-Compatible','IE=edge');
    //Cookie Suffix
    port = req.socket.localPort;
    req.jsh_cookie_suffix = '_'+(jsh.Config.server.https_port||jsh.Config.server.http_port)+'_'+(siteConfig.id||'');
    return next();
  });

  //Authenticate the user
  app.all('*', function (req, res, next) {
    if(!siteConfig.auth){ return jsh.Auth.NoAuth(req, res, next); }
    //Handle Authentication
    (siteConfig.auth.onAuth || jsh.Auth).call(jsh, req, res, next, function (errno, msg) {
      res.end('<html><body>Please log in at <a href="'+Helper.escapeHTML(req.baseurl)+'">'+Helper.escapeHTML(req.baseurl)+'</a></body></html>');
    });
  });

  //Get current branch / site ID
  app.all('*', function (req, res, next) {
    jsh.AppSrv.ExecRow(req._DBContext, cms.funcs.replaceSchema("select site_id from {schema}.v_my_branch_desc where branch_id={schema}.my_current_branch_id()"), [], {}, function (err, rslt) {
      if(err) return Helper.GenError(req, res, -99999, err.toString());

      if (!rslt || !rslt.length || !rslt[0] || !rslt[0].site_id){
        //If no branch checked out - show error message
        var url = req.baseurl+'/'+cms.namespace+'Branch_Active_Listing';
        return res.end('<html><body>Please check out a CMS branch: <a href="'+Helper.escapeHTML(url)+'">'+Helper.escapeHTML(url)+'</a></body></html>');
      }

      req.site_id = rslt[0].site_id;
      return next();
    });
  });
  
  //Return file from local branch
  app.all('*', function (req, res, next) {
    var rpath = req.path;
    var sitepath = fspath.join(jsh.Config.datadir,'site',req.site_id.toString());
    try{
      rpath = webpath.normalize(rpath);
    }
    catch(ex){
      return jsh.Gen404(req, res);
    }

    var syspath = '';
    var foundFile = false;

    async.waterfall([

      //File Match
      function(path_cb){
        syspath = fspath.join(sitepath, rpath);
        fs.realpath(syspath, function(err, fullpath){
          if(err) return jsh.Gen404(req, res);
          if(fullpath == sitepath) return path_cb();
          if(fullpath.indexOf(sitepath + fspath.sep)!=0) return jsh.Gen404(req, res);
          fs.lstat(syspath, function(err, stats){
            if(err) return jsh.Gen404(req, res);
            if(stats.isDirectory()) return path_cb();
            if(stats.isFile()){
              foundFile = true;
              return path_cb();
            }
            return jsh.Gen404(req, res);
          });
        });
      },

      //Directory Match
      function(path_cb){
        if(foundFile) return path_cb();
        syspath = fspath.join(syspath, 'index.html');
        fs.lstat(syspath, function(err, stats){
          if(err){
            res.end('No index.html file found in this folder');
            return;
          }
          if(stats.isFile()){
            foundFile = true;
            return path_cb();
          }
          return jsh.Gen404(req, res);
        });
      },

      //Return file
      function(path_cb){
        HelperFS.outputFile(req, res, syspath, '', undefined, { attachment: false });
      },

    ], function(err){
      return jsh.Gen404(req, res);
    });
  });

  //Error Handler
  app.use(function (err, req, res, next) {
    var errorpage = 'error';
    if (req.jshsite && req.jshsite.show_system_errors) errorpage = 'error_debug';
    jsh.Log.error(err);
    jsh.Log.info(err.stack);
    res.status(err.status || 500);
    res.render(jsh.getView(req, errorpage, { disable_override: true }), {
      message: err.message,
      error: err,
    });
  });

  //Launch Server
  var server = (isHTTPS?https:http).createServer(https_options, app);
  server.on('listening',function(){
    jsh.Log.info('Preview Server listening on '+(isHTTPS?'HTTPS':'HTTP')+' port '+port);
    return run_cb();
  });
  server.listen(port, cms.Config.preview_server.serverIp);
}

jsHarmonyCMSPreviewServer.prototype.getURL = function(hostname){
  var _this = this;

  var isHTTPS = !!_this.jsh.Config.server.https_key;

  var server_txt = _this.cms.Config.preview_server.serverIp;
  var server_port = _this.cms.Config.preview_server.serverPort;
  var server_scheme = isHTTPS ? 'https://' : 'http://';

  if(hostname && server_port) return server_scheme+hostname+':'+server_port;

  if(server_txt == '0.0.0.0') server_txt = os.hostname().toLowerCase();
  if(server_txt && server_port) return server_scheme+server_txt+':'+server_port;
  return '';
}

module.exports = exports = jsHarmonyCMSPreviewServer;