@echo off

rem Usage: clientcompiler.cmd [/debug]

set ROOT=%~dp0
pushd "%ROOT%clientjs"

if "%1"=="/debug" (
  set "DEV_FLAG=-d"
) else (
  set "DEV_FLAG= "
)

call supervisor  -n exit -w "." -e js -x browserify.cmd -- jsHarmonyCMS.js %DEV_FLAG% -o ..\public\js\jsHarmonyCMS.js -t ../../jsharmony/clientjs/browserifyEJS.js
popd

IF %ERRORLEVEL% NEQ 0 EXIT 1