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

var _ = require('lodash');
var Convert  = require('../utils/convert');
var GridDataStore = require('./gridDataStore');
var DataEditor_Form = require('./dataEditor_form')
var ComponentTemplate = require('../componentModel/componentTemplate');
var TemplateRenderer = require('../templateRenderer');


/** @typedef {import('../templateRenderer').RenderConfig} RenderConfig */
/** @typedef {import('../templateRenderer').GridPreviewRenderContext} GridPreviewRenderContext */

/** @typedef {import('../componentModel/dataModelTemplate_gridPreview').DataModelTemplate_GridPreview} DataModelTemplate_GridPreview */


/**
 * @callback DataEditor_GridPreviewController~beforeRenderGridRow
 * @param {DataGridItemEditor~RenderConfig} renderConfig
 */

/**
 * @callback DataEditor_GridPreviewController~renderGridRow
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
 * @param {DataModelTemplate_GridPreview} dataModelTemplate_GridPreview
 * @param {ComponentTemplate} componentTemplate
 */
function DataEditor_GridPreviewController(xModel, data, properties, dialogWrapper, cms, jsh, dataModelTemplate_GridPreview, componentTemplate) {

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
  this.$dialogWrapper = this.jsh.$(dialogWrapper);

  /** @private @type {string} */
  this._idFieldName = dataModelTemplate_GridPreview.getIdFieldName();

  /** @private @type {ComponentTemplate} */
  this._componentTemplate = componentTemplate;

  /** @private @type {string} */
  this._rowTemplate = dataModelTemplate_GridPreview.getRowTemplate();

  /** @private @type {DataModelTemplate_GridPreview} */
  this._modelTemplate = dataModelTemplate_GridPreview;

  /** @public @type {DataEditor_GridPreviewController~tileUpdateCallback} */
  this.onDataUpdated = undefined;

  /** @public @type {DataEditor_GridPreviewController~beforeRenderGridRow} */
  this.onBeforeRenderGridRow = undefined;

  /** @public @type {DataEditor_GridPreviewController~renderGridRow} */
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
  this._dataStore = new GridDataStore(this._idFieldName);
  this._apiData = [];
  _.each(data, function(item, index) {
    item[self._idFieldName] = self.makeItemId();
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
DataEditor_GridPreviewController.prototype.addRow = function($row, rowData) {
  var rowId = this.getParentRowId($row);
  var $rowComponent = this.getRowElementFromRowId(rowId);
  var self = this;

  $row.find('td.xgrid_action_cell.delete').remove();
  if (rowData._is_insert) {
    var id = this.makeItemId();
    this._insertId = id;
    rowData._insertId = id;
    $rowComponent.attr('data-item-id', id);
    setTimeout(function() {
      self.openItemEditor(id);
      self.scrollToItemRow(id);
    });

    this.forceCommit();
  } else {
    $rowComponent.attr('data-item-id', rowData[this._idFieldName]);
    this.renderRow(rowData);
  }
}

/**
 * Change the position of the item in the item list.
 * @private
 * @param {number} itemId - the item ID of the item being moved
 * @param {boolean} moveDown - set to true to mode the item toward the end of the list.
 */
DataEditor_GridPreviewController.prototype.changeItemSequence = function(itemId, moveDown) {

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
    this.updateModelDataFromDataStore(this.getRowIdFromItemId(adjData[this._idFieldName]));

    item.sequence = newSequence;
    this.updateModelDataFromDataStore(this.getRowIdFromItemId(item[this._idFieldName]));

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
DataEditor_GridPreviewController.prototype.dataUpdated = function() {
  this.updateParentController();
}

/**
 * Commit the data in the grid.
 * Should only be used for inserts and deletes.
 * @private
 */
DataEditor_GridPreviewController.prototype.forceCommit = function() {
  var controller = this.xModel.controller;
  controller.editablegrid.CurrentCell = undefined;
  controller.Commit();
}

DataEditor_GridPreviewController.prototype.showOverlay = function() {
  var joverlay = this.$dialogWrapper.find('.refreshLoadingOverlay');
  if(joverlay.length){
    joverlay.stop(true);
    joverlay.show();
    joverlay.css('opacity', 1);
  }
  else {
    this.$dialogWrapper.append('<div class="refreshLoadingOverlay" style="opacity:1;position:absolute;top:0px;left:0px;width:100%;height:'+this.$dialogWrapper[0].scrollHeight+'px;background-color:white;z-index:2147483639;"></div>');
  }
}

DataEditor_GridPreviewController.prototype.hideOverlay = function() {
  var self = this;
  this.$dialogWrapper.find('.refreshLoadingOverlay').stop().fadeOut(function(){
    self.jsh.$(this).remove();
  });
}

/**
 * Refresh the grid.
 * @private
 */
DataEditor_GridPreviewController.prototype.forceRefresh = function(cb) {

  // Need to maintain the scroll position
  // after the grid re-renders
  var self = this;
  var scrollTop = self.$dialogWrapper.scrollTop();

  //Show overlay
  self.showOverlay();
  var controller = self.xModel.controller;
  controller.editablegrid.CurrentCell = undefined;
  controller.grid.Load(undefined, undefined, function(){
    if(cb){
      if(cb()===false){ //Do not hide overlay
        self.$dialogWrapper.scrollTop(scrollTop);
        return;
      }
    }
    self.hideOverlay();
    self.$dialogWrapper.scrollTop(scrollTop);
    
  });
}

/**
 * @private
 * @param {string} itemId
 * @returns {GridPreviewRenderContext}
 */
DataEditor_GridPreviewController.prototype.getGridPreviewRenderContext = function(itemId) {
  var itemIndex = this._dataStore.getItemIndexById(itemId);
  /** @type {GridPreviewRenderContext} */
  var retVal = {
    rowIndex: itemIndex
  };
  return retVal;
}

/**
 * Get the item data for the corresponding rowId
 * @private
 * @param {number} rowId - the row ID of the data to get.
 * @return {(Oobject | undefined)}
 */
DataEditor_GridPreviewController.prototype.getItemDataFromRowId = function(rowId) {
  var slideId = this.jsh.$('.xrow.xrow_' + this.xModel.id + '[data-id="' + rowId + '"] [data-component-template="gridRow"]')
    .attr('data-item-id');
  return this._dataStore.getDataItem(slideId) || {};
}

/**
 * Get the next item sequence which is equal to the
 * current max sequence + 1.
 * @private
 * @returns {number}
 */
DataEditor_GridPreviewController.prototype.getNextSequenceNumber = function() {
  var maxItem =  _.maxBy(this._dataStore.getDataArray(), function(item) {
    return _.isNumber(item.sequence) ? item.sequence : -1;
  });
  if(!maxItem) return 1;
  return  _.isNumber(maxItem.sequence) ? maxItem.sequence + 1 : 0;
}

/**
 * Get the row ID of the parent row for the given element.
 * @private
 * @param {object} $element - a child JQuery element of the row
 * @return {number}
 */
DataEditor_GridPreviewController.prototype.getParentRowId = function($element) {
  return this.jsh.XExt.XModel.GetRowID(this.xModel.id, $element);
}

/**
 * Find the topmost element defined in the row template for the row
 * with the given ID.
 * @private
 * @param {number} rowId
 * @returns {JQuery}
 */
DataEditor_GridPreviewController.prototype.getRowElementFromRowId = function(rowId) {
  var rowSelector = '.xrow[data-id="' + rowId + '"]';
  return this.$dialogWrapper.find(rowSelector + ' [data-component-template="gridRow"]');
}

/**
 * Get the row ID for the item with the given ID.
 * @private
 * @param {number} itemId - the item ID to use to find the parent row ID.
 * @return {number}
 */
DataEditor_GridPreviewController.prototype.getRowIdFromItemId = function(itemId) {
  var $el = this.jsh.$(this.$dialogWrapper).find('[data-component-template="gridRow"][data-item-id="' + itemId + '"]');
  return this.getParentRowId($el);
}

/**
 * Entry point for controller. Do not call until
 * the form is on screen.
 * @public
 */
DataEditor_GridPreviewController.prototype.initialize = function() {

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
    newRow[self._idFieldName] = self._insertId;
    newRow.sequence = self.getNextSequenceNumber();
    self._insertId = undefined;

    var dataStoreItem = self._modelTemplate.makePristineCopy(newRow, false);
    dataStoreItem = self._modelTemplate.populateDataInstance(dataStoreItem);
    self._dataStore.addNewItem(dataStoreItem);

    actionResult[self.xModel.id] = {}
    actionResult[self.xModel.id][self._idFieldName] = newRow[self._idFieldName];
    self.dataUpdated();
    self.renderRow(self._dataStore.getDataItem(newRow[self._idFieldName]));
  }

  formApi.onDelete  = function(action, actionResult, keys) {
    self.showOverlay();

    self._dataStore.deleteItem(keys[self._idFieldName]);
    //Commit Data
    self._apiData.splice(0, self._apiData.length);
    self._dataStore.getDataArray().forEach(a => self._apiData.push(a));

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
DataEditor_GridPreviewController.prototype.isReadOnly = function() {
  return !!this.cms.readonly;
}

/**
 * Create a random item id
 * @private
 * @returns {string}
 */
DataEditor_GridPreviewController.prototype.makeItemId = function() {
  return '_' + Math.random().toString().replace('.', '');
}

/**
 * @private
 * @param {string} itemId - the ID of the item to edit
 */
DataEditor_GridPreviewController.prototype.openItemEditor = function(itemId) {

  var self = this;
  var dateEditor =  new DataEditor_Form(this._componentTemplate, this.getGridPreviewRenderContext(itemId), this.isReadOnly(), this.cms, this.jsh)
  var currentData = this._dataStore.getDataItem(itemId);
  var rowId = this.getRowIdFromItemId(itemId);

  dateEditor.open(this._dataStore.getDataItem(itemId), this._properties || {},  function(updatedData) {
      _.assign(currentData, updatedData)
      var dataId = currentData[self._idFieldName];
      var rowId = self.getRowIdFromItemId(dataId);

      for(var key in currentData){
        if(key in self.xModel.fields){
          var oldval = self.xModel.get(key, rowId);
          if(oldval !== currentData[key]){
            self.xModel.set(key, updatedData[key], rowId);
          }
        }
      }
      self.updateModelDataFromDataStore(rowId);
      self.dataUpdated();
      self.renderRow(currentData);
  }, function() {
    self.scrollToItemRow(itemId);
  });
}

/**
 * Prompt to delete the row with the given row ID
 * @private
 * @param {number} rowId - the ID of the row to delete.
 */
DataEditor_GridPreviewController.prototype.promptDelete = function(rowId) {
  var self = this;
  self.jsh.XExt.Confirm("Are you sure you want to delete this item?", function(){
    //Perform Delete
    self.xModel.controller.DeleteRow(rowId, { force: true });
    setTimeout(function() {
      self.forceCommit();
      setTimeout(function() { self.forceRefresh() });
    });
  });
}

/**
 * Render the row defined by the data
 * @override
 * @private
 * @param {TileData} data
 */
DataEditor_GridPreviewController.prototype.renderRow = function(data) {
  var self = this;
  var dataId = data[this._idFieldName];
  var rowId = this.getRowIdFromItemId(dataId);
  var $row = this.getRowElementFromRowId(rowId);
  var template =
      '<div class="toolbar">' +
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
        '<button data-component-part="editButton" data-allowReadOnly>' +
          '<span class="material-icons">' +
            'edit' +
          '</span>' +
        '</button>' +
        '<button data-component-part="deleteItem">' +
          '<span class="material-icons">' +
            'delete' +
          '</span>' +
        '</button>' +
      '</div>' +
      '<div data-component-part="preview"></div>'
  $row.empty().append(template);

  var renderConfig = TemplateRenderer.createRenderConfig(this._rowTemplate, { items: [data] }, this._properties || {}, this.cms);
  renderConfig.gridContext = this.getGridPreviewRenderContext(dataId);

  if (_.isFunction(this.onBeforeRenderGridRow)) this.onBeforeRenderGridRow(renderConfig);

  var rendered = TemplateRenderer.render(renderConfig, 'gridRowDataPreview', this.jsh);

  $row.find('[data-component-part="preview"]').empty().append(rendered);

  if (this.isReadOnly()) {
    $row.find('button:not([data-allowReadOnly])').attr('disabled', true);
  } else {

    $row.find('[data-component-part="moveItem"]').off('click.basicComponent').on('click.basicComponent', function(e) {
        if (self.isReadOnly()) return;
        var moveDown = self.jsh.$(e.target).closest('button[data-dir]').attr('data-dir') === 'next';
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

  $row.find('[data-component-part="preview"]').off('dblclick.cmsComponent').on('dblclick.cmsComponent', function() {
    self.openItemEditor(dataId);
  });

  $row.off('mousedown.cmsComponent').on('mousedown.cmsComponent', function(event) {
    // We don't want the user to accidentally select text (which happens often)
    // when double clicking. This will prevent that.
    if (event.detail === 2) {
      event.preventDefault();
    }
  });

  this.updateSequenceButtonViews();

  if (_.isFunction(this.onRenderGridRow)) this.onRenderGridRow($row.find('[data-component-part="preview"]')[0], renderConfig.data, renderConfig.properties);

  setTimeout(function() {
    _.forEach($row.find('[data-component-part="preview"] [data-component]'), function(el) {
      self.cms.componentManager.renderComponent(el);
    });
  }, 100);
}

/**
 * Set the modal scroll position to show the row for the
 * item with the given item ID. If the item is already visible
 * then do nothing.
 * @private
 * @param {string} itemId
 */
DataEditor_GridPreviewController.prototype.scrollToItemRow = function(itemId) {

  var $row = this.getRowElementFromRowId(this.getRowIdFromItemId(itemId));
  if ($row.length < 1 ) return;

  var $scrollParent = $row.scrollParent();
  var scrollParentY = $scrollParent.offset().top;
  var rowRelativeStartY = $row.offset().top - scrollParentY;
  var rowRelativeEndY = rowRelativeStartY + $row.outerHeight();
  var parentRelativeMaxY = $scrollParent.height();

  var isRowFullyInView = rowRelativeStartY >= 0 && rowRelativeEndY <= parentRelativeMaxY;
  if (isRowFullyInView) return;

  var rowFitsInView = (rowRelativeEndY - rowRelativeStartY) < parentRelativeMaxY;
  if (!rowFitsInView) {
    // If the row doesn't fit then just scroll to the top of the row
    $row[0].scrollIntoView();
    return;
  }

  // Try to minimize the scroll distance
  var rowTopDistanceFromParentTop = Math.abs(rowRelativeStartY);
  var rowBottomDistanceFromParentBottom = Math.abs(parentRelativeMaxY - rowRelativeEndY);
  var alignTop = rowTopDistanceFromParentTop <= rowBottomDistanceFromParentBottom;
  $row[0].scrollIntoView(alignTop);
}

/**
 * Copy properties from data store item to controller data item.
 * Call anytime the data store item changes.
 * @private
 * @param {number} rowId - the ID of the row for which the corresponding data will be updated (mutated).
 */
DataEditor_GridPreviewController.prototype.updateModelDataFromDataStore = function(rowId) {

  var idField = this._idFieldName;
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
DataEditor_GridPreviewController.prototype.updateParentController = function() {
  var self = this;
  this._dataStore.sortBySequence();

  var items = this._dataStore.getDataArray()  || [];
  items = _.map(items, function(item) { return self._modelTemplate.makePristineCopy(item, true); });

  var data = { items: items };

  if (_.isFunction(this.onDataUpdated)) this.onDataUpdated(data);
}

/**
 * Iterate through data and enable/disable sequence buttons as needed.
 * @private
 */
DataEditor_GridPreviewController.prototype.updateSequenceButtonViews = function() {

  var self = this;
  _.forEach(this._dataStore.getDataArray(), function(item, index) {
    var dataId = item[self._idFieldName];
    var $row = self.getRowElementFromRowId(self.getRowIdFromItemId(dataId));

    var isFirst = index < 1;
    var isLast = index >= (self._dataStore.count() - 1);

    $row.find('[data-component-part="moveItem"][data-dir="prev"]')
        .attr('disabled', isFirst || self.isReadOnly());

    $row.find('[data-component-part="moveItem"][data-dir="next"]')
      .attr('disabled', isLast || self.isReadOnly());
  });
}

exports = module.exports = DataEditor_GridPreviewController;
