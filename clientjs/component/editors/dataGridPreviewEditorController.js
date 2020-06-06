
var Convert  = require('../utils/convert');
var GridDataStore = require('./gridDataStore');
var DataFormEditor = require('./dataFormEditor')
var ComponentConfig = require('../componentModel/componentConfig');
var GridPreviewDataModel = require('../componentModel/gridPreviewDataModel');


/**
 * @typedef {Object} RenderConfig
 * @property {Object} data - the component data
 * @property {Object} properties - the component properties
 * @property {string} template - the template being rendered
 */

/**
 * @callback DataGridPreviewEditorController~beforeRenderGridRow
 * @param {DataGridItemEditor~RenderConfig} renderConfig
 */

/**
 * @callback DataGridPreviewEditorController~renderGridRow
 * @param {HTMLElement} element
 * @param {Object} data - the component data
 * @param {Object} properties - the component properties
 */

/**
 * @class
 * @classdesc Controller for handling grid preview data editor.
 * @public
 * @param {Object} xModel
 * @param {Object} data - the data used to render the component.
 * @param {Object} properties - the component's configured properties (used to render the component)
 * @param {(JQuery | HTMLElement)} dialogWrapper
 * @param {Object} cms
 * @param {Object} jsh
 * @param {GridPreviewDataModel} gridPreviewDataModel
 * @param {ComponentConfig} componentConfig
 */
function DataGridPreviewEditorController(xModel, data, properties, dialogWrapper, cms, jsh, gridPreviewDataModel, componentConfig) {

  var self = this;

  /** @private @type {Object} */
  this._properties = properties;

  /** @private @type {Object} */
  this.jsh = jsh;

  /** @private @type {Object} */
  this.cms = cms;

  /** @private @type {Object} */
  this.xModel = xModel;

  /** @private @type {JQuery} */
  this.$dialogWrapper = $(dialogWrapper);

  /** @private @type {import('../componentModel/fieldModel').FieldModel} */
  this._gridFields = gridPreviewDataModel.getGridFields();

  /** @private @type {ComponentConfig} */
  this._componentConfig = componentConfig;

  /** @private @type {string} */
  this._rowTemplate = gridPreviewDataModel.getRowTemplate();

  /** @public @type {DataGridPreviewEditorController~tileUpdateCallback} */
  this.onDataUpdated = undefined;

  /** @public @type {DataGridPreviewEditorController~beforeRenderGridRow} */
  this.onBeforeRenderGridRow = undefined;

  /** @public @type {DataGridPreviewEditorController~renderGridRow} */
  this.onRenderGridRow = undefined;


  if (!_.isArray(data || [])) {
    throw new Error('Grid data must be an array');
  }
  data = data || [];
  // We are going to keep two copies of data.
  // The data store has clean and distinct references
  // that the model doesn't touch.
  // The data store is updated by the user and then
  // changes are propagated to the API data which is
  // attached to the grid.
  /** @type {GridDataStore} */
  this._dataStore = new GridDataStore(this._gridFields.getIdFieldName());
  this._apiData = [];
  _.each(data, function(item, index) {
    item[self._gridFields.getIdFieldName()] = self.makeItemId();
    item.sequence = index;
    // Don't expose references in data store.
    // The grid is not allowed to touch them.
    self._dataStore.addNewItem(item);
    self._apiData.push(_.extend({}, item));
  });
}

/**
 * Called by JSH when adding a row.
 * @public
 * @param {object} $row - the JQuery row element proper
 * @param {Object} rowData - the data for the row (augmented by model)
 */
DataGridPreviewEditorController.prototype.addRow = function($row, rowData) {
  var rowId = this.getParentRowId($row);
  var $rowComponent = this.getRowElementFromRowId(rowId);
  $row.find('td.xgrid_action_cell.delete').remove();
  if (rowData._is_insert) {
    var id = this.makeItemId();
    this._insertId = id;
    rowData._insertId = id;
    $rowComponent.attr('data-item-id', id);
    this.forceCommit();
  } else {
    $rowComponent.attr('data-item-id', rowData[this._gridFields.getIdFieldName()]);
    var self = this;
    self.renderRow(rowData);
  }
}

/**
 * Change the position of the item in the item list.
 * @private
 * @param {number} itemId - the item ID of the item being moved
 * @param {boolean} moveDown - set to true to mode the item toward the end of the list.
 */
