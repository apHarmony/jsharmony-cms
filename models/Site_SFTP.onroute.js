//(routetype, req, res, callback, require, jsh, modelid, params)

var Helper = require('../Helper.js');
var cms = jsh.Modules['jsHarmonyCMS'];
var dbtypes = jsh.AppSrv.DB.types;

if((routetype != 'model') && (routetype != 'model_child')) return callback();

var model = jsh.getModelClone(req, modelid);
if (!Helper.hasModelAction(req, model, 'B')) return Helper.GenError(req, res, -11, 'Invalid Model Access');

var sftp_url = null;
var sftp_user = null;

jsh.AppSrv.ExecRow(req._DBContext, 'select sys_user_email from jsharmony.sys_user where sys_user_id=@sys_user_id', [dbtypes.BigInt], { sys_user_id: req.user_id }, function (err, rslt) {
  if(err) return Helper.GenError(req, res, -99999, err.toString());
  if(!rslt || !rslt.length || !rslt[0]) return Helper.GenError(req, res, -99999, 'SFTP user not found');

  if(cms.Config.sftp.enabled){
    sftp_url = cms.SFTPServer.getURL((req.headers.host||'').split(':')[0]);
    sftp_user = rslt[0].sys_user_email;
  }
  
  model.oninit = [
    '_this.sftp_url = '+JSON.stringify(sftp_url)+';',
    '_this.sftp_user = '+JSON.stringify(sftp_user)+';',
    model.oninit||'',
  ].join('');
  
  //Save model to local request cache
  req.jshlocal.Models[modelid] = model;
  return callback();

});