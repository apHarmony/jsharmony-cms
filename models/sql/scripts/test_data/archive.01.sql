/* Test Site */
/* --------------*/

insert into cms.site(site_name) select 'Archive Test Data' where ('Archive Test Data' not in (select site_name from cms.site));

/* Base Branch */
/* --------------*/
/* Create branch */
insert into cms.v_my_current_branch(branch_type, branch_name, site_id) values('USER', 'Archive Test Data: Base Branch', (select site_id from cms.site where site_name='Archive Test Data'));
/* Update pages */
insert into cms.v_my_page(page_title, page_path) values('Untouched','/archive/untouched/index.html');
insert into cms.v_my_page(page_title, page_path) values('Update Before','/archive/update/index.html');
insert into cms.v_my_page(page_title, page_path) values('Delete','/archive/delete/index.html');
/* Update Media */
insert into cms.v_my_media(media_path, media_ext, media_size, media_desc, media_type) values ('/documents/media.pdf', '.pdf', 1136293, 'Media', 'DOC');
/* Update menu */

/* Edit Branch */
/* --------------*/
/* Create branch */
insert into cms.v_my_current_branch(branch_parent_id, branch_type, branch_name) values((select branch_id from cms.branch where branch_name='Archive Test Data: Base Branch'), 'USER', 'Archive Test Data: Edit Branch');
/* Update pages */
insert into cms.v_my_page(page_title, page_path) values('Add','/archive/add/index.html');
update cms.v_my_page set page_title='Update After' where page_path='/archive/update/index.html';
delete from cms.v_my_page where page_path='/archive/delete/index.html';
