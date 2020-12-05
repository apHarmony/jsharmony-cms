const path = require('path');
const fs = require('fs');

/**
 * @typedef {object} ConnectionParams
 * @property {string} host
 * @property {string} password
 * @property {number | undefined} port
 * @property {string | undefined} private_key_path
 * @property {string} username
 */

/**
 * @typedef {object} FtpClientWrapper
 * @property {() => Promise<void>} connect
 * @property {(directory_path: string) => Promise<void>} deleteDirectoryRecursive
 * @property {(file_path: string) => Promise<void>} deleteFile
 * @property {() => void} end
 * @property {(directory_path: string) => Promise<void>} ensureDirectory
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
 * @property {(directory_paths: string[], next_cb: (path: string) => void) => Promise<void>} ensureDirectories
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

  const exports = {};

  /**
   * @param {'sftp' | 'ftp'} type
   * @param {ConnectionParams} connectionParams
   * @returns {FtpClient}
   */
  exports.ftpClientAdapter = function(type, connectionParams) {

    /** @type {FtpClientWrapper} */
    let clientWrapper = undefined

    /**
     * @returns {Promise<void>}
     */
    function connect() {

      if (type === 'ftp') {
        let ftp = undefined;
        try {
          ftp   = require('ftp');
        } catch (error) {
          if (error.code === 'MODULE_NOT_FOUND') {
            throw new Error('"ftp" module is required for FTP publish. Use `npm i ftp` to install.');
          } else {
            throw error;
          }
        }

        clientWrapper = funcs.ftpClientWrapper(ftp, {
          host: connectionParams.host,
          port: connectionParams.port,
          user: connectionParams.username,
          password: connectionParams.password,
          secure : true,
          secureOptions : {
            rejectUnauthorized: false // TODO: this should be true
          },
          connTimeout: 5000
        });

      } else if (type === 'sftp') {
        clientWrapper =  funcs.sftpClientWrapper(connectionParams);
      } else {
        throw new Error(`unknown protocol ${type}. Expected "ftp", "sftp".`);
      }

      return clientWrapper.connect();
    }

    /**
     * @param {string} directory_paths
     * @param {(path: string) => void} next_cb
     * @returns {Promise<void>}
     */
    function deleteDirectoriesRecursive(directory_paths, next_cb) {
      if ((directory_paths || []).length < 1) return Promise.resolve();

      next_cb = next_cb || (() => {});

      // Create a function for each directory to delete.
      // When executed, the function will execute
      // next_cb for logging, and return a promise
      // that resolves when the directory is deleted.
      const delete_functions = directory_paths.map(dir_path => {
        return () => {
          next_cb(dir_path);
          return clientWrapper.deleteDirectoryRecursive(dir_path);
        }
      });

      return delete_functions.reduce((prev, f) => prev.then(() => f()), Promise.resolve());
    }

    /**
     * @param {string} file_paths
     * @param {(path: string) => void} next_cb
     * @returns {Promise<void>}
     */
    function deleteFiles(file_paths, next_cb) {
      if ((file_paths || []).length < 1) return Promise.resolve();

      next_cb = next_cb || (() => {});

      // Create a function for each item to delete.
      // When executed, the function will execute
      // next_cb for logging, and return a promise
      // that resolves when the item is deleted.
      const delete_functions = file_paths.map(file_path => {
        return () => {
          next_cb(file_path);
          return clientWrapper.deleteFile(file_path);
        }
      });

      return delete_functions.reduce((prev, f) => prev.then(() => f()), Promise.resolve());
    }

    /**
     * @returns {void}
     */
    function end() {
      clientWrapper.end();
    }

    /**
     * @param {string} directory_paths
     * @param {(path: string) => void} next_cb
     * @returns {Promise<void>}
     */
    function ensureDirectories(directory_paths, next_cb) {
      if ((directory_paths || []).length < 1) return Promise.resolve();

      next_cb = next_cb || (() => {});

      // Create a function for each directory to create.
      // When executed, the function will execute
      // next_cb for logging, and return a promise
      // that resolves when the directory is created.
      const mk_dir_functions = directory_paths.map(dir_path => {
        return () => {
          next_cb(dir_path);
          return clientWrapper.ensureDirectory(dir_path);
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
    function getDirectoryListRecursive(abs_folder_path, relative_to, next_cb) {

      // This function is called any we start
      // getting directory list for a child. It allows
      // better logging/status updates.
      next_cb = next_cb || (() => {});

      next_cb(abs_folder_path);
      return clientWrapper.getDirectoryList(abs_folder_path)
      .then(items => {
        const list = [];
        const dirs = [];
        (items || []).forEach(item => {

          const isDirectory = item.isDir;

          let normalized_path = path.join(abs_folder_path, item.name);
          if (relative_to) {
            normalized_path = path.relative(relative_to, normalized_path);
          }
          normalized_path = normalized_path.replace(/\\/g, '/');
          item.path = normalized_path
          if (isDirectory) dirs.push(item)
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
        const list_getters = dirs.map(dir => {
          return current_items => {
            const full_path = path.join(abs_folder_path, dir.name).replace(/\\/g, '/');
            return getDirectoryListRecursive(full_path, relative_to, next_cb).then(items => [...current_items, ...items])
          }
        });

        return list_getters.reduce((prev, f) => prev.then(items => f(items)), Promise.resolve(list));
      });

    }

    /**
     * @param {string} file_path
     * @returns {Promise<void>}
     */
    function readFile(file_path) {
      return clientWrapper.readFile(file_path);
    }

    /**
     * @param {{dest_path: string, local_path: string}[]} paths
     * @param {(path: string) => void} next_cb
     * @returns {Promise<void>}
     */
    function writeFiles(paths, next_cb) {
      if ((paths || []).length < 1) return Promise.resolve();

      next_cb = next_cb || (() => {});

      // Create a function for each item to put.
      // When executed, the function will execute
      // next_cb for logging, and return a promise
      // that resolves when the put completes.
      const put_functions = paths.map(path_info => {
        return () => {
          next_cb(path_info.dest_path);
          return clientWrapper.writeFile(path_info.local_path, path_info.dest_path);
        }
      });

      return put_functions.reduce((prev, f) => prev.then(() => f()), Promise.resolve());
    }

    /**
     * @param {string} string_data
     * @param {string} dest_path
     * @returns {Promise<void>}
     */
    function writeString(string_data, dest_path) {
      return clientWrapper.writeString(string_data, dest_path);
    }

    /** @type {FtpClient} */
    const retVal = {
      connect,
      deleteDirectoriesRecursive,
      deleteFiles,
      end,
      ensureDirectories,
      getDirectoryListRecursive,
      readFile,
      writeFiles,
      writeString
    }
    return retVal;
  }

  exports.ftpFileInfoUtil = function() {

    function buildFileTree(files) {

      const node_map = new Map();

      (files || []).forEach(current_path => {

        let first_iteration = true;

        do {
          if (node_map.has(current_path)) {
            break;
          }

          let parent_path = path.dirname(current_path);

          let node = {
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

      const root_nodes = [];
      node_map.forEach(node => {

        if (node.parent_path === '.') {
          root_nodes.push(node);
          return;
        }

        const parent_node = node_map.get(node.parent_path);
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
    function buildOrderedDirectoryList(files) {

      const file_tree_root_nodes = buildFileTree(files);
      const dir_list = [];

      const get_paths = node => {

        if (node.is_file) return [];

        const paths = [node.path];
        node.children.forEach(child_node => {
          if (child_node.is_file) return;
          paths.push(...get_paths(child_node))
        });

        return paths;
      }

      file_tree_root_nodes.forEach(node => dir_list.push(...get_paths(node)));
      return dir_list;
    }

    function createLocalManifest(publish_path, site_files) {

      const manifest = {
        base_path: publish_path,
        file_index: new Map(),
        dir_index: new Set()
      };

      const stat_promises = [];
      const file_list = [];
      for (file in site_files) {
        file_list.push(file);
        const current_file = file;
        const stat_promise = getFileSize(path.join(publish_path, current_file)).then(size => {
          manifest.file_index.set(current_file, { size, md5: site_files[current_file].md5 });
        });
        stat_promises.push(stat_promise);
      }

      manifest.dir_index = new Set(buildOrderedDirectoryList(file_list));
      return Promise.all(stat_promises).then(() => manifest);
    }

    function createUploadInfo(local_manifest, remote_file_info_cache, remote_files, ignore_files, overwrite_all, delete_excess) {

      const upload_info = {
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
      const remote_file_cache_index = remote_file_info_cache ? Object.assign({}, remote_file_info_cache.files || {}) : {};
      const remote_file_index =  (remote_files || []).reduce((prev, current) => {
        prev[current.path] = current;
        return prev;
      }, {});

      local_manifest.file_index.forEach((local_file_info, local_file_path) => {

        if (local_file_path in ignore_files) return;

        const remote_file = remote_file_index[local_file_path];
        const remote_file_cache = remote_file_cache_index[local_file_path]

        // Whatever is remaining will be files
        // that exist on remote but not local.
        delete remote_file_index[local_file_path];
        delete remote_file_cache_index[local_file_path];

        const remote_file_exists = remote_file != undefined;
        const files_match =
          remote_file_exists &&
          local_file_info.size === remote_file.size &&
          remote_file_cache != undefined &&
          local_file_info.md5 === remote_file_cache.md5 &&
          local_file_info.size === remote_file_cache.size;

          if (!remote_file_exists) {
            upload_info.missing_file_in_remote_count++;
            upload_info.files_to_upload.push(local_file_path);
          } else if (!files_match) {
            upload_info.modified_file_count++;
            upload_info.files_to_upload.push(local_file_path)
          } else {
            upload_info.matching_file_count++;
            if (overwrite_all) upload_info.files_to_upload.push(local_file_path);
          }
      });

      for (file_path in remote_file_index) {

        if (file_path in ignore_files) continue;

        const remote_file = remote_file_index[file_path];
        if (remote_file.isDir) {
          const local_folder_exists = local_manifest.dir_index.has(file_path);
          if (!local_folder_exists) {
            upload_info.missing_folder_in_local_count++;
            if (delete_excess) upload_info.folders_to_delete.push(file_path);
          }
        } else {
          upload_info.missing_file_in_local_count++;
          if (delete_excess) upload_info.files_to_delete.push(file_path)
        }
      }

      upload_info.folders_to_create = buildOrderedDirectoryList(upload_info.files_to_upload);

      return upload_info;
    }

    function getFileSize(file_path) {
      return new Promise((resolve, reject) => {
        fs.stat(file_path, (err, stats) => err ? reject(err) : resolve(stats.size));
      });
    }

    return {
      buildOrderedDirectoryList,
      createLocalManifest,
      createUploadInfo
    }
  }

  return exports;
}