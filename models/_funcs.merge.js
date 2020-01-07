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
  
  exports.req_merge = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};

    var Q = req.query;
    var P = {};
    if (req.body && ('data' in req.body)){
      try{ P = JSON.parse(req.body.data); }
      catch(ex){ Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
    }
    var appsrv = this;
    var jsh = module.jsh;
    var XValidate = jsh.XValidate;

    var model = jsh.getModel(req, module.namespace + 'Branch_Review');

    // error codes: jsharmony errors document
    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    if (verb == 'post') {
      var src_branch_id = req.body.src_branch_id;
      var dst_branch_id = req.body.dst_branch_id;
      var merge_type = req.params.merge_type;

      if (merge_types.indexOf(merge_type) == -1) { Helper.GenError(req, res, -4, 'Merge Type Not Supported'); return; }

      //Check if Asset is defined
      var sql_params = {'src_branch_id': src_branch_id, 'dst_branch_id': dst_branch_id };
      var validate = new XValidate();
      var verrors = {};
      validate.AddValidator('_obj.src_branch_id', 'Source Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      validate.AddValidator('_obj.dst_branch_id', 'Destination Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      // look at ParamCheck

      verrors = _.merge(verrors, validate.Validate('B', sql_params));
      if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

      exports[merge_type](req._DBContext, sql_params, function(err) {
        if (err != null) { appsrv.AppDBError(req, res, err); return; }
        res.end(JSON.stringify({
          '_success': 1,
        }));
      });
    }
    else {
      return next();
    }
  }

  var objects = [
    'menu',
    'page',
    'media',
    'redirect',
  ];

  var expand = function(sqls) {
    return sqls.flatMap(function(line) {
      return objects.map(function(object) {
        return Helper.ReplaceAll(line, '%%%OBJECT%%%', object);
      });
    });
  }

  var merge_types = [
    'apply',
    'overwrite',
    'changes',
    'rebase',
  ];

  var overwrite_sql = expand([
    // not in source branch
    "delete from {schema}.branch_%%%OBJECT%%% where branch_id=@dst_branch_id and %%%OBJECT%%%_key not in (select %%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id);",

    // in source but marked as delete (no page id)
    "delete from {schema}.branch_%%%OBJECT%%% where branch_id=@dst_branch_id and %%%OBJECT%%%_key in (select %%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id and branch_%%%OBJECT%%%_action='DELETE');",

    "update {schema}.branch_%%%OBJECT%%% set %%%OBJECT%%%_id=(select %%%OBJECT%%%_id from (select %%%OBJECT%%%_id,%%%OBJECT%%%_key src_%%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id) tbl where src_%%%OBJECT%%%_key=%%%OBJECT%%%_key) where branch_id=@dst_branch_id and %%%OBJECT%%%_key in (select %%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id);",

    "insert into {schema}.branch_%%%OBJECT%%%(branch_id, %%%OBJECT%%%_key, %%%OBJECT%%%_id, %%%OBJECT%%%_orig_id) select @dst_branch_id, %%%OBJECT%%%_key, %%%OBJECT%%%_id, %%%OBJECT%%%_id from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id and branch_%%%OBJECT%%%_action not in ('DELETE') and %%%OBJECT%%%_key not in (select %%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@dst_branch_id);",
  ]);

  var apply_sql = expand([
    // fill in all the merge columns so we don't have to duplicate every other statement to deal with conflict/non-conflict
    "update {schema}.branch_%%%OBJECT%%%\
    set\
      %%%OBJECT%%%_merge_id=\
        (select %%%OBJECT%%%_id\
          from\
            (select %%%OBJECT%%%_id,%%%OBJECT%%%_key src_%%%OBJECT%%%_key\
              from {schema}.branch_%%%OBJECT%%%\
              where branch_id=@src_branch_id\
            ) tbl\
          where src_%%%OBJECT%%%_key=%%%OBJECT%%%_key\
        ),\
      branch_%%%OBJECT%%%_merge_action=\
        (select branch_%%%OBJECT%%%_action\
          from\
            (select branch_%%%OBJECT%%%_action,%%%OBJECT%%%_key src_%%%OBJECT%%%_key\
              from {schema}.branch_%%%OBJECT%%%\
              where branch_id=@src_branch_id\
            ) tbl\
          where src_%%%OBJECT%%%_key=%%%OBJECT%%%_key\
        )\
    where branch_id=@dst_branch_id\
      and %%%OBJECT%%%_merge_id is null\
      and branch_%%%OBJECT%%%_merge_action is null\
      and %%%OBJECT%%%_key in\
        (select %%%OBJECT%%%_key\
          from {schema}.branch_%%%OBJECT%%%\
          where branch_id=@src_branch_id\
            and (branch_%%%OBJECT%%%_action is not null)\
        );",

    "delete from {schema}.branch_%%%OBJECT%%% where branch_id=@dst_branch_id and branch_%%%OBJECT%%%_merge_action='DELETE';",

    "update {schema}.branch_%%%OBJECT%%% set %%%OBJECT%%%_id=%%%OBJECT%%%_merge_id where branch_id=@dst_branch_id and branch_%%%OBJECT%%%_merge_action='ADD' or branch_%%%OBJECT%%%_merge_action='UPDATE';",

    "insert into {schema}.branch_%%%OBJECT%%%(branch_id, %%%OBJECT%%%_key, %%%OBJECT%%%_id, %%%OBJECT%%%_orig_id) select @dst_branch_id, %%%OBJECT%%%_key, %%%OBJECT%%%_id, %%%OBJECT%%%_id from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id and (branch_%%%OBJECT%%%_action='ADD' or branch_%%%OBJECT%%%_action='UPDATE') and %%%OBJECT%%%_key not in (select %%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@dst_branch_id);",
  ]);

  var changes_sql = expand([
    "insert into {schema}.branch_%%%OBJECT%%%(branch_id, %%%OBJECT%%%_key, %%%OBJECT%%%_id, %%%OBJECT%%%_orig_id, branch_%%%OBJECT%%%_action) select @dst_branch_id, %%%OBJECT%%%_key, %%%OBJECT%%%_id, %%%OBJECT%%%_orig_id, branch_%%%OBJECT%%%_action from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id and (branch_%%%OBJECT%%%_action='ADD' or branch_%%%OBJECT%%%_action='UPDATE' or branch_%%%OBJECT%%%_action='DELETE') and %%%OBJECT%%%_key not in (select %%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@dst_branch_id);",

    // UPDATE/DELETE: use src branch
    "update {schema}.branch_%%%OBJECT%%% set %%%OBJECT%%%_id=(select %%%OBJECT%%%_id from (select %%%OBJECT%%%_id,%%%OBJECT%%%_key src_%%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id) tbl where src_%%%OBJECT%%%_key=%%%OBJECT%%%_key), branch_%%%OBJECT%%%_action=(select branch_%%%OBJECT%%%_action from (select branch_%%%OBJECT%%%_action,%%%OBJECT%%%_key src_%%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id) tbl where src_%%%OBJECT%%%_key=%%%OBJECT%%%_key), %%%OBJECT%%%_orig_id=(select %%%OBJECT%%%_orig_id from (select %%%OBJECT%%%_orig_id,%%%OBJECT%%%_key src_%%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id) tbl where src_%%%OBJECT%%%_key=%%%OBJECT%%%_key) where branch_id=@dst_branch_id and %%%OBJECT%%%_key in (select %%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id and (branch_%%%OBJECT%%%_action='DELETE' or branch_%%%OBJECT%%%_action='UPDATE'));",

    // ADD on UPDATE/DELETE: UPDATE with dst orig
    "update {schema}.branch_%%%OBJECT%%% set %%%OBJECT%%%_id=(select %%%OBJECT%%%_id from (select %%%OBJECT%%%_id,%%%OBJECT%%%_key src_%%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id) tbl where src_%%%OBJECT%%%_key=%%%OBJECT%%%_key), branch_%%%OBJECT%%%_action='UPDATE' where branch_id=@dst_branch_id and (branch_%%%OBJECT%%%_action='DELETE' or branch_%%%OBJECT%%%_action='UPDATE') and %%%OBJECT%%%_key in (select %%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id and (branch_%%%OBJECT%%%_action='ADD'));",

    // ADD on noop/ADD: ADD src
    "update {schema}.branch_%%%OBJECT%%% set %%%OBJECT%%%_id=(select %%%OBJECT%%%_id from (select %%%OBJECT%%%_id,%%%OBJECT%%%_key src_%%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id) tbl where src_%%%OBJECT%%%_key=%%%OBJECT%%%_key), branch_%%%OBJECT%%%_action='ADD' where branch_id=@dst_branch_id and (branch_%%%OBJECT%%%_action='ADD' or branch_%%%OBJECT%%%_action is null) and %%%OBJECT%%%_key in (select %%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id and (branch_%%%OBJECT%%%_action='ADD'));",
  ]);

  var rebase_sql = expand([
    // edit branch is the one being changed, so just copy merge conflict over to edit columns and continue as normal
    "update {schema}.branch_%%%OBJECT%%%\
    set\
      %%%OBJECT%%%_id=%%%OBJECT%%%_merge_id,\
      branch_%%%OBJECT%%%_action=branch_%%%OBJECT%%%_merge_action\
    where branch_id=@dst_branch_id\
      and (%%%OBJECT%%%_merge_id is not null\
        or branch_%%%OBJECT%%%_merge_action is not null);",

    // unmodified/deleted items missing new base
    "delete from {schema}.branch_%%%OBJECT%%% where branch_id=@dst_branch_id and (branch_%%%OBJECT%%%_action is null or branch_%%%OBJECT%%%_action='DELETE') and %%%OBJECT%%%_key not in (select %%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id);",

    // UPDATE, missing in new base - turn into ADD
    "update {schema}.branch_%%%OBJECT%%% set %%%OBJECT%%%_orig_id=null, branch_%%%OBJECT%%%_action='ADD' where branch_id=@dst_branch_id and branch_%%%OBJECT%%%_action='UPDATE' and  %%%OBJECT%%%_key not in (select %%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id);",

    // unmodified items from new base
    "update {schema}.branch_%%%OBJECT%%% set %%%OBJECT%%%_id=(select %%%OBJECT%%%_id from (select %%%OBJECT%%%_id,%%%OBJECT%%%_key src_%%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id) tbl where src_%%%OBJECT%%%_key=%%%OBJECT%%%_key) where branch_id=@dst_branch_id and branch_%%%OBJECT%%%_action is null and %%%OBJECT%%%_key in (select %%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id);",

    // ADD, exists on base - turn into UPDATE
    "update {schema}.branch_%%%OBJECT%%% set %%%OBJECT%%%_orig_id=(select %%%OBJECT%%%_id from (select %%%OBJECT%%%_id,%%%OBJECT%%%_key src_%%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id) tbl where src_%%%OBJECT%%%_key=%%%OBJECT%%%_key), branch_%%%OBJECT%%%_action='UPDATE' where branch_id=@dst_branch_id and branch_%%%OBJECT%%%_action='ADD' and %%%OBJECT%%%_key in (select %%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id);",

    // UPDATE/DELETE: update orig id
    "update {schema}.branch_%%%OBJECT%%% set %%%OBJECT%%%_orig_id=(select %%%OBJECT%%%_id from (select %%%OBJECT%%%_id,%%%OBJECT%%%_key src_%%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id) tbl where src_%%%OBJECT%%%_key=%%%OBJECT%%%_key) where branch_id=@dst_branch_id and (branch_%%%OBJECT%%%_action='DELETE' or branch_%%%OBJECT%%%_action='UPDATE') and %%%OBJECT%%%_key in (select %%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id);",

    // new items from base
    "insert into {schema}.branch_%%%OBJECT%%% (branch_id, %%%OBJECT%%%_key, %%%OBJECT%%%_id, %%%OBJECT%%%_orig_id) select @dst_branch_id, %%%OBJECT%%%_key, %%%OBJECT%%%_id, %%%OBJECT%%%_id from {schema}.branch_%%%OBJECT%%% where branch_id=@src_branch_id and %%%OBJECT%%%_key not in (select %%%OBJECT%%%_key from {schema}.branch_%%%OBJECT%%% where branch_id=@dst_branch_id);",
  ]);

  var archive_sql = [
    "update {schema}.branch set branch_sts='ARCHIVE',branch_review_sts='APPROVED' where branch_id=@src_branch_id;",
    "update {schema}.branch set branch_merge_id=null where branch_id=@dst_branch_id;",
  ];

  var merge = function(sql, context, sql_params, callback) {
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var sql_ptypes = [dbtypes.BigInt, dbtypes.BigInt];

    var sql = sql.join('\n');
    sql = sql + archive_sql.join('\n');
    sql = Helper.ReplaceAll(sql,'{schema}.', module.schema?module.schema+'.':'');
    appsrv.ExecCommand(context, sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; callback(err); return; }
      callback(null);
    });
  }

  exports.apply = function (context, sql_params, callback) {
    merge(apply_sql, context, sql_params, callback);
  }

  exports.overwrite = function (context, sql_params, callback) {
    merge(overwrite_sql, context, sql_params, callback);
  }

  exports.changes = function (context, sql_params, callback) {
    merge(changes_sql, context, sql_params, callback);
  }

  exports.rebase = function (context, sql_params, callback) {
    merge(rebase_sql, context, sql_params, callback);
  }

  var clone_sql = [
    "insert into {schema}.v_my_current_branch(branch_parent_id, branch_type, branch_name, new_branch_changes) values(@branch_parent_id, 'USER', @branch_name, @new_branch_changes);",
    "select new_branch_id from {schema}.v_my_current_branch;"
  ];

  exports.clone = function(context, sql_params, callback) {
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var sql_ptypes = [dbtypes.BigInt, dbtypes.VarChar(256), dbtypes.VarChar(8)];

    var sql = clone_sql.join('\n');
    sql = Helper.ReplaceAll(sql,'{schema}.', module.schema?module.schema+'.':'');
    appsrv.ExecScalar(context, sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; callback(err); return; }
      callback(null, rslt);
    });
  }

  exports.req_begin_merge = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};

    var Q = req.query;
    var P = {};
    if (req.body && ('data' in req.body)){
      try{ P = JSON.parse(req.body.data); }
      catch(ex){ Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
    }
    var appsrv = this;
    var jsh = module.jsh;
    var XValidate = jsh.XValidate;

    var model = jsh.getModel(req, module.namespace + 'Branch_Review');

    // error codes: jsharmony errors document
    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    if (verb == 'post') {
      var src_branch_id = req.body.src_branch_id;
      var dst_branch_id = req.body.dst_branch_id;

      //Check if Asset is defined
      var sql_params = {'src_branch_id': src_branch_id, 'dst_branch_id': dst_branch_id };
      var validate = new XValidate();
      var verrors = {};
      validate.AddValidator('_obj.src_branch_id', 'Source Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      validate.AddValidator('_obj.dst_branch_id', 'Destination Branch ID', 'B', [XValidate._v_IsNumeric(), XValidate._v_Required()]);
      // look at ParamCheck

      verrors = _.merge(verrors, validate.Validate('B', sql_params));
      if (!_.isEmpty(verrors)) { Helper.GenError(req, res, -2, verrors[''].join('\n')); return; }

      exports.begin_merge(req._DBContext, sql_params, function(err) {
        if (err != null) { appsrv.AppDBError(req, res, err); return; }
        res.end(JSON.stringify({
          '_success': 1,
        }));
      });
    }
    else {
      return next();
    }
  }

  var begin_merge_sql = [
    "update {schema}.branch set branch_merge_id=@src_branch_id where branch_id=@dst_branch_id and branch_merge_id is null;",
    "select branch_merge_id from {schema}.branch where branch_id=@dst_branch_id",
  ];

  exports.begin_merge = function(context, sql_params, callback) {
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;
    var sql_ptypes = [dbtypes.BigInt, dbtypes.BigInt];

    var sql = begin_merge_sql.join('\n');
    sql = Helper.ReplaceAll(sql,'{schema}.', module.schema?module.schema+'.':'');
    appsrv.ExecScalar(context, sql, sql_ptypes, sql_params, function (err, rslt) {
      if (err != null) { err.sql = sql; callback(err); return; }
      if (rslt[0] != sql_params.src_branch_id) { callback(	Helper.NewError('Branch already has an in-progress merge',-9)); return; }
      callback(null);
    });
  }

  return exports;
};