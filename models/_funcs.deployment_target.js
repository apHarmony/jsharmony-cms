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
var wclib = require('jsharmony/WebConnect');
var wc = new wclib.WebConnect();

module.exports = exports = function(module, funcs){
  var exports = {};
  var _t = module._t;

  var pendingHostRequests = {};

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
  };

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
  };

  exports.getTemplateVariables = function(target_site_id, dbcontext, deploymentType, default_variables, override_variables, options, callback){
    options = _.extend({ }, options);

    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    var sql = '';
    var sql_ptypes = [];
    var sql_params = {};

    if(target_site_id=='current')
      sql = 'select v_my_site.site_id, v_my_site.deployment_target_template_variables, deployment_target_publish_config from {schema}.v_my_site left outer join {schema}.deployment_target on deployment_target.deployment_target_id = v_my_site.deployment_target_id where v_my_site.site_id={schema}.my_current_site_id()';
    else {
      sql = 'select site_id from {schema}.v_my_site where site_id=@site_id';
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
  };

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
  };

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
  };

  exports.getAccessKey = function(dbcontext, deployment_target_id, server_url, options, callback){
    options = _.extend({ timestamp: null }, options);

    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    var deployment_target_client_salt = null;

    async.waterfall([
      function(key_cb){
        var sql = 'select deployment_target_client_salt from {schema}.deployment_target where deployment_target_id=@deployment_target_id';
        var sql_ptypes = [dbtypes.BigInt];
        var sql_params = { deployment_target_id: deployment_target_id };

        appsrv.ExecRow(dbcontext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
          if(err) return key_cb(err);
          if(!rslt || !rslt.length || !rslt[0]) return key_cb(new Error('Deployment target not found'));

          deployment_target_client_salt = rslt[0].deployment_target_client_salt || null;
          return key_cb();
        });
      },
      function(key_cb){
        if(deployment_target_client_salt) return key_cb();

        //Generate salt if not defined
        deployment_target_client_salt = crypto.randomBytes(16).toString('hex');
        var sql = 'update {schema}.deployment_target set deployment_target_client_salt=@deployment_target_client_salt where deployment_target_id=@deployment_target_id';
        var sql_ptypes = [dbtypes.BigInt, dbtypes.VarChar(256)];
        var sql_params = { deployment_target_id: deployment_target_id, deployment_target_client_salt: deployment_target_client_salt };

        appsrv.ExecCommand(dbcontext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
          if(err) return key_cb(err);
          return key_cb();
        });
      },
      function(key_cb){
        deployment_target_client_salt = (deployment_target_client_salt||'').toString().toLowerCase();
        if(deployment_target_client_salt.length != 32) return key_cb(new Error('Invalid deployment_target_client_salt'));
        //Generate access_key
        var domain_hash = crypto.createHash('sha256').update(deployment_target_client_salt + '-' + server_url.toLowerCase() + (options.timestamp ? '-' + options.timestamp.toString() : '')).digest('hex').toLowerCase();
        var access_key = '';
        for(var i=0;i<8;i++){
          var salt_part = parseInt(deployment_target_client_salt.substr(i*4,4), 16);
          var domain_part = parseInt(domain_hash.substr(i*4,4), 16);
          access_key += Helper.pad((salt_part ^ domain_part).toString(16).toLowerCase(), '0', 4);
        }
        access_key += domain_hash;
        return callback(null, access_key);
      },
    ], callback);
  };

  exports.req_deployment_target_regenerate_access_key = function(req, res, next){
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};

    var Q = req.query;
    var P = req.body;
    var appsrv = this;
    var jsh = module.jsh;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Site_Deployment_Target_IntegrationCode');

    if (!Helper.hasModelAction(req, model, 'U')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }

    var deployment_target_id = req.params.deployment_target_id||'';
    if(!deployment_target_id) return next();
    if(deployment_target_id.toString() != parseInt(deployment_target_id).toString()) return Helper.GenError(req, res, -4, 'Invalid Parameters');

    var sql = 'select deployment_target_id from {schema}.deployment_target where deployment_target_id=@deployment_target_id';
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { deployment_target_id: deployment_target_id };
    appsrv.ExecRow(req._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
      if(!rslt || !rslt[0]) return Helper.GenError(req, res, -99999, 'Invalid Deployment Target ID');
      var deployment_target = rslt[0];
      deployment_target_id = deployment_target.deployment_target_id;

      if (verb == 'post') {
        //Validate parameters
        if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
        if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

        var deployment_target_client_salt = crypto.randomBytes(16).toString('hex');
        sql = 'update {schema}.deployment_target set deployment_target_client_salt=@deployment_target_client_salt where deployment_target_id=@deployment_target_id';
        sql_ptypes = [dbtypes.BigInt, dbtypes.VarChar(256)];
        sql_params = { deployment_target_id: deployment_target_id, deployment_target_client_salt: deployment_target_client_salt };
        appsrv.ExecRow(req._DBContext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
          if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
          return res.send(JSON.stringify({ _success: 1 }));
        });
      }
      else {
        return next();
      }
    });
  };
 
  exports.req_deployment_target_public_key = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};

    var Q = req.query;
    var P = req.body;
    var appsrv = this;
    var jsh = module.jsh;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Site_Deployment_Target_Key');

    if (req.query && (req.query.source=='js')) req.jsproxyid = 'cmsfiledownloader';

    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }

    var deployment_target_id = req.params.deployment_target_id||'';
    if(!deployment_target_id) return next();
    if(deployment_target_id.toString() != parseInt(deployment_target_id).toString()) return Helper.GenError(req, res, -4, 'Invalid Parameters');

    var sql = 'select deployment_target_id from {schema}.deployment_target where deployment_target_id=@deployment_target_id';
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
  };

  exports.req_deployment_target_private_key = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};

    var Q = req.query;
    var P = req.body;
    var appsrv = this;
    var jsh = module.jsh;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Site_Deployment_Target_Key');

    if (req.query && (req.query.source=='js')) req.jsproxyid = 'cmsfiledownloader';

    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }

    var deployment_target_id = req.params.deployment_target_id;
    if(!deployment_target_id) return next();
    if(deployment_target_id.toString() != parseInt(deployment_target_id).toString()) return Helper.GenError(req, res, -4, 'Invalid Parameters');

    var sql = 'select deployment_target_id from {schema}.deployment_target where deployment_target_id=@deployment_target_id';
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
            fs.writeFile(privateKeyPath, privateKey, { encoding: 'utf8', mode: 0o600 }, upload_cb);
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
  };

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
    
          fs.writeFile(privateKeyPath, newPrivateKey, { encoding: 'utf8', mode: 0o600 }, function(err){
            if(err) return gen_cb(err);
            privateKey = newPrivateKey;
            fs.writeFile(publicKeyPath, newPublicKey, { encoding: 'utf8', mode: 0o600 }, function(err){
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

          fs.writeFile(publicKeyPath, newPublicKey, { encoding: 'utf8', mode: 0o600 }, function(err){
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
            fs.writeFile(publicOpensshKeyPath, opensshKey, { encoding: 'utf8', mode: 0o600 }, gen_cb);
          });
        });
      },
    ], callback);
  };

  exports.req_parse_deployment_target_url = function(req, res, next){
    var verb = req.method.toLowerCase();

    var Q = req.query;
    var P = req.body;
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;

    var model = jsh.getModel(req, module.namespace + 'Site_Deployment_Target');
    if (!Helper.hasModelAction(req, model, 'BU')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }

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
  };

  exports.parse_deployment_target_url = function(url){
    url = url || '';
    var lurl = url.toLowerCase();
    if((lurl.indexOf('git_ssh:')==0)||(lurl.indexOf('git_https:')==0)) url = url.substr(4);

    var parsed_url = null;
    try{
      parsed_url = urlparser.parse(url);
    }
    catch(ex){
      /* Do nothing */
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
  };

  exports.req_deployment_target_defaults = function(req, res, next){
    var verb = req.method.toLowerCase();

    var Q = req.query;
    var P = req.body;
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Site_Deployment_Target');
    if (!Helper.hasModelAction(req, model, 'BU')) { Helper.GenError(req, res, -11, _t('Invalid Model Access')); return; }

    if (verb == 'get'){
      if (!appsrv.ParamCheck('Q', Q, ['&site_id'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

      var site_id = Q.site_id;
      if(site_id.toString() != parseInt(site_id).toString()) return Helper.GenError(req, res, -4, 'Invalid Parameters');
      site_id = parseInt(Q.site_id);

      funcs.getTemplateVariables(site_id , req._DBContext, 'publish', {}, {}, { }, function(err, template_variables, deployment_target_publish_config){
        if(err) return Helper.GenError(req, res, -99999, err.toString());

        //Get site_default_page_filename
        var sql = 'select site_default_page_filename from {schema}.site where site_id=@site_id';
        appsrv.ExecRow(req._DBContext, funcs.replaceSchema(sql), [dbtypes.BigInt], { site_id: site_id }, function (err, rslt) {
          if (err) return Helper.GenError(req, res, -99999, err.toString());
          if (!rslt || !rslt.length || !rslt[0]) { Helper.GenError(req, res, -3, 'Site not found'); return; }

          var site_default_page_filename = rslt[0].site_default_page_filename;

          funcs.getSiteConfig(req._DBContext, site_id, { continueOnConfigError: true }, function(err, siteConfig){
            if(err) return Helper.GenError(req, res, -99999, err.toString());
        
            res.end(JSON.stringify({
              _success: 1,
              template_variables: template_variables,
              deployment_target_publish_config: deployment_target_publish_config,
              site_default_page_filename: site_default_page_filename,
              redirect_listing_path: siteConfig.redirect_listing_path,
            }));
          });
        });
      
        
      });
      
      return;
    }
    else return next();
  };

  exports.deployment_target_queue_onSubscribe = function(cb, req, res, queueid){
    var jsh = module.jsh;

    if(!queueid) return cb();
    queueid = queueid.toString();
    if(queueid in jsh.Config.queues) return cb();
    else if(queueid.indexOf('deployment_host_publish_')==0){
      //Add queue
      jsh.Log.info('Adding deployment host publish queue: '+queueid);
      jsh.Config.queues[queueid] = {
        actions: 'BIUD',
        roles: { 'CMSHOST': '*' }
      };
      return cb();
    }
    else if(queueid.indexOf('deployment_host_request_')==0){
      //Add queue
      jsh.Log.info('Adding deployment host request queue: '+queueid);
      jsh.Config.queues[queueid] = {
        actions: 'BIUD',
        roles: { 'CMSHOST': '*' }
      };
      return cb();
    }
    else return cb();
  };

  exports.deployment_target_downloadTemplates = function(host_id, deployment_id, urls, requestOptions, cb){
    var request_message = {
      deployment_id: deployment_id,
      op: 'download_templates',
      urls: urls
    };
    funcs.deployment_target_host_requestSend(host_id, request_message, requestOptions, function(err, body){
      if(err) err = 'Error downloading templates: '+err.toString();
      return cb(err, body && body.urls);
    });

  };

  exports.deployment_target_host_sendQueue = function(queue_name, host_id, msg, callback, retry){
    var MAX_RETRIES = 15;
    var RETRY_SLEEP = 2000;

    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;

    retry = retry || 0;
    if(typeof msg == 'undefined') msg = null;
    if(!_.isString(msg)) msg = JSON.stringify(msg);
    var notifications = appsrv.SendQueue(queue_name + '_' + host_id, msg);
    if(notifications) return callback();

    if(retry >= MAX_RETRIES) return callback(new Error('CMS Deployment Host "'+host_id+'" not connected.  Please verify jsharmony-cms-host is running on the target machine'));
    setTimeout(function(){
      funcs.deployment_target_host_sendQueue(queue_name, host_id, msg, callback, retry+1);
    }, RETRY_SLEEP);
  };

  exports.deployment_target_host_requestSend = function(host_id, request_message, options, cb){
    options = _.extend({ timeout: 60 }, options);
    var jsh = module.jsh;

    //Notify deployment host
    var queue_name = 'deployment_host_request';
    var requestId = (new Date()).getTime().toString() + '_' + Math.round(Math.random()*1000000000).toString();
    var msg = {
      id: requestId,
      body: request_message,
    };
    jsh.Log.info('CMSHOST: Sending request '+requestId+' to '+host_id);
    funcs.deployment_target_host_sendQueue(queue_name, host_id, msg, function(err){
      if(err) return cb(err);
      pendingHostRequests[requestId] = {
        queue_name: queue_name,
        host_id: host_id,
        cb: cb,
        timer: null,
      };
      //Clear callback after timeout
      pendingHostRequests[requestId].timer = setTimeout(function(){
        if(requestId in pendingHostRequests){
          delete pendingHostRequests[requestId];
          cb(new Error('Timeout during request to CMS Deployment Host "'+host_id+'".  Please verify jsharmony-cms-host is running on the target machine'));
        }
      }, (options.timeout||0) * 1000);
    });
  };

  exports.deployment_host_response = function (req, res, next) {
    var verb = req.method.toLowerCase();
    
    var Q = req.query;
    var P = req.body;
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;

    if(!req.params || !req.params.request_id) return next();
    var requestId = req.params.request_id;

    if (!Helper.HasRole(req, 'CMSHOST')) { Helper.GenError(req, res, -11, 'Invalid Access'); return; }

    if (verb == 'post'){
      
      //Validate parameters
      if (!appsrv.ParamCheck('P', P, ['|body','|error'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

      jsh.Log.info('CMSHOST: Received response '+requestId);

      var body = {};
      if(P.body){
        try{
          body = JSON.parse(P.body);
        }
        catch(ex){
          return Helper.GenError(req, res, -9, 'Error parsing body: '+ex.toString());
        }
      }

      if(!(requestId in pendingHostRequests)){
        return Helper.GenError(req, res, -9, 'Request timed out or closed');
      }

      var request = pendingHostRequests[requestId];
      delete pendingHostRequests[requestId];
      clearTimeout(request.timer);
      try{
        request.cb(P.error||null, body);
      }
      catch(ex){
        return Helper.GenError(req, res, -9, ex.toString());
      }

      res.end(JSON.stringify({ '_success': 1 }));

      return;
    }
    else return next();
  };

  exports.webRequestGate = function(publish_path, publish_config, f){  // f(addWebRequest, performWebRequests, gate, downloadTemplates)
    var host_id = '';
    if(publish_path && (publish_path.indexOf('cmshost://')==0)) host_id = publish_path.substr(10);
    var downloadTemplates = host_id && publish_config && publish_config.cmshost_config && publish_config.cmshost_config.download_remote_templates;
    var webRequestURLs = [];
    var webRequestContent = {};
    Helper.gate(function(gate){
      var addWebRequest = function(url, callback){
        if(!_.includes(webRequestURLs, url)) webRequestURLs.push(url);
        var op = gate.addOp(url, callback);
        op.waitForGate(function(){
          if(downloadTemplates){
            var content = webRequestContent[url];
            if(typeof content == 'undefined') return op.done(new Error('Remote Template not resolved by deployment host: '+url));
            op.params[1](null, null, content, op.done);
          }
          else {
            wc.req(op.params[0], 'GET', {}, { 'Accept': 'text/html' }, undefined, function(err, res, templateContent){
              if(err){
                if((err.code=='DEPTH_ZERO_SELF_SIGNED_CERT')||(err.code=='SELF_SIGNED_CERT_IN_CHAIN')||(err.message=='self signed certificate')){
                  err.message = 'Self-signed certificate found for URL: '+op.params[0] + ' :: Select the "Ignore certificate errors when downloading remote templates" option in the Deployment Target configuration to allow self-signed certificates.';
                }
              }
              op.params[1](err, res, templateContent, op.done);
            }, { rejectUnauthorized: !publish_config.ignore_remote_template_certificate });
          }
        });
        return op;
      };
      var performWebRequests = function(callback){
        gate.waitForOps(function(){
          Helper.execif(downloadTemplates && webRequestURLs.length,
            function(f){
              var requestOptions = {};
              if('remote_timeout' in publish_config.cmshost_config) requestOptions.timeout = publish_config.cmshost_config.remote_timeout;
              funcs.deployment_target_downloadTemplates(host_id, null, webRequestURLs, requestOptions, function(err, templates){
                if(err) return callback(err);
                if(templates) _.extend(webRequestContent, templates);
                return f();
              });
            },
            function(){
              gate.open();
              gate.waitForDone(callback);
            }
          );
        });
      };
      f(addWebRequest, performWebRequests, gate, downloadTemplates);
    }, {
      open: !downloadTemplates,
      //log: function(txt){ console.log(txt); },
    });
  };

  return exports;
};