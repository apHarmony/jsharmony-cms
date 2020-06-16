(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/*
Copyright 2019 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/

exports = module.exports = function(jsh, cms){
  var _this = this;
  var $ = jsh.$;
  var XExt = jsh.XExt;
  var async = jsh.async;
  var ejs = jsh.ejs;

  this.components = null;
  this.isInitialized = false;

  this.load = function(onComplete){
    var url = '../_funcs/templates/component/'+cms.branch_id;
    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.components = rslt.components;
        async.eachOf(_this.components, function(component, component_id, component_cb){
          if(component.remote_template && component.remote_template.publish){
            var loadObj = {};
            cms.loader.StartLoading(loadObj);
            $.ajax({
              type: 'GET',
              cache: false,
              url: component.remote_template.publish,
              xhrFields: { withCredentials: true },
              success: function(data){
                cms.loader.StopLoading(loadObj);
                component.content = data;
                return component_cb();
              },
              error: function(xhr, status, err){
                cms.loader.StopLoading(loadObj);
                component.content = '*** COMPONENT NOT FOUND ***';
                return component_cb();
              }
            });
          }
          else return component_cb();
        }, function(err){
          _this.isInitialized = true;
        });
      }
      else{
        if(onComplete) onComplete(new Error('Error Loading Components'));
        XExt.Alert('Error loading components');
      }
    }, function (err) {
      if(onComplete) onComplete(err);
    });
  };

  this.render = function(){
    $('.jsharmony_cms_component').addClass('mceNonEditable').each(function(){
      var jobj = $(this);
      var component_id = jobj.data('id');
      var component_content = '';
      if(!component_id) component_content = '*** COMPONENT MISSING data-id ATTRIBUTE ***';
      else if(!(component_id in _this.components)) component_content = '*** MISSING CONTENT FOR COMPONENT ID ' + component_id+' ***';
      else{
        component_content = ejs.render(_this.components[component_id].content || '', cms.controller.getComponentRenderParameters(component_id));
      }
      jobj.html(component_content);
    });
  }
}
},{}],2:[function(require,module,exports){
/*
Copyright 2019 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/

exports = module.exports = function(jsh, cms){
  var _this = this;

  this.hasChanges = false;

  this.init = function(){
  }

  this.load = function(cb){
  }

  this.createWorkspace = function(cb){
  }

  this.render = function(){
  }

  this.getValues = function(){
    _this.hasChanges = false;
  }

  this.validate = function(){
    return true;
  }

  this.save = function(){
  }

  this.getComponentRenderParameters = function(component_id){
    return {};
  }

  this.getMenuRenderParameters = function(menu_tag){
    return {
      menu: { menu_item_tree: [] }
    };
  }
}
},{}],3:[function(require,module,exports){
/*
Copyright 2019 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/

exports = module.exports = function(jsh, cms, editor){
  var _this = this;
  var XExt = jsh.XExt;

  this.getParameters = function(filePickerType, url){
    url = (url||'').toString();
    if(cms.onGetFilePickerParameters){
      var qs = cms.onGetFilePickerParameters(filePickerType, url);
      if(qs) return qs;
    }
    if(url.indexOf('#@JSHCMS') >= 0){
      var urlparts = document.createElement('a');
      urlparts.href = url;
      var patharr = (urlparts.pathname||'').split('/');
      if(((urlparts.pathname||'').indexOf('/_funcs/media/')==0) && (patharr.length>=4)){
        var media_key = parseInt(patharr[3]);
        if(media_key.toString()==patharr[3]) return { init_media_key: media_key };
      }
      if(((urlparts.pathname||'').indexOf('/_funcs/page/')==0) && (patharr.length>=4)){
        var page_key = parseInt(patharr[3]);
        if(page_key.toString()==patharr[3]) return { init_page_key: page_key };
      }
    }
    return {};
  }

  this.openLink = function(cb, value, meta){
    cms.filePickerCallback = cb;
    var qs = _this.getParameters('link', value);
    XExt.popupForm('jsHarmonyCMS/Link_Browser', 'browse', qs, { width: 1100, height: 600 });
  }

  this.openMedia = function(cb, value, meta){
    cms.filePickerCallback = cb;
    var qs = { };
    var linkurl = _this.getParameters('media', value);
    if(linkurl.media_key) qs.init_media_key = linkurl.media_key;
    XExt.popupForm('jsHarmonyCMS/Media_Browser', 'browse', qs, { width: 1100, height: 600 });
  }

  this.onmessage = function(event, data){
    if(data.indexOf('cms_file_picker:')==0){
      if(!cms.filePickerCallback) return true;
      data = data.substr(16);
      var jdata = JSON.parse(data);
      if(cms.onFilePickerCallback && (cms.onFilePickerCallback(jdata))){}
      else if(jdata.media_key){
        cms.filePickerCallback(cms._baseurl+'_funcs/media/'+jdata.media_key+'/?media_file_id='+jdata.media_file_id+'#@JSHCMS');
      }
      else if(jdata.page_key){
        cms.filePickerCallback(cms._baseurl+'_funcs/page/'+jdata.page_key+'/#@JSHCMS');
      }
      else XExt.Alert('Invalid response from File Browser: '+JSON.stringify(jdata));
      cms.filePickerCallback = null;
      return true;
    }
    return false;
  }
}
},{}],4:[function(require,module,exports){
/*
Copyright 2019 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/

var jsHarmonyCMSEditorPicker = require('./jsHarmonyCMS.Editor.Picker.js');

exports = module.exports = function(jsh, cms){
  var _this = this;

  var $ = jsh.$;
  var _ = jsh._;
  var XExt = jsh.XExt;
  
  this.isEditing = false;
  this.picker = new jsHarmonyCMSEditorPicker(jsh, cms, this);
  this.defaultConfig = {};

  this.onBeginEdit = null; //function(editor){};
  this.onEndEdit = null; //function(editor){};


  this.editorConfig = {
    base: null,
    full: null,
    text: null
  };

  this.init = function(cb){
    if(!cb) cb = function(){};

    //Initialize Editor
    $('<div id="jsharmony_cms_content_editor_toolbar"></div>').prependTo('body');
    XExt.TinyMCE('', undefined, function(){

      //Change text labels
      window.tinymce.addI18n('en', {
        'Media...': 'Video...',
        'Insert / Edit': 'Video...',
        'Insert/edit media': 'Insert/edit video',
        'Insert/Edit Media': 'Insert/Edit Video',
      });

      //Initialize each content editor
      _this.editorConfig.base = _.extend({}, {
        inline: true,
        branding: false,
        browser_spellcheck: true,
        valid_elements: '+*[*],#p',
        entity_encoding: 'numeric',
        plugins: [
          'advlist autolink autoresize lists link image charmapmaterialicons anchor',
          'searchreplace visualblocks code fullscreen wordcount jshwidget',
          'insertdatetime media table paste code noneditable'
        ],
        toolbar: 'formatselect | forecolor backcolor | bold italic underline | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link  image table fullscreen',
        removed_menuitems: 'newdocument',
        image_advtab: true,
        menu: {
          edit: { title: 'Edit', items: 'undo redo | cut copy paste | selectall | searchreplace' },
          view: { title: 'View', items: 'code | visualaid visualchars visualblocks | spellchecker | preview fullscreen' },
          insert: { title: 'Insert', items: 'image link media jshwidget codesample inserttable | charmapmaterialicons emoticons hr | pagebreak nonbreaking anchor toc | insertdatetime' },
          format: { title: 'Format', items: 'bold italic underline strikethrough superscript subscript codeformat | formats | forecolor backcolor | removeformat' },
          tools: { title: 'Tools', items: 'spellchecker spellcheckerlanguage | code wordcount' },
          table: { title: 'Table', items: 'inserttable tableprops deletetable row column cell' },
          help: { title: 'Help', items: 'help' }
        },
        file_picker_types: 'file image',
        file_picker_callback: function(cb, value, meta) {
          // Provide file and text for the link dialog
          if (meta.filetype == 'file') _this.picker.openLink(cb, value, meta);
          else if (meta.filetype == 'image') _this.picker.openMedia(cb, value, meta);
        },
        relative_urls: false,
        urlconverter_callback: function(url, node, on_save, name){
          var urlparts = document.createElement('a');
          var urlparts_editor = document.createElement('a');
          urlparts.href = url;
          urlparts_editor.href = document.location;
          if(urlparts.host == urlparts_editor.host){
            url = url.replace(/^[^:]*\:\/{2}[^/]*\/(.*)/, '/$1');
          }
          url = url;
          return url;
        },
        charmap_append: _this.getMaterialIcons(),
        fixed_toolbar_container: '#jsharmony_cms_content_editor_toolbar',
      }, jsh.globalparams.defaultEditorConfig, _this.defaultConfig);

      _this.editorConfig.full = _.extend({}, _this.editorConfig.base, {
        init_instance_callback: function(editor){
          editor.on('focus', function(){
            _this.isEditing = editor.id.substr(('jsharmony_cms_content_').length);
            $('#jsharmony_cms_content_editor_toolbar').stop(true).animate({ opacity:1 },300);
            cms.refreshLayout();
            if(_this.onBeginEdit) _this.onBeginEdit(editor);
          });
          editor.on('blur', function(){
            _this.isEditing = false;
            $('#jsharmony_cms_content_editor_toolbar').stop(true).animate({ opacity:0 },300);
            if(_this.onEndEdit) _this.onEndEdit(editor);
          });
        }
      });

      _this.editorConfig.text = _.extend({}, _this.editorConfig.base, {
        inline: true,
        branding: false,
        toolbar: '',
        valid_elements: '',
        valid_styles: {
          '*': ''
        },
        menubar: false,
        browser_spellcheck: true
      });

      return cb();
    });
  }

  this.attach = function(config_id, elem_id, options, cb){
    if(!(config_id in _this.editorConfig)) throw new Error('Editor config ' + (config_id||'').toString() + ' not defined');
    var config = _.extend({ selector: '#' + elem_id }, _this.editorConfig[config_id], options);
    if(cb) config.init_instance_callback = XExt.chainToEnd(config.init_instance_callback, cb);
    window.tinymce.init(config);
  }

  this.detach = function(id){
    var editor = window.tinymce.get('jsharmony_cms_content_'+id);
    if(editor){
      if(_this.isEditing == id) editor.fire('blur');
      editor.destroy();
    }
  }

  this.setContent = function(id, val){
    if(cms.readonly){
      //Delay load, so that errors in the HTML do not stop the page loading process
      window.setTimeout(function(){ $('#jsharmony_cms_content_'+id).html(val); },1);
    }
    else {
      var editor = window.tinymce.get('jsharmony_cms_content_'+id);
      if(!editor) throw new Error('Editor not found: '+id);
      if(!_this.isInitialized) editor.undoManager.clear();
      editor.setContent(val);
      if(!_this.isInitialized) editor.undoManager.add();
    }
  }

  this.getContent = function(id){
    var editor = window.tinymce.get('jsharmony_cms_content_'+id);
    if(!editor) throw new Error('Editor not found: '+id);
    return editor.getContent();
  }

  this.getMaterialIcons = function(){
    return [
      [0xe84d,'materialicon_3d_rotation'],
      [0xeb3b,'materialicon_ac_unit'],
      [0xe190,'materialicon_access_alarm'],
      [0xe191,'materialicon_access_alarms'],
      [0xe192,'materialicon_access_time'],
      [0xe84e,'materialicon_accessibility'],
      [0xe914,'materialicon_accessible'],
      [0xe84f,'materialicon_account_balance'],
      [0xe850,'materialicon_account_balance_wallet'],
      [0xe851,'materialicon_account_box'],
      [0xe853,'materialicon_account_circle'],
      [0xe60e,'materialicon_adb'],
      [0xe145,'materialicon_add'],
      [0xe439,'materialicon_add_a_photo'],
      [0xe193,'materialicon_add_alarm'],
      [0xe003,'materialicon_add_alert'],
      [0xe146,'materialicon_add_box'],
      [0xe147,'materialicon_add_circle'],
      [0xe148,'materialicon_add_circle_outline'],
      [0xe567,'materialicon_add_location'],
      [0xe854,'materialicon_add_shopping_cart'],
      [0xe39d,'materialicon_add_to_photos'],
      [0xe05c,'materialicon_add_to_queue'],
      [0xe39e,'materialicon_adjust'],
      [0xe630,'materialicon_airline_seat_flat'],
      [0xe631,'materialicon_airline_seat_flat_angled'],
      [0xe632,'materialicon_airline_seat_individual_suite'],
      [0xe633,'materialicon_airline_seat_legroom_extra'],
      [0xe634,'materialicon_airline_seat_legroom_normal'],
      [0xe635,'materialicon_airline_seat_legroom_reduced'],
      [0xe636,'materialicon_airline_seat_recline_extra'],
      [0xe637,'materialicon_airline_seat_recline_normal'],
      [0xe195,'materialicon_airplanemode_active'],
      [0xe194,'materialicon_airplanemode_inactive'],
      [0xe055,'materialicon_airplay'],
      [0xeb3c,'materialicon_airport_shuttle'],
      [0xe855,'materialicon_alarm'],
      [0xe856,'materialicon_alarm_add'],
      [0xe857,'materialicon_alarm_off'],
      [0xe858,'materialicon_alarm_on'],
      [0xe019,'materialicon_album'],
      [0xeb3d,'materialicon_all_inclusive'],
      [0xe90b,'materialicon_all_out'],
      [0xe859,'materialicon_android'],
      [0xe85a,'materialicon_announcement'],
      [0xe5c3,'materialicon_apps'],
      [0xe149,'materialicon_archive'],
      [0xe5c4,'materialicon_arrow_back'],
      [0xe5db,'materialicon_arrow_downward'],
      [0xe5c5,'materialicon_arrow_drop_down'],
      [0xe5c6,'materialicon_arrow_drop_down_circle'],
      [0xe5c7,'materialicon_arrow_drop_up'],
      [0xe5c8,'materialicon_arrow_forward'],
      [0xe5d8,'materialicon_arrow_upward'],
      [0xe060,'materialicon_art_track'],
      [0xe85b,'materialicon_aspect_ratio'],
      [0xe85c,'materialicon_assessment'],
      [0xe85d,'materialicon_assignment'],
      [0xe85e,'materialicon_assignment_ind'],
      [0xe85f,'materialicon_assignment_late'],
      [0xe860,'materialicon_assignment_return'],
      [0xe861,'materialicon_assignment_returned'],
      [0xe862,'materialicon_assignment_turned_in'],
      [0xe39f,'materialicon_assistant'],
      [0xe3a0,'materialicon_assistant_photo'],
      [0xe226,'materialicon_attach_file'],
      [0xe227,'materialicon_attach_money'],
      [0xe2bc,'materialicon_attachment'],
      [0xe3a1,'materialicon_audiotrack'],
      [0xe863,'materialicon_autorenew'],
      [0xe01b,'materialicon_av_timer'],
      [0xe14a,'materialicon_backspace'],
      [0xe864,'materialicon_backup'],
      [0xe19c,'materialicon_battery_alert'],
      [0xe1a3,'materialicon_battery_charging_full'],
      [0xe1a4,'materialicon_battery_full'],
      [0xe1a5,'materialicon_battery_std'],
      [0xe1a6,'materialicon_battery_unknown'],
      [0xeb3e,'materialicon_beach_access'],
      [0xe52d,'materialicon_beenhere'],
      [0xe14b,'materialicon_block'],
      [0xe1a7,'materialicon_bluetooth'],
      [0xe60f,'materialicon_bluetooth_audio'],
      [0xe1a8,'materialicon_bluetooth_connected'],
      [0xe1a9,'materialicon_bluetooth_disabled'],
      [0xe1aa,'materialicon_bluetooth_searching'],
      [0xe3a2,'materialicon_blur_circular'],
      [0xe3a3,'materialicon_blur_linear'],
      [0xe3a4,'materialicon_blur_off'],
      [0xe3a5,'materialicon_blur_on'],
      [0xe865,'materialicon_book'],
      [0xe866,'materialicon_bookmark'],
      [0xe867,'materialicon_bookmark_border'],
      [0xe228,'materialicon_border_all'],
      [0xe229,'materialicon_border_bottom'],
      [0xe22a,'materialicon_border_clear'],
      [0xe22b,'materialicon_border_color'],
      [0xe22c,'materialicon_border_horizontal'],
      [0xe22d,'materialicon_border_inner'],
      [0xe22e,'materialicon_border_left'],
      [0xe22f,'materialicon_border_outer'],
      [0xe230,'materialicon_border_right'],
      [0xe231,'materialicon_border_style'],
      [0xe232,'materialicon_border_top'],
      [0xe233,'materialicon_border_vertical'],
      [0xe06b,'materialicon_branding_watermark'],
      [0xe3a6,'materialicon_brightness_1'],
      [0xe3a7,'materialicon_brightness_2'],
      [0xe3a8,'materialicon_brightness_3'],
      [0xe3a9,'materialicon_brightness_4'],
      [0xe3aa,'materialicon_brightness_5'],
      [0xe3ab,'materialicon_brightness_6'],
      [0xe3ac,'materialicon_brightness_7'],
      [0xe1ab,'materialicon_brightness_auto'],
      [0xe1ac,'materialicon_brightness_high'],
      [0xe1ad,'materialicon_brightness_low'],
      [0xe1ae,'materialicon_brightness_medium'],
      [0xe3ad,'materialicon_broken_image'],
      [0xe3ae,'materialicon_brush'],
      [0xe6dd,'materialicon_bubble_chart'],
      [0xe868,'materialicon_bug_report'],
      [0xe869,'materialicon_build'],
      [0xe43c,'materialicon_burst_mode'],
      [0xe0af,'materialicon_business'],
      [0xeb3f,'materialicon_business_center'],
      [0xe86a,'materialicon_cached'],
      [0xe7e9,'materialicon_cake'],
      [0xe0b0,'materialicon_call'],
      [0xe0b1,'materialicon_call_end'],
      [0xe0b2,'materialicon_call_made'],
      [0xe0b3,'materialicon_call_merge'],
      [0xe0b4,'materialicon_call_missed'],
      [0xe0e4,'materialicon_call_missed_outgoing'],
      [0xe0b5,'materialicon_call_received'],
      [0xe0b6,'materialicon_call_split'],
      [0xe06c,'materialicon_call_to_action'],
      [0xe3af,'materialicon_camera'],
      [0xe3b0,'materialicon_camera_alt'],
      [0xe8fc,'materialicon_camera_enhance'],
      [0xe3b1,'materialicon_camera_front'],
      [0xe3b2,'materialicon_camera_rear'],
      [0xe3b3,'materialicon_camera_roll'],
      [0xe5c9,'materialicon_cancel'],
      [0xe8f6,'materialicon_card_giftcard'],
      [0xe8f7,'materialicon_card_membership'],
      [0xe8f8,'materialicon_card_travel'],
      [0xeb40,'materialicon_casino'],
      [0xe307,'materialicon_cast'],
      [0xe308,'materialicon_cast_connected'],
      [0xe3b4,'materialicon_center_focus_strong'],
      [0xe3b5,'materialicon_center_focus_weak'],
      [0xe86b,'materialicon_change_history'],
      [0xe0b7,'materialicon_chat'],
      [0xe0ca,'materialicon_chat_bubble'],
      [0xe0cb,'materialicon_chat_bubble_outline'],
      [0xe5ca,'materialicon_check'],
      [0xe834,'materialicon_check_box'],
      [0xe835,'materialicon_check_box_outline_blank'],
      [0xe86c,'materialicon_check_circle'],
      [0xe5cb,'materialicon_chevron_left'],
      [0xe5cc,'materialicon_chevron_right'],
      [0xeb41,'materialicon_child_care'],
      [0xeb42,'materialicon_child_friendly'],
      [0xe86d,'materialicon_chrome_reader_mode'],
      [0xe86e,'materialicon_class'],
      [0xe14c,'materialicon_clear'],
      [0xe0b8,'materialicon_clear_all'],
      [0xe5cd,'materialicon_close'],
      [0xe01c,'materialicon_closed_caption'],
      [0xe2bd,'materialicon_cloud'],
      [0xe2be,'materialicon_cloud_circle'],
      [0xe2bf,'materialicon_cloud_done'],
      [0xe2c0,'materialicon_cloud_download'],
      [0xe2c1,'materialicon_cloud_off'],
      [0xe2c2,'materialicon_cloud_queue'],
      [0xe2c3,'materialicon_cloud_upload'],
      [0xe86f,'materialicon_code'],
      [0xe3b6,'materialicon_collections'],
      [0xe431,'materialicon_collections_bookmark'],
      [0xe3b7,'materialicon_color_lens'],
      [0xe3b8,'materialicon_colorize'],
      [0xe0b9,'materialicon_comment'],
      [0xe3b9,'materialicon_compare'],
      [0xe915,'materialicon_compare_arrows'],
      [0xe30a,'materialicon_computer'],
      [0xe638,'materialicon_confirmation_number'],
      [0xe0d0,'materialicon_contact_mail'],
      [0xe0cf,'materialicon_contact_phone'],
      [0xe0ba,'materialicon_contacts'],
      [0xe14d,'materialicon_content_copy'],
      [0xe14e,'materialicon_content_cut'],
      [0xe14f,'materialicon_content_paste'],
      [0xe3ba,'materialicon_control_point'],
      [0xe3bb,'materialicon_control_point_duplicate'],
      [0xe90c,'materialicon_copyright'],
      [0xe150,'materialicon_create'],
      [0xe2cc,'materialicon_create_new_folder'],
      [0xe870,'materialicon_credit_card'],
      [0xe3be,'materialicon_crop'],
      [0xe3bc,'materialicon_crop_16_9'],
      [0xe3bd,'materialicon_crop_3_2'],
      [0xe3bf,'materialicon_crop_5_4'],
      [0xe3c0,'materialicon_crop_7_5'],
      [0xe3c1,'materialicon_crop_din'],
      [0xe3c2,'materialicon_crop_free'],
      [0xe3c3,'materialicon_crop_landscape'],
      [0xe3c4,'materialicon_crop_original'],
      [0xe3c5,'materialicon_crop_portrait'],
      [0xe437,'materialicon_crop_rotate'],
      [0xe3c6,'materialicon_crop_square'],
      [0xe871,'materialicon_dashboard'],
      [0xe1af,'materialicon_data_usage'],
      [0xe916,'materialicon_date_range'],
      [0xe3c7,'materialicon_dehaze'],
      [0xe872,'materialicon_delete'],
      [0xe92b,'materialicon_delete_forever'],
      [0xe16c,'materialicon_delete_sweep'],
      [0xe873,'materialicon_description'],
      [0xe30b,'materialicon_desktop_mac'],
      [0xe30c,'materialicon_desktop_windows'],
      [0xe3c8,'materialicon_details'],
      [0xe30d,'materialicon_developer_board'],
      [0xe1b0,'materialicon_developer_mode'],
      [0xe335,'materialicon_device_hub'],
      [0xe1b1,'materialicon_devices'],
      [0xe337,'materialicon_devices_other'],
      [0xe0bb,'materialicon_dialer_sip'],
      [0xe0bc,'materialicon_dialpad'],
      [0xe52e,'materialicon_directions'],
      [0xe52f,'materialicon_directions_bike'],
      [0xe532,'materialicon_directions_boat'],
      [0xe530,'materialicon_directions_bus'],
      [0xe531,'materialicon_directions_car'],
      [0xe534,'materialicon_directions_railway'],
      [0xe566,'materialicon_directions_run'],
      [0xe533,'materialicon_directions_subway'],
      [0xe535,'materialicon_directions_transit'],
      [0xe536,'materialicon_directions_walk'],
      [0xe610,'materialicon_disc_full'],
      [0xe875,'materialicon_dns'],
      [0xe612,'materialicon_do_not_disturb'],
      [0xe611,'materialicon_do_not_disturb_alt'],
      [0xe643,'materialicon_do_not_disturb_off'],
      [0xe644,'materialicon_do_not_disturb_on'],
      [0xe30e,'materialicon_dock'],
      [0xe7ee,'materialicon_domain'],
      [0xe876,'materialicon_done'],
      [0xe877,'materialicon_done_all'],
      [0xe917,'materialicon_donut_large'],
      [0xe918,'materialicon_donut_small'],
      [0xe151,'materialicon_drafts'],
      [0xe25d,'materialicon_drag_handle'],
      [0xe613,'materialicon_drive_eta'],
      [0xe1b2,'materialicon_dvr'],
      [0xe3c9,'materialicon_edit'],
      [0xe568,'materialicon_edit_location'],
      [0xe8fb,'materialicon_eject'],
      [0xe0be,'materialicon_email'],
      [0xe63f,'materialicon_enhanced_encryption'],
      [0xe01d,'materialicon_equalizer'],
      [0xe000,'materialicon_error'],
      [0xe001,'materialicon_error_outline'],
      [0xe926,'materialicon_euro_symbol'],
      [0xe56d,'materialicon_ev_station'],
      [0xe878,'materialicon_event'],
      [0xe614,'materialicon_event_available'],
      [0xe615,'materialicon_event_busy'],
      [0xe616,'materialicon_event_note'],
      [0xe903,'materialicon_event_seat'],
      [0xe879,'materialicon_exit_to_app'],
      [0xe5ce,'materialicon_expand_less'],
      [0xe5cf,'materialicon_expand_more'],
      [0xe01e,'materialicon_explicit'],
      [0xe87a,'materialicon_explore'],
      [0xe3ca,'materialicon_exposure'],
      [0xe3cb,'materialicon_exposure_neg_1'],
      [0xe3cc,'materialicon_exposure_neg_2'],
      [0xe3cd,'materialicon_exposure_plus_1'],
      [0xe3ce,'materialicon_exposure_plus_2'],
      [0xe3cf,'materialicon_exposure_zero'],
      [0xe87b,'materialicon_extension'],
      [0xe87c,'materialicon_face'],
      [0xe01f,'materialicon_fast_forward'],
      [0xe020,'materialicon_fast_rewind'],
      [0xe87d,'materialicon_favorite'],
      [0xe87e,'materialicon_favorite_border'],
      [0xe06d,'materialicon_featured_play_list'],
      [0xe06e,'materialicon_featured_video'],
      [0xe87f,'materialicon_feedback'],
      [0xe05d,'materialicon_fiber_dvr'],
      [0xe061,'materialicon_fiber_manual_record'],
      [0xe05e,'materialicon_fiber_new'],
      [0xe06a,'materialicon_fiber_pin'],
      [0xe062,'materialicon_fiber_smart_record'],
      [0xe2c4,'materialicon_file_download'],
      [0xe2c6,'materialicon_file_upload'],
      [0xe3d3,'materialicon_filter'],
      [0xe3d0,'materialicon_filter_1'],
      [0xe3d1,'materialicon_filter_2'],
      [0xe3d2,'materialicon_filter_3'],
      [0xe3d4,'materialicon_filter_4'],
      [0xe3d5,'materialicon_filter_5'],
      [0xe3d6,'materialicon_filter_6'],
      [0xe3d7,'materialicon_filter_7'],
      [0xe3d8,'materialicon_filter_8'],
      [0xe3d9,'materialicon_filter_9'],
      [0xe3da,'materialicon_filter_9_plus'],
      [0xe3db,'materialicon_filter_b_and_w'],
      [0xe3dc,'materialicon_filter_center_focus'],
      [0xe3dd,'materialicon_filter_drama'],
      [0xe3de,'materialicon_filter_frames'],
      [0xe3df,'materialicon_filter_hdr'],
      [0xe152,'materialicon_filter_list'],
      [0xe3e0,'materialicon_filter_none'],
      [0xe3e2,'materialicon_filter_tilt_shift'],
      [0xe3e3,'materialicon_filter_vintage'],
      [0xe880,'materialicon_find_in_page'],
      [0xe881,'materialicon_find_replace'],
      [0xe90d,'materialicon_fingerprint'],
      [0xe5dc,'materialicon_first_page'],
      [0xeb43,'materialicon_fitness_center'],
      [0xe153,'materialicon_flag'],
      [0xe3e4,'materialicon_flare'],
      [0xe3e5,'materialicon_flash_auto'],
      [0xe3e6,'materialicon_flash_off'],
      [0xe3e7,'materialicon_flash_on'],
      [0xe539,'materialicon_flight'],
      [0xe904,'materialicon_flight_land'],
      [0xe905,'materialicon_flight_takeoff'],
      [0xe3e8,'materialicon_flip'],
      [0xe882,'materialicon_flip_to_back'],
      [0xe883,'materialicon_flip_to_front'],
      [0xe2c7,'materialicon_folder'],
      [0xe2c8,'materialicon_folder_open'],
      [0xe2c9,'materialicon_folder_shared'],
      [0xe617,'materialicon_folder_special'],
      [0xe167,'materialicon_font_download'],
      [0xe234,'materialicon_format_align_center'],
      [0xe235,'materialicon_format_align_justify'],
      [0xe236,'materialicon_format_align_left'],
      [0xe237,'materialicon_format_align_right'],
      [0xe238,'materialicon_format_bold'],
      [0xe239,'materialicon_format_clear'],
      [0xe23a,'materialicon_format_color_fill'],
      [0xe23b,'materialicon_format_color_reset'],
      [0xe23c,'materialicon_format_color_text'],
      [0xe23d,'materialicon_format_indent_decrease'],
      [0xe23e,'materialicon_format_indent_increase'],
      [0xe23f,'materialicon_format_italic'],
      [0xe240,'materialicon_format_line_spacing'],
      [0xe241,'materialicon_format_list_bulleted'],
      [0xe242,'materialicon_format_list_numbered'],
      [0xe243,'materialicon_format_paint'],
      [0xe244,'materialicon_format_quote'],
      [0xe25e,'materialicon_format_shapes'],
      [0xe245,'materialicon_format_size'],
      [0xe246,'materialicon_format_strikethrough'],
      [0xe247,'materialicon_format_textdirection_l_to_r'],
      [0xe248,'materialicon_format_textdirection_r_to_l'],
      [0xe249,'materialicon_format_underlined'],
      [0xe0bf,'materialicon_forum'],
      [0xe154,'materialicon_forward'],
      [0xe056,'materialicon_forward_10'],
      [0xe057,'materialicon_forward_30'],
      [0xe058,'materialicon_forward_5'],
      [0xeb44,'materialicon_free_breakfast'],
      [0xe5d0,'materialicon_fullscreen'],
      [0xe5d1,'materialicon_fullscreen_exit'],
      [0xe24a,'materialicon_functions'],
      [0xe927,'materialicon_g_translate'],
      [0xe30f,'materialicon_gamepad'],
      [0xe021,'materialicon_games'],
      [0xe90e,'materialicon_gavel'],
      [0xe155,'materialicon_gesture'],
      [0xe884,'materialicon_get_app'],
      [0xe908,'materialicon_gif'],
      [0xeb45,'materialicon_golf_course'],
      [0xe1b3,'materialicon_gps_fixed'],
      [0xe1b4,'materialicon_gps_not_fixed'],
      [0xe1b5,'materialicon_gps_off'],
      [0xe885,'materialicon_grade'],
      [0xe3e9,'materialicon_gradient'],
      [0xe3ea,'materialicon_grain'],
      [0xe1b8,'materialicon_graphic_eq'],
      [0xe3eb,'materialicon_grid_off'],
      [0xe3ec,'materialicon_grid_on'],
      [0xe7ef,'materialicon_group'],
      [0xe7f0,'materialicon_group_add'],
      [0xe886,'materialicon_group_work'],
      [0xe052,'materialicon_hd'],
      [0xe3ed,'materialicon_hdr_off'],
      [0xe3ee,'materialicon_hdr_on'],
      [0xe3f1,'materialicon_hdr_strong'],
      [0xe3f2,'materialicon_hdr_weak'],
      [0xe310,'materialicon_headset'],
      [0xe311,'materialicon_headset_mic'],
      [0xe3f3,'materialicon_healing'],
      [0xe023,'materialicon_hearing'],
      [0xe887,'materialicon_help'],
      [0xe8fd,'materialicon_help_outline'],
      [0xe024,'materialicon_high_quality'],
      [0xe25f,'materialicon_highlight'],
      [0xe888,'materialicon_highlight_off'],
      [0xe889,'materialicon_history'],
      [0xe88a,'materialicon_home'],
      [0xeb46,'materialicon_hot_tub'],
      [0xe53a,'materialicon_hotel'],
      [0xe88b,'materialicon_hourglass_empty'],
      [0xe88c,'materialicon_hourglass_full'],
      [0xe902,'materialicon_http'],
      [0xe88d,'materialicon_https'],
      [0xe3f4,'materialicon_image'],
      [0xe3f5,'materialicon_image_aspect_ratio'],
      [0xe0e0,'materialicon_import_contacts'],
      [0xe0c3,'materialicon_import_export'],
      [0xe912,'materialicon_important_devices'],
      [0xe156,'materialicon_inbox'],
      [0xe909,'materialicon_indeterminate_check_box'],
      [0xe88e,'materialicon_info'],
      [0xe88f,'materialicon_info_outline'],
      [0xe890,'materialicon_input'],
      [0xe24b,'materialicon_insert_chart'],
      [0xe24c,'materialicon_insert_comment'],
      [0xe24d,'materialicon_insert_drive_file'],
      [0xe24e,'materialicon_insert_emoticon'],
      [0xe24f,'materialicon_insert_invitation'],
      [0xe250,'materialicon_insert_link'],
      [0xe251,'materialicon_insert_photo'],
      [0xe891,'materialicon_invert_colors'],
      [0xe0c4,'materialicon_invert_colors_off'],
      [0xe3f6,'materialicon_iso'],
      [0xe312,'materialicon_keyboard'],
      [0xe313,'materialicon_keyboard_arrow_down'],
      [0xe314,'materialicon_keyboard_arrow_left'],
      [0xe315,'materialicon_keyboard_arrow_right'],
      [0xe316,'materialicon_keyboard_arrow_up'],
      [0xe317,'materialicon_keyboard_backspace'],
      [0xe318,'materialicon_keyboard_capslock'],
      [0xe31a,'materialicon_keyboard_hide'],
      [0xe31b,'materialicon_keyboard_return'],
      [0xe31c,'materialicon_keyboard_tab'],
      [0xe31d,'materialicon_keyboard_voice'],
      [0xeb47,'materialicon_kitchen'],
      [0xe892,'materialicon_label'],
      [0xe893,'materialicon_label_outline'],
      [0xe3f7,'materialicon_landscape'],
      [0xe894,'materialicon_language'],
      [0xe31e,'materialicon_laptop'],
      [0xe31f,'materialicon_laptop_chromebook'],
      [0xe320,'materialicon_laptop_mac'],
      [0xe321,'materialicon_laptop_windows'],
      [0xe5dd,'materialicon_last_page'],
      [0xe895,'materialicon_launch'],
      [0xe53b,'materialicon_layers'],
      [0xe53c,'materialicon_layers_clear'],
      [0xe3f8,'materialicon_leak_add'],
      [0xe3f9,'materialicon_leak_remove'],
      [0xe3fa,'materialicon_lens'],
      [0xe02e,'materialicon_library_add'],
      [0xe02f,'materialicon_library_books'],
      [0xe030,'materialicon_library_music'],
      [0xe90f,'materialicon_lightbulb_outline'],
      [0xe919,'materialicon_line_style'],
      [0xe91a,'materialicon_line_weight'],
      [0xe260,'materialicon_linear_scale'],
      [0xe157,'materialicon_link'],
      [0xe438,'materialicon_linked_camera'],
      [0xe896,'materialicon_list'],
      [0xe0c6,'materialicon_live_help'],
      [0xe639,'materialicon_live_tv'],
      [0xe53f,'materialicon_local_activity'],
      [0xe53d,'materialicon_local_airport'],
      [0xe53e,'materialicon_local_atm'],
      [0xe540,'materialicon_local_bar'],
      [0xe541,'materialicon_local_cafe'],
      [0xe542,'materialicon_local_car_wash'],
      [0xe543,'materialicon_local_convenience_store'],
      [0xe556,'materialicon_local_dining'],
      [0xe544,'materialicon_local_drink'],
      [0xe545,'materialicon_local_florist'],
      [0xe546,'materialicon_local_gas_station'],
      [0xe547,'materialicon_local_grocery_store'],
      [0xe548,'materialicon_local_hospital'],
      [0xe549,'materialicon_local_hotel'],
      [0xe54a,'materialicon_local_laundry_service'],
      [0xe54b,'materialicon_local_library'],
      [0xe54c,'materialicon_local_mall'],
      [0xe54d,'materialicon_local_movies'],
      [0xe54e,'materialicon_local_offer'],
      [0xe54f,'materialicon_local_parking'],
      [0xe550,'materialicon_local_pharmacy'],
      [0xe551,'materialicon_local_phone'],
      [0xe552,'materialicon_local_pizza'],
      [0xe553,'materialicon_local_play'],
      [0xe554,'materialicon_local_post_office'],
      [0xe555,'materialicon_local_printshop'],
      [0xe557,'materialicon_local_see'],
      [0xe558,'materialicon_local_shipping'],
      [0xe559,'materialicon_local_taxi'],
      [0xe7f1,'materialicon_location_city'],
      [0xe1b6,'materialicon_location_disabled'],
      [0xe0c7,'materialicon_location_off'],
      [0xe0c8,'materialicon_location_on'],
      [0xe1b7,'materialicon_location_searching'],
      [0xe897,'materialicon_lock'],
      [0xe898,'materialicon_lock_open'],
      [0xe899,'materialicon_lock_outline'],
      [0xe3fc,'materialicon_looks'],
      [0xe3fb,'materialicon_looks_3'],
      [0xe3fd,'materialicon_looks_4'],
      [0xe3fe,'materialicon_looks_5'],
      [0xe3ff,'materialicon_looks_6'],
      [0xe400,'materialicon_looks_one'],
      [0xe401,'materialicon_looks_two'],
      [0xe028,'materialicon_loop'],
      [0xe402,'materialicon_loupe'],
      [0xe16d,'materialicon_low_priority'],
      [0xe89a,'materialicon_loyalty'],
      [0xe158,'materialicon_mail'],
      [0xe0e1,'materialicon_mail_outline'],
      [0xe55b,'materialicon_map'],
      [0xe159,'materialicon_markunread'],
      [0xe89b,'materialicon_markunread_mailbox'],
      [0xe322,'materialicon_memory'],
      [0xe5d2,'materialicon_menu'],
      [0xe252,'materialicon_merge_type'],
      [0xe0c9,'materialicon_message'],
      [0xe029,'materialicon_mic'],
      [0xe02a,'materialicon_mic_none'],
      [0xe02b,'materialicon_mic_off'],
      [0xe618,'materialicon_mms'],
      [0xe253,'materialicon_mode_comment'],
      [0xe254,'materialicon_mode_edit'],
      [0xe263,'materialicon_monetization_on'],
      [0xe25c,'materialicon_money_off'],
      [0xe403,'materialicon_monochrome_photos'],
      [0xe7f2,'materialicon_mood'],
      [0xe7f3,'materialicon_mood_bad'],
      [0xe619,'materialicon_more'],
      [0xe5d3,'materialicon_more_horiz'],
      [0xe5d4,'materialicon_more_vert'],
      [0xe91b,'materialicon_motorcycle'],
      [0xe323,'materialicon_mouse'],
      [0xe168,'materialicon_move_to_inbox'],
      [0xe02c,'materialicon_movie'],
      [0xe404,'materialicon_movie_creation'],
      [0xe43a,'materialicon_movie_filter'],
      [0xe6df,'materialicon_multiline_chart'],
      [0xe405,'materialicon_music_note'],
      [0xe063,'materialicon_music_video'],
      [0xe55c,'materialicon_my_location'],
      [0xe406,'materialicon_nature'],
      [0xe407,'materialicon_nature_people'],
      [0xe408,'materialicon_navigate_before'],
      [0xe409,'materialicon_navigate_next'],
      [0xe55d,'materialicon_navigation'],
      [0xe569,'materialicon_near_me'],
      [0xe1b9,'materialicon_network_cell'],
      [0xe640,'materialicon_network_check'],
      [0xe61a,'materialicon_network_locked'],
      [0xe1ba,'materialicon_network_wifi'],
      [0xe031,'materialicon_new_releases'],
      [0xe16a,'materialicon_next_week'],
      [0xe1bb,'materialicon_nfc'],
      [0xe641,'materialicon_no_encryption'],
      [0xe0cc,'materialicon_no_sim'],
      [0xe033,'materialicon_not_interested'],
      [0xe06f,'materialicon_note'],
      [0xe89c,'materialicon_note_add'],
      [0xe7f4,'materialicon_notifications'],
      [0xe7f7,'materialicon_notifications_active'],
      [0xe7f5,'materialicon_notifications_none'],
      [0xe7f6,'materialicon_notifications_off'],
      [0xe7f8,'materialicon_notifications_paused'],
      [0xe90a,'materialicon_offline_pin'],
      [0xe63a,'materialicon_ondemand_video'],
      [0xe91c,'materialicon_opacity'],
      [0xe89d,'materialicon_open_in_browser'],
      [0xe89e,'materialicon_open_in_new'],
      [0xe89f,'materialicon_open_with'],
      [0xe7f9,'materialicon_pages'],
      [0xe8a0,'materialicon_pageview'],
      [0xe40a,'materialicon_palette'],
      [0xe925,'materialicon_pan_tool'],
      [0xe40b,'materialicon_panorama'],
      [0xe40c,'materialicon_panorama_fish_eye'],
      [0xe40d,'materialicon_panorama_horizontal'],
      [0xe40e,'materialicon_panorama_vertical'],
      [0xe40f,'materialicon_panorama_wide_angle'],
      [0xe7fa,'materialicon_party_mode'],
      [0xe034,'materialicon_pause'],
      [0xe035,'materialicon_pause_circle_filled'],
      [0xe036,'materialicon_pause_circle_outline'],
      [0xe8a1,'materialicon_payment'],
      [0xe7fb,'materialicon_people'],
      [0xe7fc,'materialicon_people_outline'],
      [0xe8a2,'materialicon_perm_camera_mic'],
      [0xe8a3,'materialicon_perm_contact_calendar'],
      [0xe8a4,'materialicon_perm_data_setting'],
      [0xe8a5,'materialicon_perm_device_information'],
      [0xe8a6,'materialicon_perm_identity'],
      [0xe8a7,'materialicon_perm_media'],
      [0xe8a8,'materialicon_perm_phone_msg'],
      [0xe8a9,'materialicon_perm_scan_wifi'],
      [0xe7fd,'materialicon_person'],
      [0xe7fe,'materialicon_person_add'],
      [0xe7ff,'materialicon_person_outline'],
      [0xe55a,'materialicon_person_pin'],
      [0xe56a,'materialicon_person_pin_circle'],
      [0xe63b,'materialicon_personal_video'],
      [0xe91d,'materialicon_pets'],
      [0xe0cd,'materialicon_phone'],
      [0xe324,'materialicon_phone_android'],
      [0xe61b,'materialicon_phone_bluetooth_speaker'],
      [0xe61c,'materialicon_phone_forwarded'],
      [0xe61d,'materialicon_phone_in_talk'],
      [0xe325,'materialicon_phone_iphone'],
      [0xe61e,'materialicon_phone_locked'],
      [0xe61f,'materialicon_phone_missed'],
      [0xe620,'materialicon_phone_paused'],
      [0xe326,'materialicon_phonelink'],
      [0xe0db,'materialicon_phonelink_erase'],
      [0xe0dc,'materialicon_phonelink_lock'],
      [0xe327,'materialicon_phonelink_off'],
      [0xe0dd,'materialicon_phonelink_ring'],
      [0xe0de,'materialicon_phonelink_setup'],
      [0xe410,'materialicon_photo'],
      [0xe411,'materialicon_photo_album'],
      [0xe412,'materialicon_photo_camera'],
      [0xe43b,'materialicon_photo_filter'],
      [0xe413,'materialicon_photo_library'],
      [0xe432,'materialicon_photo_size_select_actual'],
      [0xe433,'materialicon_photo_size_select_large'],
      [0xe434,'materialicon_photo_size_select_small'],
      [0xe415,'materialicon_picture_as_pdf'],
      [0xe8aa,'materialicon_picture_in_picture'],
      [0xe911,'materialicon_picture_in_picture_alt'],
      [0xe6c4,'materialicon_pie_chart'],
      [0xe6c5,'materialicon_pie_chart_outlined'],
      [0xe55e,'materialicon_pin_drop'],
      [0xe55f,'materialicon_place'],
      [0xe037,'materialicon_play_arrow'],
      [0xe038,'materialicon_play_circle_filled'],
      [0xe039,'materialicon_play_circle_outline'],
      [0xe906,'materialicon_play_for_work'],
      [0xe03b,'materialicon_playlist_add'],
      [0xe065,'materialicon_playlist_add_check'],
      [0xe05f,'materialicon_playlist_play'],
      [0xe800,'materialicon_plus_one'],
      [0xe801,'materialicon_poll'],
      [0xe8ab,'materialicon_polymer'],
      [0xeb48,'materialicon_pool'],
      [0xe0ce,'materialicon_portable_wifi_off'],
      [0xe416,'materialicon_portrait'],
      [0xe63c,'materialicon_power'],
      [0xe336,'materialicon_power_input'],
      [0xe8ac,'materialicon_power_settings_new'],
      [0xe91e,'materialicon_pregnant_woman'],
      [0xe0df,'materialicon_present_to_all'],
      [0xe8ad,'materialicon_print'],
      [0xe645,'materialicon_priority_high'],
      [0xe80b,'materialicon_public'],
      [0xe255,'materialicon_publish'],
      [0xe8ae,'materialicon_query_builder'],
      [0xe8af,'materialicon_question_answer'],
      [0xe03c,'materialicon_queue'],
      [0xe03d,'materialicon_queue_music'],
      [0xe066,'materialicon_queue_play_next'],
      [0xe03e,'materialicon_radio'],
      [0xe837,'materialicon_radio_button_checked'],
      [0xe836,'materialicon_radio_button_unchecked'],
      [0xe560,'materialicon_rate_review'],
      [0xe8b0,'materialicon_receipt'],
      [0xe03f,'materialicon_recent_actors'],
      [0xe91f,'materialicon_record_voice_over'],
      [0xe8b1,'materialicon_redeem'],
      [0xe15a,'materialicon_redo'],
      [0xe5d5,'materialicon_refresh'],
      [0xe15b,'materialicon_remove'],
      [0xe15c,'materialicon_remove_circle'],
      [0xe15d,'materialicon_remove_circle_outline'],
      [0xe067,'materialicon_remove_from_queue'],
      [0xe417,'materialicon_remove_red_eye'],
      [0xe928,'materialicon_remove_shopping_cart'],
      [0xe8fe,'materialicon_reorder'],
      [0xe040,'materialicon_repeat'],
      [0xe041,'materialicon_repeat_one'],
      [0xe042,'materialicon_replay'],
      [0xe059,'materialicon_replay_10'],
      [0xe05a,'materialicon_replay_30'],
      [0xe05b,'materialicon_replay_5'],
      [0xe15e,'materialicon_reply'],
      [0xe15f,'materialicon_reply_all'],
      [0xe160,'materialicon_report'],
      [0xe8b2,'materialicon_report_problem'],
      [0xe56c,'materialicon_restaurant'],
      [0xe561,'materialicon_restaurant_menu'],
      [0xe8b3,'materialicon_restore'],
      [0xe929,'materialicon_restore_page'],
      [0xe0d1,'materialicon_ring_volume'],
      [0xe8b4,'materialicon_room'],
      [0xeb49,'materialicon_room_service'],
      [0xe418,'materialicon_rotate_90_degrees_ccw'],
      [0xe419,'materialicon_rotate_left'],
      [0xe41a,'materialicon_rotate_right'],
      [0xe920,'materialicon_rounded_corner'],
      [0xe328,'materialicon_router'],
      [0xe921,'materialicon_rowing'],
      [0xe0e5,'materialicon_rss_feed'],
      [0xe642,'materialicon_rv_hookup'],
      [0xe562,'materialicon_satellite'],
      [0xe161,'materialicon_save'],
      [0xe329,'materialicon_scanner'],
      [0xe8b5,'materialicon_schedule'],
      [0xe80c,'materialicon_school'],
      [0xe1be,'materialicon_screen_lock_landscape'],
      [0xe1bf,'materialicon_screen_lock_portrait'],
      [0xe1c0,'materialicon_screen_lock_rotation'],
      [0xe1c1,'materialicon_screen_rotation'],
      [0xe0e2,'materialicon_screen_share'],
      [0xe623,'materialicon_sd_card'],
      [0xe1c2,'materialicon_sd_storage'],
      [0xe8b6,'materialicon_search'],
      [0xe32a,'materialicon_security'],
      [0xe162,'materialicon_select_all'],
      [0xe163,'materialicon_send'],
      [0xe811,'materialicon_sentiment_dissatisfied'],
      [0xe812,'materialicon_sentiment_neutral'],
      [0xe813,'materialicon_sentiment_satisfied'],
      [0xe814,'materialicon_sentiment_very_dissatisfied'],
      [0xe815,'materialicon_sentiment_very_satisfied'],
      [0xe8b8,'materialicon_settings'],
      [0xe8b9,'materialicon_settings_applications'],
      [0xe8ba,'materialicon_settings_backup_restore'],
      [0xe8bb,'materialicon_settings_bluetooth'],
      [0xe8bd,'materialicon_settings_brightness'],
      [0xe8bc,'materialicon_settings_cell'],
      [0xe8be,'materialicon_settings_ethernet'],
      [0xe8bf,'materialicon_settings_input_antenna'],
      [0xe8c0,'materialicon_settings_input_component'],
      [0xe8c1,'materialicon_settings_input_composite'],
      [0xe8c2,'materialicon_settings_input_hdmi'],
      [0xe8c3,'materialicon_settings_input_svideo'],
      [0xe8c4,'materialicon_settings_overscan'],
      [0xe8c5,'materialicon_settings_phone'],
      [0xe8c6,'materialicon_settings_power'],
      [0xe8c7,'materialicon_settings_remote'],
      [0xe1c3,'materialicon_settings_system_daydream'],
      [0xe8c8,'materialicon_settings_voice'],
      [0xe80d,'materialicon_share'],
      [0xe8c9,'materialicon_shop'],
      [0xe8ca,'materialicon_shop_two'],
      [0xe8cb,'materialicon_shopping_basket'],
      [0xe8cc,'materialicon_shopping_cart'],
      [0xe261,'materialicon_short_text'],
      [0xe6e1,'materialicon_show_chart'],
      [0xe043,'materialicon_shuffle'],
      [0xe1c8,'materialicon_signal_cellular_4_bar'],
      [0xe1cd,'materialicon_signal_cellular_connected_no_internet_4_bar'],
      [0xe1ce,'materialicon_signal_cellular_no_sim'],
      [0xe1cf,'materialicon_signal_cellular_null'],
      [0xe1d0,'materialicon_signal_cellular_off'],
      [0xe1d8,'materialicon_signal_wifi_4_bar'],
      [0xe1d9,'materialicon_signal_wifi_4_bar_lock'],
      [0xe1da,'materialicon_signal_wifi_off'],
      [0xe32b,'materialicon_sim_card'],
      [0xe624,'materialicon_sim_card_alert'],
      [0xe044,'materialicon_skip_next'],
      [0xe045,'materialicon_skip_previous'],
      [0xe41b,'materialicon_slideshow'],
      [0xe068,'materialicon_slow_motion_video'],
      [0xe32c,'materialicon_smartphone'],
      [0xeb4a,'materialicon_smoke_free'],
      [0xeb4b,'materialicon_smoking_rooms'],
      [0xe625,'materialicon_sms'],
      [0xe626,'materialicon_sms_failed'],
      [0xe046,'materialicon_snooze'],
      [0xe164,'materialicon_sort'],
      [0xe053,'materialicon_sort_by_alpha'],
      [0xeb4c,'materialicon_spa'],
      [0xe256,'materialicon_space_bar'],
      [0xe32d,'materialicon_speaker'],
      [0xe32e,'materialicon_speaker_group'],
      [0xe8cd,'materialicon_speaker_notes'],
      [0xe92a,'materialicon_speaker_notes_off'],
      [0xe0d2,'materialicon_speaker_phone'],
      [0xe8ce,'materialicon_spellcheck'],
      [0xe838,'materialicon_star'],
      [0xe83a,'materialicon_star_border'],
      [0xe839,'materialicon_star_half'],
      [0xe8d0,'materialicon_stars'],
      [0xe0d3,'materialicon_stay_current_landscape'],
      [0xe0d4,'materialicon_stay_current_portrait'],
      [0xe0d5,'materialicon_stay_primary_landscape'],
      [0xe0d6,'materialicon_stay_primary_portrait'],
      [0xe047,'materialicon_stop'],
      [0xe0e3,'materialicon_stop_screen_share'],
      [0xe1db,'materialicon_storage'],
      [0xe8d1,'materialicon_store'],
      [0xe563,'materialicon_store_mall_directory'],
      [0xe41c,'materialicon_straighten'],
      [0xe56e,'materialicon_streetview'],
      [0xe257,'materialicon_strikethrough_s'],
      [0xe41d,'materialicon_style'],
      [0xe5d9,'materialicon_subdirectory_arrow_left'],
      [0xe5da,'materialicon_subdirectory_arrow_right'],
      [0xe8d2,'materialicon_subject'],
      [0xe064,'materialicon_subscriptions'],
      [0xe048,'materialicon_subtitles'],
      [0xe56f,'materialicon_subway'],
      [0xe8d3,'materialicon_supervisor_account'],
      [0xe049,'materialicon_surround_sound'],
      [0xe0d7,'materialicon_swap_calls'],
      [0xe8d4,'materialicon_swap_horiz'],
      [0xe8d5,'materialicon_swap_vert'],
      [0xe8d6,'materialicon_swap_vertical_circle'],
      [0xe41e,'materialicon_switch_camera'],
      [0xe41f,'materialicon_switch_video'],
      [0xe627,'materialicon_sync'],
      [0xe628,'materialicon_sync_disabled'],
      [0xe629,'materialicon_sync_problem'],
      [0xe62a,'materialicon_system_update'],
      [0xe8d7,'materialicon_system_update_alt'],
      [0xe8d8,'materialicon_tab'],
      [0xe8d9,'materialicon_tab_unselected'],
      [0xe32f,'materialicon_tablet'],
      [0xe330,'materialicon_tablet_android'],
      [0xe331,'materialicon_tablet_mac'],
      [0xe420,'materialicon_tag_faces'],
      [0xe62b,'materialicon_tap_and_play'],
      [0xe564,'materialicon_terrain'],
      [0xe262,'materialicon_text_fields'],
      [0xe165,'materialicon_text_format'],
      [0xe0d8,'materialicon_textsms'],
      [0xe421,'materialicon_texture'],
      [0xe8da,'materialicon_theaters'],
      [0xe8db,'materialicon_thumb_down'],
      [0xe8dc,'materialicon_thumb_up'],
      [0xe8dd,'materialicon_thumbs_up_down'],
      [0xe62c,'materialicon_time_to_leave'],
      [0xe422,'materialicon_timelapse'],
      [0xe922,'materialicon_timeline'],
      [0xe425,'materialicon_timer'],
      [0xe423,'materialicon_timer_10'],
      [0xe424,'materialicon_timer_3'],
      [0xe426,'materialicon_timer_off'],
      [0xe264,'materialicon_title'],
      [0xe8de,'materialicon_toc'],
      [0xe8df,'materialicon_today'],
      [0xe8e0,'materialicon_toll'],
      [0xe427,'materialicon_tonality'],
      [0xe913,'materialicon_touch_app'],
      [0xe332,'materialicon_toys'],
      [0xe8e1,'materialicon_track_changes'],
      [0xe565,'materialicon_traffic'],
      [0xe570,'materialicon_train'],
      [0xe571,'materialicon_tram'],
      [0xe572,'materialicon_transfer_within_a_station'],
      [0xe428,'materialicon_transform'],
      [0xe8e2,'materialicon_translate'],
      [0xe8e3,'materialicon_trending_down'],
      [0xe8e4,'materialicon_trending_flat'],
      [0xe8e5,'materialicon_trending_up'],
      [0xe429,'materialicon_tune'],
      [0xe8e6,'materialicon_turned_in'],
      [0xe8e7,'materialicon_turned_in_not'],
      [0xe333,'materialicon_tv'],
      [0xe169,'materialicon_unarchive'],
      [0xe166,'materialicon_undo'],
      [0xe5d6,'materialicon_unfold_less'],
      [0xe5d7,'materialicon_unfold_more'],
      [0xe923,'materialicon_update'],
      [0xe1e0,'materialicon_usb'],
      [0xe8e8,'materialicon_verified_user'],
      [0xe258,'materialicon_vertical_align_bottom'],
      [0xe259,'materialicon_vertical_align_center'],
      [0xe25a,'materialicon_vertical_align_top'],
      [0xe62d,'materialicon_vibration'],
      [0xe070,'materialicon_video_call'],
      [0xe071,'materialicon_video_label'],
      [0xe04a,'materialicon_video_library'],
      [0xe04b,'materialicon_videocam'],
      [0xe04c,'materialicon_videocam_off'],
      [0xe338,'materialicon_videogame_asset'],
      [0xe8e9,'materialicon_view_agenda'],
      [0xe8ea,'materialicon_view_array'],
      [0xe8eb,'materialicon_view_carousel'],
      [0xe8ec,'materialicon_view_column'],
      [0xe42a,'materialicon_view_comfy'],
      [0xe42b,'materialicon_view_compact'],
      [0xe8ed,'materialicon_view_day'],
      [0xe8ee,'materialicon_view_headline'],
      [0xe8ef,'materialicon_view_list'],
      [0xe8f0,'materialicon_view_module'],
      [0xe8f1,'materialicon_view_quilt'],
      [0xe8f2,'materialicon_view_stream'],
      [0xe8f3,'materialicon_view_week'],
      [0xe435,'materialicon_vignette'],
      [0xe8f4,'materialicon_visibility'],
      [0xe8f5,'materialicon_visibility_off'],
      [0xe62e,'materialicon_voice_chat'],
      [0xe0d9,'materialicon_voicemail'],
      [0xe04d,'materialicon_volume_down'],
      [0xe04e,'materialicon_volume_mute'],
      [0xe04f,'materialicon_volume_off'],
      [0xe050,'materialicon_volume_up'],
      [0xe0da,'materialicon_vpn_key'],
      [0xe62f,'materialicon_vpn_lock'],
      [0xe1bc,'materialicon_wallpaper'],
      [0xe002,'materialicon_warning'],
      [0xe334,'materialicon_watch'],
      [0xe924,'materialicon_watch_later'],
      [0xe42c,'materialicon_wb_auto'],
      [0xe42d,'materialicon_wb_cloudy'],
      [0xe42e,'materialicon_wb_incandescent'],
      [0xe436,'materialicon_wb_iridescent'],
      [0xe430,'materialicon_wb_sunny'],
      [0xe63d,'materialicon_wc'],
      [0xe051,'materialicon_web'],
      [0xe069,'materialicon_web_asset'],
      [0xe16b,'materialicon_weekend'],
      [0xe80e,'materialicon_whatshot'],
      [0xe1bd,'materialicon_widgets'],
      [0xe63e,'materialicon_wifi'],
      [0xe1e1,'materialicon_wifi_lock'],
      [0xe1e2,'materialicon_wifi_tethering'],
      [0xe8f9,'materialicon_work'],
      [0xe25b,'materialicon_wrap_text'],
      [0xe8fa,'materialicon_youtube_searched_for'],
      [0xe8ff,'materialicon_zoom_in'],
      [0xe900,'materialicon_zoom_out'],
      [0xe56b,'materialicon_zoom_out_map'],
    ];
  }
}
},{"./jsHarmonyCMS.Editor.Picker.js":3}],5:[function(require,module,exports){
/*
Copyright 2019 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/

exports = module.exports = function(cms){
  var _this = this;
  this.loadQueue = [];
  this.isLoading = false;
  this.defaultLoadObj = {main:1};
  
  this.StartLoading = function(obj){
    if(!obj) obj = _this.defaultLoadObj;
    
    var foundObj = false;
    for(var i=0;i<this.loadQueue.length;i++){ if(obj===this.loadQueue[i]) foundObj = true; }
    if(!foundObj) this.loadQueue.push(obj);

    if(this.isLoading) return;
    this.isLoading = true;

    var loader_obj = document.getElementById('jsHarmonyCMSLoading')

    if(loader_obj){
      if(cms.isInitialized) loader_obj.style.backgroundColor = 'rgba(0,0,0,0.2)';
      if(cms.jsh) cms.jsh.$('#jsHarmonyCMSLoading').fadeIn();
      else loader_obj.style.display = 'block';
    }
    else {
      var loader_obj = document.createElement('div');
      loader_obj.id = 'jsHarmonyCMSLoading';
      //loader_obj.style.backgroundColor = 'rgba(0,0,0,0.5)';
      loader_obj.style.backgroundColor = 'rgba(255,255,255,1)';
      loader_obj.style.position = 'fixed';
      loader_obj.style.top = '0px';
      loader_obj.style.left = '0px';
      loader_obj.style.bottom = '0px';
      loader_obj.style.width = '100%';
      loader_obj.style.zIndex = 2147483641;
      loader_obj.style.cursor = 'wait';
      document.body.appendChild(loader_obj);

      var loader_img_container = document.createElement('div');
      loader_img_container.style.position = 'absolute';
      loader_img_container.style.top = '50%';
      loader_img_container.style.left = '50%';
      loader_obj.appendChild(loader_img_container);

      var loader_img = document.createElement('img');
      loader_img.src = cms._baseurl + 'images/loading-cms.svg';
      loader_img.style.height = '100px';
      loader_img.style.width = '100px';
      loader_img.style.position = 'relative';
      loader_img.style.top = '-50px';
      loader_img.style.left = '-50px';
      loader_img_container.appendChild(loader_img);
    }
  }

  this.StopLoading = function(obj){
    if(!obj) obj = _this.defaultLoadObj;

    for(var i=0;i<this.loadQueue.length;i++){ if(obj===this.loadQueue[i]){ this.loadQueue.splice(i, 1); i--; } }
    if(this.loadQueue.length) return;

    this.isLoading = false;
    if(cms.jsh) cms.jsh.$('#jsHarmonyCMSLoading').stop(true).fadeOut();
    else document.getElementById('jsHarmonyCMSLoading').style.display = 'none';
  }

  this.ClearLoading = function(){
    this.loadQueue = [];
    this.StopLoading();
  }
}
},{}],6:[function(require,module,exports){
/*
Copyright 2019 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/

exports = module.exports = function(jsh, cms){
  var _this = this;
  var $ = jsh.$;
  var XExt = jsh.XExt;
  var async = jsh.async;
  var ejs = jsh.ejs;

  this.menuTemplates = {};
  this.isInitialized = false;

  this.load = function(onComplete){
    var url = '../_funcs/templates/menu/'+cms.branch_id;
    XExt.CallAppFunc(url, 'get', { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        _this.menuTemplates = rslt.menuTemplates;
        async.eachOf(_this.menuTemplates, function(menu, menu_template_id, menu_cb){
          async.eachOf(menu.content_elements, function(content_element, content_element_name, content_element_cb){
            if(!content_element.remote_template) return content_element_cb();

            //Load remote menu templates
            var loadObj = {};
            cms.loader.StartLoading(loadObj);
            $.ajax({
              type: 'GET',
              cache: false,
              url: content_element.remote_template,
              xhrFields: { withCredentials: true },
              success: function(data){
                cms.loader.StopLoading(loadObj);
                content_element.template = (content_element.template||'')+data;
                return content_element_cb();
              },
              error: function(xhr, status, err){
                cms.loader.StopLoading(loadObj);
                content_element.template = '*** ERROR DOWNLOADING REMOTE MENU ***';
                return content_element_cb();
              }
            });
          }, menu_cb);
        }, function(err){
          _this.isInitialized = true;
        });
      }
      else{
        if(onComplete) onComplete(new Error('Error Loading Menus'));
        XExt.Alert('Error loading menus');
      }
    }, function (err) {
      if(onComplete) onComplete(err);
    });
  };

  this.render = function(){
    $('.jsharmony_cms_menu').addClass('mceNonEditable').each(function(){
      var jobj = $(this);
      var menu_tag = jobj.data('menu_tag');
      var content_element_name = jobj.data('menu_content_element');
      var menu_content = '';
      if(!menu_tag) menu_content = '*** MENU MISSING data-menu_tag ATTRIBUTE ***';
      else if(!content_element_name) menu_content = '*** MENU MISSING data-menu_content_element ATTRIBUTE ***';
      else if(!(menu_tag in cms.controller.menus)) menu_content = '*** MISSING MENU DATA FOR MENU TAG ' + menu_tag+' ***';
      else {
        var menu = cms.controller.menus[menu_tag];
        var menuTemplate = _this.menuTemplates[menu.menu_template_id];
        if(!menuTemplate) menu_content = '*** MENU TEMPLATE NOT FOUND: ' + menu.menu_template_id+' ***';
        else if(!(content_element_name in menuTemplate.content_elements)) menu_content = '*** MENU ' + menu.menu_template_id + ' CONTENT ELEMENT NOT DEFINED: ' + content_element_name+' ***';
        else{
          var content_element = menuTemplate.content_elements[content_element_name];
          menu_content = ejs.render(content_element.template || '', cms.controller.getMenuRenderParameters(menu_tag));
        }
      }
      jobj.html(menu_content);
    });
  }
}
},{}],7:[function(require,module,exports){
/*
Copyright 2019 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/

exports = module.exports = function(jsh, cms){
  var _this = this;
  var $ = jsh.$;

  this.editorBarDocked = false;
  this.origMarginTop = undefined;
 
  this.render = function(){
    cms.util.addStyle('jsharmony_cms_editor_css',cms.views['jsh_cms_editor.css']);
    jsh.root.append(cms.views['jsh_cms_editor']);
    this.origMarginTop = $('body').css('margin-top');
    this.toggleAutoHide(false);
    jsh.InitControls();
  }

  this.toggleAutoHide = function(val){
    if(typeof val =='undefined') val = !this.editorBarDocked;
    this.editorBarDocked = !!val;

    if(this.editorBarDocked){
      $('body').css('margin-top', this.origMarginTop);
    }
    else {
      var barHeight = $('#jsharmony_cms_editor_bar .actions').outerHeight();
      $('body').css('margin-top', barHeight+'px');
    }
    $('#jsharmony_cms_editor_bar .autoHideEditorBar').toggleClass('enabled',!val);
  }
  
  this.toggleSettings = function(display, noSlide){
    var jbutton = $('#jsharmony_cms_editor_bar .button.settings');
    var prevdisplay = !!jbutton.hasClass('selected');
    if(typeof display == 'undefined') display = !prevdisplay;
    
    if(prevdisplay==display) return;
    else {
      var jsettings = $('#jsharmony_cms_editor_bar .page_settings');
      if(display){
        //Open
        jbutton.addClass('selected');
        jsettings.stop(true);
        if(noSlide) jsettings.show();
        else jsettings.slideDown();
      }
      else {
        //Close
        if(!cms.controller.validate()) return;
        jbutton.removeClass('selected');
        jsettings.stop(true);
        if(noSlide) jsettings.hide();
        else jsettings.slideUp();
      }
    }
  }

  this.showSettings = function(noSlide){ this.toggleSettings(true, noSlide); }

  this.hideSettings = function(noSlide){ this.toggleSettings(false, noSlide); }


}
},{}],8:[function(require,module,exports){
/*
Copyright 2019 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/

exports = module.exports = function(){
  
  this.setHTML = function(jobj, html){
    try{
      jobj.html(html);
    }
    catch(ex){
      console.log(ex);
    }
  }

  this.appendHTML = function(jobj, html){
    try{
      jobj.append(html);
    }
    catch(ex){
      console.log(ex);
    }
  }

  this.refreshParentPageTree = function(page_folder, page_key){
    if(window.opener){
      window.opener.postMessage('jsharmony-cms:refresh_page_folder:'+page_folder, '*');
      if(page_key) window.opener.postMessage('jsharmony-cms:refresh_page_key:'+page_key, '*');
    }
  }

  this.disableControl = function(jctrl){
    jctrl.removeClass('editable');
    jctrl.addClass('uneditable');

    if (jctrl.hasClass('dropdown')) jctrl.prop('disabled', true);
    else if (jctrl.hasClass('checkbox')) jctrl.prop('disabled', true);
    else if(jctrl.hasClass('xtagbox_base')){
      jctrl.prev().addClass('uneditable');
      jctrl.prev().find('input').prop('disabled', true);
    }
    else jctrl.prop('readonly', true);
  }

  this.loadScript = function(url, cb){
    var script = document.createElement('script');
    if(cb) script.onload = cb;
    script.src = url;
    document.head.appendChild(script);
  }

  this.loadCSS = function(url, cb){
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = url;
    link.media = 'all';
    document.head.appendChild(link);
  }

  this.addStyle = function(id, css){
    var style = document.createElement('style');
    style.type = 'text/css';
    style.media = 'all';
    style.id = id;
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  this.removeStyle = function(id){
    var elem = document.getElementById(id);
    if(elem) elem.parentNode.removeChild(elem);
  }
}
},{}],9:[function(require,module,exports){
(function (global){
/*
Copyright 2019 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/

var jsHarmonyCMSUtil = require('./jsHarmonyCMS.Util.js');
var jsHarmonyCMSLoader = require('./jsHarmonyCMS.Loader.js');
var jsHarmonyCMSToolbar = require('./jsHarmonyCMS.Toolbar.js');
var jsHarmonyCMSController = require('./jsHarmonyCMS.Controller.js');
var jsHarmonyCMSEditor = require('./jsHarmonyCMS.Editor.js');
var jsHarmonyCMSComponentController = require('./jsHarmonyCMS.ComponentController.js');
var jsHarmonyCMSMenuController = require('./jsHarmonyCMS.MenuController.js');

var jsHarmonyCMS = function(){
  var _this = this;

  this.loader = new jsHarmonyCMSLoader(this);
  this.util = new jsHarmonyCMSUtil(this);
  this.toolbar = undefined; //Loaded after init
  this.controller = undefined; //Loaded after init
  this.editor = undefined; //Loaded after init
  this.componentController = undefined; //Loaded after init
  this.menuController = undefined; //Loaded after init
  this.views = {
    'jsh_cms_editor.css': '',
    'jsh_cms_editor': '',
  };


  this.jsh = undefined;
  this._baseurl = '<%-Helper.escapeJS(baseurl)%>';
  this._cookie_suffix = '<%-Helper.escapeJS(cookie_suffix)%>';
  this.readonly = false;
  this.isInitialized = false;
  this.defaultControllerUrl = 'js/jsHarmonyCMS.Controller.page.js';

  this.branch_id = undefined;
  this.filePickerCallback = null;        //function(url)

  this.onInit = null;                    //function(jsh)
  this.onGetControllerUrl = null;        //function() => url
  this.onFilePickerCallback = null;      //function(jdata)
  this.onGetFilePickerParameters = null; //function(filePickerType, url)
  this.onTemplateLoaded = function(f){ $(document).ready(f); }


  var loader = _this.loader;
  var util = _this.util;
  var jsh = null;
  var XExt = null;
  var $ = null;
  var async = null;


  this.init = function(){
    loader.StartLoading();
    //Load jsHarmony
    util.loadScript(_this._baseurl+'js/jsHarmony.js', function(){
      var jshInit = false;
      jsh = _this.jsh = window.jshInstance = new jsHarmony({
        _debug: true,
        _BASEURL: _this._baseurl,
        _PUBLICURL: _this._baseurl,
        forcequery: {},
        home_url: _this._baseurl,
        uimap: {"code_val":"code_val","code_txt":"code_txt","code_parent_id":"code_parent_id","code_icon":"code_icon","code_id":"code_id","code_parent":"code_parent","code_seq":"code_seq","code_type":"code_type"},
        _instance: "jshInstance",
        cookie_suffix: _this._cookie_suffix,
        isAuthenticated: true,
        dev: 1,
        urlrouting: false,
        onInit: function(){
          jshInit = true;
        }
      });
      $ = jsh.$;
      XExt = jsh.XExt;
      async = jsh.async;

      _this.toolbar = new jsHarmonyCMSToolbar(jsh, _this);
      _this.controller = new jsHarmonyCMSController(jsh, _this);
      _this.editor = new jsHarmonyCMSEditor(jsh, _this);

      if(_this.onInit) _this.onInit(jsh);

      var controllerUrl = '';
      if(_this.onGetControllerUrl) controllerUrl = _this.onGetControllerUrl();
      if(!controllerUrl) controllerUrl = _this._baseurl + _this.defaultControllerUrl;
  
      _this.componentController = new jsHarmonyCMSComponentController(jsh, _this);
      _this.menuController = new jsHarmonyCMSMenuController(jsh, _this);
  
      jsh.xLoader = loader;
      async.parallel([
        function(cb){ util.loadScript(_this._baseurl+'application.js', function(){ cb(); }); },
        function(cb){ util.loadScript(_this._baseurl+'js/site.js', function(){ cb(); }); },
        function(cb){ util.loadScript(_this._baseurl+'js/jsHarmony.render.js', function(){
          jsh.Config.debug_params.monitor_globals = false;
          cb();
        }); },
        function(cb){ util.loadScript(controllerUrl, function(){ return cb(); }); },
        function(cb){ XExt.waitUntil(function(){ return jshInit; }, function(){ cb(); }, undefined, 50); },
      ], function(err){
        setTimeout(function(){ _this.load(); }, 1);
      });
    });
    util.loadCSS(_this._baseurl+'jsharmony.css');
    util.loadCSS(_this._baseurl+'application.css?rootcss=.jsharmony_cms');
    util.loadScript('https://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js', function(){
      WebFont.load({ google: { families: ['PT Sans', 'Roboto', 'Roboto:bold', 'Material Icons'] } }); 
    });
    window.addEventListener('message', this.onmessage);
  }
  
  this.load = function(){
    $('.jsharmony_cms_content').prop('contenteditable','true');
    if(jsh._GET['branch_id']){
      _this.branch_id = jsh._GET['branch_id'];
      this.componentController.load();
      this.menuController.load();
    }
    else{
      loader.StopLoading();
      XExt.Alert('Site ID not defined in querystring');
    }
    _this.controller.init();
  }
  
  this.refreshLayout = function(){
    var ww = $(window).width();
    var wh = $(window).height();
    var sleft = $(window).scrollLeft();
    var stop = $(window).scrollTop();
    var docw = $(document).width();
    var doch = $(document).height();
    var pw = ((docw > ww) ? docw : ww);
    var ph = ((doch > wh) ? doch : wh);
    var barh = $('#jsharmony_cms_editor_bar .actions').outerHeight();
    $('#jsharmony_cms_editor_bar .page_settings').css('max-height', (wh-barh)+'px');
  
    var toolbarTop = 37;
    $('#jsharmony_cms_content_editor_toolbar').css('top', toolbarTop+'px');
  }
  
  this.onmessage = function(event){
    var data = (event.data || '').toString();
    if(_this.editor && _this.editor.picker && _this.editor.picker.onmessage(event, data)) return;
  }

  //Run Init
  _this.init();
}

global.jsHarmonyCMS = jsHarmonyCMS;
global.jsHarmonyCMSInstance = new jsHarmonyCMS();
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./jsHarmonyCMS.ComponentController.js":1,"./jsHarmonyCMS.Controller.js":2,"./jsHarmonyCMS.Editor.js":4,"./jsHarmonyCMS.Loader.js":5,"./jsHarmonyCMS.MenuController.js":6,"./jsHarmonyCMS.Toolbar.js":7,"./jsHarmonyCMS.Util.js":8}]},{},[9]);
