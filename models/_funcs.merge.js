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
var Helper = require('jsharmony/Helper');
var _ = require('lodash');
var async = require('async');

module.exports = exports = function(module, funcs){
  var exports = {};

  var MERGE_TYPES = [
    'apply',
    'overwrite',
    'changes',
    'rebase',
  ];
 
  exports.req_merge = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};

    var B = req.body;
    var P = req.params;
    var appsrv = this;
    var jsh = module.jsh;
    var XValidate = jsh.XValidate;

    if (verb == 'post') {
      //Validate parameters
      if (!appsrv.ParamCheck('P', P, ['&merge_type'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
      if (!appsrv.ParamCheck('B', B, ['&dst_branch_id','&src_branch_id'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

      var src_branch_id = B.src_branch_id;
      var dst_branch_id = B.dst_branch_id;
      var merge_type = P.merge_type;

      // error codes: jsharmony errors document
      if (MERGE_TYPES.indexOf(merge_type) == -1) { Helper.GenError(req, res, -4, 'Merge Type Not Supported'); return; }

      //Check if Asset is defined
      var sql_params = {'src_branch_id': src_branch_id, 'dst_branch_id': dst_branch_id };
      var validate = new XValidate();
      var verrors = {};
      validate.AddValidator('_obj.src_branch_id', 'Source Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      validate.AddValidator('_obj.dst_branch_id', 'Destination Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);

      verrors = _.merge(verrors, validate.Validate('B', sql_params));
      if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

      funcs.merge_check_permissions(req._DBContext, sql_params, function(accessErr) {
        if (accessErr != null) { appsrv.AppDBError(req, res, accessErr); return; }
        exports['merge_'+merge_type](req._DBContext, sql_params, function(err) {
          if (err != null) { appsrv.AppDBError(req, res, err); return; }
          res.end(JSON.stringify({
            '_success': 1,
          }));
        });
      });
    }
    else {
      return next();
    }
  }

  var expand = function(sqls) {
    var cms = module;

    return sqls;
  }

  var merge_sql_overwrite = expand([
    "{schema}.merge_overwrite(@src_branch_id, @dst_branch_id);",
  ]);

  var merge_sql_apply = expand([
    "{schema}.merge_apply(@src_branch_id, @dst_branch_id);",
  ]);

  var merge_sql_changes = expand([
    "{schema}.merge_changes(@src_branch_id, @dst_branch_id);",
  ]);

  var merge_sql_rebase = expand([
    "{schema}.merge_rebase(@src_branch_id, @dst_branch_id);",
  ]);

  var merge_sql_cleanup = expand([
    "{schema}.merge_clear_edit_on_public(@dst_branch_id);",
    "update {schema}.branch set branch_merge_id=null, branch_merge_type=null where branch_id=@dst_branch_id;",
  ]);

  var merge = function(sql, context, sql_params, callback) {
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var sql_ptypes = [dbtypes.BigInt, dbtypes.BigInt];

    var sql = sql.join('\n');
    sql = sql + merge_sql_cleanup.join('\n');
    sql = Helper.ReplaceAll(sql,'{schema}.', module.schema?module.schema+'.':'');
    appsrv.ExecCommand(context, sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; callback(err); return; }
      callback(null);
    });
  }

  exports.merge_apply = function (context, sql_params, callback) {
    merge(merge_sql_apply, context, sql_params, callback);
  }

  exports.merge_overwrite = function (context, sql_params, callback) {
    merge(merge_sql_overwrite, context, sql_params, callback);
  }

  exports.merge_changes = function (context, sql_params, callback) {
    merge(merge_sql_changes, context, sql_params, callback);
  }

  exports.merge_rebase = function (context, sql_params, callback) {
    merge(merge_sql_rebase, context, sql_params, callback);
  }

  var merge_sql_clone = [
    "insert into {schema}.v_my_current_branch(branch_parent_id, branch_type, branch_name, new_branch_changes) values(@branch_parent_id, 'USER', @branch_name, @new_branch_changes);",
    "select new_branch_id from {schema}.v_my_current_branch;"
  ];

  exports.merge_clone = function(context, sql_params, callback) {
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var sql_ptypes = [dbtypes.BigInt, dbtypes.VarChar(256), dbtypes.VarChar(8)];

    var sql = merge_sql_clone.join('\n');
    sql = Helper.ReplaceAll(sql,'{schema}.', module.schema?module.schema+'.':'');
    appsrv.ExecScalar(context, sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; callback(err); return; }
      callback(null, rslt);
    });
  }

  exports.req_begin_merge = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};

    var B = req.body;
    var appsrv = this;
    var jsh = module.jsh;
    var XValidate = jsh.XValidate;

    if (verb == 'post') {
      if (!appsrv.ParamCheck('B', B, ['&dst_branch_id','&src_branch_id','&merge_type'])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

      var src_branch_id = B.src_branch_id;
      var dst_branch_id = B.dst_branch_id;
      var merge_type = B.merge_type;

      //Check if Asset is defined
      var sql_check_params = {'src_branch_id': src_branch_id, 'dst_branch_id': dst_branch_id };
      var sql_begin_params = {'src_branch_id': src_branch_id, 'dst_branch_id': dst_branch_id, 'merge_type': merge_type.toUpperCase() };
      var validate = new XValidate();
      var verrors = {};
      validate.AddValidator('_obj.src_branch_id', 'Source Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      validate.AddValidator('_obj.dst_branch_id', 'Destination Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      validate.AddValidator('_obj.merge_type', 'Merge Type', 'B', [XValidate._v_InArray(MERGE_TYPES.map(function(s) {return s.toUpperCase()})), XValidate._v_Required()]);

      verrors = _.merge(verrors, validate.Validate('B', sql_begin_params));
      if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

      funcs.merge_check_permissions(req._DBContext, sql_check_params, function(accessErr) {
        if (accessErr != null) { appsrv.AppDBError(req, res, accessErr); return; }
        funcs.merge_begin_merge(req._DBContext, sql_begin_params, function(err) {
          if (err != null) { appsrv.AppDBError(req, res, err); return; }
          res.end(JSON.stringify({
            '_success': 1,
          }));
        });
      });
    }
    else {
      return next();
    }
  }

  var merge_sql_begin_merge = "update {schema}.branch set branch_merge_id=@src_branch_id, branch_merge_type=@merge_type where branch_id=@dst_branch_id and branch_merge_id is null and (branch_id in (select branch_id from {schema}.v_my_branch_access where branch_access='RW'));";
  var merge_sql_check_merge = "select branch_merge_id from {schema}.branch where branch_id=@dst_branch_id;";

  exports.merge_begin_merge = function(context, sql_params, callback) {
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var sql_ptypes = [dbtypes.BigInt, dbtypes.BigInt, dbtypes.VarChar(9)];

    sql = merge_sql_check_merge;
    sql = Helper.ReplaceAll(sql,'{schema}.', module.schema?module.schema+'.':'');
    appsrv.ExecScalar(context, sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; callback(err); return; }
      if (rslt[0]) { callback( Helper.NewError('Branch already has an in-progress merge',-9)); return; }
      sql = merge_sql_begin_merge;
      sql = Helper.ReplaceAll(sql,'{schema}.', module.schema?module.schema+'.':'');
      appsrv.ExecCommand(context, sql, sql_ptypes, sql_params, function (err, rslt) {
        if (err != null) { err.sql = sql; callback(err); return; }
        callback(null);
      });
    });
  }

  exports.merge_check_permissions = function(context, sql_params, callback) {
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var sql_ptypes = [dbtypes.BigInt, dbtypes.BigInt];

    var sql = "select branch_id from {schema}.v_my_branch_access where (branch_id=@dst_branch_id and branch_access='RW') or (branch_id=@src_branch_id and branch_access like 'R%');"
    sql = Helper.ReplaceAll(sql,'{schema}.', module.schema?module.schema+'.':'');
    appsrv.ExecRecordset(context, sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; callback(err); return; }
      if (rslt[0].length!=2) { callback( Helper.NewError('You dont have access to those branches (or they dont exist)',-11)); return; }
      callback(null);
    });
  }

  return exports;
};