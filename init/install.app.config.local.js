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

exports = module.exports = function(appConfig, installerParams, callback){
  require('jsharmony-factory/init/install.app.config.local.js')(appConfig, installerParams, function(err){
    if(err) return callback(err);

    appConfig.body += '\r\n';
    appConfig.body += '  //jsHarmony CMS Configuration\r\n';
    appConfig.body += "  var configCms = config.modules['jsHarmonyCMS'];\r\n";
    appConfig.body += '  if(configCms){\r\n';
    appConfig.body += '    //Preview Server - Used to preview / edit pages using LOCAL templates\r\n';
    appConfig.body += '    configCms.preview_server.enabled = true;\r\n';
    appConfig.body += '    //configCms.preview_server.serverPort = 8088;\r\n';
    appConfig.body += "    //configCms.preview_server.serverHttpsCert = '/path/to/https-cert.pem'; //(Optional - System uses CMS HTTPS cert by default)\r\n";
    appConfig.body += "    //configCms.preview_server.serverHttpsKey = '/path/to/https-key.pem';\r\n";
    appConfig.body += "    //configCms.preview_server.serverHttpsCa = '/path/to/https-ca.crt';\r\n";
    appConfig.body += "    //configCms.preview_server.serverUrl = 'https://example.com'; //(Optional - System uses CMS URL by default)\r\n";
    appConfig.body += '    \r\n';
    appConfig.body += '    //SFTP Server - Used to edit LOCAL site files\r\n';
    appConfig.body += "    //  * Alternatively, edit the files directly in the 'data\\site\\SITE_ID' folder\r\n";
    appConfig.body += '    //configCms.sftp.enabled = true;\r\n';
    appConfig.body += '    //configCms.sftp.serverPort = 22;\r\n';
    appConfig.body += '    \r\n';
    appConfig.body += '    //See documentation for additional CMS, Preview Server, and SFTP settings\r\n';
    appConfig.body += '  }\r\n';

    return callback();
  });
};