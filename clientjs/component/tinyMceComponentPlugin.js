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
 * @param {Object[]} components - the component configurations
 */
function registerPlugin(components) {
  if (tinymce.PluginManager.get('jsharmony') != undefined) {
    return;
  }

  tinymce.PluginManager.add('jsharmony', function(editor, url) {
    new JsHarmonyComponentPlugin(editor, components);
  });
}

/**
 * @class
 * @private
 */
function JsHarmonyComponentPlugin(editor, components) {

  this._editor = editor;
  this.initialize(components);
}

/**
 * Create the menu button for picking components to insert.
 * @private
 * @param {Object[]} componentInfo
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
          text: item.text,
          icon: item.icon,
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
 */
JsHarmonyComponentPlugin.prototype.createContextToolbar = function() {

  var self = this;
  var propButtonId = 'jsharmonyComponentPropEditor';
  var dataButtonId = 'jsharmonyComponentDataEditor'
  var contextId = 'jsharmonyComponentContextToolbar';

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

  var toolbar = dataButtonId + ' ' + propButtonId;

  self._editor.ui.registry.addContextToolbar(contextId, {
    predicate: function(node) {
      return self._editor.dom.is(node, '[data-component]');
    },
    items: toolbar,
    scope: 'node',
    position: 'node'
  });
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

      var text = _.isArray(component.caption) ? component.caption[0] : component.caption;
      componentInfo.push({ componentType: component.id, icon: iconRegistryName, text: text || component.id });
    }
  });

  // Register icons
  for (var key in ICONS) {
    self._editor.ui.registry.addIcon(ICONS[key].name, ICONS[key].html);
  }

  this.createContextToolbar();
  this.createComponentInsertMenu(componentInfo);

  this._editor.on('undo', function(info) { self.handleUndoRedo(info); });
  this._editor.on('redo', function(info) { self.handleUndoRedo(info); });

  this._editor.addCommand(COMMAND_NAMES.editComponentData, function() {
    var el = self._editor.selection.getStart();
    self.openDataEditor(el);
  });

  this._editor.addCommand(COMMAND_NAMES.editComponentProperties, function() {
    var el = self._editor.selection.getStart();
    if (el && el._componentInterface && el._componentInterface.openPropertiesEditor) {
      el._componentInterface.openPropertiesEditor();
    }
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
  var self = this;
  var id = this.makeComponentId(componentType)
  this._editor.insertContent(this.makeComponentContainer(componentType, id));
  // Don't need to fire the insert event here.
  // We have a parser filter that will detect the insert and
  // fire the event.

  // But we do need to open the data dialog.
  // The next loop will cause the editor to parse the data
  // Then the loop after that the content will be in the DOM
  // (at least based on empirical tests).
  // So 1ms will be way more than enough time to wait.
  setTimeout(function() {
    self.openDataEditor(id);
  }, 1);
}

/**
 * Create the component container HTML string for
 * inserting into the editor.
 * @private
 * @param {string} componentType - the type of component to create
 * @param {string} id - the ID to uniquely identify the component.
 * @returns {string} - HTML string
 */
JsHarmonyComponentPlugin.prototype.makeComponentContainer = function(componentType, id) {
  return '<div class="mceNonEditable" data-component="' + componentType +'" data-component-id="' +
    id + '" data-component-properties="" data-component-content=""></div>';
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
 * Create a random ID for uniquely identifying
 * each component add via the editor.
 * @private
 * @returns {string}
 */
JsHarmonyComponentPlugin.prototype.makeComponentId = function(componentType) {
  var id;
  do {
    id = 'jsharmony_cms_component_' + Math.random().toString().replace('.', '');
    var idExists = tinymce.dom.DomQuery.find('#' + id).length > 0;
    id = idExists ? undefined : id;
  } while(!id)
  return id;
}

/**
 * Open the data editor for the component.
 * @private
 * @param {(string | Element)} componentIdOrElement - if type is string then find the component in the dom,
 * or else use the component element passed in
 */
JsHarmonyComponentPlugin.prototype.openDataEditor = function(componentIdOrElement) {
  if (!componentIdOrElement) return;
  if (_.isString(componentIdOrElement)) {
    var componentIdOrElement = tinymce.dom.DomQuery.find('[data-component-id="' + componentIdOrElement + '"]')[0];
  }
  if (!componentIdOrElement) return;
  if (componentIdOrElement && componentIdOrElement._componentInterface && componentIdOrElement._componentInterface.openDataEditor) {
    componentIdOrElement._componentInterface.openDataEditor();
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
    var id = node.attributes.map['data-component-id'];
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