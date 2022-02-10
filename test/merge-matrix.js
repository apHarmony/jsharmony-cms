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
var path = require('path');
var fs = require('fs');


// -------------------- merge result assertions -----------------
// D - values from destination
// S - values from source
// Si - current id of source
// So - orig id of source
// XY - id from X (S/D), orig id from Y

var notExist = function(s, d) {
  return null;
};

// all properties same as source
var src = function(s, d) {
  if (!s) return s;
  return {
    id: s.id,
    orig_id: s.orig_id,
    action: s.action,
  };
};

// all properties same as destiation
var dst = function(s, d) {
  if (!d) return d;
  return {
    id: d.id,
    orig_id: d.orig_id,
    action: d.action,
  };
};

// update id with value from source
var srcId = function(s, d) {
  return {
    id: s.id,
    orig_id: d.orig_id,
    action: d.action,
  };
};

// no action, with source id
var noneS = function(s, d) {
  return {
    id: s.id,
    orig_id: s.id,
    action: null,
  };
};

var addS = function(s, d) {
  return {
    id: s.id,
    orig_id: null,
    action: 'ADD',
  };
};

var addD = function(s, d) {
  return {
    id: d.id,
    orig_id: null,
    action: 'ADD',
  };
};

var updateSD = function(s, d) {
  return {
    id: s.id,
    orig_id: d.orig_id,
    action: 'UPDATE',
  };
};

var updateSS = function(s, d) {
  return {
    id: s.id,
    orig_id: s.orig_id,
    action: 'UPDATE',
  };
};

var updateDS = function(s, d) {
  return {
    id: d.id,
    orig_id: s.id,
    action: 'UPDATE',
  };
};

var deleteD = function(s, d) {
  return {
    id: null,
    orig_id: d.orig_id,
    action: 'DELETE',
  };
};

var deleteSi = function(s, d) {
  return {
    id: null,
    orig_id: s.id,
    action: 'DELETE',
  };
};

var deleteSo = function(s, d) {
  return {
    id: null,
    orig_id: s.orig_id,
    action: 'DELETE',
  };
};

var setupMissing = function(id, orig_id) {
  return null;
};
setupMissing.label = 'missing';

var setupUnchanged = function(id, orig_id) {
  return {
    id: orig_id,
    orig_id: orig_id,
    action: null,
  };
};
setupUnchanged.label = 'unchanged';

var setupAdd = function(id, orig_id) {
  return {
    id: id,
    orig_id: null,
    action: 'ADD',
  };
};
setupAdd.label = 'ADD';

var setupUpdate = function(id, orig_id) {
  return {
    id: id,
    orig_id: orig_id,
    action: 'UPDATE',
  };
};
setupUpdate.label = 'UPDATE';

var setupDelete = function(id, orig_id) {
  return {
    id: null,
    orig_id: orig_id,
    action: 'DELETE',
  };
};
setupDelete.label = 'DELETE';

var mergeCases = [
  setupMissing,
  setupUnchanged,
  setupAdd,
  setupUpdate,
  setupDelete,
];

