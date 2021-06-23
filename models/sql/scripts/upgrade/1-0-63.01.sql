jsharmony.version_increment('jsHarmonyCMS',1,0,63,0);
insert into jsharmony.sys_role(sys_role_name,sys_role_desc,sys_role_seq) values ('CMSHOST', 'Service - Deployment Host', 5);
insert into jsharmony.sys_user_role(sys_user_id, sys_role_name) select sys_user_id, 'CMSHOST' from jsharmony.sys_user_role where sys_role_name='DEV';