DataGridPreviewEditorController.prototype.changeItemSequence = function(itemId, moveDown) {

  var item = this._dataStore.getDataItem(itemId);
  if (!item) return;

  var items = this._dataStore.getDataArray() || [];
  item.sequence = item.sequence == undefined ? 9999 : Convert.toNumber(item.sequence);

  // Find the adjacent items
  var prevSequence = -1;
  var prevIndex = -1;
  var nextSequence = 9999;
  var nextIndex = -1;

  for (var i = 0; i < items.length; i++) {
    var currentItem = items[i];
    var sequence = Convert.toNumber(currentItem.sequence);
    // Find the previous adjacent item by finding the max sequence
    // less than the current sequence
    if (sequence < item.sequence && sequence > prevSequence) {
      prevSequence = sequence;
      prevIndex = i;
    }
    // Find the next adjacent item by finding the min sequence
    // greater than the current sequence
    if (sequence > item.sequence && sequence < nextSequence) {
      nextSequence = sequence;
      nextIndex = i;
    }
  }

  var doUpdate = false;
  var updateIndex = -1;
  var newSequence = -1;

  if (moveDown && nextIndex > -1) {
    updateIndex = nextIndex;
    newSequence = nextSequence
    doUpdate = true;
  } else if (!moveDown && prevIndex > - 1) {
    updateIndex = prevIndex;
    newSequence = prevSequence
    doUpdate = true;
  }

  if (doUpdate) {
    var adjData = items[updateIndex]
    adjData.sequence = item.sequence;
    this.updateModelDataFromDataStore(this.getRowIdFromItemId(adjData[this._gridFields.getIdFieldName()]));

    item.sequence = newSequence;
    this.updateModelDataFromDataStore(this.getRowIdFromItemId(item[this._gridFields.getIdFieldName()]));

    this._dataStore.sortBySequence();
    this._apiData.splice(0, this._apiData.length);
    // Update the data attached to the grid from the pristine data store
    this._dataStore.getDataArray().forEach(a => this._apiData.push(a));

    // Data was changed in the view
    this.dataUpdated();

    // A refresh is required by the current grid
    // system to ensure rows are re-drawn in correct order.
    this.forceRefresh();
  }
}

/**
 * Call anytime slide data is changed (and valid) in the view.
 * @private
 */
DataGridPreviewEditorController.prototype.dataUpdated = function() {
  this.updateParentController();
}

/**
 * Commit the data in the grid.
 * Should only be used for inserts and deletes.
 * @private
 */
DataGridPreviewEditorController.prototype.forceCommit = function() {
  var controller = this.xModel.controller;
  controller.editablegrid.CurrentCell = undefined;
  controller.Commit();
}

/**
 * Refresh the grid.
 * @private
 */
DataGridPreviewEditorController.prototype.forceRefresh = function() {
  var controller = this.xModel.controller;
  controller.editablegrid.CurrentCell = undefined;
  controller.Refresh();
}

/**
 * Get the item data for the corresponding rowId
 * @private
 * @param {number} rowId - the row ID of the data to get.
 * @return {(Oobject | undefined)}
 */
DataGridPreviewEditorController.prototype.getItemDataFromRowId = function(rowId) {
  var slideId = $('.xrow.xrow_' + this.xModel.id + '[data-id="' + rowId + '"] [data-component-template="gridRow"]')
    .attr('data-item-id');
  return this._dataStore.getDataItem(slideId) || {};
}

/**
 * Get the next item sequence which is equal to the
 * current max sequence + 1.
 * @private
 * @returns {number}
 */
DataGridPreviewEditorController.prototype.getNextSequenceNumber = function() {
  var maxItem =  _.max(this._dataStore.getDataArray(), function(item) {
    return typeof item.sequence == 'number' ? item.sequence : -1;
  });
  return typeof maxItem.sequence == 'number' ? maxItem.sequence + 1 : 0;
}

/**
 * Get the row ID of the parent row for the given element.
 * @private
 * @param {object} $element - a child JQuery element of the row
 * @return {number}
 */
DataGridPreviewEditorController.prototype.getParentRowId = function($element) {
  return this.jsh.XExt.XModel.GetRowID(this.xModel.id, $element);
}

/**
 * Find the topmost element defined in the row template for the row
 * with the given ID.
 * @private
 * @param {number} rowId
 * @returns {JQuery}
 */
DataGridPreviewEditorController.prototype.getRowElementFromRowId = function(rowId) {
  var rowSelector = '.xrow[data-id="' + rowId + '"]';
  return this.$dialogWrapper.find(rowSelector + ' [data-component-template="gridRow"]');
}

