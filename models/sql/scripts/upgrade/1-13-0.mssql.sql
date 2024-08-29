alter table {schema}.deployment add deployment_params nvarchar(max) null;

jsharmony.version_increment('jsHarmonyCMS',1,13,0,0);