var operations = {
  overwrite: [
  //              missing,  unchanged, ADD,       UPDATE,    DELETE  (src)
  /*missing  */ [ notExist, src,       src,       src,       src ],
    /*unchanged*/ [ notExist, src,       src,       src,       src ],
    /*ADD      */ [ notExist, src,       src,       src,       src ],
    /*UPDATE   */ [ notExist, src,       src,       src,       src ],
    /*DELETE   */ [ notExist, src,       src,       src,       src ],
  ],
  apply: [
  //              missing,  unchanged, ADD,       UPDATE,    DELETE  (src)
  /*missing  */ [ dst,      dst,       noneS,     noneS,     notExist ],
    /*unchanged*/ [ dst,      dst,       srcId,     srcId,     notExist ],
    /*ADD      */ [ dst,      dst,       srcId,     srcId,     notExist ],
    /*UPDATE   */ [ dst,      dst,       srcId,     srcId,     notExist ],
    /*DELETE   */ [ dst,      dst,       updateSD,  updateSD,  notExist ],
  ],
  changes: [
  //              missing,  unchanged, ADD,       UPDATE,    DELETE  (src)
  /*missing  */ [ dst,      dst,       src,       src,       src ],
    /*unchanged*/ [ dst,      dst,       updateSD,  updateSD,  deleteD ],
    /*ADD      */ [ dst,      dst,       addS,      updateSS,  deleteSo ],
    /*UPDATE   */ [ dst,      dst,       updateSD,  updateSD,  deleteD ],
    /*DELETE   */ [ dst,      dst,       updateSD,  updateSD,  deleteD ],
  ],
  rebase: [
  //              missing,  unchanged, ADD,       UPDATE,    DELETE  (src)
  /*missing  */ [ dst,      noneS,     noneS,     noneS,     dst ],
    /*unchanged*/ [ notExist, noneS,     noneS,     noneS,     notExist ],
    /*ADD      */ [ dst,      updateDS,  updateDS,  updateDS,  dst ],
    /*UPDATE   */ [ addD,     updateDS,  updateDS,  updateDS,  addD ],
    /*DELETE   */ [ notExist, deleteSi,  deleteSi,  deleteSi,  notExist ],
  ],
};

// -------------------- conflict matrix result assertions -----------------
// A, B - arbitrary values, what matters is "same, not same" between the two branches
// XY - id from X (A/B), orig id from Y

var setupNoneA = function(a, b) {
  return {
    id: a,
    orig_id: a,
    action: null,
  };
};
setupNoneA.label = 'noneA';

var setupNoneB = function(a, b) {
  return {
    id: b,
    orig_id: b,
    action: null,
  };
};
setupNoneB.label = 'noneB';

var setupAddA = function(a, b) {
  return {
    id: a,
    orig_id: null,
    action: 'ADD',
  };
};
setupAddA.label = 'addA';

var setupAddB = function(a, b) {
  return {
    id: b,
    orig_id: null,
    action: 'ADD',
  };
};
setupAddB.label = 'addB';

var setupUpdateAA = function(a, b) {
  return {
    id: a,
    orig_id: a,
    action: 'UPDATE',
  };
};
setupUpdateAA.label = 'updateAA';

var setupUpdateAB = function(a, b) {
  return {
    id: a,
    orig_id: b,
    action: 'UPDATE',
  };
};
setupUpdateAB.label = 'updateAB';

var setupUpdateBA = function(a, b) {
  return {
    id: b,
    orig_id: a,
    action: 'UPDATE',
  };
};
setupUpdateBA.label = 'updateBA';

var setupUpdateBB = function(a, b) {
  return {
    id: b,
    orig_id: b,
    action: 'UPDATE',
  };
};
setupUpdateBB.label = 'updateBB';

var setupDeleteA = function(a, b) {
  return {
    id: null,
    orig_id: a,
    action: 'DELETE',
  };
};
setupDeleteA.label = 'deleteA';

var setupDeleteB = function(a, b) {
  return {
    id: null,
    orig_id: b,
    action: 'DELETE',
  };
};
setupDeleteB.label = 'deleteB';

var conflictCases = [
  setupMissing,
  setupNoneA,
  setupNoneB,
  setupAddA,
  setupAddB,
  setupUpdateAA,
  setupUpdateAB,
  setupUpdateBA,
  setupUpdateBB,
  setupDeleteA,
  setupDeleteB,
];

var nc = 'no conflict';
var CONFLICT = 'CONFLICT';

