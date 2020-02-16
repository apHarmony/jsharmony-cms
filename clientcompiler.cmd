@echo off

rem Usage: clientcompiler.cmd

cd clientjs
rem call browserify jsHarmony.js | uglifyjs > ..\public\js\jsHarmony.js
rem call browserify jsHarmony.js > ..\public\js\jsHarmony.js

if "%1"=="/prod" goto prod

supervisor  -n exit -w "." -e js -x browserify.cmd -- jsHarmonyCMS.js -o ..\public\js\jsHarmonyCMS.js -t ../../jsharmony/clientjs/browserifyEJS.js
goto done

:done
cd ..