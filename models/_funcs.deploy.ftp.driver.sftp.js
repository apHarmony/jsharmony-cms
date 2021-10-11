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

var ssh2 = require('ssh2-classic');
var path = require('path');
var fs = require('fs');
var Helper = require('jsharmony/Helper');

/** @typedef {import('./_funcs.deploy.ftp').FtpDriver} FtpDriver */
/** @typedef {import('./_funcs.deploy.ftp').DirectoryItem} DirectoryItem */
/** @typedef {import('./_funcs.deploy.ftp').ConnectionParams} ConnectionParams */

module.exports = exports = function(module, funcs) {

  var exports = {};

  var ERR_CODE_DOES_NOT_EXIST = 2;
  var ERR_CODE_ALREADY_EXISTS = 4;

  /**
   * @param {ConnectionParams} connectionParams
   * @returns {FtpDriver}
   */
  exports.sftpDriver = function(connectionParams) {
    var _this = this;
    var connection = new ssh2.Client();
    var client = undefined;

    /**
     * @public
     * @returns {Promise<void>}
     */
    this.connect = function() {
      return new Promise((resolve, reject) => {

        connection.on('ready', () => {
          connection.sftp((err, sftp_stream) => {
            client = err ? undefined : sftp_stream;
            err ? reject(err) : resolve();
          });
        });

        connection.on('error', err => reject(err));

        var private_key_content = undefined;

        Helper.execif(connectionParams.private_key,
          function(f){
            fs.readFile(connectionParams.private_key, 'utf8', function(err, data){
              if(err) return reject(err);
              private_key_content = data.toString();
              return f();
            });
          },
          function(){
            connection.connect({
              host: connectionParams.host,
              password: connectionParams.password,
              port: connectionParams.port,
              username: connectionParams.username,
              privateKey: private_key_content,
            });
          }
        );
      });
    }


    /**
     * Directory MUST be empty!
     * @private
     * @param {string} directory_path
     * @returns {Promise<void>}
     */
    this.deleteDirectory = function(directory_path) {
      return new Promise((resolve, reject) => {
        client.rmdir(directory_path, err => {
          if (!err || err.code === ERR_CODE_DOES_NOT_EXIST) {
            resolve();
          } else {
            reject(err);
          }
        });
      });
    }

    /**
     * @public
     * @param {string} directory_path
     * @returns {Promise<void>}
     */
    this.deleteDirectoryRecursive = function(directory_path) {
      return _this.getDirectoryList(directory_path)
      .catch(err => {
        if (err.code === ERR_CODE_DOES_NOT_EXIST) {
          return [];
        } else {
          throw err;
        }
      })
      .then(items => {

        var files = [];
        var dirs = [];
        (items || []).forEach(item => {
          if (item.isDir) dirs.push(item.path)
          else files.push(item.path);
        });

        if (files.length < 1) return dirs;

        var delete_functions = files.map(file_path => () => _this.deleteFile(file_path));
        return delete_functions.reduce((prev, func) => prev.then(() => func()), Promise.resolve()).then(() => dirs);
      })
      .then(dirs => {

        if (dirs.length < 1) return;

        var delete_functions = dirs.map(dir_path => () => _this.deleteDirectoryRecursive(dir_path));
        return delete_functions.reduce((prev, func) => prev.then(() => func()), Promise.resolve());
      })
      .then(() => _this.deleteDirectory(directory_path));
    }

    /**
     * @param {string} file_path
     * @returns {Promise<void>}
     */
    this.deleteFile = function(file_path) {
      return new Promise((resolve, reject) => {
        client.unlink(file_path,  err => {
          if (!err || err.code === ERR_CODE_DOES_NOT_EXIST) {
            resolve();
          } else {
            reject(err);
          }
        });
      });
    }

    /**
     * @public
     * @returns {void}
     */
    this.end = function() {
      connection.end();
    }

    /**
     * @public
     * @param {string} directory_path
     * @returns {Promise<void>}
     */
    this.createDirectoryIfNotExists = function(directory_path) {
      return new Promise((resolve, reject) => {
        client.mkdir(directory_path, err => {
          if (!err || err.code === ERR_CODE_ALREADY_EXISTS) {
            resolve();
          } else {
            reject(err);
          }
        });
      });
    }

    /**
     * @public
     * @param {string} directory_path
     * @returns{Promise<DirectoryItem[]>}
     */
    this.getDirectoryList = function(directory_path) {
      return new Promise((resolve, reject) => {
        client.readdir(directory_path, (err, items) => {
          if (err) {
            reject(err);
          } else {
            items = (items || []).map(item => {
              /** @type {DirectoryItem} */
              var retVal = {
                isDir: item.attrs.isDirectory(),
                name: item.filename,
                path:  path.join(directory_path, item.filename).replace(/\\/g, '/'),
                size: item.attrs.size
              }
              return retVal;
            });
            resolve(items);
          }
        });
      });
    }

    /**
     * @public
     * @param {string} file_path
     * @returns{Promise<string | undefined>}
     */
    this.readFile = function(file_path) {
      return new Promise((resolve, reject) => {
        var stream = client.createReadStream(file_path);
        var chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString()));
        stream.on('error', stream_error =>  {
          if (stream_error.code === ERR_CODE_DOES_NOT_EXIST) {
            resolve(undefined);
          } else {
            reject(stream_error)
          }
        });
      });
    }

    /**
     * @public
     * @param {string} local_path
     * @param {string} dest_path
     * @returns{Promise<void>}
     */
    this.writeFile = function(local_path, dest_path) {
      return new Promise((resolve, reject) => {
        client.fastPut(local_path, dest_path, err => err ? reject(err) : resolve());
      });
    }

    /**
     * @public
     * @param {string} string_data
     * @param {string} dest_path
     * @returns{Promise<void>}
     */
    this.writeString = function(string_data, dest_path) {
      return new Promise((resolve, reject) => {
        client.writeFile(dest_path, string_data, { flag: 'w+'}, write_error => write_error ? reject(write_error) : resolve());
      });
    }
  }

  return exports;
}