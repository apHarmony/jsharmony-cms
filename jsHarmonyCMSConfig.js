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

  this.media_thumbnails = {
    file_tile: { resize: [150, 150], format: "jpg" },
    file_preview: { resize: [300, 300] },
    small: { resize: [512, 384] },
    medium: { resize: [1024, 768] },
    large: { resize: [2048, 1538] }
  }

  this.deployment_target_params = { //Default deployment target parameters
    page_subfolder: '',   //Relative path from publish folder to pages subfolder, ex. 'pages/'
    media_subfolder: '',  //Relative path from publish folder to media subfolder, ex. 'media/'
    content_url: '/',     //Absolute path from website root to CMS publish folder, ex. '/content/'
    exec_pre_deployment: undefined,  //Execute shell command after populating publish folder, before deployment
                                     //Ex. { cmd: 'cmd', params: ['/c', 'echo abc > c:\\a.a'] }
    exec_post_deployment: undefined, //Execute shell command after deployment
                                     //Ex. { cmd: 'cmd', params: ['/c', 'echo abc > c:\\a.a'] }
    generate_redirect_files: undefined, //Execute when generating redirect files
                                        //function(jsh, redirects, page_redirects, redirects_cb){
                                        //  var redirect_files = { file_path1: file_contents1, file_path2: file_contents2 };
                                        //  return redirects_cb(err, redirect_files);
                                        //}
    git_branch: 'site_%%%SITE_ID%%%', //Git branch used for deployment.  The %%%SITE_ID%%% parameter is replaced with the site id.
  }

  this.deploymentJobDelay = (1000 * 60 * 60);

  this.debug_params = {
    no_cache_client_js: false  //Do not cache jsharmony-cms.js, always reload from disk
  };

  this.onRender = null; //function(target, content, cb){ return cb(new_content); }  //target = 'editor', 'publish'
}

jsHarmonyCMSConfig.prototype = new jsHarmonyConfig.Base();

jsHarmonyCMSConfig.prototype.Init = function(cb, jsh){
  if(cb) return cb();
}

exports = module.exports = jsHarmonyCMSConfig;