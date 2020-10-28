@echo off

rem Usage: clientcompiler.cmd

cd clientjs
supervisor  -n exit -w "." -e js -x browserify.cmd -- jsHarmonyCMS.js -d -o ..\public\js\jsHarmonyCMS.js -t ../../jsharmony/clientjs/browserifyEJS.js
goto done

:done
cd ..