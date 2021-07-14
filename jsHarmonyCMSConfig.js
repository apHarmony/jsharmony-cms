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

var jsHarmonyConfig = require('jsharmony/jsHarmonyConfig');
var HelperFS = require('jsharmony/HelperFS');
var path = require('path');

function jsHarmonyCMSConfig(){
  //jsHarmony CMS module path
  this.moduledir = path.dirname(module.filename);

  this.git = {
    enabled: false,
    bin_path: '',
    ssh_command: 'ssh -o StrictHostKeyChecking=no -o IdentitiesOnly=yes -o PreferredAuthentications=publickey -o IdentityFile="%%%IDENTITYFILE%%%"',
  };

  this.sftp = {
    enabled: false,
    serverPort: 22,
    serverIp: '0.0.0.0',
    clientIp: ['0.0.0.0/0'],  /* '127.0.0.1', '192.168.1.0/24', ... */

    serverKey: undefined,     // path/to/key.pem
                              //   If undefined, HTTPS Key from main CMS site will be used

    serverUrl: undefined,     // SFTP Server client-facing URL, ex. sftp://example.com:22
                              //   If not set, hostname will be auto-detected from CMS site hostname
  };

  this.preview_server = {
    enabled: false,
    serverPort: 8088,
    serverIp: '0.0.0.0',
    serverUrl: undefined,       // Preview Server client-facing URL, ex. https://example.com:8088
                                //   If not set, hostname will be auto-detected from CMS site hostname

    serverHttpsKey: undefined,  // path/to/https-key.pem
                                //   If undefined, HTTPS Key / Cert / CA from main CMS site will be used
                                //   If set to false, HTTP will be used instead of HTTPS
    serverHttpsCert: undefined, // path/to/https-cert.pem
    serverHttpsCa: undefined,   // path/to/https-ca.pem
  };

  this.media_thumbnails = {
    file_tile: { resize: [150, 150], format: "jpg" },
    file_preview: { resize: [300, 300], format: "jpg" },
    small: { resize: [512, 384] },
    medium: { resize: [1024, 768] },
    large: { resize: [2048, 1538] },
    //maximum: { resize: [2048, 1538] }
  };

  this.template_variables = { //Default template variables
  };

  this.deployment_target_publish_config = { //Default deployment target publish config
    page_subfolder: '',   //Stores CMS page files in a subfolder of the publish directory, ex. 'pages/'
    media_subfolder: '',  //Stores CMS media files in a subfolder of the publish directory, ex. 'media/'
    url_prefix: null,                 //Prefix for URLs on publish, ex. '/content/'.  Can be used in page templates as %%%url_prefix%%%.  Defaults to "/" if null
    url_prefix_page_override: null,  //Override URL prefix for CMS page URLs, ex. '/pages/'
    url_prefix_media_override: null, //Override URL prefix for CMS media URLs, ex. '/media/'
    published_url: null,  //(Optional) URL of published site, ex. https://example.com
    exec_pre_deployment: undefined,  //Execute shell command after populating publish folder, before deployment
                                     //Ex. { cmd: 'cmd', params: ['/c', 'echo abc > c:\\a.a'] }
    exec_post_deployment: undefined, //Execute shell command after deployment
                                     //Ex. { cmd: 'cmd', params: ['/c', 'echo abc > c:\\a.a'] }
    git_branch: 'site_%%%SITE_ID%%%',    //Git branch used for deployment.  The %%%SITE_ID%%% parameter is replaced with the site id.
    copy_folders: [/* 'dir1','dir2' */], //Copy contents from the source folders into the publish folder

    //List of remote paths to ignore
    //* Future - Not implemented
    //ignore_remote: [],
    //ex. ["path/to/file1","path/to/folder2",{ "regex": "/regex1/"},{ "regex": "/regex_with_flags/i"}]

    //FTP/FTPS/SFTP publish settings
    ftp_config: {
      overwrite_all: false,         //For FTP / FTPS / SFTP, if true, always upload all files, instead of comparing size and MD5
      delete_excess_files: false,   //For FTP / FTPS / SFTP, if true, delete excess files in destination that weren't in the publish build

      ignore_certificate_errors: false,  //For FTPS, ignore self-signed certificate errors
      compression: false,                //For FTP / FTPS, whether to enable compression
    },

    //Amazon S3 deployment settings
    s3_config: {
      accessKeyId: "",
      secretAccessKey: "",
      upload_params: { //Add parameters to the S3.upload request
        //"ACL": "public-read",
        //More parameters can be found at:
        //https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
      }
    },
  };

  this.deploymentJobDelay = (1000 * 15);

  this.debug_params = {
    no_cache_client_js: false,          //Do not cache jsHarmonyCMS.js, always reload from disk
    auto_restart_failed_publish: false, //Do not cancel failed publish - instead auto-restart
    no_publish_complete: false,         //Leave publish in 'RUNNING' (for debugging, so that it will auto-restart with auto_restart_failed_publish flag)
    sftp_log: false,                    //Log SFTP session
  };

  this.defaultEditorConfig = {          //Default GUI page editor config
    webSnippetsPath: '/templates/websnippets/',  //Web snippets listing path
    materialIcons: false,                        //Whether to enable Material Icons in the Editor
                                                 //  If enabled, Material Icons Font CSS Link must be added to the Page Template HTML
  };

  this.cachedDbResidentBranches = 5;   //Number of branches to maintain in the database (vs. archived to file) NOT INCLUDING (always resident) checkouts, reviews, and releases

  this.evictBranchesJobDelay = (1000 * 60 * 60 * 24);  //How often to check for unused branches that can be archived to file (reloaded on demand)

  this.cleanupOrphanBranchesJobDelay = (1000 * 60 * 60 * 24 * 7);  //How often to check for branch archive files whose branch was deleted

  this.showLocalTemplatePaths = true;   //Display local template file system paths in Site Templates Administration

  this.onRender = null; //function(target, content, callback){ return callback(new_content); }  //target = 'editor', 'publish'
  this.onRouteLinkBrowser = null; //function(jsh, req, res, model, callback){ return callback(); } //callback(false) to stop further processing
  this.onReplaceBranchURL = null; //function(url, branchData, getLinkContent, options){ return url; } //return a value (not undefined) to stop processing
  this.onDeploy_LoadData = null; //function(jsh, branchData, template_variables, callback){ return callback(err); }
  this.onValidate_LoadData = null; //function(jsh, branchData, template_variables, callback){ return callback(err); }
  this.onDeploy_GenerateRedirects = null; //function(jsh, branchData, template_variables, callback){ return callback(err, generated_redirect_files); }
                                          //    generated_redirect_files = { 'path1': 'file content1', 'path2': 'file content2' }
  this.onDeploy_PostBuild = null; //function(jsh, branchData, template_variables, callback){ return callback(err); }
}

jsHarmonyCMSConfig.prototype = new jsHarmonyConfig.Base();

jsHarmonyCMSConfig.prototype.Init = function(cb, jsh){
  if(cb) return cb();
}

exports = module.exports = jsHarmonyCMSConfig;