// Two things are slightly unusual because this only uses two values to control combinatorical explosion. (sort of three when null)
// updateAA/BB are atypical, but can exist under special circumstances; e.g. merging changes into branch that already has those changes.
// updateAB vs updateBA is surprising. I don't see how this would actually occur in editing, unless there were some sort of "revert" and that got merged with the original edit.
// similarly deleteA vs addA. though the sequence add, then delete may occur normally.
var conflicts = [
  //              missing  , noneA    , noneB    , addA     , addB     , updateAA , updateAB , updateBA , updateBB , deleteA  , deleteB (src)
  /*missing*/   [ nc       , nc       , nc       , nc       , nc       , nc       , nc       , nc       , nc       , nc       , nc ],
  /*noneA*/     [ nc       , nc       , nc       , nc       , CONFLICT , nc       , nc       , nc       , CONFLICT , nc       , CONFLICT ],
  /*noneB*/     [ nc       , nc       , nc       , CONFLICT , nc       , CONFLICT , nc       , nc       , nc       , CONFLICT , nc ],
  /*addA*/      [ nc       , nc       , CONFLICT , nc       , CONFLICT , nc       , nc       , CONFLICT , CONFLICT , nc       , CONFLICT ],
  /*addB*/      [ nc       , CONFLICT , nc       , CONFLICT , nc       , CONFLICT , CONFLICT , nc       , nc       , CONFLICT , nc ],
  /*updateAA*/  [ nc       , nc       , CONFLICT , nc       , CONFLICT , nc       , nc       , CONFLICT , CONFLICT , CONFLICT , CONFLICT ],
  /*updateAB*/  [ nc       , nc       , nc       , nc       , CONFLICT , nc       , nc       , nc       , CONFLICT , CONFLICT , CONFLICT ],
  /*updateBA*/  [ nc       , nc       , nc       , CONFLICT , nc       , CONFLICT , nc       , nc       , nc       , CONFLICT , CONFLICT ],
  /*updateBB*/  [ nc       , CONFLICT , nc       , CONFLICT , nc       , CONFLICT , CONFLICT , nc       , nc       , CONFLICT , CONFLICT ],
  /*deleteA*/   [ nc       , nc       , CONFLICT , nc       , CONFLICT , CONFLICT , CONFLICT , CONFLICT , CONFLICT , nc       , nc ],
  /*deleteB*/   [ nc       , CONFLICT , nc       , CONFLICT , nc       , CONFLICT , CONFLICT , CONFLICT , CONFLICT , nc       , nc ],
];

// -------------------- conflict manual result assertions (three-four pages) -----------------
// provided premade updateAB and updateCD
// cases with more then two "sames" are often degenerate (may not really be an update) and should be covered above

var sameNothing = function(srcPage, dstPage) {};
sameNothing.label = 'same nothing';

var sameId = function(srcPage, dstPage) {
  srcPage.id = dstPage.id;
};
sameId.label = 'same id';

var sameOrig = function(srcPage, dstPage) {
  srcPage.orig_id = dstPage.orig_id;
};
sameOrig.label = 'same orig_id';

var srcEditsDst = function(srcPage, dstPage) {
  srcPage.orig_id = dstPage.id;
};
srcEditsDst.label = 'src edits dst';

var dstEditsSrc = function(srcPage, dstPage) {
  dstPage.orig_id = srcPage.id;
};
dstEditsSrc.label = 'dst edits src';

var manualConflicts = [
  // four pages
  [CONFLICT, sameNothing],

  // three pages
  [nc      , sameId],
  [CONFLICT, sameOrig],
  [CONFLICT, srcEditsDst],
  [CONFLICT, dstEditsSrc],

  // <= two pages: see matrix
];

/*
Update A-B on no-change C will happen given any two concurrent edits.
So, lead Developer David recently got a departure notice from Developer Danny, and makes a branch to add a job description to the careers page.
Meanwhile, HR Henry makes a branch to update all the job descriptions with new work-from-home policies.
David merges the change, taking the careers page from 1->2. After merge to master and clearing orig, all we see is 2.
Henry submits his changes, with update 1->3. During the conflict check, we see 1->3 : 2.  No matching ids.
If there is no conflict notice, the job posting gets lost.
*/

var cmsPath = '';
var dataPath = '';

