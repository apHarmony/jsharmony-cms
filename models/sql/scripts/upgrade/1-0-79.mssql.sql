jsharmony.version_increment('jsHarmonyCMS',1,0,79,0);

alter table {schema}.page add page_template_path nvarchar(max) null;
alter table {schema}.deployment_target add deployment_target_client_salt nvarchar(256) null;