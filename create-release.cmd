rmdir ..\jsharmony-cms-release\models /s /q
mkdir ..\jsharmony-cms-release\models
xcopy .\models ..\jsharmony-cms-release\models /s

rmdir ..\jsharmony-cms-release\public /s /q
mkdir ..\jsharmony-cms-release\public
xcopy .\public ..\jsharmony-cms-release\public /s

rmdir ..\jsharmony-cms-release\views /s /q
mkdir ..\jsharmony-cms-release\views
xcopy .\views ..\jsharmony-cms-release\views /s

del ..\jsharmony-cms-release\*.js
del ..\jsharmony-cms-release\*.json
del ..\jsharmony-cms-release\*.cmd
copy *.js ..\jsharmony-cms-release\
copy LICENSE ..\jsharmony-cms-release\
copy README.md ..\jsharmony-cms-release\
copy package.json ..\jsharmony-cms-release\