/**
 * Get the row ID for the item with the given ID.
 * @private
 * @param {number} itemId - the item ID to use to find the parent row ID.
 * @return {number}
 */
DataGridPreviewEditorController.prototype.getRowIdFromItemId = function(itemId) {
  var $el = $(this.$dialogWrapper).find('[data-component-template="gridRow"][data-item-id="' + itemId + '"]');
  return this.getParentRowId($el);
}

/**
 * Entry point for controller. Do not call until
 * the form is on screen.
 * @public
 */
DataGridPreviewEditorController.prototype.initialize = function() {

  var self = this;
  var modelInterface = this.jsh.App[this.xModel.id];

  if (!_.isFunction(modelInterface.getDataApi)) {
    throw new Error('model must have function "getDataApi(xModel, apiType)"');
  }

  var gridApi = modelInterface.getDataApi(this.xModel, 'grid');
  var formApi = modelInterface.getDataApi(this.xModel, 'form');

  gridApi.dataset = this._apiData;
  formApi.dataset = this._apiData;

  formApi.onInsert = function(action, actionResult, newRow) {
    newRow[self._gridFields.getIdFieldName()] = self._insertId;
    newRow.sequence = self.getNextSequenceNumber();
    self._insertId = undefined;
    self._dataStore.addNewItem(_.extend({}, newRow));
    self._apiData.push(newRow);
    actionResult[self.xModel.id] = {}
    actionResult[self.xModel.id][self._gridFields.getIdFieldName()] = newRow[self._gridFields.getIdFieldName()];
    self.dataUpdated();
    self.renderRow(self._dataStore.getDataItem(newRow[self._gridFields.getIdFieldName()]));
  }

  formApi.onDelete  = function(action, actionResult, keys) {
    self._dataStore.deleteItem(keys[self._gridFields.getIdFieldName()]);
    var index = self._apiData.findIndex(function(item) { return item[self._gridFields.getIdFieldName()] === keys[self._gridFields.getIdFieldName()]});
    if (index > -1) {
      self._apiData.splice(index, 1);
    }
    self.dataUpdated();
    return false;
  }

  this.forceRefresh();
}

/**
 * Check to see if the component is readonly.
 * @private
 * @returns {boolean} - true if the model is readonly.
 */
DataGridPreviewEditorController.prototype.isReadOnly = function() {
  return !!this.cms.readonly;
}

/**
 * Create a random item id
 * @private
 * @returns {string}
 */
DataGridPreviewEditorController.prototype.makeItemId = function() {
  return '_' + Math.random().toString().replace('.', '');
}

/**
 * @private
 * @param {string} itemId - the ID of the item to edit
 */
DataGridPreviewEditorController.prototype.openItemEditor = function(itemId) {

  var self = this;
  var dataFormEditor =  new DataFormEditor(this._componentConfig, this.isReadOnly(), this.cms, this.jsh)
  var currentData = this._dataStore.getDataItem(itemId);
  dataFormEditor.open(this._dataStore.getDataItem(itemId), this._properties || {},  function(updatedData) {
      _.assign(currentData, updatedData)
      var rowId = self.getRowIdFromItemId(itemId);
      self.updateModelDataFromDataStore(rowId);
      self.dataUpdated();
      self.renderRow(currentData);
  });
}

/**
 * Prompt to delete the row with the given row ID
 * @private
 * @param {number} rowId - the ID of the row to delete.
 */
DataGridPreviewEditorController.prototype.promptDelete = function(rowId) {
  this.xModel.controller.DeleteRow(rowId);
  var self = this;
  $('body').one('click', '.xdialogbox.xconfirmbox input[type="button"]', function(e) {
    var buttonValue = $(e.target).closest('input[type="button"]').attr('value');
    if (buttonValue === 'Yes') {
      setTimeout(function() {
        self.forceCommit();
      });
    }
  });
}

/**
 * Render the row defined by the data
 * @override
 * @private
 * @param {TileData} data
 */
