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

// Test files must be run from an application with a configured database
// e.g. "mocha node_modules/jsharmony-cms/test --reporter spec"

var assert = require('assert');
var jsHarmonyCMS = require('../jsHarmonyCMS.js');
var DB = require('jsharmony-db');
var async = require('async');
var _ = require('lodash');
var fs = require('fs');

describe('Branch Archive', function() {
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

  function basicBranchSetup(name, done) {
    results = {}
    async.waterfall([
      function(cb){
        jsh.Modules.jsHarmonyCMS.funcs.merge_clone('S1', {branch_parent_id: testBaseBranchId, branch_name: 'Archive Test Data: '+name, new_branch_changes: 'COPY'}, function(err, id, stats) {
          results.branch_id = id[0];
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
    delete from cms.branch_page where branch_id in (select branch_id from cms.branch where branch_name like 'Archive Test Data:%');\
    delete from cms.page where page_path like '/archive/%';\
    delete from cms.branch_media where branch_id in (select branch_id from cms.branch where branch_name like 'Archive Test Data:%');\
    delete from cms.branch_menu where branch_id in (select branch_id from cms.branch where branch_name like 'Archive Test Data:%');\
    delete from cms.branch_redirect where branch_id in (select branch_id from cms.branch where branch_name like 'Archive Test Data:%');\
    delete from cms.branch where branch_name like 'Archive Test Data:%';"
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
          db.RunScripts(jsh, ['jsHarmonyCMS','test_data','archive'], { dbconfig: dbconfig, context: 'S1' }, function(err, rslt){
            if(err){ console.log('Error initializing database'); console.log(err); return; }
            return cb();
          });
        },
        function(cb){
          var sql = "select branch_id from cms.branch where branch_name='Archive Test Data: Base Branch';\
                     select branch_id from cms.branch where branch_name='Archive Test Data: Edit Branch';";
          db.MultiRecordset('', sql, [], {}, function (err, dbrslt, stats) {
            testBaseBranchId = dbrslt[1][0].branch_id;
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
    var sql = "select count(*) from cms.branch where branch_name='Archive Test Data: Base Branch';";
    db.Scalar('', sql, [], {}, function (err, dbrslt, stats) {
      assert.strictEqual(parseInt(dbrslt), 1, "test branch should exist");
      assert.notStrictEqual(testBaseBranchId, -1, "base branch id should be captured")
      done(); 
    });
  });

  describe('branch_indexToFile', function() {
    var branch_id;
    before(function(done) {
      basicBranchSetup('branch_indexToFile', function(err, results) {
        branch_id = results.branch_id;
        jsh.Modules.jsHarmonyCMS.funcs.branch_indexToFile('S1', branch_id, done);
      });
    });

    after(function(done) {
      fs.unlink('data/branch/' + branch_id + '.json', function(err) {done();});
    });

    it('writes a file', function(done) {
      fs.access('data/branch/' + branch_id + '.json', fs.constants.F_OK, done);
    });

    describe('file contents', function() {
      var json;
      before(function(done) {
        fs.readFile('data/branch/' + branch_id + '.json', function(err, data) {
          assert.ifError(err);
          json = JSON.parse(data);
          done();
        });
      });

      it('file has json', function() {
        assert(json && json.page);
      });

      it('has page fields', function() {
        var page = json.page[0];
        var fields = [
          'branch_page_id',
          'page_key',
          'page_id',
          'branch_page_action',
          'page_orig_id',
          'branch_page_etstmp',
          'branch_page_euser',
          'branch_page_mtstmp',
          'branch_page_muser',
        ];
        _.forEach(fields, function(field) {
          assert.notStrictEqual(page[field], undefined, 'has a '+field);
        });
      });
    });

    it('removes the records', function(done) {
      var sql_ptypes = [dbtypes.BigInt];
      var sql_params = {branch_id: branch_id};
      var sql = "select count(*) from cms.branch_page where branch_id=@branch_id;";
      db.Scalar('', sql, sql_ptypes, sql_params, function (err, dbrslt, stats) {
        assert.strictEqual(parseInt(dbrslt), 0, "branch pages should have been removed");
        done(); 
      });
    });

    it('does not remove the base page', function(done) {
      var sql = "select count(*) from cms.page where page_path='/archive/untouched/index.html';"
      db.Scalar('', sql, [], {}, function (err, dbrslt, stats) {
        assert.strictEqual(parseInt(dbrslt), 1, "pages should not have been removed");
        done(); 
      });
    });

    it('branch is no longer resident (cached)', function(done) {
      jsh.Modules.jsHarmonyCMS.funcs.branch_isDbResident('S1', branch_id, function(err, resident) {
        assert.ifError(err);
        assert.strictEqual(resident, false);
        done();
      });
    });

    it('branch is no longer resident (uncached)', function(done) {
      jsh.Modules.jsHarmonyCMS.funcs.branch_reallyCheckIsDbResident('S1', branch_id, function(err, resident) {
        assert.ifError(err);
        assert.strictEqual(resident, false);
        done();
      });
    });
  });

  describe('branch_indexFromFile', function() {
    var branch_id;
    var pages;
    before(function(done) {
      basicBranchSetup('branch_indexFromFile', function(err, results) {
        assert.ifError(err);
        branch_id = results.branch_id;
        jsh.Modules.jsHarmonyCMS.funcs.branch_indexToFile('S1', branch_id, function(err2) {
          assert.ifError(err2);
          jsh.Modules.jsHarmonyCMS.funcs.branch_indexFromFile('S1', branch_id, function(err3) {
            assert.ifError(err3);
            var sql_ptypes = [dbtypes.BigInt];
            var sql_params = {branch_id: branch_id};
            var sql = "select * from cms.branch_page where branch_id=@branch_id;";
            db.Recordset('', sql, sql_ptypes, sql_params, function (err, dbrslt, stats) {
              pages = dbrslt;
              done(); 
            });
          });
        });
      });
    });

    after(function(done) {
      fs.unlink('data/branch/' + branch_id + '.json', function(err) {done();});
    });

    it('removes the file', function(done) {
      fs.access('data/branch/' + branch_id + '.json', fs.constants.F_OK, function(err) {
        assert.equal(err && err.code, 'ENOENT', 'should have removed the file');
        done();
      });
    });

    it('restores four records', function() {
      assert.strictEqual(pages.length, 4, 'pages shold have been restored');
    });

    it('has page fields', function() {
      var page = pages[1];
      var fields = [
        'branch_id',
        'branch_page_id',
        'page_key',
        'page_id',
        'branch_page_action',
        'page_orig_id',
        'branch_page_etstmp',
        'branch_page_euser',
        'branch_page_mtstmp',
        'branch_page_muser',
      ];
      _.forEach(fields, function(field) {
        assert.notStrictEqual(page[field], undefined, 'has a '+field);
      });
    });

    it('branch is resident (cached)', function(done) {
      jsh.Modules.jsHarmonyCMS.funcs.branch_isDbResident('S1', branch_id, function(err, resident) {
        assert.ifError(err);
        assert.strictEqual(resident, true);
        done();
      });
    });

    it('branch is resident (uncached)', function(done) {
      jsh.Modules.jsHarmonyCMS.funcs.branch_reallyCheckIsDbResident('S1', branch_id, function(err, resident) {
        assert.ifError(err);
        assert.strictEqual(resident, true);
        done();
      });
    });
  });

  describe('branch_acquireBranchLock', function() {
    var branch_id;
    var other_branch_id;
    before(function(done) {
      basicBranchSetup('branch_acquireBranchLock1', function(err, results) {
        branch_id = results.branch_id;
        basicBranchSetup('branch_acquireBranchLock2', function(err, results) {
          other_branch_id = results.branch_id;
          done();
        });
      });
    });

    it('acquire and release', function(done) {
      async.waterfall([
        function(cb) {
          jsh.Modules.jsHarmonyCMS.funcs.branch_acquireBranchLock('S1', branch_id, cb);
        },
        function(lock, cb) {
          lock.release(cb);
        },
      ], done);
    });

    it('reacquire', function(done) {
      async.waterfall([
        function(cb) {
          jsh.Modules.jsHarmonyCMS.funcs.branch_acquireBranchLock('S1', branch_id, cb);
        },
        function(lock, cb) {
          lock.release(cb);
        },
        function(cb) {
          jsh.Modules.jsHarmonyCMS.funcs.branch_acquireBranchLock('S1', branch_id, cb);
        },
        function(lock, cb) {
          lock.release(cb);
        },
      ], done);
    });

    it('different branches', function(done) {
      async.waterfall([
        function(cb) {
          jsh.Modules.jsHarmonyCMS.funcs.branch_acquireBranchLock('S1', branch_id, cb);
        },
        function(lock1, cb) {
          jsh.Modules.jsHarmonyCMS.funcs.branch_acquireBranchLock('S1', other_branch_id, function(err, lock2) {
            cb(err, lock1, lock2);
          });
        },
        function(lock1, lock2, cb) {
          lock1.release(function(err) {
            assert.ifError(err);
            lock2.release(cb);
          });
        },
      ], done);
    });

    it('locks the same branch', function(done) {
      var secondCallbackRun = false;
      var lock1 = null;
      async.waterfall([
        function(cb) {
          jsh.Modules.jsHarmonyCMS.funcs.branch_acquireBranchLock('S1', branch_id, cb);
        },
        function(lock, cb) {
          lock1 = lock;
          jsh.Modules.jsHarmonyCMS.funcs.branch_acquireBranchLock('S1', branch_id, function(err, lock2) {
            secondCallbackRun = true;
            lock2.release();
          });
          setTimeout(cb, 10);
        },
        function(cb) {
          assert(!secondCallbackRun, 'second lock should have been blocked');
          lock1.release(cb);
          lock1 = null;
        },
        function(cb) {
          setTimeout(cb, 10);
        },
        function(cb) {
          assert(secondCallbackRun, 'second lock should have released');
          cb();
        },
      ], done);
    });
  });
});