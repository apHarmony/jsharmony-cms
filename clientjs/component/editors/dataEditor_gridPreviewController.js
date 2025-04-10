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
var DataEditor_Form = require('./dataEditor_form');
var TemplateRenderer = require('../templateRenderer');

/** @typedef {import('../componentModel/componentTemplate').ComponentTemplate} ComponentTemplate */

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
 * @param {Object} cms - the parent jsHarmonyCMSInstance
 * @param {Object} component - the parent component
 */

/**
 * @class
 * @classdesc Controller for handling grid preview data editor.
 * @public
 * @param {Object} xmodel
 * @param {Object} data - the data used to render the component.
 * @param {Object} properties - the component's configured properties (used to render the component)
 * @param {(JQuery | HTMLElement)} dialogWrapper
 * @param {Object} cms
 * @param {Object} jsh
 * @param {Object} component
 * @param {DataModelTemplate_GridPreview} dataModelTemplate_GridPreview
 * @param {ComponentTemplate} componentTemplate
 */
function DataEditor_GridPreviewController(xmodel, data, properties, dialogWrapper, cms, jsh, component, dataModelTemplate_GridPreview, componentTemplate) {

  var _this = this;

  /** @private @type {Object} */
  this._properties = properties;

  /** @private @type {Object} */
  this.jsh = jsh;

  /** @private @type {Object} */
  this.cms = cms;

  /** @private @type {Object} */
  this.component = component;

  /** @private @type {Object} */
  this.xmodel = xmodel;

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
    item[_this._idFieldName] = _this.makeItemId();
    item.sequence = index;
    // Don't expose references in data store.
    // The grid is not allowed to touch them.
    _this._dataStore.addNewItem(item);
    _this._apiData.push(_.extend({}, item));
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
  var _this = this;

  $row.find('td.xgrid_action_cell.delete').remove();
  if (rowData._is_insert) {
    var id = this.makeItemId();
    this._insertId = id;
    rowData._insertId = id;
    $rowComponent.attr('data-item-id', id);
    setTimeout(function() {
      _this.scrollToItemRow(id);
    });
  } else {
    $rowComponent.attr('data-item-id', rowData[this._idFieldName]);
    this.renderRow(rowData);
  }
};

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
    newSequence = nextSequence;
    doUpdate = true;
  } else if (!moveDown && prevIndex > - 1) {
    updateIndex = prevIndex;
    newSequence = prevSequence;
    doUpdate = true;
  }

  if (doUpdate) {
    var adjData = items[updateIndex];
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
};

/**
 * Call anytime slide data is changed (and valid) in the view.
 * @private
 */
DataEditor_GridPreviewController.prototype.dataUpdated = function() {
  this.updateParentController();
};

/**
 * Commit the data in the grid.
 * Should only be used for inserts and deletes.
 * @private
 */
DataEditor_GridPreviewController.prototype.forceCommit = function() {
  var controller = this.xmodel.controller;
  controller.editablegrid.CurrentCell = undefined;
  controller.Commit();
};

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
};

DataEditor_GridPreviewController.prototype.hideOverlay = function() {
  var _this = this;
  this.$dialogWrapper.find('.refreshLoadingOverlay').stop().fadeOut(function(){
    _this.jsh.$(this).remove();
  });
};

/**
 * Refresh the grid.
 * @private
 */
DataEditor_GridPreviewController.prototype.forceRefresh = function(cb) {

  // Need to maintain the scroll position
  // after the grid re-renders
  var _this = this;
  var scrollTop = _this.$dialogWrapper.scrollTop();

  //Show overlay
  _this.showOverlay();
  var controller = _this.xmodel.controller;
  controller.editablegrid.CurrentCell = undefined;
  controller.grid.Load(undefined, undefined, function(){
    if(cb){
      if(cb()===false){ //Do not hide overlay
        _this.$dialogWrapper.scrollTop(scrollTop);
        return;
      }
    }
    _this.hideOverlay();
    _this.$dialogWrapper.scrollTop(scrollTop);

  });
};

/**
 * @private
 * @param {string} itemId
 * @returns {GridPreviewRenderContext}
 */
