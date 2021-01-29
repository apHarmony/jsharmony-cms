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
    bin_path: ''
  };

  this.aws_key = {
    //accessKeyId: 'xxxxxxxxxxxxxxxxxxxx',
    //secretAccessKey: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  };

  this.sftp = {
    enabled: false,
    serverPort: 22,
    serverIp: '0.0.0.0',
    clientIp: ['0.0.0.0/0'],  /* '127.0.0.1', '192.168.1.0/24', ... */
  };

  this.preview_server = {
    enabled: false,
    serverPort: 8088,
    serverIp: '0.0.0.0',
  };

  this.media_thumbnails = {
    file_tile: { resize: [150, 150], format: "jpg" },
    file_preview: { resize: [300, 300], format: "jpg" },
    small: { resize: [512, 384] },
    medium: { resize: [1024, 768] },
    large: { resize: [2048, 1538] },
    //maximum: { resize: [2048, 1538] }
  };

  this.deployment_target_params = { //Default deployment target parameters
    page_subfolder: '',   //Relative path from publish folder to pages subfolder, ex. 'pages/'
    media_subfolder: '',  //Relative path from publish folder to media subfolder, ex. 'media/'
    menu_subfolder: '',   //Relative path from publish folder to menu subfolder, ex. 'menus/'
    content_url: '/',     //Absolute path from website root to CMS publish folder, ex. '/content/'
    exec_pre_deployment: undefined,  //Execute shell command after populating publish folder, before deployment
                                     //Ex. { cmd: 'cmd', params: ['/c', 'echo abc > c:\\a.a'] }
    exec_post_deployment: undefined, //Execute shell command after deployment
                                     //Ex. { cmd: 'cmd', params: ['/c', 'echo abc > c:\\a.a'] }
    generate_redirect_files: undefined, //Execute when generating redirect files
                                        //function(jsh, deployment, redirects, page_redirects, redirects_cb){
                                        //  var redirect_files = { file_path1: file_contents1, file_path2: file_contents2 };
                                        //  return redirects_cb(err, redirect_files);
                                        //}
    generate_menu_files: undefined, //Execute when generating menu files
                                    //function(jsh, deployment, menus, menus_cb){
                                    //  var menu_files = { file_path1: file_contents1, file_path2: file_contents2 };
                                    //  return menus_cb(err, menu_files);
                                    //}
    git_branch: 'site_%%%SITE_ID%%%',    //Git branch used for deployment.  The %%%SITE_ID%%% parameter is replaced with the site id.
    copy_folders: [/* 'dir1','dir2' */], //Copy contents from the source folders into the publish folder
  };

  this.deploymentJobDelay = (1000 * 15);

  this.debug_params = {
    no_cache_client_js: false,          //Do not cache jsHarmonyCMS.js, always reload from disk
    auto_restart_failed_publish: false, //Do not cancel failed publish - instead auto-restart
    no_publish_complete: false,         //Leave publish in 'RUNNING' (for debugging, so that it will auto-restart with auto_restart_failed_publish flag)
    sftp_log: false,                    //Log SFTP session
  };

  this.defaultEditorConfig = {};        //Default GUI editor config
                                        //Web snippets listing path: { webSnippetsPath: '/templates/websnippets/' }
                                        //Enable Material Icons { materialIcons: true }

  this.onRender = null; //function(target, content, callback){ return callback(new_content); }  //target = 'editor', 'publish'
  this.onRouteLinkBrowser = null; //function(jsh, req, res, model, callback){ return callback(); } //callback(false) to stop further processing
  this.onReplaceBranchURL = null; //function(url, branchData, getLinkContent, options){ return url; } //return a value (not undefined) to stop processing
  this.onDeploy_LoadData = null; //function(jsh, branchData, deployment_target_params, callback){ return callback(); }
  this.onValidate_LoadData = null; //function(jsh, branchData, deployment_target_params, callback){ return callback(); }
}

jsHarmonyCMSConfig.prototype = new jsHarmonyConfig.Base();

jsHarmonyCMSConfig.prototype.Init = function(cb, jsh){
  if(cb) return cb();
}

exports = module.exports = jsHarmonyCMSConfig;