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
var _ = require('lodash');

/**
 * @typedef {object} ConnectionParams
 * @property {string} host
 * @property {string} password
 * @property {number | undefined} [port]
 * @property {string | undefined} [private_key_path]
 * @property {string} username
 */

/**
 * @typedef {object} FtpDriver
 * @property {() => Promise<void>} connect
 * @property {(directory_path: string) => Promise<void>} deleteDirectoryRecursive
 * @property {(file_path: string) => Promise<void>} deleteFile
 * @property {() => void} end
 * @property {(directory_path: string) => Promise<void>} createDirectoryIfNotExists
 * @property {(directory_path: string) => Promise<DirectoryItem[]>} getDirectoryList
 * @property {(file_path: string) => Promise<string | undefined>} readFile
 * @property {(local_path: string, dest_path: string) => Promise<void>} writeFile
 * @property {(string_data: string, dest_path: string) => Promise<void>} writeString
 */

/**
 * @typedef {object} FtpClient
 * @property {() => Promise<void>} connect
 * @property {(directory_paths: string[], next_cb: (path: string) => void) => Promise<void>} deleteDirectoriesRecursive
 * @property {(file_paths: string[], next_cb: (path: string) => void) => Promise<void>} deleteFiles
 * @property {() => void} end
 * @property {(directory_paths: string[], next_cb: (path: string) => void) => Promise<void>} createDirectoriesIfNotExists
 * @property {(abs_folder_path: string, relative_to: string, next_cb: (path: string) => void) => Promise<DirectoryItem[]>} getDirectoryListRecursive
 * @property {(file_path: string) => Promise<string | undefined>} readFile
 * @property {(paths: { dest_path: string, local_path: string }[], next_cb: (path: string) => void) => Promise<void>} writeFiles
 * @property {(string_data: string, dest_path: string) => Promise<void>} writeString
 */

/**
 * @typedef {object} DirectoryItem
 * @property {string} path
 * @property {string} name
 * @property {boolean} isDir
 * @property {number} size
 */

