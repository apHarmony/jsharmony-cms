jsharmony.version_increment('jsHarmonyCMS',1,0,62,0);

alter table {schema}.deployment_target add column deployment_target_template_variables text;
update {schema}.deployment_target set deployment_target_template_variables = deployment_target_params;