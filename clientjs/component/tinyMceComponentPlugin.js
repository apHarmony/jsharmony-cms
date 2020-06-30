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
 * @typedef {Object} ComponentInfo
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
 * This defines event names that can be used for the plugin.
 * @type {Object.<string, string>}
 */
var EVENT_NAMES = {
  renderComponent:  'jsHarmonyRenderComponent'
};


/**
 * Register the JSH CMS Component plugin.
 * @public
 * @param {Object} jsHarmonyCmsComponentManager
 */
function registerPlugin(jsHarmonyCmsComponentManager) {
  if (tinymce.PluginManager.get('jsharmony') != undefined) {
    return;
  }

  var components = jsHarmonyCmsComponentManager.componentTemplates;
  tinymce.PluginManager.add('jsharmony', function(editor, url) {
    new JsHarmonyComponentPlugin(editor, components, jsHarmonyCmsComponentManager);
  });
}

/**
 * @class
 * @private
 * @param {Object} editor - the TinyMce editor instance
 * @param {Object[]} components - the component configurations
 * @param {Object} jsHarmonyCmsComponentManager
 */
function JsHarmonyComponentPlugin(editor, components, jsHarmonyCmsComponentManager) {

  this._editor = editor;
  this._jsHarmonyCmsComponentManager = jsHarmonyCmsComponentManager;
  this.initialize(components);
}

/**
 * Create the menu button for picking components to insert.
 * @private
 * @param {ComponentInfo[]} componentInfo
 */
JsHarmonyComponentPlugin.prototype.createComponentInsertMenu = function(componentInfo) {
  var self = this;

  self._editor.ui.registry.addMenuButton('jsHarmonyComponents', {
    icon: ICONS.widgets.name,
    text: 'Components',
    fetch: function(cb) {
      items = _.map(componentInfo, function(item) {
        return {
          type: 'menuitem',
          text: item.menuLabel,
          icon: item.iconId,
          onAction: function() { self.insertComponentContent(item.componentType); }
        }
      });
      cb(items)
    }
  });
}

/**
 * Create and register the context toolbar for editing
 * the component properties and data.
 * @private
 * @param {ComponentInfo[]} componentInfos
 */
JsHarmonyComponentPlugin.prototype.createContextToolbar = function(componentInfos) {

  var self = this;
  var propButtonId = 'jsharmonyComponentPropEditor';
  var dataButtonId = 'jsharmonyComponentDataEditor';

  self._editor.ui.registry.addButton(dataButtonId, {
    tooltip: 'Edit',
    text: 'Edit',
    icon:  ICONS.edit.name,
    onAction: function() { self._editor.execCommand(COMMAND_NAMES.editComponentData); }
  });

  self._editor.ui.registry.addButton(propButtonId, {
    tooltip: 'Configure',
    text: 'Configure',
    icon: ICONS.settings.name,
    onAction: function() { self._editor.execCommand(COMMAND_NAMES.editComponentProperties); }
  });

  var dataAndPropsToolbar = dataButtonId + ' ' + propButtonId;
  var dataToolBar = dataButtonId;
  var propsToolBar = propButtonId;

  var toolbarPredicate = function(enableData, enableProps) {
    return function(node) {
      var isComponent = self._editor.dom.is(node, '[data-component]');
      if (!isComponent) {
        return false;
      }
      var componentType = self._editor.dom.getAttrib(node, 'data-component');
      var componentInfo = _.find(componentInfos, function(info) { return info.componentType === componentType });
      if (!componentInfo) {
        return false;
      };
      return enableData === componentInfo.hasData && enableProps === componentInfo.hasProperties;
    }
  }

  var addToolbar = function(toolBarConfig, predicate) {
    var contextId = 'jsharmonyComponentContextToolbar_' + toolBarConfig;
    self._editor.ui.registry.addContextToolbar(contextId, {
      predicate: predicate,
      items: toolBarConfig,
      scope: 'node',
      position: 'node'
    });
  }
  addToolbar(dataAndPropsToolbar, toolbarPredicate(true, true));
  addToolbar(dataToolBar, toolbarPredicate(true, false));
  addToolbar(propsToolBar, toolbarPredicate(false, true));
}

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

  return this._jsHarmonyCmsComponentManager.components[id];
}

/**
 * When an undo or redo event occurs in the editor
 * the component needs to be re-rendered.
 * @private
 * @param {object} e - the undo/redo event from the TinyMCE editor
 */
