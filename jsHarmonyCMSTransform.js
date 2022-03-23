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

var jsHarmonyModuleTransform = require('jsharmony/jsHarmonyModuleTransform');

function jsHarmonyCMSTransform(module){
  this.sql = {
    '{deployment_env}': 'default',
    '{create_sys_roles}': (module.createRoles ? '1' : '0'),
    '{is_submodule}': (module.isSubmodule ? '1' : '0'),
  };

  this.ignore_errors = {
    '0': true,
    '1': true,
  };

  jsHarmonyModuleTransform.call(this, module);
}

jsHarmonyCMSTransform.prototype = new jsHarmonyModuleTransform();

exports = module.exports = jsHarmonyCMSTransform;