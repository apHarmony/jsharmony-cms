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

var assert = require('assert');
var jsHarmonyCMS = require('../jsHarmonyCMS.js');
var async = require('async');
var _ = require('lodash');

var jsh = new jsHarmonyCMS.Application();
var jshcms = jsh.Modules['jsHarmonyCMS'];
var funcs = jshcms.funcs;


describe('URL Parsing', function() {
  it('Git SSH', function(done) {
    var parsed_url = funcs.parse_deployment_target_url('git_ssh://git@github.com:user/test.git');
    assert.equal(parsed_url.protocol,'ssh:');
    assert.equal(parsed_url.auth,'git');
    assert.equal(parsed_url.hostname,'github.com');
    assert.equal(parsed_url.path,':user/test.git');
    done();
  });
  it('HTTPS', function(done) {
    var parsed_url = funcs.parse_deployment_target_url('https://git@github.com:user/test.git?x=3');
    assert.equal(parsed_url.protocol,'https:');
    assert.equal(parsed_url.auth,'git');
    assert.equal(parsed_url.hostname,'github.com');
    assert.equal(parsed_url.path,'/user/test.git?x=3');
    done();
  });
  it('HTTPS User @', function(done) {
    var parsed_url = funcs.parse_deployment_target_url('https://git@github.com@github.com:user/test.git?x=3');
    assert.equal(parsed_url.protocol,'https:');
    assert.equal(parsed_url.auth,'git@github.com');
    assert.equal(parsed_url.hostname,'github.com');
    assert.equal(parsed_url.path,'/user/test.git?x=3');
    done();
  });
  it('HTTPS User @ Password', function(done) {
    var parsed_url = funcs.parse_deployment_target_url('https://git@github.com:pa:@ss@github.com:user/test.git?@x=3');
    assert.equal(parsed_url.protocol,'https:');
    assert.equal(parsed_url.auth,'git@github.com:pa:@ss');
    assert.equal(parsed_url.hostname,'github.com');
    assert.equal(parsed_url.path,'/user/test.git?@x=3');
    done();
  });
  it('HTTPS User @ Password Port', function(done) {
    var parsed_url = funcs.parse_deployment_target_url('https://git@github.com:pa:@ss@github.com:43/user/test.git?@x=3');
    assert.equal(parsed_url.protocol,'https:');
    assert.equal(parsed_url.auth,'git@github.com:pa:@ss');
    assert.equal(parsed_url.username,'git@github.com');
    assert.equal(parsed_url.password,'pa:@ss');
    assert.equal(parsed_url.hostname,'github.com');
    assert.equal(parsed_url.port,'43');
    assert.equal(parsed_url.path,'/user/test.git?@x=3');
    done();
  });
  it('SSH User @ Password Port with Absolute Path', function(done) {
    var parsed_url = funcs.parse_deployment_target_url('ssh://git@github.com:pa:@ss@github.com:43/user/test.git?@x=3');
    assert.equal(parsed_url.protocol,'ssh:');
    assert.equal(parsed_url.auth,'git@github.com:pa:@ss');
    assert.equal(parsed_url.username,'git@github.com');
    assert.equal(parsed_url.password,'pa:@ss');
    assert.equal(parsed_url.hostname,'github.com');
    assert.equal(parsed_url.port,'43');
    assert.equal(parsed_url.path,'/user/test.git?@x=3');
    done();
  });
  it('SSH User @ Password with Relative Path', function(done) {
    var parsed_url = funcs.parse_deployment_target_url('ssh://git@github.com:pa:@ss@github.com:user/test.git?@x=3');
    assert.equal(parsed_url.protocol,'ssh:');
    assert.equal(parsed_url.auth,'git@github.com:pa:@ss');
    assert.equal(parsed_url.username,'git@github.com');
    assert.equal(parsed_url.password,'pa:@ss');
    assert.equal(parsed_url.hostname,'github.com');
    assert.equal(parsed_url.path,':user/test.git?@x=3');
    done();
  });
  it('SSH User @ Password with Absolute Path', function(done) {
    var parsed_url = funcs.parse_deployment_target_url('ssh://git@github.com:pa:@ss@github.com:/user/test.git?@x=3');
    assert.equal(parsed_url.protocol,'ssh:');
    assert.equal(parsed_url.auth,'git@github.com:pa:@ss');
    assert.equal(parsed_url.username,'git@github.com');
    assert.equal(parsed_url.password,'pa:@ss');
    assert.equal(parsed_url.hostname,'github.com');
    assert.equal(parsed_url.path,'/user/test.git?@x=3');
    done();
  });
});