JsHarmonyComponentPlugin.prototype.handleUndoRedo = function(e) {
  var self = this;
  var content = e.level.content;
  if (!content) return;
  var parser = new tinymce.html.DomParser({validate: false});
  parser.addAttributeFilter('data-component-id', function(nodes, name) {
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var id = node.attributes.map['data-component-id'];
      var type = node.attributes.map['data-component'];
      if (id && type) {
        self._editor.fire(EVENT_NAMES.renderComponent, self.makeComponentEvent(id, type));
      }
    }
  });
  parser.parse(content);
}

/**
 * Initialize the plugin.
 * Do not call this more than one time per editor instance.
 * @private
 * @param {Object[]} components - the component configurations
 */
JsHarmonyComponentPlugin.prototype.initialize = function(components) {

  var self = this;

  /** @type {ComponentInfo[]} */
  var componentInfo = [];

  // Register component icons and build
  // component info.
  _.forEach(components, function(component) {
    if (component.icon) {
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
          console.error('Unknown icon family "' + iconType + '"');
        }
      } else {
        icon = component.icon;
      }

      self._editor.ui.registry.addIcon(iconRegistryName, icon);

      componentInfo.push({
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
    self._editor.ui.registry.addIcon(ICONS[key].name, ICONS[key].html);
  }

  this.createContextToolbar(componentInfo);
  this.createComponentInsertMenu(componentInfo);

  this._editor.on('undo', function(info) { self.handleUndoRedo(info); });
  this._editor.on('redo', function(info) { self.handleUndoRedo(info); });

  this._editor.addCommand(COMMAND_NAMES.editComponentData, function() {
    var el = self._editor.selection.getStart();
    self.openDataEditor(el);
  });

  this._editor.addCommand(COMMAND_NAMES.editComponentProperties, function() {
    var el = self._editor.selection.getStart();
    self.openPropertiesEditor(el);
  });

  this._editor.on('init', function() {
    self._editor.serializer.addNodeFilter('div', function(nodes) { self.serializerFilter(nodes); });
    self._editor.parser.addAttributeFilter('data-component', function(nodes) { self.parseFilter(nodes); });
  });
}

/**
 * Insert the component into the editor.
 * @private
 * @param {string} componentType - the type of the component to insert.
 */
JsHarmonyComponentPlugin.prototype.insertComponentContent = function(componentType) {
  var cms = jsHarmonyCMSInstance;
  var jsh = cms.jsh;
  var $ = jsh.$;

  var domUtil = this._editor.dom;
  var selection = this._editor.selection;

  var currentNode = selection.getEnd();

  var placeHolder = domUtil.create('div', { id: domUtil.uniqueId() },  '');

  $(placeHolder).insertBefore(currentNode);
  
  selection.select(placeHolder);
  selection.collapse(false);

  this._editor.insertContent(this.makeComponentContainer(componentType));
}

/**
 * Create the component container HTML string for
 * inserting into the editor.
 * @private
 * @param {string} componentType - the type of component to create
 * @returns {string} - HTML string
 */
JsHarmonyComponentPlugin.prototype.makeComponentContainer = function(componentType) {
  return '<div class="mceNonEditable" data-component="' + componentType + '" data-component-properties="" data-component-content="" data-is-insert="true"></div>';
}

/**
 * Create a component event.
 * @private
 * @param {string} componentId - the ID of the component that is the event target
 * @param {string} componentType - the type of the component that is the event target
 * @return {ComponentEvent}
 */
JsHarmonyComponentPlugin.prototype.makeComponentEvent = function(componentId, componentType) {
  return {
    componentId: componentId,
    componentType: componentType
  };
}

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
}

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
}

/**
 * Filter the TinyMce content parsed nodes.
 * @private
 * @param {Array.<object>} nodes - a list of TinyMce nodes
 */
JsHarmonyComponentPlugin.prototype.parseFilter = function(nodes) {
  var self = this;
  _.each(nodes, function(node) {
    var id = self._jsHarmonyCmsComponentManager.getNextComponentId();
    // var id = node.attributes.map['data-component-id'];
    node.attr('data-component-id', id);
    var type = node.attributes.map['data-component'];
    // Content is not actually in the DOM yet.
    // Wait for next loop
    setTimeout(function() {
      self._editor.fire(EVENT_NAMES.renderComponent, self.makeComponentEvent(id, type));
    });
  });
}

/**
 * Filter the TinyMce content to find relevant components
 * and serialize the components for save.
 * @private
 * @param {Array.<object>} nodes - a list of TinyMce nodes
 */
JsHarmonyComponentPlugin.prototype.serializerFilter = function(nodes) {
  for(var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var componentAttr = node.attr('data-component');
    if (componentAttr == undefined || componentAttr.length < 1) {
      continue;
    }
    node.empty();
  }
}

exports = module.exports = registerPlugin;