DataGridPreviewEditorController.prototype.renderRow = function(data) {

  var self = this;
  var dataId = data[this._gridFields.getIdFieldName()];
  var rowId = this.getRowIdFromItemId(dataId);
  var $row = this.getRowElementFromRowId(rowId);
  var itemIndex = this._dataStore.getItemIndexById(dataId);
  var isFirst = itemIndex < 1;
  var isLast = itemIndex >= (this._dataStore.count() - 1);

  var template =
        '<div tabindex="0" data-component-template="gridRow">' +
          '<div class="toolbar">' +
            '<button data-component-part="editButton" data-allowReadOnly>' +
              '<span class="material-icons">' +
                'edit' +
              '</span>' +
            '</button>' +
            '<button data-component-part="moveItem" data-dir="prev">' +
              '<span class="material-icons" style="transform: rotate(-90deg)">' +
                'chevron_right' +
              '</span>' +
            '</button>' +
            '<button data-component-part="moveItem" data-dir="next">' +
              '<span class="material-icons" style="transform: rotate(90deg)">' +
                'chevron_right' +
              '</span>' +
            '</button>' +
            '<button data-component-part="deleteItem">' +
              '<span class="material-icons">' +
                'delete' +
              '</span>' +
            '</button>' +
          '</div>' +
          '<div data-component-part="preview"></div>' +
        '</div>'

  $row.empty().append(template);

  var renderOptions = {
    template: this._rowTemplate,
    data: data,
    properties: this._properties || {}
  }

  if (_.isFunction(this.onBeforeRenderGridRow)) this.onBeforeRenderGridRow(renderOptions);

  var templateData = { data: renderOptions.data, properties: renderOptions.properties };
  var rendered = '';
  try {
    rendered = this.jsh.ejs.render(renderOptions.template || '', templateData);
  } catch (error) {
    console.error(error);
  }


  $row.find('[data-component-part="preview"]').empty().append(rendered);

  if (this.isReadOnly()) {
    $row.find('button:not([data-allowReadOnly])').attr('disabled', true);
  } else {
    // Disable "move up" button if item is first, otherwise enable
    $row.find('[data-component-part="moveItem"][data-dir="prev"]')
        .attr('disabled', isFirst)
    // Disable "move down" button if item is last, otherwise enable
    $row.find('[data-component-part="moveItem"][data-dir="next"]')
      .attr('disabled', isLast)

    $row.find('[data-component-part="moveItem"]').off('click.basicComponent').on('click.basicComponent', function(e) {
        if (self.isReadOnly()) return;
        var moveDown = $(e.target).closest('button[data-dir]').attr('data-dir') === 'next';
        self.changeItemSequence(dataId, moveDown);
    });

    $row.find('[data-component-part="deleteItem"]').off('click.basicComponent').on('click.basicComponent', function(e) {
      if (self.isReadOnly()) return;
      var rowId = self.getParentRowId(e.target);
      self.promptDelete(rowId);
    });
  }

  $row.find('[data-component-part="editButton"]').on('click', function() {
    self.openItemEditor(dataId);
  });

  $row.off('dblclick.cmsComponent').on('dblclick.cmsComponent', function() {
    self.openItemEditor(dataId);
  });

  if (_.isFunction(this.onRenderGridRow)) this.onRenderGridRow($row.find('[data-component-part="preview"]')[0], renderOptions.data, renderOptions.properties);

  setTimeout(function() {
    _.forEach($row.find('[data-component-part="preview"] [data-component]'), function(el) {
      self.cms.componentController.renderComponent(el);
    });
  }, 100);
}

/**
 * Copy properties from data store item to controller data item.
 * Call anytime the data store item changes.
 * @private
 * @param {number} rowId - the ID of the row for which the corresponding data will be updated (mutated).
 */
DataGridPreviewEditorController.prototype.updateModelDataFromDataStore = function(rowId) {

  var idField = this._gridFields.getIdFieldName();
  var data = this.getItemDataFromRowId(rowId);
  var item = this.xModel.controller.form.DataSet.find(a => a[idField] === data[idField]);
  if (!item) {
    return;
  }

  // Don't share references!
  _.extend(item, data);
}

/**
 * Send updated data to the parent controller.
 * Call anytime item data is changed (and valid).
 * @private
 */
DataGridPreviewEditorController.prototype.updateParentController = function() {
  var self = this;
  this._dataStore.sortBySequence();
  var data = this._dataStore.getDataArray()  || [];

  // /** @type {Array.<TileData>} */
  // var tiles = _.map(data, function(item) {
  //   // return self.cleanAndCopySlideData(item);
  //   return item;
  // });

  /** @type {TilesData} */
  var data = {
    items: data
  };

  if (_.isFunction(this.onDataUpdated)) this.onDataUpdated(data);
}

exports = module.exports = DataGridPreviewEditorController;
