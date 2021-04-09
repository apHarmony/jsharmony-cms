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
var ftppath = require('path').posix;
var fspath = require('path');
var ssh2 = require('ssh2');
var crypto = require('crypto');
var moment = require('moment');
var Helper = require('jsharmony/Helper');
var HelperFS = require('jsharmony/HelperFS');

function jsHarmonyCMSSFTPServer(cms){
  this.cms = cms;
  this.jsh = cms.jsh;
}

jsHarmonyCMSSFTPServer.WRITES_BEFORE_FLUSH = 50;
jsHarmonyCMSSFTPServer.MAX_HANDLE_QUEUE_LENGTH = 100;

jsHarmonyCMSSFTPServer.prototype.Auth = function(req, user, password, clientIp, auth_cb){
  var _this = this;
  var jsh = _this.jsh;
  var sqlparams = {};
  sqlparams[jsh.map.user_email] = user;
  req.jshsite.auth.on_login(req, jsh, sqlparams, function (err, rslt) {
    if ((rslt != null) && (rslt.length == 1) && (rslt[0].length == 1)) {
      var user_info = rslt[0][0];
      if ((user_info[jsh.map.user_status]||'').toUpperCase() != 'ACTIVE') {
        if(jsh.Config.debug_params.auth_debug) jsh.Log('Login: User account not ACTIVE', { source: 'authentication' });
        return auth_cb(false);
      }
      else {
        req.jshsite.auth.validatePassword(req, jsh, user_info, password, function(error, token) { //onAuthenticate
          if (error) {
            if(jsh.Config.debug_params.auth_debug) jsh.Log('Login: Error Authenticating ' + error.toString(), { source: 'authentication' });
            return auth_cb(false);
          }
          else if (token) {
            var user_id = user_info[jsh.map.user_id];
            var pe_ll_tstmp = new Date();
            var sqlparams = {};
            sqlparams[jsh.map.user_last_ip] = clientIp;
            sqlparams[jsh.map.user_id] = user_id;
            sqlparams[jsh.map.user_last_tstmp] = pe_ll_tstmp;
            if(jsh.Config.debug_params.auth_debug) jsh.Log('Login: Success', { source: 'authentication' });
            req.jshsite.auth.on_loginsuccess(req, jsh, sqlparams, function (err, rslt) {
              if ((rslt != null) && (rslt.length == 1) && (rslt[0] != null) && (rslt[0][jsh.map.rowcount] == 1)) {
                sqlparams = {};
                sqlparams[jsh.map.user_email] = user;
                req.jshsite.auth.on_auth(req, jsh, { username: user }, sqlparams, function (err, rslt) {
                  if (err) { jsh.Log.error(err); return auth_cb(false); }
                  if ((rslt != null) && (rslt.length == 1) && (rslt[0].length == 2) && (rslt[0][0].length == 1)) {
                    var user_roles = [];
                    if (rslt[0][1].length > 0) user_roles = _.map(rslt[0][1], jsh.map.user_role);
                    var user_info = rslt[0][0][0];
                    if ((user_info[jsh.map.user_status]||'').toUpperCase() != 'ACTIVE'){
                      if(jsh.Config.debug_params.auth_debug) jsh.Log('Auth: User status not ACTIVE', { source: 'authentication' }); 
                      return auth_cb(false);
                    }
                    else {
                      req.isAuthenticated = true;
                      req.user_id = user_info[jsh.map.user_id];
                      req.user_name = req.jshsite.auth.getuser_name(user_info, jsh);
                      req._DBContext = req.jshsite.auth.getContextUser(user_info, jsh);
                      req._roles = {};
                      _.each(user_roles, function (role) { req._roles[role] = role; });
                      if(jsh.Config.debug_params.auth_debug) jsh.Log('Auth: Success', { source: 'authentication' });
                      var onSuccess = function(){ return auth_cb(true); };
                      if ('onAuthComplete' in req.jshsite.auth) req.jshsite.auth.onAuthComplete(req, user_info, jsh, onSuccess);
                      return onSuccess();
                    }
                  }
                  else{
                    if(jsh.Config.debug_params.auth_debug) jsh.Log('Auth: User not found', { source: 'authentication' }); 
                    return auth_cb(false);
                  }
                });
              }
              else {
                if(jsh.Config.debug_params.auth_debug) jsh.Log('Login: An unexpected error has occurred', { source: 'authentication' });
                return auth_cb(false);
              }
            });
          }
          else {
            if(jsh.Config.debug_params.auth_debug) jsh.Log('Login: An unexpected error has occurred', { source: 'authentication' });
            return auth_cb(false);
          }
        });
      }
    }
    else { 
      if(jsh.Config.debug_params.auth_debug){
        jsh.Log('Login: User account not found', { source: 'authentication' });
        if(err) jsh.Log(err);
      }
      return auth_cb(false);
    }
  });
}

