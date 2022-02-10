jsh.App[modelid] = new (function(){
  var _this = this;

  _this.onload = function(){
    var jChangeStatus = jsh.$root('.'+xmodel.class+'_Change_Status');
    if((xmodel.get('source_branch_type')||'').toUpperCase()=='USER'){
      var tmpl = jsh.$root('.'+xmodel.class+'_template_Change_Status').html();
      jChangeStatus.html(XExt.renderClientEJS(tmpl, { _: _, jsh: jsh }));
    }
    else {
      jsh.$root('.'+xmodel.class+'_change_status_group').hide();
    }
  };

  _this.Change_Status_getvalue = function(val, field, xmodel){
    var checked_option = $("input[name='"+xmodel.class+'_Change_Status_option'+"']:checked:visible");
    if(checked_option.length) return checked_option.val();
    return 'RESET';
  };

})();