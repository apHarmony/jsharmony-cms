alter table {schema}.deployment add column deployment_params text null;

jsharmony.version_increment('jsHarmonyCMS',1,13,0,0);