DataEditor_GridPreviewController.prototype.getGridPreviewRenderContext = function(itemId) {
  var itemIndex = itemId ? this._dataStore.getItemIndexById(itemId) : this._dataStore.count();
  /** @type {GridPreviewRenderContext} */
  var retVal = {
    rowIndex: itemIndex
  };
  return retVal;
};

/**
 * Get the item data for the corresponding rowId
 * @private
 * @param {number} rowId - the row ID of the data to get.
 * @return {(Oobject | undefined)}
 */
DataEditor_GridPreviewController.prototype.getItemDataFromRowId = function(rowId) {
  var slideId = this.jsh.$('.xrow.xrow_' + this.xmodel.id + '[data-id="' + rowId + '"] [data-component-template="gridRow"]')
    .attr('data-item-id');
  return this._dataStore.getDataItem(slideId) || {};
};

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
};

/**
 * Get the row ID of the parent row for the given element.
 * @private
 * @param {object} $element - a child JQuery element of the row
 * @return {number}
 */
DataEditor_GridPreviewController.prototype.getParentRowId = function($element) {
  return this.jsh.XExt.XModel.GetRowID(this.xmodel.id, $element);
};

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
};

/**
 * Get the row ID for the item with the given ID.
 * @private
 * @param {number} itemId - the item ID to use to find the parent row ID.
 * @return {number}
 */
DataEditor_GridPreviewController.prototype.getRowIdFromItemId = function(itemId) {
  var $el = this.jsh.$(this.$dialogWrapper).find('[data-component-template="gridRow"][data-item-id="' + itemId + '"]');
  return this.getParentRowId($el);
};

/**
 * Entry point for controller. Do not call until
 * the form is on screen.
 * @public
 */
DataEditor_GridPreviewController.prototype.initialize = function() {

  var _this = this;
  var modelInterface = this.jsh.App[this.xmodel.id];

  if (!_.isFunction(modelInterface.getDataApi)) {
    throw new Error('model must have function "getDataApi(xmodel, apiType)"');
  }

  var gridApi = modelInterface.getDataApi(this.xmodel, 'grid');
  var formApi = modelInterface.getDataApi(this.xmodel, 'form');

  gridApi.dataset = this._apiData;
  formApi.dataset = this._apiData;

  formApi.onInsert = function(action, actionResult, newRow) {
    newRow[_this._idFieldName] = _this._insertId;
    newRow.sequence = _this.getNextSequenceNumber();
    _this._insertId = undefined;

    var dataStoreItem = _this._modelTemplate.makePristineCopy(newRow, false);
    dataStoreItem = _this._modelTemplate.populateDataInstance(dataStoreItem);
    _this._dataStore.addNewItem(dataStoreItem);

    actionResult[_this.xmodel.id] = {};
    actionResult[_this.xmodel.id][_this._idFieldName] = newRow[_this._idFieldName];
    _this.dataUpdated();
    _this.renderRow(_this._dataStore.getDataItem(newRow[_this._idFieldName]));
  };

  formApi.onDelete  = function(action, actionResult, keys) {
    _this.showOverlay();

    _this._dataStore.deleteItem(keys[_this._idFieldName]);
    //Commit Data
    _this._apiData.splice(0, _this._apiData.length);
    _this._dataStore.getDataArray().forEach(a => _this._apiData.push(a));

    _this.dataUpdated();
    return false;
  };

  this.forceRefresh();
};

/**
 * Check to see if the component is readonly.
 * @private
 * @returns {boolean} - true if the model is readonly.
 */
DataEditor_GridPreviewController.prototype.isReadOnly = function() {
  return !!this.cms.readonly;
};

/**
 * Create a random item id
 * @private
 * @returns {string}
 */
DataEditor_GridPreviewController.prototype.makeItemId = function() {
  return '_' + Math.random().toString().replace('.', '');
};

/**
 * @private
 */
