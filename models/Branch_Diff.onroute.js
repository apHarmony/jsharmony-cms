//(routetype, req, res, callback, require, jsh, modelid, params)
var _ = require('lodash');
var model = jsh.getModelClone(req, modelid);
var cms = jsh.Modules['jsHarmonyCMS'];
var field_mapping = _.extend.apply(null,_.map(cms.BranchItems, function(branchItem){ return branchItem && branchItem.diff && branchItem.diff.field_mapping||{}; }));

model.oninit = '_this.field_mapping = '+JSON.stringify(field_mapping)+';'+model.oninit||'';

//Save model to local request cache
req.jshlocal.Models[modelid] = model;
return callback();