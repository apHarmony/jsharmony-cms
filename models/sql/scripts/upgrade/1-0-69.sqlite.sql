jsharmony.version_increment('jsHarmonyCMS',1,0,69,0);
create table cms_sys_user_token(
  sys_user_token_id integer primary key autoincrement not null,
  sys_user_id integer not null,
  sys_user_token_hash text unique not null,
  sys_user_token_ext text,
  sys_user_token_keys text,
  sys_user_token_etstmp text,
  sys_user_token_euser text,
  sys_user_token_mtstmp text,
  sys_user_token_muser text,
 foreign key (sys_user_id) references jsharmony_sys_user(sys_user_id) on delete cascade
);
create index index_cms_sys_user_token_1 on cms_sys_user_token(sys_user_token_hash);