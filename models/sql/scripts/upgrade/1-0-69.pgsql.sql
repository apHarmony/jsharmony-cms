jsharmony.version_increment('jsHarmonyCMS',1,0,69,0);
set search_path = cms,pg_catalog;
create table cms.sys_user_token(
  sys_user_token_id bigserial not null,
  sys_user_id bigint not null,
  sys_user_token_hash varchar(256) not null,
  sys_user_token_ext varchar(32),
  sys_user_token_keys varchar(1024),
  sys_user_token_etstmp timestamp,
  sys_user_token_euser varchar(20),
  sys_user_token_mtstmp timestamp,
  sys_user_token_muser varchar(20),
  foreign key (sys_user_id) references jsharmony.sys_user(sys_user_id) on delete cascade,
  constraint pk_cms_sys_user_token_sys_user_token_id primary key (sys_user_token_id),
  constraint unique_cms_sys_user_token_sys_user_token_hash unique (sys_user_token_hash)
);
create index index_cms_sys_user_token_sys_user_token_hash on cms.sys_user_token(sys_user_token_hash);
