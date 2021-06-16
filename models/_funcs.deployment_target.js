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

module.exports = exports = function(module, funcs){
  var exports = {};

  exports.parseDeploymentTargetParams = function(deploymentType, dbcontext, site_id, site_config, deployment_target_params, callback){
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
        deployment_target_params = funcs.mergeDeploymentTargetParams(deploymentType, {}, cms.Config.deployment_target_params, site_config.deployment_target_params, deployment_target_params);

        return callback(null, deployment_target_params);
      }
    );
  }

  exports.getCurrentDeploymentTargetParams = function(dbcontext, deploymentType, default_params, override_params, callback){
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;

    var sql = "select site_id,deployment_target_params from {schema}.v_my_site where site_id={schema}.my_current_site_id()";
    var sql_ptypes = [];
    var sql_params = {};

    appsrv.ExecRow(dbcontext, funcs.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
      if (err) return callback(err);
      if (!rslt || !rslt.length || !rslt[0]) return callback(new Error('Site not checked out'));

      var deployment_target_params_str = rslt[0].deployment_target_params || '';
      var site_id = rslt[0].site_id || null;

      var deployment_target_params = _.extend({
        timestamp: (Date.now()).toString()
      }, default_params);

      if(deployment_target_params_str){
        try{
          deployment_target_params = _.extend(deployment_target_params, JSON.parse(deployment_target_params_str));
        }
        catch(ex){
          return callback(new Error('Error reading deployment_target_params.  Please make sure the JSON syntax is correct'));
        }
      }

      deployment_target_params = _.extend(deployment_target_params, override_params);

      funcs.parseDeploymentTargetParams(deploymentType, dbcontext, site_id, undefined, deployment_target_params, function(err, parsed_deployment_target_params){
        if(err) return callback(err);
        deployment_target_params = parsed_deployment_target_params;
        return callback(null, parsed_deployment_target_params);
      });
    });
  }

  exports.replaceDeploymentTargetParams = function(deployment_target_params, content){
    if(!content) return content;
    if(!deployment_target_params) return content;
    content = content.toString();
    var orig_content = content;
    for(var key in deployment_target_params){
      if(key == deployment_target_params[key]) continue;
      content = Helper.ReplaceAll(content, '%%%' + key + '%%%', deployment_target_params[key]);
    }
    if(orig_content != content) return funcs.replaceDeploymentTargetParams(deployment_target_params, content);
    return content;
  }

  exports.mergeDeploymentTargetParams = function(deploymentType, orig){
    if(!orig) orig = {};
    for(var i=2;i<arguments.length;i++){
      var item = arguments[i];
      if(!item) continue;
      for(var key in item){
        var val = item[key];
        if(val && (val.editor || val.publish)){
          if((deploymentType=='editor') && ('editor' in val)) orig[key] = val.editor;
          else if((deploymentType=='publish') && ('publish' in val)) orig[key] = val.publish;
        }
        else orig[key] = val;
      }
    }
    return orig;
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

  return exports;
};