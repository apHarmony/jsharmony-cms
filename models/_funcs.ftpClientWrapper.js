const path = require('path');
const fs = require('fs');

/** @typedef {import('./_funcs.ftp').FtpClientWrapper} FtpClientWrapper */
/** @typedef {import('./_funcs.ftp').DirectoryItem} DirectoryItem */

module.exports = exports = function(module, funcs) {

  const exports = {};

  /**
   * @param {object} ftp - default export from `require('ftp')`
   * @param {object} connectionOptions - see connect() args {@link https://github.com/mscdex/node-ftp#methods}
   * @returns {FtpClientWrapper}
   */
  exports.ftpClientWrapper = function(ftp, connectionOptions) {

    const client = new ftp();

    /**
     * @public
     * @returns {Promise<void>}
     */
    function connect() {
      return new Promise((resolve, reject) => {

        const onError = err => reject(err);
        client.on('error', onError);

        client.on('ready', () => {
          client.off('error', onError);
          resolve();
        });

        client.connect(connectionOptions);
      });
    }

    /**
     * @public
     * @param {string} directory_path
     * @returns {Promise<void>}
     */
    function deleteDirectoryRecursive(directory_path) {
      return new Promise((resolve, reject) => {
        client.rmdir(directory_path, true, err => {
          if (err && err.code !== 550) {
              reject(error);
          } else {
            resolve();
          }
        });
      });
    }

    /**
     * @public
     * @param {string} file_path
     * @returns {Promise<void>}
     */
    function deleteFile(file_path) {
      return new Promise((resolve, reject) => {
        client.delete(file_path,  err => err ? reject(err) : resolve());
      });
    }

    /**
     * @public
     * @returns {void}
     */
    function end() {
      client.end();
    }

    /**
     * @public
     * @param {string} directory_path
     * @returns {Promise<void>}
     */
    function ensureDirectory(directory_path) {
      return new Promise((resolve, reject) => {
        client.mkdir(directory_path, true, err => err ? reject(err) : resolve());
      });
    }

    /**
     * @public
     * @param {string} directory_path
     * @returns{Promise<DirectoryItem[]>}
     */
    function getDirectoryList(directory_path) {
      return new Promise((resolve, reject) => {
        client.list(directory_path, (list_error, items) => {
          if (list_error) {
            reject(list_error);
          } else {
            /** @type {DirectoryItem[]} */
            const retVal = [];
            (items || []).forEach(item => {
              const isDir = item.type === 'd';
              if (isDir && item.name.startsWith('.')) return;
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
      });
    }

    /**
     * @public
     * @param {string} file_path
     * @returns{Promise<string | undefined>}
     */
    function readFile(file_path) {
      return new Promise((resolve, reject) => {
        client.get(file_path, (err, stream) => {
          if (err) {
            // 550 is a bit ambiguous.
            // It most likely means that the file does not exist.
            // But it is possible the user does not have permission.
            // This might need to be revisited in the future if
            // permission issues become an issue. If the file does
            // not exist then we want to return undefined.
            // All other errors should be thrown.
            if (err.code === 550) {
              resolve(undefined);
            } else {
              reject(err);
            }
          } else {
            const chunks = [];
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks).toString()));
            stream.on('error', stream_error =>  reject(stream_error));
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
    function writeFile(local_path, dest_path) {
      return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(local_path);
        client.put(stream, dest_path, err => err ? reject(err) : resolve());
      });
    }

    /**
     * @public
     * @param {string} string_data
     * @param {string} dest_path
     * @returns{Promise<void>}
     */
    function writeString(string_data, dest_path) {
      return new Promise((resolve, reject) => {
        client.put(Buffer.from(string_data), dest_path, err => err ? reject(err) : resolve());
      });
    }

    /** @type {FtpClientWrapper} */
    const retVal = {
      connect,
      deleteDirectoryRecursive,
      deleteFile,
      end,
      ensureDirectory,
      getDirectoryList,
      readFile,
      writeFile,
      writeString
    };
    return retVal;
  }

  return exports;
}