DataEditor_GridPreviewController.prototype.addItem = function() {
  var _this = this;

  if (_this.xmodel.controller.editablegrid.CurrentCell) if(!_this.xmodel.controller.form.CommitRow()) return;
  if (_this.jsh.XPage.GetChanges().length > 0) { _this.jsh.XExt.Alert('Please save all changes before adding a row.'); return; }

  var dataEditor =  new DataEditor_Form(this._componentTemplate, this.getGridPreviewRenderContext(null), this.isReadOnly(), this.cms, this.jsh, _this.component);

  //Create a new item
  var currentData = this.xmodel.controller.form.NewRow({ unbound: true });

  //Open the form to edit the item
  dataEditor.open(currentData, this._properties || {},  function(updatedData) {
    _.assign(currentData, updatedData);
    var rowId = _this.xmodel.controller.AddRow();
    for(var key in currentData){
      if(key in _this.xmodel.fields){
        var oldval = _this.xmodel.get(key, rowId);
        if(oldval !== currentData[key]){
          _this.xmodel.set(key, updatedData[key], rowId);
        }
      }
    }
    _this.updateModelDataFromDataStore(rowId);
    _this.dataUpdated();
    _this.forceCommit();
    _this.renderRow(currentData);
  });
};

/**
 * @private
 * @param {string} itemId - the ID of the item to edit
 */
DataEditor_GridPreviewController.prototype.openItemEditor = function(itemId) {

  var _this = this;
  var dataEditor =  new DataEditor_Form(this._componentTemplate, this.getGridPreviewRenderContext(itemId), this.isReadOnly(), this.cms, this.jsh, _this.component);
  var currentData = this._dataStore.getDataItem(itemId);

  dataEditor.open(currentData, this._properties || {},  function(updatedData) {
    _.assign(currentData, updatedData);
    var dataId = currentData[_this._idFieldName];
    var rowId = _this.getRowIdFromItemId(dataId);

    for(var key in currentData){
      if(key in _this.xmodel.fields){
        var oldval = _this.xmodel.get(key, rowId);
        if(oldval !== currentData[key]){
          _this.xmodel.set(key, updatedData[key], rowId);
        }
      }
    }
    _this.updateModelDataFromDataStore(rowId);
    _this.dataUpdated();
    _this.renderRow(currentData);
  }, function() {
    _this.scrollToItemRow(itemId);
  });
};

/**
 * Prompt to delete the row with the given row ID
 * @private
 * @param {number} rowId - the ID of the row to delete.
 */
DataEditor_GridPreviewController.prototype.promptDelete = function(rowId) {
  var _this = this;
  _this.jsh.XExt.Confirm('Are you sure you want to delete this item?', function(){
    //Perform Delete
    _this.xmodel.controller.DeleteRow(rowId, { force: true });
    setTimeout(function() {
      _this.forceCommit();
      setTimeout(function() { _this.forceRefresh(); });
    });
  });
};

/**
 * Render the row defined by the data
 * @override
 * @private
 * @param {TileData} data
 */
