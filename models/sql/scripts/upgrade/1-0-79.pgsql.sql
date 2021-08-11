jsharmony.version_increment('jsHarmonyCMS',1,0,79,0);

alter table {schema}.page add column page_template_path text null;
alter table {schema}.deployment_target add column deployment_target_client_salt varchar(256) null;