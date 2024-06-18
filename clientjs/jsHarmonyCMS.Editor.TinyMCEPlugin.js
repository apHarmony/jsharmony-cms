/*
Copyright 2020 apHarmony

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

/* globals tinymce */

exports = module.exports = function(jsh, cms, editor){
  var _ = jsh._;
  var $ = jsh.$;

  /**
   * @typedef {Object} IconDefinition
   * @property {string} name - the name the icon is registered as
   * @property {string} html - the html for the icon
   */

  /**
   * @typedef {Object} ComponentEvent
   * @property {string} id - the ID of the component for the event target.
   * @property {string} type - the component type for the event target.
   */

  /**
   * @typedef {Object} EditorComponent
   * @property {string} componentType
   * @property {bool} hasData
   * @property {bool} hasProperties
   * @property {string} iconId
   * @property {string} menuLabel
   *
   */

  /**
   * Each icon definition will be registered with the editor
   * and available for use within the editor by name property.
   * @type {Object.<string, IconDefinition>}
   **/
  var ICONS = {
    edit: {
      name: 'material_edit',
      html: '<span class="material-icons" style="font-family: \'Material Icons\' !important;font-size:18px;">edit</span>'
    },
    settings: {
      name: 'material_setting',
      html: '<span class="material-icons" style="font-family: \'Material Icons\' !important;font-size:18px;">settings</span>'
    },
    widgets: {
      name: 'material_widgets',
      html: '<span class="material-icons" style="font-family: \'Material Icons\' !important;font-size:18px;">widgets</span>'
    },
    search: {
      name: 'search',
      html: '<span class="material-icons" style="font-family: \'Material Icons\' !important;font-size:18px;">search</span>'
    }
  };



  /**
   * This defines commands that can be used for the plugin.
   * @type {Object.<string, string>}
   */
  var COMMAND_NAMES = {
    editComponentProperties: 'jsharmonyEditComponentProperties',
    editComponentData: 'jsharmonyEditComponentData'
  };


  /**
   * Register the JSH CMS Component plugin.
   * @public
   */
  this.register = function() {
    if (tinymce.PluginManager.get('jsHarmonyCms') != undefined) return;

    tinymce.PluginManager.add('jsHarmonyCms', function(editor, url) {
      return new JsHarmonyComponentPlugin(editor);
    });
  };

  /**
   * @class
   * @private
   * @param {Object} editor - the TinyMce editor instance
   */
  function JsHarmonyComponentPlugin(editor) {

    this._editor = editor;
    this.toolbarOptions = _.extend({}, cms.editor.defaultToolbarOptions);

    this.initialize(cms.componentManager.componentTemplates);
  }

  /**
   * Create the menu items used by the toolbar buttons, nested menu, etc..
   * @private
   * @param {componentTemplates[]} componentTemplates
   * @returns {object[]}
   */
  JsHarmonyComponentPlugin.prototype.createComponentMenuItems = function(editorComponents) {
    var _this = this;
    editorComponents = editorComponents || [];
    var menuHierarchy = {
      root: { items: [], submenus: {} }
    };
    _.each(editorComponents, function(editorComponent){
      var componentTemplate = cms.componentManager.componentTemplates[editorComponent.componentType];
      var parentNode = menuHierarchy.root;
      if(componentTemplate && componentTemplate.options){
        if('menu_visibility' in componentTemplate.options){
          if(componentTemplate.options.menu_visibility===false) return;
          var menu_visibility = jsh.XExt.JSEval(componentTemplate.options.menu_visibility, componentTemplate, {
            jsh: jsh,
            cms: cms,
            component: componentTemplate,
            _: _,
          });
          if(menu_visibility === false) return;
        }
        if(_.isArray(componentTemplate.options.menu_parents)){
          for(var j=0;j<componentTemplate.options.menu_parents.length;j++){
            var menu_parent = componentTemplate.options.menu_parents[j];
            if(!(menu_parent in parentNode.submenus)){
              parentNode.submenus[menu_parent] = { items: [], submenus: {} };
            }
            parentNode = parentNode.submenus[menu_parent];
          }
        }
      }
      parentNode.items.push({
        type: 'menuitem',
        text: editorComponent.menuLabel,
        icon: editorComponent.iconId,
        onAction: function() { _this.insertComponent(editorComponent.componentType); },
      });
    });
    //Apply hierarchy
    var getMenuItems = function(parentNode){
      var rslt = [];
      for(var key in parentNode.submenus){
        (function(){
          var childKey = key;
          var childNode = parentNode.submenus[key];
          var childItems = getMenuItems(childNode);
          rslt.push({
            type: 'nestedmenuitem',
            text: childKey,
            icon: 'cms_component_folder',
            getSubmenuItems: function () {
              return childItems;
            },
          });
        })();
      }
      rslt = rslt.concat(parentNode.items);
      //Sort
      rslt.sort(function(a,b){
        var atext = ((a && a.text)||'').toLowerCase();
        var btext = ((b && b.text)||'').toLowerCase();
        if(atext > btext) return 1;
        if(atext < btext) return -1;
        return 0;
      });
      return rslt;
    };
    return getMenuItems(menuHierarchy.root);
  };

  /**
   * Create the nested menu for picking components to insert.
   * @private
   * @param {EditorComponent[]} editorComponents
   */
  JsHarmonyComponentPlugin.prototype.createComponentMenuButton = function(editorComponents) {
    if(!editorComponents || !editorComponents.length) return;

    var _this = this;
    this._editor.ui.registry.addNestedMenuItem('jsHarmonyCmsComponent', {
      text: 'Component',
      icon: ICONS.widgets.name,
      getSubmenuItems: function() {
        return _this.createComponentMenuItems(editorComponents);
      }
    });
  };

  /**
   * Create the toolbar menu button for picking components to insert.
   * @private
   * @param {EditorComponent[]} editorComponents
   */
  JsHarmonyComponentPlugin.prototype.createComponentToolbarButton = function(editorComponents) {
    if(!editorComponents || !editorComponents.length) return;

    var _this = this;
    _this._editor.ui.registry.addMenuButton('jsHarmonyCmsComponent', {
      icon: ICONS.widgets.name,
      text: 'Component',
      fetch: function(cb) {
        cb(_this.createComponentMenuItems(editorComponents));
      }
    });
  };

  JsHarmonyComponentPlugin.prototype.createComponentContextMenu = function(editorComponents) {
    if(!editorComponents || !editorComponents.length) return;

    var _this = this;

    function getComponentType(element){
      while(element){
        if(element.hasAttribute && element.hasAttribute('data-component')) return element.getAttribute('data-component');
        element = element.parentNode;
      }
      return false;
    }

    //Disable other context items on components
    _.each(_this._editor.ui.registry.getAll().contextMenus, function(menu){
      if(menu.update) menu.update = jsh.XExt.chain(menu.update, function(element){
        if(getComponentType(element)) return '';
      });
    });
    //Add context menu for components
    _this._editor.ui.registry.addContextMenu('jsharmonycmscomponentcontextmenu', {
      update: function (element) {
        var componentType = getComponentType(element);
        if(componentType){
          var info = _.find(editorComponents, function(info) { return info.componentType === componentType; });
          if (!info) return '';
          var menuItems = [];
          if(info.hasData) menuItems.push('jsHarmonyCmsComponent_Edit');
          if(info.hasProperties) menuItems.push('jsHarmonyCmsComponent_Configure');
          return menuItems.join(' | ');
        }
        return '';
      }
    });
    _this._editor.ui.registry.addMenuItem('jsHarmonyCmsComponent_Edit', {
      tooltip: 'Edit Content',
      text: 'Edit Content',
      icon:  ICONS.edit.name,
      onAction: function() { _this._editor.execCommand(COMMAND_NAMES.editComponentData); }
    });
    _this._editor.ui.registry.addMenuItem('jsHarmonyCmsComponent_Configure', {
      tooltip: 'Configure',
      text: 'Configure',
      icon: ICONS.settings.name,
      onAction: function() { _this._editor.execCommand(COMMAND_NAMES.editComponentProperties); }
    });
  };

  JsHarmonyComponentPlugin.prototype.createElementPathMenuButton = function() {
    var _this = this;
    this._editor.ui.registry.addNestedMenuItem('jsHarmonyCmsElementPath', {
      text: 'Element Path',
      icon: 'visualchars',
      getSubmenuItems: function() {
        var selection = _this._editor.selection;
        if(!selection) return [];
        var endNode = selection.getEnd();
        if(!endNode) return [];
        //Get path from node to editor root
        var container = _this._editor.getContentAreaContainer();
        var nodes = [];
        var currentNode = endNode;
        while(currentNode){
          if(currentNode == container) break;
          nodes.push(currentNode);
          currentNode = currentNode.parentNode;
        }
        return _.map(nodes, function(node) {
          return {
            type: 'nestedmenuitem',
            text: node.tagName,
            getSubmenuItems: function () {
              return [
                {
                  type: 'menuitem',
                  text: 'Select Element',
                  onAction: function () {
                    var selection = _this._editor.selection;
                    selection.select(node);
                  }
                },
                {
                  type: 'menuitem',
                  text: 'Add Line Break Before',
                  onAction: function () {
                    var lineBreak = _this._editor.dom.create('p',undefined,'&#160;');
                    $(lineBreak).insertBefore(node);
                    var selection = _this._editor.selection;
                    var textNode = (lineBreak.childNodes && lineBreak.childNodes.length) ? lineBreak.childNodes[0] : lineBreak;
                    selection.select(textNode);
                  }
                },
                {
                  type: 'menuitem',
                  text: 'Add Line Break After',
                  onAction: function () {
                    var lineBreak = _this._editor.dom.create('p',undefined,'&#160;');
                    $(lineBreak).insertAfter(node);
                    var selection = _this._editor.selection;
                    var textNode = (lineBreak.childNodes && lineBreak.childNodes.length) ? lineBreak.childNodes[0] : lineBreak;
                    selection.select(textNode);
                  }
                },
                {
                  type: 'menuitem',
                  text: 'Delete Element',
                  onAction: function () {
                    var nextSelection = node.nextSibling || node.previousSibling || node.parentNode;
                    node.remove();
                    var selection = _this._editor.selection;
                    if(nextSelection) selection.select(nextSelection);
                    _this.checkForUpdate();
                  }
                }
              ];
            }
          };
        });
      }
    });
  };

  JsHarmonyComponentPlugin.prototype.checkForUpdate = function(){
    if(!cms.controller) return;
    var checkForUpdate = function(){ if(!cms.controller.hasChanges) cms.controller.getValues(); };
    checkForUpdate();
    setTimeout(checkForUpdate, 100);
  };

  JsHarmonyComponentPlugin.prototype.setMenuVisibility = function(visible){
    var _this = this;
    _this.toolbarOptions.show_menu = !!visible;
    cms.editor.renderContentEditorToolbar(_this._editor);
  };

  JsHarmonyComponentPlugin.prototype.setToolbarVisibility = function(visible){
    var _this = this;
    _this.toolbarOptions.show_toolbar = !!visible;
    cms.editor.renderContentEditorToolbar(_this._editor);
  };

  JsHarmonyComponentPlugin.prototype.setToolbarDock = function(dockPosition){
    var _this = this;
    _this.toolbarOptions.dock = dockPosition || 'auto';
    cms.editor.renderContentEditorToolbar(_this._editor);
  };

  /**
   * Create the "View" toolbar menu button, for hiding the menu and viewing source code.
   * @private
   */
  JsHarmonyComponentPlugin.prototype.createToolbarViewOptions = function() {
    var _this = this;
    _this._editor.ui.registry.addMenuButton('jsHarmonyCmsView', {
      text: 'View',
      icon: ICONS.search.name,
      fetch: function (cb) {
        return cb([
          {
            type: 'menuitem',
            text: 'Toggle Menu',
            onAction: function () {
              _this.setMenuVisibility(!_this.toolbarOptions.show_menu);
            }
          },
          {
            type: 'menuitem',
            text: 'Toggle Toolbar',
            onAction: function () {
              _this.setToolbarVisibility(!_this.toolbarOptions.show_toolbar);
            }
          },
          {
            type: 'menuitem',
            icon: 'visualblocks',
            text: 'Toggle Outlines',
            onAction: function () {
              if(document && document.body){
                var hasOutlines =  $(document.body).hasClass('jsHarmonyCMS_showEditorOutlines');
                $(document.body).toggleClass('jsHarmonyCMS_hideEditorOutlines', hasOutlines);
                $(document.body).toggleClass('jsHarmonyCMS_showEditorOutlines', !hasOutlines);
                if(!jsh.xDialog.length){
                  var editorManager = tinymce.util.Tools.resolve('tinymce.EditorManager');
                  editorManager.activeEditor.focus();
                }
              }
            }
          },
          {
            type: 'menuitem',
            icon: 'sourcecode',
            text: 'Source Code',
            onAction: function () {
              _this._editor.execCommand('mceCodeEditor');
            }
          },
        ]);
      }
    });
  };

  JsHarmonyComponentPlugin.prototype.createEndEditToolbarButton = function() {
    this._editor.ui.registry.addButton('jsHarmonyCmsEndEdit', {
      text: 'End Edit',
      icon: 'checkmark',
      onAction: function () { cms.editor.endEdit(); }
    });
  };

  JsHarmonyComponentPlugin.prototype.createMenuViewOptions = function() {
    //if(!this._editor.settings.isjsHarmonyCmsComponent)
    var _this = this;

    this._editor.ui.registry.addMenuItem('jsHarmonyCmsToggleMenu', {
      text: 'Toggle Menu',
      onAction: function () {
        _this.setMenuVisibility(!_this.toolbarOptions.show_menu);
      }
    });

    this._editor.ui.registry.addMenuItem('jsHarmonyCmsToggleToolbar', {
      text: 'Toggle Toolbar',
      onAction: function () {
        _this.setToolbarVisibility(!_this.toolbarOptions.show_toolbar);
      }
    });

    _this._editor.ui.registry.addNestedMenuItem('jsharmonyCmsDockToolbar', {
      text: 'Dock Toolbar',
      getSubmenuItems: function() {
        return [
          {
            type: 'togglemenuitem',
            text: 'Top',
            onAction: function() {
              if(_.includes(['top','top_offset','auto'],_this.toolbarOptions.orig_dock)) _this.setToolbarDock(_this.toolbarOptions.orig_dock);
              else _this.setToolbarDock('auto');
            },
            onSetup: function(api) {
              api.setActive((_this.toolbarOptions.dock === 'top')||(_this.toolbarOptions.dock === 'top_offset')||(_this.toolbarOptions.dock === 'auto'));
              return function() {};
            }
          },
          {
            type: 'togglemenuitem',
            text: 'Bottom',
            onAction: function(a) {
              _this.setToolbarDock('bottom');
            },
            onSetup: function(api) {
              api.setActive(_this.toolbarOptions.dock === 'bottom');
              return function() {};
            }
          }
        ];
      }
    });
  };

  /**
   * Create menu button for Spell Check
   * @private
   * @param {EditorComponent[]} editorComponents
   */
  JsHarmonyComponentPlugin.prototype.createSpellCheckMessageMenuButton = function() {
    this._editor.ui.registry.addMenuItem('jsHarmonyCmsSpellCheckMessage', {
      text: 'Spell Check',
      icon: 'spell-check',
      onAction: function () {
        jsh.XExt.Alert('The editor uses your browser\'s spellcheck.\n\nPress and hold the CTRL key while right-clicking on the misspelled words to see suggestions.\n\n');
      }
    });
  };

  JsHarmonyComponentPlugin.prototype.createEndEditMenuButton = function() {
    this._editor.ui.registry.addMenuItem('jsHarmonyCmsEndEdit', {
      text: 'End Edit',
      icon: 'checkmark',
      onAction: function () { cms.editor.endEdit(); }
    });
  };
  
  JsHarmonyComponentPlugin.prototype.createContextToolbar = function(editorComponents) {

    var _this = this;
    var propButtonId = 'jsharmonyComponentPropEditor';
    var dataButtonId = 'jsharmonyComponentDataEditor';

    _this._editor.ui.registry.addButton(dataButtonId, {
      tooltip: 'Edit Content',
      text: 'Edit Content',
      icon:  ICONS.edit.name,
      onAction: function() { _this._editor.execCommand(COMMAND_NAMES.editComponentData); }
    });

    _this._editor.ui.registry.addButton(propButtonId, {
      tooltip: 'Configure',
      text: 'Configure',
      icon: ICONS.settings.name,
      onAction: function() { _this._editor.execCommand(COMMAND_NAMES.editComponentProperties); }
    });

    var dataAndPropsToolbar = dataButtonId + ' ' + propButtonId;
    var dataToolBar = dataButtonId;
    var propsToolBar = propButtonId;

    var toolbarPredicate = function(enableData, enableProps) {
      return function(node) {
        var isComponent = _this._editor.dom.is(node, '[data-component]');
        if (!isComponent) {
          return false;
        }
        var componentType = _this._editor.dom.getAttrib(node, 'data-component');
        var editorComponent = _.find(editorComponents, function(info) { return info.componentType === componentType; });
        if (!editorComponent) {
          return false;
        }
        return enableData === editorComponent.hasData && enableProps === editorComponent.hasProperties;
      };
    };

    var addToolbar = function(toolBarConfig, predicate) {
      var contextId = 'jsharmonyComponentContextToolbar_' + toolBarConfig;
      _this._editor.ui.registry.addContextToolbar(contextId, {
        predicate: predicate,
        items: toolBarConfig,
        scope: 'node',
        position: 'node'
      });
    };
    addToolbar(dataAndPropsToolbar, toolbarPredicate(true, true));
    addToolbar(dataToolBar, toolbarPredicate(true, false));
    addToolbar(propsToolBar, toolbarPredicate(false, true));
  };

  /**
   * Find the component instance if it exits
   * @private
   * @param {(string | HTMLElement)} element - if type is string then find the component by the string ID,
   * if type is an HTMLElement then find element and get ID from the ID attribute.
   * @returns {(Object | undefined)}
   */
  JsHarmonyComponentPlugin.prototype.getComponentInstance = function(element) {

    if (!element) return;
    var id = element;
    if (!_.isString(element)) {
      id = $(element).attr('data-component-id') || '';
    }

    return cms.componentManager.components[id];
  };

  /**
   * When an undo or redo event occurs in the editor
   * the component needs to be re-rendered.
   * @private
   * @param {object} e - the undo/redo event from the TinyMCE editor
   */
  JsHarmonyComponentPlugin.prototype.onUndoRedo = function(e) {
    var _this = this;
    var content = e.level.content;
    if (!content) return;
    var parser = new tinymce.html.DomParser({validate: false});
    parser.addAttributeFilter('data-component-id', function(nodes, name) {
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var id = node.attributes.map['data-component-id'];
        var type = node.attributes.map['data-component'];
        if (id && type) {
          cms.componentManager.renderContentComponent($(_this._editor.targetElm).find('[data-component-id="' + id + '"]')[0]);
        }
      }
    });
    parser.parse(content);
  };

  JsHarmonyComponentPlugin.prototype.setToolbarOptions = function(toolbarOptions){
    var _this = this;

    _this.toolbarOptions = _.extend({}, cms.editor.defaultToolbarOptions, toolbarOptions);
    if(!('orig_dock' in toolbarOptions)) _this.toolbarOptions.orig_dock = toolbarOptions.dock;
    if(!('orig_toolbar_or_menu' in toolbarOptions)) _this.toolbarOptions.orig_toolbar_or_menu = !!toolbarOptions.show_menu || toolbarOptions.show_toolbar;
  };

  /**
   * Initialize the plugin.
   * Do not call this more than one time per editor instance.
   * @private
   * @param {Object[]} components - the component configurations
   */
  JsHarmonyComponentPlugin.prototype.initialize = function(components) {

    var _this = this;

    /** @type {EditorComponent[]} */
    var editorComponents = [];

    _this._editor.ui.registry.addIcon('cms_component_folder', '<span class="material-icons" style="font-family: \'Material Icons\' !important;font-size:18px;">folder_open</span>');

    // Register component icons and build
    // component info.
    _.forEach(components, function(component) {
      if ((component.target == 'content') && component.icon) {
        // Icon name MUST be lowercase for TinyMce to work correctly.
        var iconRegistryName = ('cms_component_icon_' + component.id).toLowerCase();
        var iconMatch = /^(\w+):/.exec(component.icon);
        var icon = '';
        if (iconMatch) {
          var iconType = iconMatch[1];
          var iconValue = component.icon.slice(iconMatch[0].length);
          if (iconType === 'material') {
            icon = '<span class="material-icons" style="font-family: \'Material Icons\' !important;font-size:18px;">' + iconValue + '</span>';
          } else if (iconType === 'svg' || iconType === 'html') {
            icon = iconValue;
          } else {
            console.error('Unknown icon family "' + iconType + '"'); // eslint-disable-line no-console
          }
        } else {
          icon = component.icon;
        }

        _this._editor.ui.registry.addIcon(iconRegistryName, icon);

        editorComponents.push({
          componentType: component.id,
          hasData: ((component.data || {}).fields || []).length > 0,
          hasProperties: ((component.properties || {}).fields || []).length > 0,
          iconId: iconRegistryName,
          menuLabel: component.title || component.id
        });
      }
    });

    // Register icons
    for (var key in ICONS) {
      _this._editor.ui.registry.addIcon(ICONS[key].name, ICONS[key].html);
    }

    //Create menu buttons, toolbar buttons, and context menu buttons
    this.createContextToolbar(editorComponents);
    this.createComponentToolbarButton(editorComponents);
    this.createToolbarViewOptions();
    this.createMenuViewOptions();
    this.createElementPathMenuButton();
    this.createComponentMenuButton(editorComponents);
    this.createSpellCheckMessageMenuButton();
    this.createEndEditMenuButton();
    this.createEndEditToolbarButton();
    this.createComponentContextMenu(editorComponents);


    this._editor.on('SetContent', function(info){ if(cms.editor.onSetContent) cms.editor.onSetContent(_this._editor, info); });
    this._editor.on('undo', function(info) { _this.onUndoRedo(info); });
    this._editor.on('redo', function(info) { _this.onUndoRedo(info); });
    this._editor.on('setToolbarOptions', function(e){
      if(e && e.toolbarOptions) _this.setToolbarOptions(e.toolbarOptions);
    });

    this._editor.addCommand(COMMAND_NAMES.editComponentData, function() {
      var el = _this._editor.selection.getStart();
      _this.openDataEditor(el);
    });

    this._editor.addCommand(COMMAND_NAMES.editComponentProperties, function() {
      var el = _this._editor.selection.getStart();
      _this.openPropertiesEditor(el);
    });
    this._editor.addCommand('jsHarmonyCmsSetToolbarOptions', function(toolbarOptions) {
      _this.setToolbarOptions(toolbarOptions);
    });
    this._editor.addQueryValueHandler('jsHarmonyCmsGetToolbarOptions', function() { return _this.toolbarOptions; });

    this._editor.on('init', function() {
      _this._editor.serializer.addAttributeFilter('data-component', function(nodes) { _this.serializerFilter(nodes); });
      _this._editor.serializer.addAttributeFilter('cms-component', function(nodes) { _this.serializerFilter(nodes); });
      _this._editor.parser.addAttributeFilter('data-component', function(nodes) { _this.renderContentComponents(nodes); });
      _this._editor.parser.addAttributeFilter('cms-component', function(nodes) { _this.replacePageComponentsWithContentComponents(nodes); });
    });
  };

  /**
   * Insert the component into the editor.
   * @private
   * @param {string} componentType - the type of the component to insert.
   */
  JsHarmonyComponentPlugin.prototype.insertComponent = function(componentType) {
    var _this = this;
    var domUtil = _this._editor.dom;
    var selection = _this._editor.selection;

    var componentTemplate = cms.componentManager.componentTemplates[componentType];
    var isInline = (componentTemplate && componentTemplate.options && componentTemplate.options.editor_container) == 'inline';

    if(isInline){
      jsh.XExt.execif(!selection.isCollapsed(),
        function(next){
          selection.collapse(false);
          setTimeout(next, 0);
        },
        function(){
          _this._editor.insertContent(_this.createComponentContainer(componentType));
        }
      );
    }
    else {
      var currentNode = selection.getEnd();

      var placeholderId = domUtil.uniqueId();
      var placeholder = domUtil.create('div', { id: placeholderId }, '');

      $(placeholder).insertBefore(currentNode);

      selection.select(placeholder);
      selection.collapse(false);

      _this._editor.insertContent(_this.createComponentContainer(componentType));
      _this._editor.insertContent('<p></p>');
      domUtil.remove(domUtil.select('#' + placeholderId));
    }
  };

  /**
   * Create the component container HTML string for
   * inserting into the editor.
   * @private
   * @param {string} componentType - the type of component to create
   * @returns {string} - HTML string
   */
  JsHarmonyComponentPlugin.prototype.createComponentContainer = function(componentType) {
    var componentTemplate = cms.componentManager.componentTemplates[componentType];
    var isInline = (componentTemplate && componentTemplate.options && componentTemplate.options.editor_container) == 'inline';
    var componentCode =
      '<'+(isInline?'span':'div')+
        ' class="mceNonEditable"'+
        ' data-component="' + jsh.XExt.escapeHTML(componentType) + '"'+
        ' data-component-properties=""'+
        ' data-component-content=""'+
        ' data-is-insert="true"'+
      '>'+
      (isInline?'&nbsp;':'') +
      '</'+(isInline?'span':'div')+'>';
    return componentCode;
  };

  /**
   * Open the data editor for the component.
   * @private
   * @param {(string | Element)} element - if type is string then find the component by the string ID,
   * if type is an HTMLElement then find component from the ID attribute.
   */
  JsHarmonyComponentPlugin.prototype.openDataEditor = function(element) {
    var component = this.getComponentInstance(element);
    if (component && _.isFunction(component.openDataEditor)) {
      component.openDataEditor();
    }
  };

  /**
   * Open the property editor for the component.
   * @private
   * @param {(string | Element)} element - if type is string then find the component by the string ID,
   * if type is an HTMLElement then find component from the ID attribute.
   */
  JsHarmonyComponentPlugin.prototype.openPropertiesEditor = function(element) {
    var component = this.getComponentInstance(element);
    if (component && _.isFunction(component.openPropertiesEditor)) {
      component.openPropertiesEditor();
    }
  };

  /**
   * Filter the TinyMce content parsed nodes.
   * @private
   * @param {Array.<object>} nodes - a list of TinyMce nodes
   */
  JsHarmonyComponentPlugin.prototype.renderContentComponents = function(nodes) {
    var _this = this;
    _.each(nodes, function(node) {
      var id = cms.componentManager.getNextComponentId();
      node.attr('data-component-id', id);
      // Check if editor_container is correct
      var componentType = node.attr('data-component');
      var componentTemplate = componentType && cms.componentManager.componentTemplates[componentType];
      var isInline = (componentTemplate && componentTemplate.options && componentTemplate.options.editor_container) == 'inline';
      var nodeIsInline = ((node.name||'').toString().toLowerCase()=='span');
      if(nodeIsInline !== isInline){
        if(isInline) node.name = 'span';
        else node.name = 'div';
      }
      // Content is not actually in the DOM yet.
      // Wait for next loop
      var isInitialized = cms.isInitialized;
      setTimeout(function() {
        cms.componentManager.renderContentComponent($(_this._editor.targetElm).find('[data-component-id="' + id + '"]')[0], {
          init: !isInitialized
        });
      });
    });
  };

  /**
   * Replace cms-component elements with data-component
   * @private
   * @param {Array.<object>} nodes - a list of TinyMce nodes
   */
  JsHarmonyComponentPlugin.prototype.replacePageComponentsWithContentComponents = function(nodes) {
    var _this = this;
    _.each(nodes, function(node) {
      var cmsComponent = node.attr('cms-component');
      var cmsComponentData = node.attr('cms-component-data');
      var cmsComponentProperties = node.attr('cms-component-properties');
      if(cmsComponent){
        node.attr('data-component', cmsComponent);
        node.attr('cms-component', null);
        
        var nodeClass = (node.attr('class')||'');
        if(nodeClass) nodeClass += ' ';
        nodeClass += 'mceNonEditable';
        node.attr('class', nodeClass);
        node.attr('contenteditable', 'false');

        var defaultProperties = {};
        var defaultData = {};
        var component = cms.componentManager.componentTemplates[cmsComponent];
        if(component){
          defaultProperties = cms.componentManager.getDefaultValues(component.properties);
          defaultData = cms.componentManager.getDefaultValues(component.data);
        }
        
        if(cmsComponentData){
          try{
            cmsComponentData = JSON.parse(cmsComponentData);
            if(_.isArray(cmsComponentData)){
              for(var i=0;i<cmsComponentData.length;i++){ cmsComponentData[i] = _.extend({}, defaultData, cmsComponentData[i]); }
              cmsComponentData = {items: cmsComponentData};
            }
            else{
              cmsComponentData = _.extend({}, defaultData, cmsComponentData);
              cmsComponentData = {item: cmsComponentData};
            }
            cmsComponentData = JSON.stringify(cmsComponentData);
          }
          catch(ex){
            /* Do nothing */
          }
          node.attr('data-component-data', btoa(cmsComponentData));
          node.attr('cms-component-data', null);
        }
        if(cmsComponentProperties){
          try{
            cmsComponentProperties = JSON.parse(cmsComponentProperties);
            cmsComponentProperties = _.extend({}, defaultProperties, cmsComponentProperties);
            cmsComponentProperties = JSON.stringify(cmsComponentProperties);
          }
          catch(ex){
            /* Do nothing */
          }
          node.attr('data-component-properties', btoa(cmsComponentProperties));
          node.attr('cms-component-properties', null);
        }
      }
    });
    _this.renderContentComponents(nodes);
  };

  /**
   * Filter the TinyMce content to find relevant components
   * and serialize the components for save.
   * @private
   * @param {Array.<object>} nodes - a list of TinyMce nodes
   */
  JsHarmonyComponentPlugin.prototype.serializerFilter = function(nodes) {
    var _this = this;
    for(var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var componentAttr = node.attr('data-component');
      if (componentAttr == undefined || componentAttr.length < 1) {
        continue;
      }
      node.attr('data-component-id', null);
      if(node.attr('class')){
        var cls = node.attr('class').toString().trim().split(' ');
        var newcls = '';
        if(cls.indexOf('initialized')>=0){
          for(var j=0;j<cls.length;j++){
            if(!cls[j] || (cls[j]=='initialized')) continue;
            newcls += cls[j] + ' ';
          }
          node.attr('class', newcls.trim() || null);
        }
      }
      node.empty();
      var newNode = tinymce.html.Node.create('#text');
      newNode.value = String.fromCharCode(0x00A0);
      node.append(newNode);
      _this._editor.dom.setHTML(node, '&nbsp;');
      
    }
  };
};