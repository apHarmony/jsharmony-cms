jsh.App[modelid] = new (function(){
  /* global d3 */
  
  var _this = this;

  //Member variables
  this.code_cnt = [];

  this.oninit = function(xmodel){
    if(!jsh.globalparams.site_id){
      $('.xform'+xmodel.class).closest('.xsubform').hide();
      return;
    }
    //Bind event handlers
    $(document).bind('mousemove', _this.onmousemove);
    $(document).bind('mouseup', _this.onmouseup);
    //Load API Data
    this.loadData();
  };

  this.loadData = function(onComplete){
    var emodelid = xmodel.namespace+'Dashboard_NewContentPieChart_Data';
    XForm.prototype.XExecutePost(emodelid, { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        //Populate arrays + Render
        _this.code_cnt = rslt[emodelid];
        _this.render();
        if (onComplete) onComplete();
      }
      else XExt.Alert('Error while loading data');
    }, function (err) {
      //Optionally, handle errors
    });
  };

  this.render = function(){
    if(xmodel.parent){
      if(jsh.App[xmodel.parent] && !jsh.App[xmodel.parent].loaded){
        setTimeout(function(){ _this.render(); }, 50);
        return;
      }
    }

    var data = _this.code_cnt;
    var getDesc = function(d){ return d.code_txt; };
    var getTooltip = function(d){ return d.data.code_txt + ': ' + d.data.cnt; };

    var pie_scale = 0.83;
    var width = 480, height = 400, radius = Math.min(width, height) * pie_scale / 2;


    var animationDuration = 300;

    //var color = d3.scaleOrdinal().domain(['TRUEPOS','FALSEPOS','WAITREV','REVINPRG']).range(['#e95b54','#3caf85','#a66dbc','#fbce4a']);
    var color = d3.scaleOrdinal().domain(data.map(getDesc)).range(d3.quantize(function(t){ return d3.interpolateHsl('#3caf85','#a66dbc')(t); }, data.length + 1).reverse());

    var svg = d3.select('.chart_'+xmodel.class).append('svg').attr('viewBox', [-width / 2, -height * pie_scale / 2, width, height]);

    var pie = d3.pie().sort(null).value(function(d) { return d.cnt; });
    var g = svg.selectAll('.arc').data(pie(_this.code_cnt)).enter().append('g').attr('class', 'arc');

    var arc = d3.arc().innerRadius(0).outerRadius(radius - 1);
    g.append('path').attr('d', arc)
      .style('fill', function(d){ return color(getDesc(d.data)); })
      .transition()
      .duration(animationDuration)
      .attrTween('d', function(d){
        var i = d3.interpolate(d.startAngle, d.endAngle);
        return function(t){ d.endAngle = i(t); return arc(d); };
      });
    //Tooltip
    g.selectAll('path').append('title').text(getTooltip);

    //Key
    var jkey = $('.chart_'+xmodel.class+' .key');
    jkey.empty();
    var sorted_items = _this.code_cnt.slice().sort(function(a,b){
      if(a.cnt > b.cnt) return -1;
      if(a.cnt < b.cnt) return 1;
    });
    _.each(sorted_items, function(data){
      if(!data.cnt) return;
      var jitem = $('<div class="item"></div>');
      jitem.text(data.code_txt + ' (' + data.cnt + ')');
      var jitembox = $('<div class="box"></div>');
      jitembox.css('background-color',color(getDesc(data)));
      jitem.prepend(jitembox);
      jkey.append(jitem);
    });

    //Mouse Over Effects
    g.on('mouseover', function(){
      d3.select(this).style('cursor', 'pointer');
      d3.select(this).select('path').style('fill', function(d){
        var curColor = color(getDesc(d.data));
        var highlightColor = d3.lch(curColor);
        highlightColor.l = highlightColor.l + 12;
        return highlightColor;
      });
    });

    g.on('mouseout', function(){
      d3.select(this).style('cursor', 'default');
      d3.select(this).select('path').style('fill', function(d){ return color(getDesc(d.data)); });
    });
  };

})();