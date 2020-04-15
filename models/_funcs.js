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
var _ = require('lodash');
var prettyhtml = require('js-beautify').html;

function ModuleFunctions(module){
  this.deploymentQueue = undefined;
  
  this.prettyhtml = prettyhtml;
  _.extend(this, require('./_funcs.page.js')(module, this));
  _.extend(this, require('./_funcs.media.js')(module, this));
  _.extend(this, require('./_funcs.menu.js')(module, this));
  _.extend(this, require('./_funcs.sitemap.js')(module, this));
  _.extend(this, require('./_funcs.deploy.js')(module, this));
  _.extend(this, require('./_funcs.diff.js')(module, this));
  _.extend(this, require('./_funcs.validate.js')(module, this));
  _.extend(this, require('./_funcs.conflicts.js')(module, this));
  _.extend(this, require('./_funcs.merge.js')(module, this));
}

exports = module.exports = ModuleFunctions;