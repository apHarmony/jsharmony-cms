/*
Copyright 2021 apHarmony

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
  var _ = jsh._;
  var XExt = jsh.XExt;

  this.createMenuTree = function(menu, page_key){
    var selected_item = null;

    //Generate menu item tree
    var menu_item_ids = {};
    for(var i=0;i<menu.menu_items.length;i++){
      var menu_item = menu.menu_items[i];
      menu_item.menu_item_children = [];
      menu_item_ids[menu_item.menu_item_id] = menu_item;

      menu_item.menu_item_type = (menu_item.menu_item_type||'TEXT').toUpperCase();
      menu_item.menu_item_link_type = (menu_item.menu_item_link_type||'').toUpperCase();
      menu_item.menu_item_link_target = (menu_item.menu_item_link_target||'').toUpperCase();

      menu_item.id = menu_item.menu_item_id;
      menu_item.children = menu_item.menu_item_children;

      //html
      menu_item.html = menu_item.menu_item_text;
      if(menu_item.menu_item_type != 'HTML') menu_item.html = XExt.escapeHTML(menu_item.html);
      menu_item.text = XExt.StripTags(menu_item.html);

      menu_item.tag = menu_item.menu_item_tag || '';
      menu_item.menu_tag = menu.menu_tag || '';
      menu_item.class = menu_item.menu_item_class || '';
      menu_item.style = menu_item.menu_item_style || '';

      menu_item.href = '';
      menu_item.onclick = '';
      if(menu_item.menu_item_link_type){
        menu_item.href = '#';
        menu_item.onclick = 'return false;';
      }
        
      menu_item.target = ((menu_item.menu_item_link_type != 'JS') && (menu_item.menu_item_link_target == 'NEWWIN')) ? '_blank' : '';
      menu_item.selected = ((menu_item.menu_item_link_type=='PAGE') && ((menu_item.menu_item_link_dest||'').toString() == (page_key||'').toString()));
      if(menu_item.selected) selected_item = menu_item;
    }

    var menu_item_tree = [];
    _.each(menu.menu_items, function(menu_item){
      if(!menu_item.menu_item_parent_id){
        menu_item_tree.push(menu_item);
        menu_item.parent = null;
      }
      else {
        menu_item_ids[menu_item.menu_item_parent_id].children.push(menu_item);
        menu_item.parent = menu_item_ids[menu_item.menu_item_parent_id];
      }
    });

    function resolveParent(menu_item){
      if(menu_item.parents) return;
      if(!menu_item.parent){
        menu_item.parents = [];
        menu_item.depth = 1;
        return;
      }
      if(!menu_item.parent.parents) resolveParent(menu_item.parent);
      menu_item.parents = menu_item.parent.parents.concat(menu_item.parent);
      menu_item.depth = menu_item.parent.depth + 1;
    }

    _.each(menu.menu_items, function(menu_item){
      resolveParent(menu_item);
      menu_item.getSiblings = function(){
        var siblings = menu_item.parent ? menu_item.parent.children : menu_item_tree;
        return _.filter(siblings, function(sibling){ return sibling.id != menu_item.id; });
      };
    });

    //Add properties to menu
    menu.menu_item_tree = menu_item_tree;
    menu.tree = menu_item_tree;
    menu.items = menu.menu_items;
    menu.tag = menu.menu_tag;
    menu.currentItem = selected_item;
    //Aliases
    menu.topItems = menu.tree;
    menu.allItems = menu.items;
  };

  this.createSitemapTree = function(sitemap){
    //Input:
    //  self + siblings
    //  parents + siblings
    //  children

    //***Populate children, siblings, parent
    //parent.siblings
    //parent.children
    //parent.parent
    //self.siblings
    //self.children
    //self.parent

    if(sitemap.self){
      //self.parent
      if(sitemap.parents && sitemap.parents.length) sitemap.self.parent = sitemap.parents[sitemap.parents.length-1];
      else sitemap.self.parent = null;

      //self.children
      sitemap.self.children = sitemap.children || [];
      //self.children.siblings
      for(let i=0;i<sitemap.self.children.length;i++){
        var child = sitemap.self.children[i];
        child.siblings = sitemap.self.children;
        child.parent = sitemap.self;
      }

      //self.siblings
      sitemap.self.siblings = sitemap.self.sitemap_item_siblings || [sitemap.self];
      for(let i=0;i<sitemap.self.siblings.length;i++){
        var sibling = sitemap.self.siblings[i];
        //Replace self in sitemap.self.siblings
        if(sibling.sitemap_item_id == sitemap.self.sitemap_item_id) sitemap.self.siblings[i] = sitemap.self;
        else{
          sibling.parent = sitemap.self.parent;
          sibling.children = [];
        }
      }
    }

    //Replace self in each sitemap.parents.siblings
    if(sitemap.parents){
      for(let i=0;i<sitemap.parents.length;i++){
        let parent = sitemap.parents[i];

        //parent.parent
        if(i==0) parent.parent = null;
        else parent.parent = sitemap.parents[i-1];

        //parent.siblings
        parent.siblings = parent.sitemap_item_siblings || [parent];
        for(var j=0;j<parent.siblings.length;j++){
          if(parent.siblings[j].sitemap_item_id == parent.sitemap_item_id) parent.siblings[j] = parent;
        }
      }
      for(let i=0;i<sitemap.parents.length;i++){
        let parent = sitemap.parents[i];
        //parent.children
        if(i==(sitemap.parents.length-1)) parent.children = sitemap.self.siblings;
        else parent.children = sitemap.parents[i+1].siblings;
      }
    }

    //Generate tree and root
    if(sitemap.parents && sitemap.parents.length){
      sitemap.tree = [sitemap.parents[0]];
      sitemap.root = sitemap.parents[0];
    }
    else if(sitemap.self){
      sitemap.root = sitemap.self;
      sitemap.tree = sitemap.self.siblings;
    }
    else sitemap.tree = null;

    //Populate allItems
    sitemap.allItems = [];
    _.each(sitemap.parents, function(parent){
      _.each(parent.siblings, function(sibling){ sitemap.allItems.push(sibling); });
    });
    if(sitemap.self){
      _.each(sitemap.self.siblings, function(sibling){ sitemap.allItems.push(sibling); });
      _.each(sitemap.self.children, function(child){ sitemap.allItems.push(child); });
    }
    

    //Populate id and item fields
    var itemsToProcess = sitemap.allItems;
    _.each(sitemap.breadcrumbs, function(sitemap_item){
      if(!_.includes(itemsToProcess, sitemap_item)) itemsToProcess.push(sitemap_item);
    });
    _.each(itemsToProcess, function(sitemap_item){
      sitemap_item.id = sitemap_item.sitemap_item_id;

      sitemap_item.sitemap_item_type = (sitemap_item.sitemap_item_type||'TEXT').toUpperCase();
      sitemap_item.sitemap_item_link_type = (sitemap_item.sitemap_item_link_type||'').toUpperCase();
      sitemap_item.sitemap_item_link_target = (sitemap_item.sitemap_item_link_target||'').toUpperCase();

      //html
      sitemap_item.html = sitemap_item.sitemap_item_text;
      if(sitemap_item.sitemap_item_type != 'HTML') sitemap_item.html = XExt.escapeHTML(sitemap_item.html);
      sitemap_item.text = XExt.StripTags(sitemap_item.html);

      sitemap_item.tag = sitemap_item.sitemap_item_tag || '';
      sitemap_item.sitemap_tag = sitemap.sitemap_tag || '';
      sitemap_item.class = sitemap_item.sitemap_item_class || '';
      sitemap_item.style = sitemap_item.sitemap_item_style || '';

      sitemap_item.href = '';
      sitemap_item.onclick = '';
      if(sitemap_item.sitemap_item_link_type){
        sitemap_item.href = '#';
        sitemap_item.onclick = 'return false;';
      }
        
      sitemap_item.target = ((sitemap_item.sitemap_item_link_type != 'JS') && (sitemap_item.sitemap_item_link_target == 'NEWWIN')) ? '_blank' : '';
      sitemap_item.selected = (sitemap_item.sitemap_item_id == (sitemap.self && sitemap.self.sitemap_item_id));
    });

    //Populate parents, depth
    function resolveParent(sitemap_item){
      if(sitemap_item.parents) return;
      if(!sitemap_item.parent){
        sitemap_item.parents = [];
        sitemap_item.depth = 1;
        return;
      }
      if(!sitemap_item.parent.parents) resolveParent(sitemap_item.parent);
      sitemap_item.parents = sitemap_item.parent.parents.concat(sitemap_item.parent);
      sitemap_item.depth = sitemap_item.parent.depth + 1;
    }

    _.each(sitemap.allItems, function(sitemap_item){
      resolveParent(sitemap_item);
      sitemap_item.getSiblings = function(){
        var siblings = sitemap_item.parent ? sitemap_item.parent.children : sitemap.tree;
        return _.filter(siblings, function(sibling){ return sibling.id != sitemap_item.id; });
      };
    });

    //Aliases
    sitemap.topItems = sitemap.tree;
    sitemap.currentItem = sitemap.self;
    sitemap.item = sitemap.self;
  };
};