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

var path = require('path');
var fs = require('fs');
var Helper = require('jsharmony/Helper');
var baseModule = module;

/** @typedef {import('./_funcs.deploy.ftp').FtpDriver} FtpDriver */
/** @typedef {import('./_funcs.deploy.ftp').DirectoryItem} DirectoryItem */

module.exports = exports = function(module, funcs) {
  var exports = {};

  /**
   * @param {object} ftp - default export from `require('ftp')`
   * @param {object} connectionOptions - see connect() args {@link https://github.com/mscdex/node-ftp#methods}
   * @returns {FtpDriver}
   */
  exports.ftpDriver = function(connectionOptions) {
    var _this = this;

    var NUM_RETRIES = 5;

    var ftpSession = undefined;

    this.connected = false;
    this.pendingRetry = null;
    this.pendingRetryFail = null;
    this.pendingRetryCount = 0;

    try {
      ftpSession = new Helper.requireAnywhere(baseModule, 'ftp')();
    } catch (error) { /* Do nothing */ }

    if(!ftpSession){
      throw new Error('"ftp" module is required for FTP publish. Use `npm i ftp` to install.');
    }

    this.log = function(msg){
      if(connectionOptions.logger) connectionOptions.logger(msg);
    };

    /**
     * @public
     * @returns {Promise<void>}
     */
    this.connect = function() {
      return new Promise((resolve, reject) => {

        var onConnectError = function(err){ return reject(err); };
        var onOperationError = function(err){ };
        var onClose = function(){
          this.connected = false;
          if(_this.pendingRetry){
            _this.pendingRetryCount--;
            if(_this.pendingRetryCount >= 0){
              var retryNum = (NUM_RETRIES - _this.pendingRetryCount);
              var reconnectTimeout = 100;
              for(var i = 1; i < retryNum;i ++){
                reconnectTimeout *= 5;
                if(reconnectTimeout > 60 * 1000) reconnectTimeout = 60*1000;
              }
              _this.log('>>> Reconnect Retry '+retryNum+' in '+Math.round(reconnectTimeout/100)/10+'s');
              setTimeout(function(){
                reconnect().then(_this.pendingRetry).catch(_this.pendingRetryFail);
              }, reconnectTimeout);
            }
            else{
              _this.pendingRetry = null;
              _this.pendingRetryFail(new Error('Maximum retries exceeded'));
              _this.pendingRetryFail = null;
            }
          }
        };
        var onReady = function(){
          ftpSession.off('ready', onReady);
          ftpSession.off('error', onConnectError);
          ftpSession.on('error', onOperationError);
          ftpSession.on('close', onClose);
          this.connected = true;
          resolve();
        };
        var reconnect = function(){
          ftpSession.off('error', onConnectError);
          ftpSession.off('error', onOperationError);
          ftpSession.off('close', onClose);
          return _this.connect();
        };

        ftpSession.on('error', onConnectError);
        ftpSession.on('ready', onReady);
        ftpSession.connect(connectionOptions);
      });
    };

    this.retryOnDisconnect = function(f, reject, isRetry){
      if(!isRetry){
        if(_this.pendingRetry) return reject(new Error('Another operation is already pending retry'));
        _this.pendingRetry = function(){ _this.retryOnDisconnect(f, reject, true); };
        _this.pendingRetryCount = NUM_RETRIES;
        _this.pendingRetryFail = reject;
      }
      f(function stopRetry(){
        _this.pendingRetry = null;
        _this.pendingRetryFail = null;
      });
    };

    /**
     * @public
     * @param {string} directory_path
     * @returns {Promise<void>}
     */
    this.deleteDirectoryRecursive = function(directory_path) {
      return new Promise((resolve, reject) => {
        _this.retryOnDisconnect(function(stopRetry){
          ftpSession.rmdir(directory_path, true, err => {
            stopRetry();
            if (err && err.code !== 550) {
              reject(err);
            } else {
              resolve();
            }
          });
        }, reject);
      });
    };

    /**
     * @public
     * @param {string} file_path
     * @returns {Promise<void>}
     */
    this.deleteFile = function(file_path) {
      return new Promise((resolve, reject) => {
        _this.retryOnDisconnect(function(stopRetry){
          ftpSession.delete(file_path,  function(err){
            stopRetry();
            if(err) return reject(err);
            return resolve();
          });
        }, reject);
      });
    };

    /**
     * @public
     * @returns {void}
     */
    this.end = function() {
      ftpSession.end();
    };

    /**
     * @public
     * @param {string} directory_path
     * @returns {Promise<void>}
     */
    this.createDirectoryIfNotExists = function(directory_path) {
      return new Promise((resolve, reject) => {
        _this.retryOnDisconnect(function(stopRetry){
          ftpSession.mkdir(directory_path, true, function(err){
            stopRetry();
            if(err) return reject(err);
            return resolve();
          });
        }, reject);
      });
    };

    /**
     * @public
     * @param {string} directory_path
     * @returns{Promise<DirectoryItem[]>}
     */
    this.getDirectoryList = function(directory_path) {
      return new Promise((resolve, reject) => {
        _this.retryOnDisconnect(function(stopRetry){
          ftpSession.list(directory_path, connectionOptions.compression, (list_error, items) => {
            stopRetry();
            if (list_error) {
              reject(list_error);
            } else {
              /** @type {DirectoryItem[]} */
              var retVal = [];
              (items || []).forEach(item => {
                var isDir = item.type === 'd';
                if (item.name=='.') return;
                if (item.name=='..') return;
                retVal.push({
                  isDir,
                  name: item.name,
                  path: path.join(directory_path, item.name).replace(/\\/g, '/'),
                  size: item.size
                });
              });
              resolve(retVal);
            }
          });
        }, reject);
      });
    };

    /**
     * @public
     * @param {string} file_path
     * @returns{Promise<string | undefined>}
     */
    this.readFile = function(file_path) {
      return new Promise((resolve, reject) => {
        _this.retryOnDisconnect(function(stopRetry){
          try{
            ftpSession.get(file_path, connectionOptions.compression, (err, stream) => {
              if (err) {
                stopRetry();
                // 550 is a bit ambiguous.
                // It most likely means that the file does not exist.
                // But it is possible the user does not have permission.
                // This might need to be revisited in the future if
                // permission issues become an issue. If the file does
                // not exist then we want to return undefined.
                // All other errors should be thrown.
                if (err.code === 550) {
                  return resolve(undefined);
                } else {
                  return reject(err);
                }
              } else {
                var chunks = [];
                stream.on('data', chunk => chunks.push(chunk));
                stream.on('end', function(){
                  stopRetry();
                  return resolve(Buffer.concat(chunks).toString());
                });
                stream.on('error', function(stream_error){
                  stopRetry();
                  return reject(stream_error);
                });
              }
            });
          }
          catch(ex){
            return reject(ex);
          }
        }, reject);
      });
    };

    /**
     * @public
     * @param {string} local_path
     * @param {string} dest_path
     * @returns{Promise<void>}
     */
    this.writeFile = function(local_path, dest_path) {
      return new Promise(function(resolve, reject){
        _this.retryOnDisconnect(function(stopRetry){
          var stream = fs.createReadStream(local_path);
          ftpSession.put(stream, dest_path, connectionOptions.compression, function(err){
            stopRetry();
            if(err) return reject(err);
            return resolve();
          });
        }, reject);
      });
    };

    /**
     * @public
     * @param {string} string_data
     * @param {string} dest_path
     * @returns{Promise<void>}
     */
    this.writeString = function(string_data, dest_path) {
      return new Promise((resolve, reject) => {
        _this.retryOnDisconnect(function(stopRetry){
          ftpSession.put(Buffer.from(string_data), dest_path, connectionOptions.compression, function(err){
            stopRetry();
            if(err) return reject(err);
            return resolve();
          });
        }, reject);
      });
    };
  };

  return exports;
};