DataEditor_GridPreviewController.prototype.renderRow = function(data) {
  var _this = this;
  var dataId = data[this._idFieldName];
  var rowId = this.getRowIdFromItemId(dataId);
  var $row = this.getRowElementFromRowId(rowId);
  var componentConfig = this._componentTemplate && this._componentTemplate._componentConfig;

  var template =
      '<div class="jsharmony_cms component_toolbar">' +
        '<div class="component_toolbar_button" data-component-part="moveItem" data-dir="prev">' +
          '<span class="material-icons" style="display:inline-block; transform: rotate(-90deg)">' +
            'chevron_right' +
          '</span>' +
        '</div>' +
        '<div class="component_toolbar_button" data-component-part="moveItem" data-dir="next">' +
          '<span class="material-icons" style="display:inline-block; transform: rotate(90deg)">' +
            'chevron_right' +
          '</span>' +
        '</div>' +
        '<div class="component_toolbar_button" data-component-part="editButton" data-allowReadOnly>' +
          '<span class="material-icons">' +
            'edit' +
          '</span>' +
        '</div>' +
        '<div class="component_toolbar_button" data-component-part="deleteItem">' +
          '<span class="material-icons">' +
            'delete' +
          '</span>' +
        '</div>' +
      '</div>' +
      '<div class="jsharmony_cms_component_preview" data-component-part="preview"></div>';
  $row.empty().append(template);

  var renderConfig = TemplateRenderer.createRenderConfig(this._rowTemplate, { items: [data] }, this._properties || {}, this.cms);
  renderConfig.gridContext = this.getGridPreviewRenderContext(dataId);

  if (_.isFunction(this.onBeforeRenderGridRow)) this.onBeforeRenderGridRow(renderConfig);

  var rendered = TemplateRenderer.render(renderConfig, 'gridRowDataPreview', this.jsh, this.cms, componentConfig);

  var $wrapper = $row.find('[data-component-part="preview"]');

  $wrapper.empty().append(rendered);

  if(this.cms && this.cms.editor) this.cms.editor.disableLinks($wrapper);

  if (this.isReadOnly()) {
    $row.find('.component_toolbar_button:not([data-allowReadOnly])').attr('disabled', true);
  } else {

    $row.find('[data-component-part="moveItem"]').off('click.basicComponent').on('click.basicComponent', function(e) {
      if (_this.isReadOnly()) return;
      var moveDown = _this.jsh.$(e.target).closest('.component_toolbar_button[data-dir]').attr('data-dir') === 'next';
      _this.changeItemSequence(dataId, moveDown);
    });

    $row.find('[data-component-part="deleteItem"]').off('click.basicComponent').on('click.basicComponent', function(e) {
      if (_this.isReadOnly()) return;
      var rowId = _this.getParentRowId(e.target);
      _this.promptDelete(rowId);
    });
  }

  $row.find('[data-component-part="editButton"]').on('click', function() {
    _this.openItemEditor(dataId);
  });

  $row.find('[data-component-part="preview"]').off('dblclick.cmsComponent').on('dblclick.cmsComponent', function() {
    _this.openItemEditor(dataId);
  });

  $row.off('mousedown.cmsComponent').on('mousedown.cmsComponent', function(event) {
    // We don't want the user to accidentally select text (which happens often)
    // when double clicking. This will prevent that.
    if (event.detail === 2) {
      event.preventDefault();
    }
  });

  this.updateSequenceButtonViews();

  if (_.isFunction(this.onRenderGridRow)) this.onRenderGridRow($row.find('[data-component-part="preview"]')[0], renderConfig.data, renderConfig.properties, _this.cms, _this.component);
  
  _this.component.notifyUpdate($row.find('[data-component-part="preview"]')[0]);

  setTimeout(function() {
    _.forEach($row.find('[data-component-part="preview"] [data-component]'), function(el) {
      _this.cms.componentManager.renderContentComponent(el);
    });
  }, 100);
};

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
};

/**
 * Copy properties from data store item to controller data item.
 * Call anytime the data store item changes.
 * @private
 * @param {number} rowId - the ID of the row for which the corresponding data will be updated (mutated).
 */
DataEditor_GridPreviewController.prototype.updateModelDataFromDataStore = function(rowId) {

  var idField = this._idFieldName;
  var data = this.getItemDataFromRowId(rowId);
  var item = this.xmodel.controller.form.DataSet.find(a => a[idField] === data[idField]);
  if (!item) {
    return;
  }

  // Don't share references!
  _.extend(item, data);
  this.xmodel.controller.form.ResetDirty();
};

/**
 * Send updated data to the parent controller.
 * Call anytime item data is changed (and valid).
 * @private
 */
DataEditor_GridPreviewController.prototype.updateParentController = function() {
  var _this = this;
  this._dataStore.sortBySequence();

  var items = this._dataStore.getDataArray()  || [];
  items = _.map(items, function(item) { return _this._modelTemplate.makePristineCopy(item, true); });

  var data = { items: items };

  if (_.isFunction(this.onDataUpdated)) this.onDataUpdated(data);
};

/**
 * Iterate through data and enable/disable sequence buttons as needed.
 * @private
 */
DataEditor_GridPreviewController.prototype.updateSequenceButtonViews = function() {

  var _this = this;
  _.forEach(this._dataStore.getDataArray(), function(item, index) {
    var dataId = item[_this._idFieldName];
    var $row = _this.getRowElementFromRowId(_this.getRowIdFromItemId(dataId));

    var isFirst = index < 1;
    var isLast = index >= (_this._dataStore.count() - 1);

    $row.find('[data-component-part="moveItem"][data-dir="prev"]')
      .attr('disabled', isFirst || _this.isReadOnly());

    $row.find('[data-component-part="moveItem"][data-dir="next"]')
      .attr('disabled', isLast || _this.isReadOnly());
  });
};

exports = module.exports = DataEditor_GridPreviewController;
