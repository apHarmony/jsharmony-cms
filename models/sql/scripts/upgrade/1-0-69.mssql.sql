jsharmony.version_increment('jsHarmonyCMS',1,0,69,0);
create table cms.sys_user_token(
  sys_user_token_id bigint identity not null,
  sys_user_id bigint not null,
  sys_user_token_hash nvarchar(256) not null,
  sys_user_token_ext nvarchar(32),
  sys_user_token_keys nvarchar(1024),
  sys_user_token_etstmp datetime,
  sys_user_token_euser nvarchar(20),
  sys_user_token_mtstmp datetime,
  sys_user_token_muser nvarchar(20),
  constraint fk_cms_sys_user_token_sys_user_id foreign key (sys_user_id) references jsharmony.sys_user(sys_user_id) on delete cascade,
  constraint pk_cms_sys_user_token_sys_user_token_id primary key (sys_user_token_id),
  constraint unique_cms_sys_user_token_sys_user_token_hash unique (sys_user_token_hash)
);
create index index_cms_sys_user_token_sys_user_token_hash on cms.sys_user_token(sys_user_token_hash);
exec sys.sp_addextendedproperty @name=N'MS_Description', @value=N'User Tokens' , @level0type=N'SCHEMA',@level0name=N'cms', @level1type=N'TABLE',@level1name=N'sys_user_token';

