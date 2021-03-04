/*
Copyright 2020 apHarmony

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

// Test files must be run from an application with a configured database
// e.g. "mocha node_modules/jsharmony-cms/test --reporter spec"

var assert = require('assert');
var jsHarmonyCMS = require('../jsHarmonyCMS.js');
var DB = require('jsharmony-db');
var async = require('async');
var _ = require('lodash');

describe('Merges', function() {
  var jsh = new jsHarmonyCMS.Application();
  jsh.Config.appbasepath = process.cwd();
  jsh.Config.silentStart = true;
  jsh.Config.interactive = true;
  jsh.Config.onConfigLoaded.push(function(cb){
    jsh.Config.system_settings.automatic_schema = false;
    return cb();
  });

  var dbconfig;
  var db;
  var dbtypes = DB.types;
  var testBaseBranchId = -1;
  var testEditBranchId = -1;


  function assertBranchState(branch_id, state, done) {
    var sql = "select branch_page_action, page_title, page_path from cms.branch_page inner join cms.page on (page.page_id=branch_page.page_id) where branch_id="+branch_id+" and (branch_page_action<>'DELETE' or branch_page_action is null)\
    union\
    select branch_page_action, page_title, page_path from cms.branch_page inner join cms.page on (page.page_id=branch_page.page_orig_id) where branch_id="+branch_id+" and branch_page_action='DELETE'\
    order by page_path;";
    //"select branch_page_action from cms.branch_page where branch_id="+branch_id+" and branch_page_action='DELETE';";
    db.Recordset('', sql, [], {}, function (err, dbrslt, stats) {
      assert.ifError(err);
      try{
        assert.deepStrictEqual(dbrslt, state);
      }
      catch(ex){
        console.log('Found');
        console.log('-----');
        console.log(JSON.stringify(dbrslt,null,4));
        console.log('Expected');
        console.log('--------');
        console.log(JSON.stringify(state,null,4));
        throw(ex);
      }
      done(); 
    });
  }

  function basicBranchSetup(name, done) {
    results = {}
    async.waterfall([
      function(cb){
        jsh.Modules.jsHarmonyCMS.funcs.merge_clone('S1', {branch_parent_id: testBaseBranchId, branch_name: 'Merge Test Data: '+name+' master', new_branch_changes: 'RESET'}, function(err, id, stats) {
          results.master_branch_id = id;
          cb();
        });
      },
      function(cb){
        jsh.Modules.jsHarmonyCMS.funcs.merge_clone('S1', {branch_parent_id: testEditBranchId, branch_name: 'Merge Test Data: '+name+' edit', new_branch_changes: 'COPY'}, function(err, id, stats) {
          results.edit_branch_id = id;
          cb();
        });
      },
      function(cb){
        jsh.Modules.jsHarmonyCMS.funcs.merge_begin_merge('S1', {dst_branch_id: results.master_branch_id, src_branch_id: results.edit_branch_id, merge_type: name.toUpperCase()}, function(err, id, stats) {
          cb();
        });
      },
    ], function(err){
      if(err) console.log(err);
      done(err, results);
    });
  }

  function clearTestData(cb){
    /* Clear previous branchs */
    var sql = "\
    delete from cms.branch_page where branch_id in (select branch_id from cms.branch where branch_name like 'Merge Test Data:%');\
    delete from cms.page where page_path like '/test/:%';\
    delete from cms.branch_media where branch_id in (select branch_id from cms.branch where branch_name like 'Merge Test Data:%');\
    delete from cms.branch_menu where branch_id in (select branch_id from cms.branch where branch_name like 'Merge Test Data:%');\
    delete from cms.branch_redirect where branch_id in (select branch_id from cms.branch where branch_name like 'Merge Test Data:%');\
    delete from cms.branch where branch_name like 'Merge Test Data:%';"
    db.Command('S1', sql, [], {}, function(err, dbrslt, stats) {
      assert.ifError(err);
      cb();
    });
  }

  before(function(done) {
    this.timeout(0);

    jsh.Init(function(){
      var dbid = 'default';
      db = jsh.DB[dbid];

      dbconfig = jsh.DBConfig[dbid];

      if(dbconfig.admin_user){
        dbconfig = _.extend({}, dbconfig);
        dbconfig.user = dbconfig.admin_user;
        dbconfig.password = dbconfig.admin_password;
      }

      async.waterfall([
        clearTestData,
        function(cb){
          console.log('Initializing test data');
          db.RunScripts(jsh, ['jsHarmonyCMS','test_data','merge'], { dbconfig: dbconfig, context: 'S1' }, function(err, rslt){
            if(err){ console.log('Error initializing database'); console.log(err); return; }
            return cb();
          });
        },
        function(cb){
          var sql = "select branch_id from cms.branch where branch_name='Merge Test Data: Base Branch';\
                     select branch_id from cms.branch where branch_name='Merge Test Data: Edit Branch';";
          db.MultiRecordset('', sql, [], {}, function (err, dbrslt, stats) {
            testBaseBranchId = dbrslt[0][0].branch_id;
            testEditBranchId = dbrslt[1][0].branch_id;
            cb(); 
          });
        },
      ], function(err){
        if(err) console.log(err);
        done();
      });
    });
  });

  after(function(done) {
    clearTestData(function(err){
      if(err) console.log(err);
      db.Close();
      done();
    });
  });

  it('database initialized', function(done) {
    var sql = "select count(*) from cms.branch where branch_name='Merge Test Data: Base Branch';";
    db.Scalar('', sql, [], {}, function (err, dbrslt, stats) {
      assert.strictEqual(parseInt(dbrslt), 1, "test branch should exist");
      assert.notStrictEqual(testBaseBranchId, -1, "base branch id should be captured")
      assert.notStrictEqual(testEditBranchId, -1, "edit branch id should be captured")
      done(); 
    });
  });

  describe('Apply', function() {
    var dst_branch_id;
    var src_branch_id;
    before(function(done) {
      basicBranchSetup('apply', function(err, results) {
        dst_branch_id = results.master_branch_id;
        src_branch_id = results.edit_branch_id;
        done();
      });
    });

    it('apply', function(done) {
      jsh.Modules.jsHarmonyCMS.funcs.merge_apply('S1', {dst_branch_id: dst_branch_id, src_branch_id: src_branch_id}, function(err) {
        assert.ifError(err);
        assertBranchState(dst_branch_id, [
          {
            branch_page_action: null,
            page_title: 'Add',
            page_path: '/test/add/index.html',
          },
          {
            branch_page_action: null,
            page_title: 'Untouched',
            page_path: '/test/untouched/index.html',
          },
          {
            branch_page_action: null,
            page_title: 'Update After',
            page_path: '/test/update/index.html',
          },
        ], done);  
      });
    });
  });

  describe('Overwrite', function() {
    var dst_branch_id;
    var src_branch_id;
    before(function(done) {
      basicBranchSetup('overwrite', function(err, results) {
        dst_branch_id = results.master_branch_id;
        src_branch_id = results.edit_branch_id;
        done();
      });
    });

    it('overwrite', function(done) {
      jsh.Modules.jsHarmonyCMS.funcs.merge_overwrite('S1', {dst_branch_id: dst_branch_id, src_branch_id: src_branch_id}, function(err) {
        assert.ifError(err);
        assertBranchState(dst_branch_id, [
          {
            branch_page_action: 'ADD',
            page_title: 'Add',
            page_path: '/test/add/index.html',
          },
          {
            branch_page_action: 'DELETE',
            page_title: 'Delete',
            page_path: '/test/delete/index.html',
          },
          {
            branch_page_action: null,
            page_title: 'Untouched',
            page_path: '/test/untouched/index.html',
          },
          {
            branch_page_action: 'UPDATE',
            page_title: 'Update After',
            page_path: '/test/update/index.html',
          },
        ], done);  
      });
    });
  });

  describe('Changes', function() {
    var dst_branch_id;
    var src_branch_id;
    before(function(done) {
      basicBranchSetup('changes', function(err, results) {
        dst_branch_id = results.master_branch_id;
        src_branch_id = results.edit_branch_id;
        done();
      });
    });

    it('changes', function(done) {
      jsh.Modules.jsHarmonyCMS.funcs.merge_changes('S1', {dst_branch_id: dst_branch_id, src_branch_id: src_branch_id}, function(err) {
        assert.ifError(err);
        assertBranchState(dst_branch_id, [
          {
            branch_page_action: 'ADD',
            page_title: 'Add',
            page_path: '/test/add/index.html',
          },
          {
            branch_page_action: 'DELETE',
            page_title: 'Delete',
            page_path: '/test/delete/index.html',
          },
          {
            branch_page_action: null,
            page_title: 'Untouched',
            page_path: '/test/untouched/index.html',
          },
          {
            branch_page_action: 'UPDATE',
            page_title: 'Update After',
            page_path: '/test/update/index.html',
          },
        ], done);  
      });
    });
  });

  describe('Rebase', function() {
    var dst_branch_id;
    var src_branch_id;
    before(function(done) {
      basicBranchSetup('rebase', function(err, results) {
        dst_branch_id = results.edit_branch_id;
        src_branch_id = results.master_branch_id;
        done();
      });
    });

    it('rebase', function(done) {
      jsh.Modules.jsHarmonyCMS.funcs.merge_rebase('S1', {dst_branch_id: dst_branch_id, src_branch_id: src_branch_id}, function(err) {
        assert.ifError(err);
        assertBranchState(dst_branch_id, [
          {
            branch_page_action: 'ADD',
            page_title: 'Add',
            page_path: '/test/add/index.html',
          },
          {
            branch_page_action: 'DELETE',
            page_title: 'Delete',
            page_path: '/test/delete/index.html',
          },
          {
            branch_page_action: null,
            page_title: 'Untouched',
            page_path: '/test/untouched/index.html',
          },
          {
            branch_page_action: 'UPDATE',
            page_title: 'Update After',
            page_path: '/test/update/index.html',
          },
        ], done);  
      });
    });
  });
});