module.exports = exports = function(module, funcs) {

  var exports = {};

  /**
   * @param {'sftp' | 'ftp' | 'ftps' } type
   * @param {ConnectionParams} connectionParams
   * @returns {FtpClient}
   */
  exports.ftpClient = function(type, connectionParams, ftpConfig, logger) {
    ftpConfig = ftpConfig || {};

    /** @type {FtpDriver} */
    var ftpDriver = undefined;

    var _this = this;

    /**
     * @returns {Promise<void>}
     */
    this.connect = function() {
      try{
        if (type === 'ftp' || type === 'ftps') {
          connectionParams.user = connectionParams.username;
          delete connectionParams.username;
          connectionParams.secure = (type == 'ftps');
          connectionParams.connTimeout = 5000;
          connectionParams.logger = logger;
          if(ftpConfig.ignore_certificate_errors) connectionParams.secureOptions = { rejectUnauthorized: false };
          connectionParams.compression = !!ftpConfig.compression;
          ftpDriver = new funcs.ftpDriver(connectionParams);
        } else if (type === 'sftp') {
          if(ftpConfig.private_key){
            connectionParams.private_key = ftpConfig.private_key;
            if(_.isArray(connectionParams.private_key)) connectionParams.private_key = connectionParams.private_key.join("\n");
          }
          ftpDriver = new funcs.sftpDriver(connectionParams);
        } else {
          throw new Error(`unknown protocol ${type}. Expected "ftp", "sftp".`);
        }
      }
      catch(ex){
        return Promise.reject(ex);
      }

      return ftpDriver.connect();
    }

    /**
     * @param {string} directory_paths
     * @param {(path: string) => void} next_cb
     * @returns {Promise<void>}
     */
    this.deleteDirectoriesRecursive = function(directory_paths, next_cb) {
      if ((directory_paths || []).length < 1) return Promise.resolve();

      next_cb = next_cb || (() => {});

      // Create a function for each directory to delete.
      // When executed, the function will execute
      // next_cb for logging, and return a promise
      // that resolves when the directory is deleted.
      var delete_functions = directory_paths.map(dir_path => {
        return () => {
          next_cb(dir_path);
          return ftpDriver.deleteDirectoryRecursive(dir_path);
        }
      });

      return delete_functions.reduce((prev, f) => prev.then(() => f()), Promise.resolve());
    }

    /**
     * @param {string} file_paths
     * @param {(path: string) => void} next_cb
     * @returns {Promise<void>}
     */
    this.deleteFiles = function(file_paths, next_cb) {
      if ((file_paths || []).length < 1) return Promise.resolve();

      next_cb = next_cb || (() => {});

      // Create a function for each item to delete.
      // When executed, the function will execute
      // next_cb for logging, and return a promise
      // that resolves when the item is deleted.
      var delete_functions = file_paths.map(file_path => {
        return () => {
          next_cb(file_path);
          return ftpDriver.deleteFile(file_path);
        }
      });

      return delete_functions.reduce((prev, f) => prev.then(() => f()), Promise.resolve());
    }

    /**
     * @returns {void}
     */
    this.end = function() {
      try{
        ftpDriver.end();
      }
      catch(ex){}
    }

    /**
     * @param {string} directory_paths
     * @param {(path: string) => void} next_cb
     * @returns {Promise<void>}
     */
    this.createDirectoriesIfNotExists = function(directory_paths, next_cb) {
      if ((directory_paths || []).length < 1) return Promise.resolve();

      next_cb = next_cb || (() => {});

      // Create a function for each directory to create.
      // When executed, the function will execute
      // next_cb for logging, and return a promise
      // that resolves when the directory is created.
      var mk_dir_functions = directory_paths.map(dir_path => {
        return () => {
          next_cb(dir_path);
          return ftpDriver.createDirectoryIfNotExists(dir_path);
        }
      });

      return mk_dir_functions.reduce((prev, f) => prev.then(() => f()), Promise.resolve());
    }

    /**
     * @param {string} abs_folder_path
     * @param {string} relative_to
     * @param {(path: string) => void} next_cb
     * @returns {Promise<DirectoryItem[]>}
     */
    this.getDirectoryListRecursive = function(abs_folder_path, relative_to, next_cb) {

      // This function is called any we start
      // getting directory list for a child. It allows
      // better logging/status updates.
      next_cb = next_cb || (() => {});

      next_cb(abs_folder_path);
      return ftpDriver.getDirectoryList(abs_folder_path)
      .then(items => {
        var list = [];
        var dirs = [];
        (items || []).forEach(item => {
          var normalized_path = path.join(abs_folder_path, item.name);
          if (relative_to) {
            normalized_path = path.relative(relative_to, normalized_path);
          }
          normalized_path = normalized_path.replace(/\\/g, '/');
          item.path = normalized_path
          if (item.isDir) dirs.push(item)
          list.push(item);
        });

        if (dirs.length < 1) {
          return list;
        }

        // Create a function for each child directory
        // in the current directory. When executed,
        // each function will return a promise that resolves
        // the contents (recursively) of the child directory
        // and concats them with the input argument.
        var list_getters = dirs.map(dir => {
          return current_items => {
            var full_path = path.join(abs_folder_path, dir.name).replace(/\\/g, '/');
            return _this.getDirectoryListRecursive(full_path, relative_to, next_cb).then(items => [...current_items, ...items])
          }
        });

        return list_getters.reduce((prev, f) => prev.then(items => f(items)), Promise.resolve(list));
      });

    }

    /**
     * @param {string} file_path
     * @returns {Promise<void>}
     */
    this.readFile = function(file_path) {
      return ftpDriver.readFile(file_path);
    }

    /**
     * @param {{dest_path: string, local_path: string}[]} paths
     * @param {(path: string) => void} next_cb
     * @returns {Promise<void>}
     */
    this.writeFiles = function(paths, next_cb) {
      if ((paths || []).length < 1) return Promise.resolve();

      next_cb = next_cb || (() => {});

      // Create a function for each item to put.
      // When executed, the function will execute
      // next_cb for logging, and return a promise
      // that resolves when the put completes.
      var put_functions = paths.map(path_info => {
        return () => {
          next_cb(path_info.dest_path);
          return ftpDriver.writeFile(path_info.local_path, path_info.dest_path);
        }
      });

      return put_functions.reduce((prev, f) => prev.then(() => f()), Promise.resolve());
    }

    /**
     * @param {string} string_data
     * @param {string} dest_path
     * @returns {Promise<void>}
     */
    this.writeString = function(string_data, dest_path) {
      return ftpDriver.writeString(string_data, dest_path);
    }

    this.buildFileTree = function(files) {

      var node_map = new Map();

      (files || []).forEach(current_path => {

        var first_iteration = true;

        do {
          if (node_map.has(current_path)) {
            break;
          }

          var parent_path = path.dirname(current_path);

          var node = {
            children: [],
            path: current_path,
            is_file: first_iteration,
            name: path.basename(current_path),
            parent_path
          };
          node_map.set(node.path, node);

          first_iteration = false;
          current_path = parent_path;

        } while (current_path !== '.');
      });

      var root_nodes = [];
      node_map.forEach(node => {

        if (node.parent_path === '.') {
          root_nodes.push(node);
          return;
        }

        var parent_node = node_map.get(node.parent_path);
        if (parent_node == undefined) {
          throw new Error(`Cannot find ${node.parent_path}`);
        }
        parent_node.children.push(node);
      });

      return root_nodes;
    }

    /**
     * Given a list of file paths,
     * create a list of directory paths
     * that can be created in the given order
     * (i.e., preserving hierarchy)
     */
    this.buildOrderedDirectoryList = function(files, dir_index) {

      var file_tree_root_nodes = _this.buildFileTree(files);
      var dir_list = [];

      var get_paths = node => {

        if (node.is_file) return [];

        var paths = [node.path];
        node.children.forEach(child_node => {
          if (child_node.is_file) return;
          paths.push(...get_paths(child_node))
        });

        return paths;
      }

      file_tree_root_nodes.forEach(node => dir_list.push(...get_paths(node)));
      return dir_list;
    }

    this.createLocalManifest = function(publish_path, site_files) {

      var manifest = {
        base_path: publish_path,
        file_index: new Map(),
        dir_index: new Set()
      };

      var stat_promises = [];
      var file_list = [];
      _.each(site_files, function(file_info, fpath){
        file_list.push(fpath);
        stat_promises.push(_this.getFileSize(path.join(publish_path, fpath)).then(function(size){
          manifest.file_index.set(fpath, { size, md5: file_info.md5 });
        }));
      });

      manifest.dir_index = new Set(_this.buildOrderedDirectoryList(file_list));
      return Promise.all(stat_promises).then(function(){ return manifest; });
    }

    this.getOperations = function(deployment, local_manifest, remote_file_info_cache, remote_files, ignore_files) {

      var operations = {
        files_to_delete: [],
        files_to_upload: [],
        folders_to_create: [],
        folders_to_delete: [],
        matching_file_count: 0,
        missing_file_in_local_count: 0,
        missing_file_in_remote_count: 0,
        missing_folder_in_local_count: 0,
        modified_file_count: 0,
      }

      // Don't mutate the remote cache
      var remote_file_cache_index = remote_file_info_cache ? Object.assign({}, remote_file_info_cache.files || {}) : {};
      var remote_file_index =  (remote_files || []).reduce((prev, current) => {
        prev[current.path] = current;
        return prev;
      }, {});

      local_manifest.file_index.forEach((local_file_info, local_file_path) => {

        if (local_file_path in ignore_files) return;

        var remote_file = remote_file_index[local_file_path];
        var remote_file_cache = remote_file_cache_index[local_file_path]

        // Whatever is remaining will be files
        // that exist on remote but not local.
        delete remote_file_index[local_file_path];
        delete remote_file_cache_index[local_file_path];

        var remote_file_exists = remote_file != undefined;
        var files_match =
          remote_file_exists &&
          local_file_info.size === remote_file.size &&
          remote_file_cache != undefined &&
          local_file_info.md5 === remote_file_cache.md5 &&
          local_file_info.size === remote_file_cache.size;

          if (!remote_file_exists) {
            operations.missing_file_in_remote_count++;
            operations.files_to_upload.push(local_file_path);
          } else if (!files_match) {
            operations.modified_file_count++;
            operations.files_to_upload.push(local_file_path)
          } else {
            operations.matching_file_count++;
            if (deployment.publish_params.ftp_config && deployment.publish_params.ftp_config.overwrite_all) operations.files_to_upload.push(local_file_path);
          }
      });

      var remote_dirs = {};
      for (file_path in remote_file_index) {

        if (file_path in ignore_files) continue;

        var remote_file = remote_file_index[file_path];
        if (remote_file.isDir) {
          var local_folder_exists = local_manifest.dir_index.has(file_path);
          if (!local_folder_exists) {
            if(!funcs.deploy_ignore_remote(deployment.publish_params, file_path)){
              operations.missing_folder_in_local_count++;
              if (deployment.publish_params.ftp_config && deployment.publish_params.ftp_config.delete_excess_files) operations.folders_to_delete.push(file_path);
            }
          }
          else {
            remote_dirs[file_path] = file_path;;
          }
        } else {
          if(!funcs.deploy_ignore_remote(deployment.publish_params, file_path)){
            operations.missing_file_in_local_count++;
            if (deployment.publish_params.ftp_config && deployment.publish_params.ftp_config.delete_excess_files) operations.files_to_delete.push(file_path)
          }
        }
      }

      var required_folders = _this.buildOrderedDirectoryList(operations.files_to_upload);
      _.each(required_folders, function(folder_name){
        if(!(folder_name in remote_dirs)) operations.folders_to_create.push(folder_name);
      });

      return operations;
    }

    this.getFileSize = function(file_path) {
      return new Promise((resolve, reject) => {
        fs.stat(file_path, (err, stats) => err ? reject(err) : resolve(stats.size));
      });
    }
  }

  return exports;
}