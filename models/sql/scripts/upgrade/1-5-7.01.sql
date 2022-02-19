jsharmony.version_increment('jsHarmonyCMS',1,5,7,0);
update {schema}.code_deployment_target_role_type set code_seq=3 where code_val='EDITOR';
insert into {schema}.code_deployment_target_role_type(code_val, code_txt, code_seq) values ('PUBLISH_RELEASE','Publish Release',2);
