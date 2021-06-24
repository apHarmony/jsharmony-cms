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
var Helper = require('jsharmony/Helper');
var HelperFS = require('jsharmony/HelperFS');
var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var async = require('async');
var crypto = require('crypto');
var urlparser = require('url');

module.exports = exports = function(module, funcs){
  var exports = {};

  exports.parseTemplateVariables = function(deploymentType, dbcontext, site_id, site_config, template_variables, deployment_target_publish_config, callback){
    var cms = module;

    if(!deploymentType || !_.includes(['editor','publish'], deploymentType)) return callback(new Error('Invalid deployment type'));
    Helper.execif(!site_config,
      function(f){
        funcs.getSiteConfig(dbcontext, site_id, { continueOnConfigError: true }, function(err, siteConfig){
          if(err) return callback(err);
          site_config = siteConfig || {};
          return f();
        });
      },
      function(){
        var defaultParams = {
          timestamp: (Date.now()).toString(),
          url_prefix: deployment_target_publish_config.url_prefix
        };
        template_variables = funcs.mergeTemplateVariables(deploymentType, defaultParams, cms.Config.template_variables, site_config.template_variables, template_variables);

        return callback(null, template_variables);
      }
    );
  }

  exports.mergeTemplateVariables = function(deploymentType, orig){
    if(!orig) orig = {};
    for(var i=2;i<arguments.length;i++){
      var item = arguments[i];
      if(!item) continue;
      for(var key in item){
        var val = item[key];
        if(val && (val.editor || val.publish)){
          if((deploymentType=='editor') && ('editor' in val)) orig[key] = val.editor;
          else if((deploymentType=='publish') && ('publish' in val)) orig[key] = val.publish;
          else if(!(key in orig)) orig[key] = '';
        }
        else orig[key] = val;
      }
    }
    return orig;
  }

  exports.getTemplateVariables = function(target_site_id, dbcontext, deploymentType, default_variables, override_variables, options, callback){
    options = _.extend({ }, options);

    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    var sql = '';
    var sql_ptypes = [];
    var sql_params = {};

    if(target_site_id=='current')
      sql = "select v_my_site.site_id, v_my_site.deployment_target_template_variables, deployment_target_publish_config from {schema}.v_my_site left outer join {schema}.deployment_target on deployment_target.deployment_target_id = v_my_site.deployment_target_id where v_my_site.site_id={schema}.my_current_site_id()";
    else {
      sql = "select site_id from {schema}.v_my_site where site_id=@site_id";
      sql_ptypes = [dbtypes.BigInt];
      sql_params = { site_id: target_site_id };
    }

    appsrv.ExecRow(dbcontext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
      if (err) return callback(err);
      if (!rslt || !rslt.length || !rslt[0]) return callback(new Error('Site not checked out'));

      var deployment_target_template_variables_str = rslt[0].deployment_target_template_variables || '';
      var deployment_target_publish_config_str = rslt[0].deployment_target_publish_config || '';
      var site_id = rslt[0].site_id || null;

      var template_variables = _.extend({}, default_variables);

      if(deployment_target_template_variables_str){
        try{
          template_variables = _.extend(template_variables, JSON.parse(deployment_target_template_variables_str));
        }
        catch(ex){
          return callback(new Error('Error reading deployment_target_template_variables.  Please make sure the JSON syntax is correct'));
        }
      }

      var deployment_target_publish_config = {};
      try{
        deployment_target_publish_config = funcs.parseDeploymentTargetPublishConfig(site_id, deployment_target_publish_config_str, deploymentType);
      }
      catch(ex){
        return callback(new Error('Error reading deployment_target_publish_config: '+ex.toString()));
      }

      template_variables = _.extend(template_variables, override_variables);

      funcs.parseTemplateVariables(deploymentType, dbcontext, site_id, undefined, template_variables, deployment_target_publish_config, function(err, parsed_template_variables){
        if(err) return callback(err);
        return callback(null, parsed_template_variables, deployment_target_publish_config);
      });
    });
  }

  exports.parseDeploymentTargetPublishConfig = function(site_id, deployment_target_publish_config_str, deploymentType){
    var cms = module;
    deployment_target_publish_config_str = deployment_target_publish_config_str || '';
    var rslt = {};
    try{
      if(deployment_target_publish_config_str) rslt = _.extend(rslt, JSON.parse(deployment_target_publish_config_str));
    }
    catch(ex){
      throw new Error('Deployment Target deployment_target_publish_config has invalid JSON syntax');
    }
    for(var key in cms.Config.deployment_target_publish_config){
      if((key == 's3_config')||(key == 'ftp_config')) rslt[key] = _.extend({}, cms.Config.deployment_target_publish_config[key], rslt[key]);
      else if(!(key in rslt)) rslt[key] = cms.Config.deployment_target_publish_config[key];
    }
    if(Helper.isNullUndefined(rslt.url_prefix)) rslt.url_prefix = '/';
    if(deploymentType=='editor') rslt.url_prefix = '/';
    return rslt;
  }

  exports.replaceTemplateVariables = function(template_variables, content){
    if(!content) return content;
    if(!template_variables) return content;
    content = content.toString();
    var orig_content = content;
    for(var key in template_variables){
      if(key == template_variables[key]) continue;
      var val = template_variables[key];
      if(Helper.isNullUndefined(val)) val = '';
      content = Helper.ReplaceAll(content, '%%%' + key + '%%%', val);
    }
    if(orig_content != content) return funcs.replaceTemplateVariables(template_variables, content);
    return content;
  }
 
  exports.req_deployment_target_public_key = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};

    var Q = req.query;
    var P = req.body;
    var appsrv = this;
    var jsh = module.jsh;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Branch_Download');

    if (req.query && (req.query.source=='js')) req.jsproxyid = 'cmsfiledownloader';

    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    var deployment_target_id = req.params.deployment_target_id||'';
    if(!deployment_target_id) return next();
    if(deployment_target_id.toString() != parseInt(deployment_target_id).toString()) return Helper.GenError(req, res, -4, 'Invalid Parameters');

    var sql = "select deployment_target_id from {schema}.deployment_target where deployment_target_id=@deployment_target_id";
    appsrv.ExecRow(req._DBContext, funcs.replaceSchema(sql), [dbtypes.BigInt], { deployment_target_id: deployment_target_id }, function (err, rslt) {
      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
      if(!rslt || !rslt[0]) return Helper.GenError(req, res, -99999, 'Invalid Deployment Target ID');
      var deployment_target = rslt[0];
      deployment_target_id = deployment_target.deployment_target_id;

      //Validate parameters
      if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      if (!appsrv.ParamCheck('Q', Q, ['|source','&format'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

      if(!_.includes(['pem','openssh'], Q.format)) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      //Keep certExt separate from Q.format for security
      var certExt = 'pem';
      if(Q.format=='openssh') certExt = 'openssh';

      if (verb == 'get') {
        //Check if file exists
        var fpath = path.join(jsh.Config.datadir,'deployment_target',deployment_target_id.toString(), 'key.public.'+certExt);
        fs.exists(fpath, function(exists){
          Helper.execif(!exists, function(f){
            //If not, generate file
            funcs.generate_deployment_target_key(deployment_target_id, function(err){
              if(err) return Helper.GenError(req, res, -99999, err.toString());
              return f();
            });
          },
          function(){
            HelperFS.outputFile(req, res, fpath, deployment_target_id.toString()+'.key.public.'+certExt);
          });
        });
      }
      else {
        return next();
      }
    });
  }

  exports.req_deployment_target_private_key = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};

    var Q = req.query;
    var P = req.body;
    var appsrv = this;
    var jsh = module.jsh;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Branch_Download');

    if (req.query && (req.query.source=='js')) req.jsproxyid = 'cmsfiledownloader';

    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    var deployment_target_id = req.params.deployment_target_id;
    if(!deployment_target_id) return next();
    if(deployment_target_id.toString() != parseInt(deployment_target_id).toString()) return Helper.GenError(req, res, -4, 'Invalid Parameters');

    var sql = "select deployment_target_id from {schema}.deployment_target where deployment_target_id=@deployment_target_id";
    appsrv.ExecRow(req._DBContext, funcs.replaceSchema(sql), [dbtypes.BigInt], { deployment_target_id: deployment_target_id }, function (err, rslt) {
      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
      if(!rslt || !rslt[0]) return Helper.GenError(req, res, -99999, 'Invalid Deployment Target ID');
      var deployment_target = rslt[0];
      deployment_target_id = deployment_target.deployment_target_id;

      if (verb == 'get') {
        //Validate parameters
        if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, ['|source'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        //Check if file exists
        var fpath = path.join(jsh.Config.datadir,'deployment_target',deployment_target_id.toString(), 'key.private.pem');
        fs.exists(fpath, function(exists){
          Helper.execif(!exists, function(f){
            //If not, generate file
            funcs.generate_deployment_target_key(deployment_target_id, function(err){
              if(err) return Helper.GenError(req, res, -99999, err.toString());
              return f();
            });
          },
          function(){
            HelperFS.outputFile(req, res, fpath, deployment_target_id.toString()+'.key.private.pem');
          });
        });
      }
      else if(verb == 'post'){
        //Validate parameters
        if (!appsrv.ParamCheck('P', P, ['&private_key'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        var deploymentTargetPath = path.join(jsh.Config.datadir,'deployment_target',deployment_target_id.toString());
        var privateKeyPath = path.join(deploymentTargetPath, 'key.private.pem');

        var privateKey = null;
        
        async.waterfall([

          //Get uploaded file
          function(upload_cb){
            var fname = path.basename(P.private_key);
            var file_ext = path.extname(fname).toLowerCase(); //Get extension
            if (file_ext != '.pem') { return Helper.GenError(req, res, -32, 'File extension is not supported.'); }
            var uploadFilePath = path.join(jsh.Config.datadir, 'temp', req._DBContext, fname);
            HelperFS.getFileStats(req, res, uploadFilePath, function (err, stat) {
              if (err) { return Helper.GenError(req, res, -33, 'Key file not found.'); }
              fs.readFile(uploadFilePath, 'utf8', function(err, data){
                if(err) return upload_cb(err);
                privateKey = data;
                if(!data) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
                return upload_cb(null);
              });
            });
          },

          //Validate key
          function(upload_cb){
            validatePrivateKey(privateKey, function(err, newPrivateKey){
              if(err) return upload_cb(err);
              privateKey = newPrivateKey;
              return upload_cb();
            });
          },

          //Create deployment target folder if it does not exist
          function(upload_cb){
            HelperFS.createFolderIfNotExists(deploymentTargetPath, upload_cb);
          },

          //Write new private key to disk
          function(upload_cb){
            fs.writeFile(privateKeyPath, privateKey, 'utf8', upload_cb);
          },

          //Delete pem public key if it exists
          function(upload_cb){
            HelperFS.tryUnlink(path.join(deploymentTargetPath, 'key.public.pem'), upload_cb);
          },

          //Delete openssh public key if it exists
          function(upload_cb){
            HelperFS.tryUnlink(path.join(deploymentTargetPath, 'key.public.openssh'), upload_cb);
          },

          //Regenerate public key
          function(upload_cb){
            funcs.generate_deployment_target_key(deployment_target_id, upload_cb);
          },

        ], function(err){
          if(err) return Helper.GenError(req, res, -99999, err.toString());
          return res.send(JSON.stringify({ _success: 1 }));
        });
      }
      else {
        return next();
      }
    });
  }

  function createPrivateKey(cb){
    crypto.generateKeyPair('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    }, function(err, newPublicKey, newPrivateKey){
      if(err) return cb(err);
      validatePrivateKey(newPrivateKey, function(err, processedPrivateKey){
        if(err) return cb(err);
        return cb(err, newPublicKey, processedPrivateKey);
      });
    });
  }

  function createPublicKey(privateKey, cb){
    var forge = require('node-forge');
    forge.options.usePureJavaScript = true; 

    var newPublicKey = null;
    try{
      var pkiPrivateKey = forge.pki.privateKeyFromPem(privateKey);
      newPublicKey = forge.pki.publicKeyToPem(forge.pki.setRsaPublicKey(pkiPrivateKey.n, pkiPrivateKey.e));
    }
    catch(err){
      return cb(err);
    }
    if(!newPublicKey) return cb(new Error('Could not generate public key - invalid private key'));
    return cb(null, newPublicKey);
  }

  function createOpensshKey(publicKey, cb){
    var forge = require('node-forge');
    forge.options.usePureJavaScript = true;

    var opensshKey = null;
    try{
      var pkiPublicKey = forge.pki.publicKeyFromPem(publicKey);
      opensshKey = forge.ssh.publicKeyToOpenSSH(pkiPublicKey);
    }
    catch(err){
      return cb(err);
    }
    return cb(null, opensshKey);
  }

  function validatePrivateKey(privateKey, cb){
    var forge = require('node-forge');
    forge.options.usePureJavaScript = true; 

    var newPrivateKey = null;
    try{
      var pkiPrivateKey = forge.pki.privateKeyFromPem(privateKey);
      newPrivateKey = forge.pki.privateKeyToPem(pkiPrivateKey);
    }
    catch(err){
      return cb(err);
    }
    if(!newPrivateKey) return cb(new Error('Invalid private key'));
    return cb(null, newPrivateKey);
  }

  exports.generate_deployment_target_key = function(deployment_target_id, callback){
    var jsh = module.jsh;

    var deploymentTargetPath = path.join(jsh.Config.datadir,'deployment_target',deployment_target_id.toString());
    var privateKeyPath = path.join(deploymentTargetPath, 'key.private.pem');
    var publicKeyPath = path.join(deploymentTargetPath, 'key.public.pem');
    var publicOpensshKeyPath = path.join(deploymentTargetPath, 'key.public.openssh');
    
    var privateKey = null;
    var publicKey = null;

    async.waterfall([

      //Create deployment target folder if it does not exist
      function(gen_cb){
        HelperFS.createFolderIfNotExists(deploymentTargetPath, gen_cb);
      },

      //Check if private key exists
      function(gen_cb){
        fs.exists(privateKeyPath, function(exists){
          if(!exists) return gen_cb();
          fs.readFile(privateKeyPath, 'utf8', function(err, content){
            if(err) return gen_cb(err);
            privateKey = content;
            return gen_cb();
          });
        });
      },

      //Check if public key exists
      function(gen_cb){
        fs.exists(publicKeyPath, function(exists){
          if(!exists) return gen_cb();
          fs.readFile(publicKeyPath, 'utf8', function(err, content){
            if(err) return gen_cb(err);
            publicKey = content;
            return gen_cb();
          });
        });
      },

      //Generate public + private keys if the private key does not exist
      function(gen_cb){
        if(privateKey) return gen_cb();

        createPrivateKey(function(err, newPublicKey, newPrivateKey){
          if(err) return gen_cb(err);
    
          fs.writeFile(privateKeyPath, newPrivateKey, 'utf8', function(err){
            if(err) return gen_cb(err);
            privateKey = newPrivateKey;
            fs.writeFile(publicKeyPath, newPublicKey, 'utf8', function(err){
              if(err) return gen_cb(err);
              publicKey = newPublicKey;
              return gen_cb();
            });
          });
        });
      },

      //Generate public key if the private key does not exist
      function(gen_cb){
        if(publicKey) return gen_cb();

        createPublicKey(privateKey, function(err, newPublicKey){
          if(err) return gen_cb(err);

          fs.writeFile(publicKeyPath, newPublicKey, 'utf8', function(err){
            if(err) return gen_cb(err);
            publicKey = newPublicKey;
            return gen_cb();
          });
        });
      },

      //Generate OpenSSH public key if it does not exist
      function(gen_cb){
        fs.exists(publicOpensshKeyPath, function(exists){
          if(exists) return gen_cb();
          createOpensshKey(publicKey, function(err, opensshKey){
            if(err) return gen_cb(err);
            fs.writeFile(publicOpensshKeyPath, opensshKey, 'utf8', gen_cb);
          });
        });
      },
    ], callback);
  }

  exports.req_parse_deployment_target_url = function(req, res, next){
    var verb = req.method.toLowerCase();

    var Q = req.query;
    var P = req.body;
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;

    var model = jsh.getModel(req, module.namespace + 'Site_Deployment_Target');
    if (!Helper.hasModelAction(req, model, 'BU')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    if (verb == 'post'){
      if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      if (!appsrv.ParamCheck('P', P, ['&url'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      
      var url = P.url;
      var parsed_url = funcs.parse_deployment_target_url(url);

      res.end(JSON.stringify({
        '_success': 1,
        'urlparts': parsed_url,
      }));
      return;
    }
    else return next();
  }

  exports.parse_deployment_target_url = function(url){
    url = url || '';
    var lurl = url.toLowerCase();
    if((lurl.indexOf('git_ssh:')==0)||(lurl.indexOf('git_https:')==0)) url = url.substr(4);

    var parsed_url = null;
    try{
      parsed_url = urlparser.parse(url);
    }
    catch(ex){
    }

    var username = null;
    var password = null;

    if(parsed_url){
      if(parsed_url.path && (parsed_url.path.indexOf('/:')==0)){
        if(parsed_url.protocol && (parsed_url.protocol.toLowerCase()=='ssh:')){
          parsed_url.path = ':' + parsed_url.path.substr(2);
          parsed_url.pathname = ':' + parsed_url.pathname.substr(2);
        }
        else {
          parsed_url.path = '/' + parsed_url.path.substr(2);
          parsed_url.pathname = '/' + parsed_url.pathname.substr(2);
        }
      }

      var auth = parsed_url.auth;
      if(parsed_url.auth){
        var idx = auth.indexOf(':');
        if(idx>=0){
          username = auth.substr(0, idx);
          password = auth.substr(idx+1);
        }
        else username = auth;
      }
    }

    return (parsed_url ? {
      protocol: parsed_url.protocol,
      auth: parsed_url.auth,
      hostname: parsed_url.hostname,
      port: parsed_url.port,
      path: parsed_url.path,
      username: username,
      password: password,
    } : null);
  }

  exports.req_deployment_target_defaults = function(req, res, next){
    var verb = req.method.toLowerCase();

    var Q = req.query;
    var P = req.body;
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;

    var model = jsh.getModel(req, module.namespace + 'Site_Deployment_Target');
    if (!Helper.hasModelAction(req, model, 'BU')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    if (verb == 'get'){
      if (!appsrv.ParamCheck('Q', Q, ['&site_id'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

      var site_id = Q.site_id;
      if(site_id.toString() != parseInt(site_id).toString()) return Helper.GenError(req, res, -4, 'Invalid Parameters');
      site_id = parseInt(Q.site_id);

      funcs.getTemplateVariables(site_id , req._DBContext, 'publish', {}, {}, { }, function(err, template_variables, deployment_target_publish_config){
        if(err) return Helper.GenError(req, res, -99999, err.toString());
      
        res.end(JSON.stringify({
          _success: 1,
          template_variables: template_variables,
          deployment_target_publish_config: deployment_target_publish_config,
        }));
      });
      
      return;
    }
    else return next();
  }

  exports.deployment_target_queue_onSubscribe = function(cb, req, res, queueid){
    var jsh = module.jsh;

    if(!queueid) return cb();
    queueid = queueid.toString();
    if(queueid.indexOf('deployment_host_')!=0) return cb();
    if(queueid in jsh.Config.queues) return cb();
    //Add queue
    jsh.Log.info('Adding deployment host queue: '+queueid);
    jsh.Config.queues[queueid] = {
      actions: "BIUD",
      roles: { "CMSHOST": "*" }
    };
    return cb();
  }

  return exports;
};