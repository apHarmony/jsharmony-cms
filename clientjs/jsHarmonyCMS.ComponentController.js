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
    var url = '../_funcs/components/'+cms.branch_id;
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

  this.loadTestForm = function(callback){
    var CUST_FORM_CONTAINER = '.test_cust_form_container';

    if(jsh.XModels['Customer']) return callback();

    $('body').append("<div style='display:none;'>\
        <div class='test_cust_form_container xdialogbox' style='width:400px;'></div>\
      </div>");
    //Define the form in-memory
    jsh.XPage.LoadVirtualModel($(CUST_FORM_CONTAINER)[0], {
      "id": "Customer",
      "layout": "form",
      "buttons": [{"link": "js:_this.showTestMessage()", "icon": "ok", "actions":"BIU", "text":"Test Message"}],
      "ejs": "<div class='test_sample_ejs'>Sample EJS for Test model</div>",
      "css": ".test_sample_ejs { background-color:#f0f0f0; border:1px solid #bbb; padding:4px 20px; margin-top:10px; }",
      "js": function(){ //This function is virtual and cannot reference any variables outside its scope
        var _this = this;
        //var modelid = [current model id];
        //var xmodel = [current model];

        _this.oninit = function(xmodel){
          //Custom oninit function
        }

        _this.onload = function(xmodel){
          //Custom onload function
        }

        _this.showTestMessage = function(){
          XExt.Alert('Test Message');
        }
      },
      "oninit":"_this.oninit(xmodel);",
      "onload":"_this.onload(xmodel);",
      "fields": [
        {"name": "cust_id", "caption":"Customer ID", "type": "int", "actions":"B",
         "control":"textbox", "controlstyle":"width:80px;", "validate": ["IsNumeric","Required"] },
         
        {"name": "cust_name", "caption":"Name", "type": "varchar", "length": 256, "actions":"B",
         "control":"textbox", "controlstyle":"width:260px;", "validate": ["MaxLength:256","Required"] },
         
        {"name": "cust_sts", "caption":"Status", "type": "varchar", "length":32,
         "control":"dropdown", "validate": ["Required"] },

        {"control":"html","value":"<b>Sample HTML:</b> Content"},

        {"name":"save_button","control":"button","value":"Save"},
        {"name":"cancel_button","control":"button","value":"Cancel","nl":false},
      ]
    }, function(custmodel){
      if(callback) callback();
    });
  }

  this.showTestForm = function(){
    var CUST_FORM_CONTAINER = '.test_cust_form_container';

    var cust_data = {
      cust_id:   1,
      cust_name: 'Test Customer',
      cust_sts:  'ACTIVE',
    };

    _this.loadTestForm(function(){
      //Model loaded
      //Render data
      jsh.XModels['Customer'].controller.setLOV('cust_sts', [
        {code_val: '',       code_txt:'Please select...'},
        {code_val: 'ACTIVE', code_txt:'Active'},
        {code_val: 'CLOSED', code_txt:'Closed'},
      ]);
      jsh.XModels['Customer'].controller.Render(cust_data);
      //Open dialog
      XExt.CustomPrompt(CUST_FORM_CONTAINER, $(CUST_FORM_CONTAINER), function(acceptFunc, cancelFunc){ //onInit
        //Enable the form (so that navigation events trigger check for updates)
        jsh.XModels['Customer'].controller.form.Prop.Enabled = true;
        //Attach save / cancel events to dialog events
        jsh.$root('.save_button.xelemCustomer').off('click').on('click', acceptFunc);
        jsh.$root('.cancel_button.xelemCustomer').off('click').on('click', cancelFunc);
      }, function(success){ //onAccept
        //Commit customer data to API
        if(!jsh.XModels['Customer'].controller.Commit(cust_data, 'U')) return;
        XExt.Alert('Saving...'+JSON.stringify(cust_data), success);
      }, undefined, function(){ //onClosed
        //Disable the form (so that navigation events do not trigger check for updates)
        jsh.XModels['Customer'].controller.form.Prop.Enabled = false;
      }, { reuse: true });
    });
  }

}