jsh.App[modelid] = new (function(){
  var _this = this;

  _this.onload = function(){
    var xdChangeStatus = jsh.xd('.'+xmodel.class+'_Change_Status');
    if((xmodel.get('source_branch_type')||'').toUpperCase()=='USER'){
      var tmpl = jsh.xd('.'+xmodel.class+'_template_Change_Status').html;
      xdChangeStatus.html = XExt.renderClientEJS(tmpl, { _: _, jsh: jsh });
    }
    else {
      jsh.xd('.'+xmodel.class+'_change_status_group').style.display = false;
    }
  };

  _this.Change_Status_getvalue = function(val, field, xmodel){
    var xdchecked_option = jsh.XDom("input[name='"+xmodel.class+'_Change_Status_option'+"']").filter(function(el) {return el.checked && jsh.XDom.isVisible(el);});
    if(xdchecked_option.length) return xdchecked_option.value;
    return 'RESET';
  };

})();