describe('Merges - Matrix', function() {
  this.timeout(10000);
  var jsh = new jsHarmonyCMS.Application();
  jsh.Config.appbasepath = process.cwd();
  jsh.Config.silentStart = true;
  jsh.Config.interactive = true;
  jsh.Config.onConfigLoaded.push(function(cb){
    jsh.Config.system_settings.automatic_schema = false;
    cmsPath = jsh.Config.modules['jsHarmonyCMS'].moduledir;
    dataPath = jsh.Config.datadir;
    return cb();
  });

  var dbconfig;
  var db;
  var dbtypes = DB.types;
  var testDstBranchId = -1;
  var testSrcBranchId = -1;
  var testPages = [];
  var testSrcPageId = -1;
  var testSrcOrigPageId = -1;
  var testDstPageId = -1;
  var testDstOrigPageId = -1;
  var testPageIdA = -1;
  var testPageIdB = -1;
  var testPageIdGrandparent = -1;
  var testPageIdParent = -1;
  var testPageIdChild = -1;
  var testPageKey = -1;

  var setupBranchPage = function(branchId, key, page){
    return function(cb) {
      var sql, sql_params, sql_ptypes;
      if (page) {
        // if the page should exist, ensure it exists, and update with the correct values.
        sql = 'update cms.branch_page set page_id = @page_id, page_orig_id = @page_orig_id, branch_page_action = @branch_page_action where page_key = @page_key and branch_id = @branch_id;\
        insert into cms.branch_page(branch_id, page_key, page_id, page_orig_id, branch_page_action) select @branch_id, @page_key, @page_id, @page_orig_id, @branch_page_action from cms.branch where branch_id = @branch_id and @page_key not in (select page_key from cms.branch_page where branch_id = @branch_id);';
        sql_params = {
          'branch_id': branchId,
          'page_key': key,
          'page_id': page.id,
          'page_orig_id': page.orig_id,
          'branch_page_action': page.action,
        };
        sql_ptypes = [
          dbtypes.BigInt,
          dbtypes.BigInt,
          dbtypes.BigInt,
          dbtypes.BigInt,
          dbtypes.VarChar(8),
        ];
      } else {
        // page shouldn't exist for this test, get rid if it present.
        sql = 'delete from cms.branch_page where page_key = @page_key and branch_id = @branch_id;';
        sql_params = {
          'branch_id': branchId,
          'page_key': key,
        };
        sql_ptypes = [
          dbtypes.BigInt,
          dbtypes.BigInt,
        ];
      }
      db.Command('S1', sql, sql_ptypes, sql_params, function(err, dbrslt, stats) {
        assert.ifError(err);
        cb(err);
      });
    };
  };

  // clear flags from last test to ensure branch is updatable
  var resetBranch = function(branchId) {
    return function(cb) {
      var sql = 'update cms.branch set branch_merge_id=null, branch_merge_type=null where branch_id=@dst_branch_id;';
      var sql_params = {
        'dst_branch_id': branchId,
      };
      var sql_ptypes = [
        dbtypes.BigInt,
      ];
      db.Command('S1', sql, sql_ptypes, sql_params, function(err, dbrslt, stats) {
        assert.ifError(err);
        cb(err);
      });
    };
  };

  // pull page state as JS object and compare values
  // can compare multiple entries, but we only use one here
  function assertBranchState(branch_id, state, label, done) {
    var sql = 'select branch_page_action as action, page_id id, page_orig_id orig_id from cms.branch_page where branch_id='+branch_id+'';
    db.Recordset('', sql, [], {}, function (err, dbrslt, stats) {
      // log: async test exceptions don't appear under the right test heading
      // providing a message to deepStrictEqual doesn't print the diff.
      console.log(label, 'results');
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
      done(err);
    });
  }

  function clearTestData(cb){
    /* Clear previous branchs */
    var sql = "\
    delete from cms.branch_page where branch_id in (select branch_id from cms.branch where branch_name like 'Merge Test Data:%');\
    delete from cms.page where page_path like 'Merge Test Data:%';\
    delete from cms.branch_media where branch_id in (select branch_id from cms.branch where branch_name like 'Merge Test Data:%');\
    delete from cms.branch_menu where branch_id in (select branch_id from cms.branch where branch_name like 'Merge Test Data:%');\
    delete from cms.branch_redirect where branch_id in (select branch_id from cms.branch where branch_name like 'Merge Test Data:%');\
    delete from cms.branch where branch_name like 'Merge Test Data:%';";
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
          // create test site
          var sql = "insert into cms.site(site_name) select 'Merge Test Data' where ('Merge Test Data' not in (select site_name from cms.site));";
          db.Command('S1', sql, [], {}, function(err, dbrslt, stats) {
            assert.ifError(err);
            cb();
          });
        },
        function(cb){
          // create source branch
          var sql = "insert into cms.v_my_current_branch(branch_type, branch_name, site_id) values('USER', 'Merge Test Data: Source Branch', (select site_id from cms.site where site_name='Merge Test Data'));\
          select branch_id from cms.v_my_current_branch;";
          db.Scalar('S1', sql, [], {}, function(err, dbrslt, stats) {
            assert.ifError(err);
            testSrcBranchId = dbrslt;
            cb();
          });
        },
        function(cb){
          // create destination branch
          var sql = "insert into cms.v_my_current_branch(branch_type, branch_name, site_id) values('USER', 'Merge Test Data: Destination Branch', (select site_id from cms.site where site_name='Merge Test Data'));\
          select branch_id from cms.v_my_current_branch;";
          db.Scalar('S1', sql, [], {}, function(err, dbrslt, stats) {
            assert.ifError(err);
            testDstBranchId = dbrslt;
            cb();
          });
        },
        function(cb){
          // create test pages
          var sql =
          "insert into cms.page(site_id,page_path) values((select site_id from cms.site where site_name='Merge Test Data'), 'Merge Test Data: src orig');\
          insert into cms.page(site_id,page_key, page_path) select (select site_id from cms.site where site_name='Merge Test Data'), page_key, 'Merge Test Data: dst orig' from cms.page where page_path = 'Merge Test Data: src orig';\
          insert into cms.page(site_id,page_key, page_path, page_orig_id) select (select site_id from cms.site where site_name='Merge Test Data'), page_key, 'Merge Test Data: src current', page_id from cms.page where page_path = 'Merge Test Data: src orig';\
          insert into cms.page(site_id,page_key, page_path, page_orig_id) select (select site_id from cms.site where site_name='Merge Test Data'), page_key, 'Merge Test Data: dst current', page_id from cms.page where page_path = 'Merge Test Data: dst orig';\
          insert into cms.page(site_id,page_key, page_path, page_orig_id) select (select site_id from cms.site where site_name='Merge Test Data'), page_key, 'Merge Test Data: child', page_id from cms.page where page_path = 'Merge Test Data: src current';\
          select page_key, page_id, page_orig_id from cms.page where page_path like 'Merge Test Data:%' order by page_id;";
          db.Recordset('S1', sql, [], {}, function(err, dbrslt, stats) {
            assert.ifError(err);
            testPageKey = dbrslt[0].page_key;
            testPages = dbrslt.map(function(rec) {return rec.page_id;});
            testSrcOrigPageId = testPages[0];
            testDstOrigPageId = testPages[1];
            testSrcPageId = testPages[2];
            testDstPageId = testPages[3];
            testPageIdA = testPages[0];
            testPageIdB = testPages[1];
            testPageIdGrandparent = testPages[0];
            testPageIdParent = testPages[2];
            testPageIdChild = testPages[4];
            async.eachSeries(testPages, function(page_id, file_cb){
              fs.copyFile(
                path.join(cmsPath, 'models/sql/objects/data_files/page_sample.json'),
                path.join(dataPath, 'page/'+page_id+'.json'),
                file_cb);
            }, cb);
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

  Object.keys(operations).forEach(function(operation){
    describe(operation, function() {
      operations[operation].forEach(function(row, dstIndex) {
        row.forEach(function(test, srcIndex) {
          var label = 'dst ' + mergeCases[dstIndex].label + ' + src ' + mergeCases[srcIndex].label;
          it(label, function(done) {
            var srcPage = mergeCases[srcIndex](testSrcPageId, testSrcOrigPageId);
            var dstPage = mergeCases[dstIndex](testDstPageId, testDstOrigPageId);
            var resultPage = test(srcPage, dstPage);
            async.waterfall([
              resetBranch(testDstBranchId),
              setupBranchPage(testSrcBranchId, testPageKey, srcPage),
              setupBranchPage(testDstBranchId, testPageKey, dstPage),
              function(cb) {
                jsh.Modules.jsHarmonyCMS.funcs.merge_begin_merge('S1', {dst_branch_id: testDstBranchId, src_branch_id: testSrcBranchId, merge_type: operation.toUpperCase()}, cb);
              },
              function(cb) {
                //console.log('merge for ', label);
                jsh.Modules.jsHarmonyCMS.funcs['merge_'+operation]('S1', {dst_branch_id: testDstBranchId, src_branch_id: testSrcBranchId}, cb);
              },
              function(cb) {
                //console.log('assert for ', label);
                assertBranchState(testDstBranchId, resultPage ? [resultPage] : [], label, cb);
              },
            ], function(err){
              if(err) console.log(err);
              done(err);
            });
          });
        });
      });
    });
  });

  var conflictTest = function(label, srcPage, dstPage, status, done) {
    async.waterfall([
      setupBranchPage(testSrcBranchId, testPageKey, srcPage),
      setupBranchPage(testDstBranchId, testPageKey, dstPage),
      function(cb) {
        console.log('conflicts for ', label);
        jsh.Modules.jsHarmonyCMS.funcs.conflicts('S1', '', testSrcBranchId, testDstBranchId, function(err, results) {
          if(err) return cb(err);
          assert(!_.isEmpty(results.branch_conflicts));
          var resultStatus = results.branch_conflicts.page.length > 0 ? CONFLICT : nc;
          if(resultStatus != status){
            console.log(testSrcBranchId);
            console.log(srcPage);
            console.log(testDstBranchId);
            console.log(dstPage);
            console.log('Actual Result: ' + JSON.stringify(results.branch_conflicts.page));
          }
          assert.strictEqual(resultStatus, status);
          cb();
        });
      },
    ], function(err){
      if(err) console.log(err);
      done(err);
    });
  };

  describe('Conflicts', function() {

    before(function(done) {
      resetBranch(testDstBranchId)(done);
    });

    describe('Matrix', function() {
      conflicts.forEach(function(row, dstIndex) {
        row.forEach(function(status, srcIndex) {
          var label = 'dst ' + conflictCases[dstIndex].label + ' + src ' + conflictCases[srcIndex].label;

          // can't include the "it" in the function because testPageId isn't defined until `before` runs.
          it(label, function(done) {
            var srcPage = conflictCases[srcIndex](testPageIdA, testPageIdB);
            var dstPage = conflictCases[dstIndex](testPageIdA, testPageIdB);
            conflictTest(label, srcPage, dstPage, status, done);
          });
        });
      });
    });

    describe('Manual', function() {
      manualConflicts.forEach(function(row) {
        var status = row.shift();
        var label = row.map(function(f) {return f.label;}).join(' ');

        // can't include the "it" in the function because testPageId isn't defined until `before` runs.
        it(label, function(done) {
          var srcPage = setupUpdate(testSrcPageId, testSrcOrigPageId);
          var dstPage = setupUpdate(testDstPageId, testDstOrigPageId);
          row.forEach(function(f) {f(srcPage, dstPage);});
          conflictTest(label, srcPage, dstPage, status, done);
        });
      });
    });

    describe('Direct Descedant', function() {
      it('Unrelated pages', function(done) {
        var srcPage = setupUpdate(testSrcPageId, testSrcOrigPageId);
        var dstPage = setupUnchanged(testDstPageId, testDstPageId);
        conflictTest('Unrelated pages', srcPage, dstPage, CONFLICT, done);
      });

      it('Source Descendant of Destination', function(done) {
        var srcPage = setupUpdate(testPageIdChild, testPageIdParent);
        var dstPage = setupUnchanged(testPageIdGrandparent, testPageIdGrandparent);
        conflictTest('Source Descendant of Destination', srcPage, dstPage, nc, done);
      });

      it('Destination Descendant of Source', function(done) {
        var srcPage = setupUpdate(testPageIdParent, testPageIdGrandparent);
        var dstPage = setupUpdate(testPageIdChild, testPageIdParent);
        conflictTest('Destination Descendant of Source', srcPage, dstPage, CONFLICT, done);
      });
    });

  });
});