jsHarmonyCMSSFTPServer.prototype.Log = function(txt){
  var _this = this;
  if(!_this.cms || !_this.cms.Config.debug_params.sftp_log) return;
  _this.jsh.Log.info(txt);
}

jsHarmonyCMSSFTPServer.prototype.DebugLog = function(txt){
  var _this = this;
  if(!_this.cms || !_this.cms.Config.debug_params.sftp_log) return;
  _this.jsh.Log.debug(txt);
}

jsHarmonyCMSSFTPServer.prototype.Run = function(run_cb){
  if(!run_cb) run_cb = function(){};
  var _this = this;
  var jsh = _this.jsh;
  var cms = _this.cms;
  var dbtypes = jsh.AppSrv.DB.types;

  
  var hostKeys = [];
  if(_this.cms.Config.sftp.serverKey){
    hostKeys.push(fs.readFileSync(_this.cms.Config.sftp.serverKey));
  }
  else if(jsh.Config.server.https_key){
    hostKeys.push(fs.readFileSync(jsh.Config.server.https_key));
  }

  if(!_this.cms.Config.sftp.serverIp){
    jsh.Log.error('Invalid CMS Config: SFTP is enabled, but missing cms.Config.sftp.serverIp');
    return run_cb();
  }

  var serverParams = { };
  if(hostKeys.length) serverParams.hostKeys = hostKeys;

  var failedAuth = { };


  new ssh2.Server(serverParams, function(client, clientInfo) {

    var clientIp = null;
    var clientIpStr = null;
    if (clientInfo) {
      clientIp = clientInfo.ip;
      if(clientIp) clientIpStr = clientIp.toString();
    }
    var clientDesc = 'SFTP Client ' + clientIp + ' ';

    var req = {
      jshsite: jsh.Sites['main']
    };

    var isValidIp = false;
    _.each(cms.Config.sftp.clientIp, function(subnet){
      if(clientIp && Helper.ValidateSubnet(clientIp, subnet)) isValidIp = true;
    });

    if(!isValidIp){
      _this.DebugLog(clientDesc + 'Connection dropped because no subnet match in cms.Config.sftp.clientIp');
      //Ignore Connection Errors
      client.on('error', function(){ });
      return;
    }

    var clientSessions = [];

    function onAuthSuccess(ctx, username){
      var clientIndex = (clientIpStr) ? (clientIpStr + '-' + username.toLowerCase()) : '';
      if(clientIndex){
        if(failedAuth[clientIndex]){
          delete failedAuth[clientIndex];
        }
      }
      try{
        ctx.accept();
      }
      catch(ex){
      }
    }

    function onAuthReject(ctx, username, authMethods){
      var clientIndex = (clientIpStr) ? (clientIpStr + '-' + username.toLowerCase()) : '';
      if(clientIndex){
        if(!(clientIndex in failedAuth)){
          failedAuth[clientIndex] = {
            count: 0,
            lastLogin: new Date().getTime()
          }
        }
        failedAuth[clientIndex].count++;
        failedAuth[clientIndex].lastLogin = new Date().getTime();
      }
      try{
        ctx.reject(authMethods);
      }
      catch(ex){
      }
    }

    client.on('authentication', function(ctx) {
      var username = Buffer.from(ctx.username).toString() || '';
      var sleepTime = 0;
      var clientIndex = (clientIpStr) ? (clientIpStr + '-' + username.toLowerCase()) : '';
      if(clientIndex in failedAuth){
        var failedAuthInfo = failedAuth[clientIndex];
        if(failedAuthInfo.count > 10){
          sleepTime = 1000*Math.pow(1.1,(failedAuthInfo.count-10))-1000;
        }
        sleepTime = Math.round(Math.min(sleepTime, 15000));

        //Expire after one hour
        if(failedAuth[clientIndex].lastLogin < (new Date().getTime() - 1000 * 60 * 60)){
          delete failedAuth[clientIndex];
          sleepTime = 0;
        }
      }
      Helper.execif((sleepTime > 0),
        function(f){
          setTimeout(f, sleepTime);
        },
        function(){
          if(!username) return onAuthReject(ctx, username);

          var authMethods = ['password'];

          if(ctx.method=='password'){
            var password = Buffer.from(ctx.password).toString();
            _this.Auth(req, username, password, clientIp, function(success){
              if(success){
                if(!_.intersection(['SYSADMIN','WEBMASTER'], _.keys(req._roles)).length) return onAuthReject(ctx, username);
                return onAuthSuccess(ctx, username);
              }
              else {
                return onAuthReject(ctx, username, authMethods);
              }
            });
            return;
          }
          else{
            return onAuthReject(ctx, username, authMethods);
          }
        }
      );
   
      
    }).on('ready', function() {
      _this.Log(clientDesc + 'Authenticated');
   
      client.on('session', function(accept, reject) {

        var session = accept();
        session.on('sftp', function(accept, reject) {
          _this.DebugLog(clientDesc + 'Session Started');
          var handles = {};
          var maxHandle = 1;
          var basePath = '/';
          var sitePath = fspath.join(jsh.Config.datadir,'site');

          var clientSession = {
            handles: handles
          };
          clientSessions.push(clientSession);

          var sftpStream = accept();
          var SFTPSTREAM = sftpStream.constructor;

          //SFTPStream.STATUS_CODE { OK, EOF, NO_SUCH_FILE, PERMISSION_DENIED, FAILURE, BAD_MESSAGE, OP_UNSUPPORTED }
          //SFTPStream.OPEN_MODE { READ, WRITE, APPEND, CREAT, TRUNC, EXCL }  SFTPStream.stringToFlags, SFTPStream.flagsToString
          //.status(reqid, statusCode, [message])  -- Wait for continue event
          //.handle(reqid, handle) -- If return false, wait for continue event
          //.data(reqid, data, encoding) -- If return false, wait for continue event
          //.name(reqid, names)  names = array of { filename, longname, attrs }
          //.attrs(reqid, attrs) attrs = { mode, uid, gid, size, atime, mtime }

          function normalizePath(fpath){
            var vpath = fpath;
            try{
              if(!vpath) vpath = basePath;
              if(vpath[0] != '/') vpath = ftppath.join(basePath, vpath);
              vpath = ftppath.normalize(vpath);
            }
            catch(ex){
              _this.DebugLog(clientDesc + 'REALPATH - Invalid Path: '+fpath);
              return false;
            }
            if(vpath.indexOf('/sites/')===0){
              var vpathParts = vpath.split('/');
              if(vpathParts[2]){
                var siteId = vpathParts[2].split('_')[0];
                if(parseInt(siteId).toString() === siteId){
                  vpathParts[2] = siteId;
                  return vpathParts.join('/');
                }
              }
            }
            return vpath;
          }

          function realPath(vpath, cb){
            var sysPath = '';
            var sysBasePath = '';
            if(vpath=='/'){
              return cb('');
            }
            else if(vpath == '/sites'){
              sysBasePath = sitePath;
              sysPath = sysBasePath;
            }
            else if(vpath.indexOf('/sites/')==0){
              sysBasePath = sitePath;
              sysPath = fspath.join(sysBasePath, vpath.substr(('/sites/').length));
            }
            else {
              return cb(false);
            }
            fs.realpath(sysPath, function(err, fullpath){
              if(err) return cb(false);
              if(fullpath.indexOf(sysBasePath + fspath.sep)==0) return cb(fullpath);
              if(fullpath === sysBasePath) return cb(fullpath);
              return cb(false);
            });
          }

          function validateAccess(reqid, vpath, options, cb){
            options = _.extend({ softFail: false }, options);
            function handleError(code, msg){
              if(options.softFail) return cb({ isSFTPError: true, code: code, msg: msg });
              return sftpStream.status(reqid, code, msg);
            }

            if(vpath.indexOf('/sites/')==0){
              var site_str = vpath.substr(('/sites/').length);
              if(!site_str) return cb();
              site_str = site_str.split('/')[0];
              site_str = site_str.split('_')[0];
              if(!site_str) return handleError(ssh2.SFTP_STATUS_CODE.FAILURE, 'Invalid path');
              var site_id = parseInt(site_str);
              if(site_id.toString() != site_str) return handleError(ssh2.SFTP_STATUS_CODE.FAILURE, 'Invalid path');

              jsh.AppSrv.ExecRow(req._DBContext, cms.funcs.replaceSchema("select site_id from {schema}.v_my_site where site_id=@site_id and site_sts='ACTIVE' order by site_id"), [dbtypes.BigInt], { site_id: site_id }, function (err, rslt) {
                if (err) { jsh.Log.error(err); return handleError(ssh2.SFTP_STATUS_CODE.FAILURE, 'Error retrieving site listing'); }

                if (!rslt || !rslt.length || !rslt[0] || !rslt[0].site_id) return handleError(ssh2.SFTP_STATUS_CODE.PERMISSION_DENIED);

                //If it is a site folder and it does not exist, create it
                HelperFS.createFolderIfNotExists(fspath.join(sitePath,site_id.toString()), cb);
              });
            }
            else if(vpath == '/') return cb();
            else if(vpath == '/sites') return cb();
            else return handleError(ssh2.SFTP_STATUS_CODE.PERMISSION_DENIED);
          }

          function initPath(reqid, fpath, options, cb){
            options = _.extend({ softFail: false }, options);
            function handleError(code, msg){
              if(options.softFail) return cb({ isSFTPError: true, code: code, msg: msg });
              return sftpStream.status(reqid, code, msg);
            }

            //Normalize path
            var vpath = normalizePath(fpath);
            if(vpath === false) return handleError(ssh2.SFTP_STATUS_CODE.FAILURE, 'Invalid path');

            async.waterfall([

              function(open_cb){
                ////Check if a user has access to the folder
                validateAccess(reqid, vpath, options, open_cb);
              },

              function(open_cb){
                //Check if it is a real path
                realPath(vpath, function(syspath){
                  if(syspath === false) return handleError(ssh2.SFTP_STATUS_CODE.NO_SUCH_FILE, 'Path not found');

                  if(syspath === '') return cb(null, vpath, syspath, {
                    size: 4096,
                    atimeMs: moment().valueOf(),
                    mtimeMs: moment().valueOf(),
                    mode: 0777 + fs.constants.S_IFDIR,
                    isFile: function(){ return false; },
                    isDirectory: function(){ return true; },
                    isSymbolicLink: function(){ return false; },
                  });

                  //Get stats
                  fs.lstat(syspath, function(err, stats){
                    if(err) return open_cb(err);
                    //Verify it is a file or directory
                    if(!stats.isDirectory() && !stats.isFile()) return handleError(ssh2.SFTP_STATUS_CODE.PERMISSION_DENIED);
                    return cb(null, vpath, syspath, stats);
                  });
                });
              },
            ], function(err){
              if(err){
                if(options.softFail && err.isSFTPError) return cb(err);
                jsh.Log.error(err);
                return handleError(ssh2.SFTP_STATUS_CODE.FAILURE, 'An error occurred');
              }
            });
          }

          function updateHandleAccess(handleInfo){
            handleInfo.lastAccess = new Date().getTime();
          }

          function getHandleInfo(handle){
            handle = (handle||'').toString();
            var handleInfo = handles[handle];
            if(!handleInfo) return false;
            updateHandleAccess(handleInfo);
            return handleInfo;
          }
          
          function waitForLock(handleInfo, cb){
            if(handleInfo.closed) return;
            if(cb){
              updateHandleAccess(handleInfo);
              handleInfo.lockQueue.push(cb);
              if(handleInfo.lockQueue.length > jsHarmonyCMSSFTPServer.MAX_HANDLE_QUEUE_LENGTH){
                handleInfo.lockPaused = true;
                sftpStream.pause();
              }
            }

            var retry = function(){ setTimeout(function(){ waitForLock(handleInfo, null); }, 1); };
            if(handleInfo.lock){
              if(!cb && !handleInfo.lockQueue.length) return;
              if(!cb) retry(); //Standard retry
              if(handleInfo.lockQueue.length==1) retry(); //First time
            }
            else {
              updateHandleAccess(handleInfo);
              if(handleInfo.lockQueue.length) handleInfo.lockQueue.shift()();
              if(handleInfo.lockPaused && (handleInfo.lockQueue.length < jsHarmonyCMSSFTPServer.MAX_HANDLE_QUEUE_LENGTH)){
                handleInfo.lockPaused = false;
                sftpStream.resume();
              }
              if(!cb && handleInfo.lockQueue.length) retry(); //Get next item
            }
          }

          var handleTimer = null;
          function runHandleTimer(tick){
            var HANDLE_TIMEOUT = 60;
            if(!tick && handleTimer) return;
            var hasHandles = false;
            var curdt = new Date().getTime();
            var closedt = curdt - HANDLE_TIMEOUT * 1000;
            for(var handle in handles){
              hasHandles = true;
              var handleInfo = handles[handle];
              if(!handleInfo.lastAccess) updateHandleAccess(handleInfo);
              else {
                if(handleInfo.lastAccess < closedt){
                  _this.DebugLog(clientDesc + 'Auto-closing '+handleInfo.syspath);
                  closeHandle(handle);
                  if(handleInfo.lockPaused){
                    handleInfo.lockPaused = false;
                    sftpStream.resume();
                  }
                }
              }
            }
            handleTimer = hasHandles ? setTimeout(function(){ runHandleTimer(true); }, 1000) : null;
          }

          function addHandle(handleInfo){
            var handle = (maxHandle++).toString();
            _.extend(handleInfo, {
              lock: false,
              lockQueue: [],
              lockPaused: false,
              closed: false,
              closing: false,
              lastAccess: new Date().getTime(),
            });
            handles[handle] = handleInfo;
            runHandleTimer();
            return handle;
          }

          function closeHandle(handle, cb){
            if(!cb) cb = function(){};
            var handleInfo = getHandleInfo(handle);
            if(!handleInfo) return cb();

            if(handleInfo.closing) return cb();
            handleInfo.closing = true;

            Helper.execif(handleInfo.type=='file',
              function(f){
                waitForLock(handleInfo, function(){
                  if(handleInfo.lockPaused){
                    handleInfo.lockPaused = false;
                    sftpStream.resume();
                  }
                  if(handleInfo.closed) return f();
                  handleInfo.closed = true;
                  fs.close(handleInfo.fd, function(err){
                    if(err) return cb(err);
                    return f();
                  });
                });
              },
              function(){
                delete handles[(handle||'').toString()];
                return cb();
              }
            );
          }

          clientSession.closeAllHandles = function(){
            for(var handle in handles){
              closeHandle(handle);
            }
          }

          function setStats(reqid, fpath, attrs){
            initPath(reqid, fpath, null, function(err, vpath, syspath, stats){
              if(!stats.isFile()) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Path is not a file');

              if(_.includes(['/','/sites/'], vpath)) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.PERMISSION_DENIED);
              if(_.includes(['/','/sites'], ftppath.dirname(vpath))) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.PERMISSION_DENIED);

              if(attrs.atime || attrs.mtime){
                var atime = attrs.atime || Math.round(stats.atimeMs/1000);
                var mtime = attrs.mtime || Math.round(stats.mtimeMs/1000);
                fs.utimes(syspath, atime, mtime, function(err){
                  if (err){
                    jsh.Log.error(err);
                    return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Error updating stats');
                  }
                  sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.OK);
                });
              }
              else return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.OK);
            });
          }

          sftpStream.on('OPEN', function(reqid, fpath, flags, attrs) {
            _this.DebugLog(clientDesc + 'OPEN '+fpath);
            //.handle(reqid, handle) -- If return false, wait for continue event
            //.status(reqid, statusCode, [message])

            var fsflags = SFTPSTREAM.flagsToString(flags);
            var createIfNotExists = ((flags & ssh2.SFTP_OPEN_MODE.CREAT) > 0);
            var createFile = false;

            initPath(reqid, fpath, { softFail: true }, function(err, vpath, syspath, stats){
              async.waterfall([
                function(open_cb){
                  if(err){
                    if(err.isSFTPError){
                      if(createIfNotExists && (err.code == ssh2.SFTP_STATUS_CODE.NO_SUCH_FILE)){
                        //Create file - check if parent folder is accessible
                        createFile = true;
                        return open_cb();
                      }
                      return sftpStream.status(reqid, err.code, err.msg);
                    }
                    return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Error opening file');
                  }

                  if(!stats.isFile()) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Path is not a file');
                  return open_cb();
                },

                //If creating a new file, validate the parent folder
                function(open_cb){
                  if(!createFile) return open_cb();

                  var parentDir = ftppath.dirname(fpath);
                  var newName = ftppath.basename(fpath);
                  if(!newName) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Invalid directory name');
      
                  initPath(reqid, parentDir, null, function(err, parentvpath, parentsyspath, parentstats){
                    if(!parentstats.isDirectory()) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Parent path is not a directory');
      
                    if(_.includes(['/','/sites'], parentvpath)) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.PERMISSION_DENIED);
      
                    vpath = ftppath.join(parentvpath, newName);
                    syspath = fspath.join(parentsyspath, newName);
                    return open_cb();
                  });
                },

                function(open_cb){
                  //Open the file with target access
                  fs.open(syspath, fsflags, function(err, fd){
                    if(err) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Error opening file');
    
                    //Return the handle to read folder contents
                    var handle = addHandle({
                      type: 'file',
                      path: vpath,
                      syspath: syspath,
                      fsflags: fsflags,
                      page: 0,
                      fd: fd,
                    });
                    sftpStream.handle(reqid, Buffer.from(handle));
                  });
                },
              ], function(err){
                if(err) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Error opening file');
              });
            });

          }).on('READ', function(reqid, handle, offset, length) {
            _this.DebugLog(clientDesc + 'READ '+(offset||'').toString()+' '+(length||'').toString());
            //.data(reqid, data, encoding) -- If return false, wait for continue event
            //.status(reqid, statusCode, [message])

            var handleInfo = getHandleInfo(handle);
            if(!handleInfo) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Handle not found');

            handleInfo.page++;
            
            fs.fstat(handleInfo.fd, function(err, stats){
              if(err) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Error reading file');

              //EOF
              if (offset >= stats.size){
                sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.EOF);
                return;
              }

              //Read from file
              var buffer = Buffer.alloc(length);
              fs.read(handleInfo.fd, buffer, 0, length, offset, function(err, bytesRead, readBuffer){
                if(err) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Error reading file');
                sftpStream.data(reqid, readBuffer.slice(0, bytesRead));
                updateHandleAccess(handleInfo);
              });
            });


          }).on('WRITE', function(reqid, handle, offset, data) {
            _this.DebugLog(clientDesc + 'WRITE to file at offset '+offset+': '+(data ? data.length : 0)+' bytes');

            var handleInfo = getHandleInfo(handle);
            if(!handleInfo) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Handle not found');

            var startTime = new Date().getTime();

            waitForLock(handleInfo, function(){
              if(handleInfo.closing || handleInfo.closed){
                return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Handle is being closed');
              }

              handleInfo.lock = true;
              handleInfo.page++;

              fs.write(handleInfo.fd, data, 0, data.length, offset, function(err, bytesWritten, writeBuffer){
                if(err){
                  handleInfo.lock = false;
                  jsh.Log.error(err);
                  sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Error writing file');
                  closeHandle(handle);
                  return;
                }
                Helper.execif((handleInfo.page % jsHarmonyCMSSFTPServer.WRITES_BEFORE_FLUSH == 0),
                  function(f){
                    updateHandleAccess(handleInfo);
                    fs.fdatasync(handleInfo.fd, function(err){
                      if(err){
                        handleInfo.lock = false;
                        jsh.Log.error(err);
                        sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Error writing file');
                        closeHandle(handle);
                        return;
                      }
                      return f();
                    });
                  },
                  function(){
                    handleInfo.lock = false;
                    var endTime = new Date().getTime();
                    //console.log(endTime - startTime); //Diagnostic Logging
                    sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.OK);
                    updateHandleAccess(handleInfo);
                  }
                );
              });
            });
            

          }).on('FSTAT', function(reqid, handle) {
            _this.DebugLog(clientDesc + 'FSTAT');
            //.attrs(reqid, attrs) attrs = { mode, uid, gid, size, atime, mtime }
            //.status(reqid, statusCode, [message])

            var handleInfo = getHandleInfo(handle);
            if(!handleInfo) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Handle not found');

            waitForLock(handleInfo, function(){
              fs.fstat(handleInfo.fd, function(err, stats){
                if(err) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Error reading file');

                sftpStream.attrs(reqid, {
                  mode: stats.mode,
                  uid: 0,
                  gid: 0,
                  size: (stats.isFile() ? stats.size : 4096),
                  atime: Math.round(stats.atimeMs/1000),
                  mtime: Math.round(stats.mtimeMs/1000),
                });
              });
            });


          }).on('FSETSTAT', function(reqid, handle, attrs) {
            _this.DebugLog(clientDesc + 'FSETSTAT');
            //.status(reqid, statusCode, [message])
            
            var handleInfo = getHandleInfo(handle);
            if(!handleInfo) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Handle not found');

            waitForLock(handleInfo, function(){
              if(handleInfo.closing || handleInfo.closed){
                return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Handle is being closed');
              }

              setStats(reqid, handleInfo.path, attrs);
            });


          }).on('CLOSE', function(reqid, handle) {
            _this.DebugLog(clientDesc + 'CLOSE');

            var handleInfo = getHandleInfo(handle);
            if(!handleInfo) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.OK);

            if(handleInfo.closed) return;
            waitForLock(handleInfo, function(){
              closeHandle(handle, function(err){
                if(err) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Error closing handle');
                sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.OK);
              });
            });


          }).on('OPENDIR', function(reqid, fpath) {
            _this.DebugLog(clientDesc + 'OPENDIR '+fpath);
            //.handle(reqid, handle) -- If return false, wait for continue event
            //.status(reqid, statusCode, [message])

            initPath(reqid, fpath, null, function(err, vpath, syspath, stats){
              if(!stats.isDirectory()) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Path is not a directory');

              //Return the handle to read folder contents
              var handle = addHandle({
                type: 'dir',
                path: vpath,
                syspath: syspath,
                page: 0,
              });
              sftpStream.handle(reqid, Buffer.from(handle));
            });


          }).on('READDIR', function(reqid, handle) {
            _this.DebugLog(clientDesc + 'READDIR');
            //.name(reqid, names)  names = array of { filename, longname, attrs }
            //.status(reqid, statusCode, [message])

            var handleInfo = getHandleInfo(handle);
            if(!handleInfo) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Handle not found');

            handleInfo.page++;

            if(!handleInfo.syspath){
              //Root folder
              if(handleInfo.page > 1){
                sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.EOF);
                closeHandle(handle);
              }
              else {
                var filename = 'sites';
                sftpStream.name(reqid, [{
                  filename: filename,
                  longname: filename,
                  longname: 'drwxrwxrwx 1 sys sys 4096 '+moment().format('MMM D YYYY')+' ' + filename,
                  attrs: {
                    mode: 0777 + fs.constants.S_IFDIR,
                    uid: 0,
                    gid: 0,
                    size: 4096,
                    atime: moment().unix(),
                    mtime: moment().unix(),
                  }
                }]);
              }
            }
            else {
              fs.exists(handleInfo.syspath, function(exists){
                if(!exists) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.NO_SUCH_FILE);
                fs.readdir(handleInfo.syspath, function(err, files){
                  if(err) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Error retrieving directory listing');

                  Helper.execif((handleInfo.path=='/sites'), 
                    function(f){
                      files = [];
                      jsh.AppSrv.ExecRecordset(req._DBContext, cms.funcs.replaceSchema("select site_id,site_name from {schema}.v_my_site where site_sts='ACTIVE' order by site_id"), [], { }, function (err, rslt) {
                        if (err) { jsh.Log.error(err); return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Error retrieving site listing'); }

                        if(rslt && rslt[0]) _.each(rslt[0], function(site){
                          var filename = HelperFS.cleanFileName(site.site_id+'_'+site.site_name);
                          files.push({
                            filename: filename,
                            longname: filename,
                            longname: 'lrwxrwxrwx 1 sys sys 4096 '+moment().format('MMM D YYYY')+' ' + filename,
                            attrs: {
                              mode: 0777 + fs.constants.S_IFDIR,
                              uid: 0,
                              gid: 0,
                              size: 4096,
                              atime: moment().unix(),
                              mtime: moment().unix(),
                            }
                          });
                        });
                    
                        return f();
                      });
                    },
                    function(){
                      var filesPerPage = 1000;
                      var pageFiles = [];
                      var dirPage = [];
                      if((handleInfo.page-1)*filesPerPage >= files.length){
                        sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.EOF);
                        closeHandle(handle);
                      }
                      else{
                        for(var i=filesPerPage*(handleInfo.page-1);i<filesPerPage*handleInfo.page&&i<files.length;i++){
                          var file = files[i];
                          if(_.isString(file)){
                            pageFiles.push(file);
                            dirPage.push({
                              filename: file,
                              longname: file,
                              attrs: {}
                            });
                          }
                          else {
                            pageFiles.push('');
                            dirPage.push(file);
                          }
                        }
                        async.eachOf(pageFiles, function(pageFile, idx, file_cb){
                          if(!pageFile) return file_cb();
                          fs.stat(fspath.join(handleInfo.syspath, pageFile), function(err, fstat){
                            if(err) return file_cb();

                            var longname = '';
                            if(fstat.isDirectory()) longname += 'd';
                            //else if(fstat.isSymbolicLink()) longname += 'l';
                            else if(fstat.isFile()) longname += '-';
                            else{
                              dirPage[idx] = undefined;
                              return file_cb();
                            }
                            
                            longname += 'rwxrwxrwx 0 sys sys '+(longname=='-' ? fstat.size : 4096)+' '+moment(fstat.mtime).format('MMM D YYYY')+' '+pageFile;
                            dirPage[idx].longname = longname;

                            dirPage[idx].attrs = {
                              mode: 0777 + (longname[0]=='d' ? fs.constants.S_IFDIR : longname[0]=='l' ? fs.constants.S_IFLNK : fs.constants.S_IFREG),
                              uid: 0,
                              gid: 0,
                              size: (longname=='-' ? fstat.size : 4096),
                              atime: Math.floor(fstat.atime/1000),
                              mtime: Math.floor(fstat.mtime/1000),
                            };

                            return file_cb();
                          });
                        }, function(err){
                          if(err){
                            jsh.Log.error(err);
                            return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Error retrieving directory listing');
                          }
                          //Remove undefined entries from dirPage
                          for(var i=0;i<dirPage.length;i++){
                            if(typeof dirPage[i]=='undefined'){
                              dirPage.splice(i, 1);
                              i--;
                            }
                          }
                          sftpStream.name(reqid, dirPage);
                        });
                      }
                    }
                  );
                });
              });
            }


          }).on('LSTAT', function(reqid, fpath) {
            _this.DebugLog(clientDesc + 'LSTAT '+fpath);
            //.attrs(reqid, attrs) attrs = { mode, uid, gid, size, atime, mtime }
            //.status(reqid, statusCode, [message])

            initPath(reqid, fpath, null, function(err, vpath, syspath, stats){
              sftpStream.attrs(reqid, {
                mode: stats.mode,
                uid: 0,
                gid: 0,
                size: (stats.isFile() ? stats.size : 4096),
                atime: Math.round(stats.atimeMs/1000),
                mtime: Math.round(stats.mtimeMs/1000),
              });
            });

          }).on('STAT', function(reqid, fpath) {
            _this.DebugLog(clientDesc + 'STAT '+fpath);
            //.attrs(reqid, attrs) attrs = { mode, uid, gid, size, atime, mtime }
            //.status(reqid, statusCode, [message])

            initPath(reqid, fpath, null, function(err, vpath, syspath, stats){
              sftpStream.attrs(reqid, {
                mode: stats.mode,
                uid: 0,
                gid: 0,
                size: (stats.isFile() ? stats.size : 4096),
                atime: Math.round(stats.atimeMs/1000),
                mtime: Math.round(stats.mtimeMs/1000),
              });
            });


          }).on('REMOVE', function(reqid, fpath) {
            _this.DebugLog(clientDesc + 'REMOVE '+fpath);
            //.status(reqid, statusCode, [message])

            initPath(reqid, fpath, null, function(err, vpath, syspath, stats){
              if(!stats.isFile()) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Path is not a file');

              if(_.includes(['/','/sites/'], vpath)) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.PERMISSION_DENIED);
              if(_.includes(['/','/sites'], ftppath.dirname(vpath))) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.PERMISSION_DENIED);

              fs.unlink(syspath, function(err){
                if (err) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Error deleting file');
                sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.OK);
              });
            });


          }).on('RMDIR', function(reqid, fpath) {
            _this.DebugLog(clientDesc + 'RMDIR '+fpath);
            //.status(reqid, statusCode, [message])

            initPath(reqid, fpath, null, function(err, vpath, syspath, stats){
              if(!stats.isDirectory()) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Path is not a directory');

              if(_.includes(['/','/sites/'], vpath)) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.PERMISSION_DENIED);
              if(_.includes(['/','/sites'], ftppath.dirname(vpath))) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.PERMISSION_DENIED);

              fs.rmdir(syspath, function(err){
                if (err){
                  if(err.code=='ENOTEMPTY') return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Cannot delete - folder is not empty');
                  return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Error deleting folder');
                }
                sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.OK);
              });
            });

            
          }).on('REALPATH', function(reqid, fpath) {
            _this.DebugLog(clientDesc + 'REALPATH '+fpath);
            //.name(reqid, names)  names = array of { filename, longname, attrs }
            //.status(reqid, statusCode, [message])

            //Normalize path
            var vpath = normalizePath(fpath);
            if(vpath === false) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Invalid path');
            //Resolve path
            sftpStream.name(reqid, {
              filename: vpath,
              longname: vpath, 
              attrs: {}
            });


          }).on('READLINK', function(reqid, fpath) {
            _this.DebugLog(clientDesc + 'READLINK '+fpath);
            //.name(reqid, names)  names = array of { filename, longname, attrs }
            //.status(reqid, statusCode, [message])
            
            //Resolve path
            var vpath = normalizePath(fpath);
            if(vpath === false) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Invalid path');
            
            var parentDir = ftppath.dirname(vpath);
            if(!_.includes(['/sites'], parentDir)) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.PERMISSION_DENIED);

            sftpStream.name(reqid, {
              filename: vpath,
              longname: vpath, 
              attrs: {}
            });


          }).on('SETSTAT', function(reqid, fpath, attrs) {
            _this.DebugLog(clientDesc + 'SETSTAT '+fpath);
            //.status(reqid, statusCode, [message])

            setStats(reqid, fpath, attrs);


          }).on('MKDIR', function(reqid, fpath, attrs) {
            _this.DebugLog(clientDesc + 'MKDIR '+fpath);
            //.status(reqid, statusCode, [message])

            var parentDir = ftppath.dirname(fpath);
            var newDirName = ftppath.basename(fpath);
            if(!newDirName) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Invalid directory name');

            initPath(reqid, parentDir, null, function(err, parentvpath, parentsyspath, parentstats){
              if(!parentstats.isDirectory()) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Parent path is not a directory');

              if(_.includes(['/','/sites'], parentvpath)) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.PERMISSION_DENIED);

              var syspath = fspath.join(parentsyspath, newDirName);
              fs.mkdir(syspath, function(err){
                if (err) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Error creating folder');
                sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.OK);
              });
            });


          }).on('RENAME', function(reqid, oldPath, newPath) {
            _this.DebugLog(clientDesc + 'RENAME '+oldPath+' '+newPath);
            //.status(reqid, statusCode, [message])

            var newParentDir = ftppath.dirname(newPath);
            var newName = ftppath.basename(newPath);

            if(!newName) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Invalid new name');

            initPath(reqid, oldPath, null, function(err, oldvpath, oldsyspath, oldstats){
              initPath(reqid, newParentDir, null, function(err, newparentvpath, newparentsyspath, newparentstats){
                if(_.includes(['/','/sites'], newparentvpath)) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.PERMISSION_DENIED);
                if(_.includes(['/','/sites','/sites/'], oldvpath)) return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.PERMISSION_DENIED);

                var newsyspath = fspath.join(newparentsyspath, newName);
                fs.rename(oldsyspath, newsyspath, function(err){
                  if (err){
                    return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.FAILURE, 'Error renaming');
                  }
                  sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.OK);
                });
              });
            });


          }).on('SYMLINK', function(reqid, linkPath, targetPath) {
            _this.DebugLog(clientDesc + 'SYMLINK '+linkPath+' '+targetPath);
            //.status(reqid, statusCode, [message])
            return sftpStream.status(reqid, ssh2.SFTP_STATUS_CODE.PERMISSION_DENIED);
          });
        });
      });
    }).on('error', function(err){
      if(err.message == 'Unable to authenticate'){
        _this.DebugLog(clientDesc + 'Authentication Failed');
      }
      else{
        _this.DebugLog(clientDesc + 'Error: ' + err.toString());
      }
    }).on('end', function() {
      //Close any open handles
      _.each(clientSessions, function(clientSession){
        clientSession.closeAllHandles();
      });
      _this.DebugLog(clientDesc + 'Disconnected');
    });
  }).listen(_this.cms.Config.sftp.serverPort||22, _this.cms.Config.sftp.serverIp, function() {
    jsh.Log.info('SFTP Server listening on port ' + this.address().port);
    run_cb();
  });
}

module.exports = exports = jsHarmonyCMSSFTPServer;