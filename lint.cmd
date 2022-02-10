call eslint --fix *.js
call eslint --fix lib\*.js
call eslint --fix init\*.js
call eslint --config .eslintrc_test.js --fix test\*.js
call eslint --config .eslintrc_clientjs.js --ignore-pattern "d3.v5.min.js" --ignore-pattern "jsHarmonyCMS.js" --fix public\js\**\*.js
call eslint --config .eslintrc_clientjs.js --fix models\js\*.js
call eslint --fix models\_*.js
call eslint --config .eslintrc_onroute.js --fix models\*.onroute.js
call eslint --config .eslintrc_models.js --ignore-pattern "_*" --ignore-pattern "*.onroute.*" --fix models\*.js
call eslint --config .eslintrc_clientjs.js --fix clientjs\**\*.js