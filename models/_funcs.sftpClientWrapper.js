const ssh2 = require('ssh2');
const path = require('path');
const fs = require('fs');

/** @typedef {import('./_funcs.ftp').FtpClientWrapper} FtpClientWrapper */
/** @typedef {import('./_funcs.ftp').DirectoryItem} DirectoryItem */
/** @typedef {import('./_funcs.ftp').ConnectionParams} ConnectionParams */


const ERR_CODE_DOES_NOT_EXIST = 2;
const ERR_CODE_ALREADY_EXISTS = 4;

module.exports = exports = function(module, funcs) {

  const exports = {};

  /**
   * @param {ConnectionParams} connectionParams
   * @returns {FtpClientWrapper}
   */
  exports.sftpClientWrapper = function(connectionParams) {

    const connection = new ssh2.Client();
    let client = undefined;

    /**
     * @public
     * @returns {Promise<void>}
     */
    function connect() {
      return new Promise((resolve, reject) => {

        connection.on('ready', () => {
          connection.sftp((err, sftp_stream) => {
            client = err ? undefined : sftp_stream;
            err ? reject(err) : resolve();
          });
        });
        connection.on('error', err => reject(err))

        getPrivateKey(connectionParams.private_key_path).then(key => {
          connection.connect({
            host: connectionParams.host,
            password: connectionParams.password,
            port: connectionParams.port,
            username: connectionParams.username,
            privateKey: key
          })
        });
      });
    }


    /**
     * Directory MUST be empty!
     * @private
     * @param {string} directory_path
     * @returns {Promise<void>}
     */
    function deleteDirectory(directory_path) {
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
    function deleteDirectoryRecursive(directory_path) {
      return getDirectoryList(directory_path)
      .catch(err => {
        if (err.code === ERR_CODE_DOES_NOT_EXIST) {
          return [];
        } else {
          throw err;
        }
      })
      .then(items => {

        const files = [];
        const dirs = [];
        (items || []).forEach(item => {
          if (item.isDir) dirs.push(item.path)
          else files.push(item.path);
        });

        if (files.length < 1) return dirs;

        const delete_functions = files.map(file_path => () => deleteFile(file_path));
        return delete_functions.reduce((prev, func) => prev.then(() => func()), Promise.resolve()).then(() => dirs);
      })
      .then(dirs => {

        if (dirs.length < 1) return;

        const delete_functions = dirs.map(dir_path => () => deleteDirectoryRecursive(dir_path));
        return delete_functions.reduce((prev, func) => prev.then(() => func()), Promise.resolve());
      })
      .then(() => deleteDirectory(directory_path));
    }

    /**
     * @param {string} file_path
     * @returns {Promise<void>}
     */
    function deleteFile(file_path) {
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
    function end() {
      connection.end();
    }

    /**
     * @public
     * @param {string} directory_path
     * @returns {Promise<void>}
     */
    function ensureDirectory(directory_path) {
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
    function getDirectoryList(directory_path) {
      return new Promise((resolve, reject) => {
        client.readdir(directory_path, (err, items) => {
          if (err) {
            reject(err);
          } else {
            items = (items || []).map(item => {
              /** @type {DirectoryItem} */
              const retVal = {
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
     * @param {string} key_file_path
     * @returns {Promise<string>}
     */
    function getPrivateKey(key_file_path) {
      if (!key_file_path) return Promise.resolve();
      return new Promise((resolve, reject) => {
        fs.readFile(key_file_path, (err, data) => err ? reject(err) : resolve(data.toString()));
      });
    }

    /**
     * @public
     * @param {string} file_path
     * @returns{Promise<string | undefined>}
     */
    function readFile(file_path) {
      return new Promise((resolve, reject) => {
        const stream = client.createReadStream(file_path);
        const chunks = [];
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
    function writeFile(local_path, dest_path) {
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
    function writeString(string_data, dest_path) {
      return new Promise((resolve, reject) => {
        client.writeFile(dest_path, string_data, { flag: 'w+'}, write_error => write_error ? reject(write_error) : resolve());
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