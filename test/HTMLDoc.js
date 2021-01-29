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

var assert = require('assert');
var jsHarmonyCMS = require('../jsHarmonyCMS.js');
var async = require('async');
var _ = require('lodash');

var jsh = new jsHarmonyCMS.Application();
var jshcms = jsh.Modules['jsHarmonyCMS'];
var funcs = jshcms.funcs;

describe('HTMLDoc Attributes', function() {
  it('Append New Attributes', function(done) {
    var htdoc = new funcs.HTMLDoc('<html><body first="abc"></body></html>');
    htdoc.applyNodes([
      { //Apply properties
        pred: function(node){ return htdoc.isTag(node, 'body'); },
        exec: function(node){
          htdoc.removeAttr(node, 'first');
          htdoc.appendAttr(node, 'second', 'def', ' ');
          htdoc.appendAttr(node, 'second', 'ghi', ' ');
          htdoc.appendAttr(node, 'third', '123', ' ');
          htdoc.appendAttr(node, 'third', '456', ' ');
        }
      },
    ]);
    assert.equal(htdoc.content,'<html><body third="123 456" second="def ghi" ></body></html>');
    done();
  });
  it('Append New Attributes to Single Tag', function(done) {
    var htdoc = new funcs.HTMLDoc('<html><body/></html>');
    htdoc.applyNodes([
      { //Apply properties
        pred: function(node){ return htdoc.isTag(node, 'body'); },
        exec: function(node){
          htdoc.appendAttr(node, 'second', 'def', ' ');
          htdoc.appendAttr(node, 'second', 'ghi', ' ');
          htdoc.appendAttr(node, 'third', '123', ' ');
          htdoc.appendAttr(node, 'third', '456', ' ');
        }
      },
    ]);
    assert.equal(htdoc.content,'<html><body third="123 456" second="def ghi"/></html>');
    done();
  });
  it('Update Existing Attributes and New', function(done) {
    var htdoc = new funcs.HTMLDoc('<html><body first="abc" fourth="iii"></body></html>');
    htdoc.applyNodes([
      { //Apply properties
        pred: function(node){ return htdoc.isTag(node, 'body'); },
        exec: function(node){
          htdoc.appendAttr(node, 'first', 'zzz', ' ');
          htdoc.appendAttr(node, 'first', 'yyy', ' ');
          htdoc.appendAttr(node, 'second', 'def', ' ');
          htdoc.appendAttr(node, 'second', 'ghi', ' ');
          htdoc.appendAttr(node, 'third', '123', ' ');
          htdoc.appendAttr(node, 'third', '456', ' ');
          htdoc.appendAttr(node, 'fourth', 'jjj', ' ');
          htdoc.appendAttr(node, 'fourth', 'lll', ' ');
        }
      },
    ]);
    assert.equal(htdoc.content,'<html><body third="123 456" second="def ghi" first="abc zzz yyy" fourth="iii jjj lll"></body></html>');
    done();
  });
  it('Remove Attribute then Add', function(done) {
    var htdoc = new funcs.HTMLDoc('<html><body first="abc"></body></html>');
    htdoc.applyNodes([
      { //Apply properties
        pred: function(node){ return htdoc.isTag(node, 'body'); },
        exec: function(node){
          htdoc.removeAttr(node, 'first');
          htdoc.appendAttr(node, 'first', 'def', ' ');
          htdoc.appendAttr(node, 'first', 'ghi', ' ');
          htdoc.appendAttr(node, 'third', '123', ' ');
          htdoc.appendAttr(node, 'third', '456', ' ');
        }
      },
    ]);
    assert.equal(htdoc.content,'<html><body third="123 456" first="def ghi" ></body></html>');
    done();
  });
  it('Append and Add Attributes', function(done) {
    var htdoc = new funcs.HTMLDoc('<html><body first="abc" second="aaa"></body></html>');
    htdoc.applyNodes([
      { //Apply properties
        pred: function(node){ return htdoc.isTag(node, 'body'); },
        exec: function(node){
          htdoc.removeAttr(node, 'second');
          htdoc.appendAttr(node, 'first', 'def', ' ');
          htdoc.appendAttr(node, 'first', 'ghi', ' ');
          htdoc.appendAttr(node, 'third', '123', ' ');
          htdoc.appendAttr(node, 'third', '456', ' ');
        }
      },
    ]);
    assert.equal(htdoc.content,'<html><body third="123 456" first="abc def ghi" ></body></html>');
    done();
  });
});

describe('HTMLDoc Tags', function() {

  it('All', function(done) {
    var htdoc = new funcs.HTMLDoc('<!DOCTYPE html><html><head></head><body first="abc"></body></html>');
    var htparts = htdoc.getParts();
    assert(htparts.doctype);
    assert(htparts.html);
    assert(htparts.head);
    assert(htparts.body);
    done();
  });
  it('No Doctype', function(done) {
    var htdoc = new funcs.HTMLDoc('<html><head></head><body first="abc"></body></html>');
    var htparts = htdoc.getParts();
    assert(!htparts.doctype);
    assert(htparts.html);
    assert(htparts.head);
    assert(htparts.body);
    done();
  });
  it('No head', function(done) {
    var htdoc = new funcs.HTMLDoc('<html><body first="abc"></body></html>');
    var htparts = htdoc.getParts();
    assert(!htparts.doctype);
    assert(htparts.html);
    assert(!htparts.head);
    assert(htparts.body);
    done();
  });
  it('No Body', function(done) {
    var htdoc = new funcs.HTMLDoc('<html>Test Content</html>');
    var htparts = htdoc.getParts();
    assert(!htparts.doctype);
    assert(htparts.html);
    assert(!htparts.head);
    assert(!htparts.body);
    done();
  });
  it('No HTML', function(done) {
    var htdoc = new funcs.HTMLDoc('Test Content');
    var htparts = htdoc.getParts();
    assert(!htparts.doctype);
    assert(!htparts.html);
    assert(!htparts.head);
    assert(!htparts.body);
    done();
  });
  it('Only doctype', function(done) {
    var htdoc = new funcs.HTMLDoc('<!DOCTYPE html>Test Content');
    var htparts = htdoc.getParts();
    assert(htparts.doctype);
    assert(!htparts.html);
    assert(!htparts.head);
    assert(!htparts.body);
    done();
  });
});

describe('Page Editor Template Generation', function() {

  it('Full Page', function(done) {
    var rslt = funcs.generateEditorTemplate([
      'Test',
    ].join(''));
    assert.equal(rslt, [
      '<!DOCTYPE HTML><html>',
      '<head>',
      '</head>',
      '<body>',
      '<script type="text/javascript" src="/js/jsHarmonyCMS.js"></script>',
      'Test',
      '</body>',
      '</html>',
    ].join(''));
    done();
  });

  it('No duplicate script', function(done) {
    var rslt = funcs.generateEditorTemplate([
      'Test',
      '<script type="text/javascript" src="/js/jsHarmonyCMS.js"></script>',
    ].join(''));
    assert.equal(rslt, [
      '<!DOCTYPE HTML><html>',
      '<head>',
      '</head>',
      '<body>',
      'Test',
      '<script type="text/javascript" src="/js/jsHarmonyCMS.js"></script>',
      '</body>',
      '</html>',
    ].join(''));
    done();
  });

  it('Doctype', function(done) {
    var rslt = funcs.generateEditorTemplate([
      '<html>',
      '<head>',
      '</head>',
      '<body>',
      'Test',
      '</body>',
      '</html>',
    ].join(''));
    assert.equal(rslt, [
      '<!DOCTYPE HTML><html>',
      '<head>',
      '</head>',
      '<body>',
      '<script type="text/javascript" src="/js/jsHarmonyCMS.js"></script>',
      'Test',
      '</body>',
      '</html>',
    ].join(''));
    done();
  });

  it('Page Parsing Error', function(done) {
    var rslt = funcs.generateEditorTemplate([
      '<html>',
      '<head>',
      '</head>',
      '<body>',
      'Test<%=abcdef%>Test2<div id="<%=defghji+"abc"%>"></div>',
      '</body>',
      '</html>',
    ].join(''));
    assert.equal(rslt, [
      '<!DOCTYPE HTML><html>',
      '<head>',
      '</head>',
      '<body>',
      '<script type="text/javascript" src="/js/jsHarmonyCMS.js"></script>',
      'Test<%=abcdef%>Test2<div id="<%=defghji+"abc"%>"></div>',
      '</body>',
      '</html>',
    ].join(''));
    done();
  });
});

describe('Page Deployment Template Generation', function() {
  it('Header Tags Replaced', function(done) {
    var rslt = funcs.generateDeploymentTemplate([
      '<html>',
      '<head>',
      '<title>ABC</title>',
      '<meta name="keywords" content="The Meta Keywords" />',
      '<meta name="description" content="The Meta Description" />',
      '<link rel="canonical" href="http://zzzzz" />',
      '</head>',
      '<body>',
      '</body>',
      '</html>',
    ].join(''));
    assert.equal(rslt, [
      '<html>',
      '<head>',
      '<% if(page.seo.title){ %><title><%=page.seo.title%></title><% } %>',
      '<% if(page.seo.keywords){ %><meta content="<%=page.seo.keywords%>" name="keywords"  /><% } %>',
      '<% if(page.seo.metadesc){ %><meta content="<%=page.seo.metadesc%>" name="description"  /><% } %>',
      '<% if(page.seo.canonical_url){ %><link href="<%=page.seo.canonical_url%>" rel="canonical"  /><% } %>',
      '<% if(page.css){ %><style type="text/css"><%-page.css%></style><% } %>',
      '<% if(page.js){ %><script type="test/javascript"><%-page.js%></script><% } %>',
      '<%-page.header%>',
      '</head>',
      '<body>',
      '<%-page.footer%>',
      '</body>',
      '</html>',
    ].join(''));
    done();
  });
  it('Header Tags Added if HEAD Tag Exists', function(done) {
    var rslt = funcs.generateDeploymentTemplate([
      '<html>',
      '<head>',
      '</head>',
      '<body>',
      '</body>',
      '</html>',
    ].join(''));
    assert.equal(rslt, [
      '<html>',
      '<head>',
      '<% if(page.seo.title){ %><title><%=page.seo.title%></title><% } %>',
      '<% if(page.seo.keywords){ %><meta name="keywords" content="<%=page.seo.keywords%>" /><% } %>',
      '<% if(page.seo.metadesc){ %><meta name="description" content="<%=page.seo.metadesc%>" /><% } %>',
      '<% if(page.seo.canonical_url){ %><link rel="canonical" href="<%=page.seo.canonical_url%>" /><% } %>',
      '<% if(page.css){ %><style type="text/css"><%-page.css%></style><% } %>',
      '<% if(page.js){ %><script type="test/javascript"><%-page.js%></script><% } %>',
      '<%-page.header%>',
      '</head>',
      '<body>',
      '<%-page.footer%>',
      '</body>',
      '</html>',
    ].join(''));
    done();
  });
  it('Header Tags Added if HTML Tag Exists', function(done) {
    var rslt = funcs.generateDeploymentTemplate([
      '<html>',
      '</html>',
    ].join(''));
    assert.equal(rslt, [
      '<html>',
      '<% if(page.seo.title){ %><title><%=page.seo.title%></title><% } %>',
      '<% if(page.seo.keywords){ %><meta name="keywords" content="<%=page.seo.keywords%>" /><% } %>',
      '<% if(page.seo.metadesc){ %><meta name="description" content="<%=page.seo.metadesc%>" /><% } %>',
      '<% if(page.seo.canonical_url){ %><link rel="canonical" href="<%=page.seo.canonical_url%>" /><% } %>',
      '<% if(page.css){ %><style type="text/css"><%-page.css%></style><% } %>',
      '<% if(page.js){ %><script type="test/javascript"><%-page.js%></script><% } %>',
      '<%-page.header%>',
      '<%-page.footer%>',
      '</html>',
    ].join(''));
    done();
  });
  it('Header Tags Added if BODY Tag Exists', function(done) {
    var rslt = funcs.generateDeploymentTemplate([
      '<!DOCTYPE html>',
      '<html>',
      '<body>',
      '</body>',
      '</html>',
    ].join(''));
    assert.equal(rslt, [
      '<!DOCTYPE html>',
      '<html>',
      '<% if(page.seo.title){ %><title><%=page.seo.title%></title><% } %>',
      '<% if(page.seo.keywords){ %><meta name="keywords" content="<%=page.seo.keywords%>" /><% } %>',
      '<% if(page.seo.metadesc){ %><meta name="description" content="<%=page.seo.metadesc%>" /><% } %>',
      '<% if(page.seo.canonical_url){ %><link rel="canonical" href="<%=page.seo.canonical_url%>" /><% } %>',
      '<% if(page.css){ %><style type="text/css"><%-page.css%></style><% } %>',
      '<% if(page.js){ %><script type="test/javascript"><%-page.js%></script><% } %>',
      '<%-page.header%>',
      '<body>',
      '<%-page.footer%>',
      '</body>',
      '</html>',
    ].join(''));
    done();
  });
  it('Header Tags Added if DOCTYPE Tag Exists', function(done) {
    var rslt = funcs.generateDeploymentTemplate([
      '<!DOCTYPE html>',
      'Test Content',
    ].join(''));
    assert.equal(rslt, [
      '<!DOCTYPE html>',
      '<% if(page.seo.title){ %><title><%=page.seo.title%></title><% } %>',
      '<% if(page.seo.keywords){ %><meta name="keywords" content="<%=page.seo.keywords%>" /><% } %>',
      '<% if(page.seo.metadesc){ %><meta name="description" content="<%=page.seo.metadesc%>" /><% } %>',
      '<% if(page.seo.canonical_url){ %><link rel="canonical" href="<%=page.seo.canonical_url%>" /><% } %>',
      '<% if(page.css){ %><style type="text/css"><%-page.css%></style><% } %>',
      '<% if(page.js){ %><script type="test/javascript"><%-page.js%></script><% } %>',
      '<%-page.header%>',
      'Test Content',
      '<%-page.footer%>',
    ].join(''));
    done();
  });
  it('Header Tags Added if DOCTYPE and BODY Tags Exists', function(done) {
    var rslt = funcs.generateDeploymentTemplate([
      '<!DOCTYPE html>',
      '<body>',
      '</body>',
    ].join(''));
    assert.equal(rslt, [
      '<!DOCTYPE html>',
      '<% if(page.seo.title){ %><title><%=page.seo.title%></title><% } %>',
      '<% if(page.seo.keywords){ %><meta name="keywords" content="<%=page.seo.keywords%>" /><% } %>',
      '<% if(page.seo.metadesc){ %><meta name="description" content="<%=page.seo.metadesc%>" /><% } %>',
      '<% if(page.seo.canonical_url){ %><link rel="canonical" href="<%=page.seo.canonical_url%>" /><% } %>',
      '<% if(page.css){ %><style type="text/css"><%-page.css%></style><% } %>',
      '<% if(page.js){ %><script type="test/javascript"><%-page.js%></script><% } %>',
      '<%-page.header%>',
      '<body>',
      '<%-page.footer%>',
      '</body>',
    ].join(''));
    done();
  });
  it('Header Tags Added if no tags exist', function(done) {
    var rslt = funcs.generateDeploymentTemplate([
      'Test Content',
    ].join(''));
    assert.equal(rslt, [
      '<% if(page.seo.title){ %><title><%=page.seo.title%></title><% } %>',
      '<% if(page.seo.keywords){ %><meta name="keywords" content="<%=page.seo.keywords%>" /><% } %>',
      '<% if(page.seo.metadesc){ %><meta name="description" content="<%=page.seo.metadesc%>" /><% } %>',
      '<% if(page.seo.canonical_url){ %><link rel="canonical" href="<%=page.seo.canonical_url%>" /><% } %>',
      '<% if(page.css){ %><style type="text/css"><%-page.css%></style><% } %>',
      '<% if(page.js){ %><script type="test/javascript"><%-page.js%></script><% } %>',
      '<%-page.header%>',
      'Test Content',
      '<%-page.footer%>',
    ].join(''));
    done();
  });
});

describe('EJS Extract / Restore', function() {
  it('Simple EJS', function(done) {
    var htdoc = new funcs.HTMLDoc([
      '<div class="<%=test%>">',
      'Test Content',
      '</div>',
    ].join(''), { extractEJS: true });
    htdoc.applyNodes([
      { //Apply properties
        pred: function(node){ return htdoc.isTag(node, 'div'); },
        exec: function(node){
          htdoc.appendAttr(node, 'class', 'moreClass', ' ');
        }
      },
    ]);
    htdoc.restoreEJS();
    assert.equal(htdoc.content, [
      '<div class="<%=test%> moreClass">',
      'Test Content',
      '</div>',
    ].join(''));
    done();
  });
  it('More EJS', function(done) {
    var htdoc = new funcs.HTMLDoc([
      '<div class="<%=test%>">',
      'Test Content <%=value%>',
      '</div>',
    ].join(''), { extractEJS: true });
    htdoc.applyNodes([
      { //Apply properties
        pred: function(node){ return htdoc.isTag(node, 'div'); },
        exec: function(node){
          htdoc.appendAttr(node, 'class', 'moreClass', ' ');
          htdoc.appendAttr(node, 'style', 'basicStyle', ';');
          htdoc.appendAttr(node, 'style', 'moreStyle', ';');
        }
      },
    ]);
    htdoc.restoreEJS();
    assert.equal(htdoc.content, [
      '<div style="basicStyle;moreStyle" class="<%=test%> moreClass">',
      'Test Content <%=value%>',
      '</div>',
    ].join(''));
    done();
  });
  it('EJS with Removed Attribute', function(done) {
    var htdoc = new funcs.HTMLDoc([
      '<div class="<%=test%>" style="<%=initialStyle%>">',
      'Test Content <%=value%>',
      '</div>',
    ].join(''), { extractEJS: true });
    htdoc.applyNodes([
      { //Apply properties
        pred: function(node){ return htdoc.isTag(node, 'div'); },
        exec: function(node){
          htdoc.removeAttr(node, 'style');
          htdoc.appendAttr(node, 'class', 'moreClass', ' ');
          htdoc.appendAttr(node, 'style', 'basicStyle', ';');
          htdoc.appendAttr(node, 'style', 'moreStyle', ';');
        }
      },
    ]);
    htdoc.restoreEJS();
    assert.equal(htdoc.content, [
      '<div style="basicStyle;moreStyle" class="<%=test%> moreClass" >',
      'Test Content <%=value%>',
      '</div>',
    ].join(''));
    done();
  });
  it('Header Tag with EJS', function(done) {
    var htdoc = new funcs.HTMLDoc([
      '<%=before%><header><%=header_var%></header><%=after%>',
      '<%=before2%><div class="<%=test%>" style="<%=initialStyle%>">',
      'Test Content <%=value%>',
      '</div><%=after2%>',
    ].join(''), { extractEJS: true });
    htdoc.applyNodes([
      { //Remove header
        pred: function(node){ return htdoc.isTag(node, 'header'); },
        exec: function(node){
          htdoc.removeNode(node);
        }
      },
      { //Apply properties
        pred: function(node){ return htdoc.isTag(node, 'div'); },
        exec: function(node){
          htdoc.removeAttr(node, 'style');
          htdoc.appendAttr(node, 'class', 'moreClass', ' ');
          htdoc.appendAttr(node, 'style', 'basicStyle', ';');
          htdoc.appendAttr(node, 'style', 'moreStyle', ';');
          htdoc.wrapNode(node, '<%=wrapPre%>', '<%=wrapPost%>');
        }
      },
    ]);
    htdoc.restoreEJS();
    assert.equal(htdoc.content, [
      '<%=before%><%=after%><%=before2%><%=wrapPre%><div style="basicStyle;moreStyle" class="<%=test%> moreClass" >',
      'Test Content <%=value%>',
      '</div><%=wrapPost%><%=after2%>',
    ].join(''));
    done();
  });
});

describe('Component Template Generation', function() {
  it('Error on duplicate tag', function(done) {
    assert.throws(function(){
      var rslt = funcs.generateComponentTemplate(null, [
        '<div class="inner flex flex-3" component-group-every="3" component-group-every="3">',
        '</div>',
      ].join(''));
    }, /Duplicate attribute at/);
    done();
  });
  it('Header Tags Replaced', function(done) {
    var componentConfig = { data: { fields: [ { name: 'title' } ] } };
    var rslt = funcs.generateComponentTemplate(componentConfig, [
      '<script type="text/jsharmony-cms-component-config">',
      '{ "title": "Local Tiles <%=sampleEjs%>" }',
      '</script>',
      '<section class="tiles wrapper <%=component.cssClass%>" style="<%=component.cssStyle%>" component-editor-add-class="preview">',
      '  <div class="inner flex flex-3" component-group-every="3" component-editor-remove-class="flex-3">',
      '    <div class="flex-item box <%=item.cssClass%>" component-item>',
      '      <div class="image fit">',
      '        <img src="<%=item.image%>" alt="<%=item.title%>" />',
      '      </div>',
      '      <div class="content">',
      '        <h3 cms-editor-for="item.title" cms-editor-type="simple">Head</h3>',
      '        <p cms-editor-for="item.body" cms-editor-on-p></p>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</section>',
    ].join(''));
    assert.equal(rslt, [
      '<% var component_group_offset = 0; %>',
      '<section class="tiles wrapper <%=component.cssClass%> <%=(isInComponentEditor?"preview":"")%>" style="<%=component.cssStyle%>" >',
      '  <% for(var component_group_index=0;component_group_index<Math.ceil(items.length/3);component_group_index++){ var component_group_parent_offset = component_group_offset; var component_subgroup_offset = component_group_index*3; var component_subgroup = items.slice(component_group_index*3,(component_group_index+1)*3); (function(){ var component_group_offset = component_group_parent_offset + component_subgroup_offset; var items = component_subgroup; %><div class="inner flex  <%=(!isInComponentEditor?"flex-3":"")%>"  >',
      '    <% for(var component_item_index=0;component_item_index<items.length;component_item_index++){ var item = items[component_item_index]; if(data_errors[component_group_offset+component_item_index]){ %><%-renderPlaceholder({ errors: data_errors[component_group_offset+component_item_index] })%><% } else { %><div class="flex-item box <%=item.cssClass%>" >',
      '      <div class="image fit">',
      '        <img src="<%=item.image%>" alt="<%=item.title%>" />',
      '      </div>',
      '      <div class="content">',
      '        <h3 <% if(renderType=="gridItemPreview"){ %>data-component-title-editor="title"<% } %>  ><%-item.title%></h3>',
      '        <p <% if(renderType=="gridItemPreview"){ %>data-component-full-editor="body"<% } %>  ><%-item.body%></p>',
      '      </div>',
      '    </div><% } } %>',
      '  </div><% })(); } %>',
      '</section>',
    ].join(''));
    assert(componentConfig.data.fields[0].default == 'Head');
    done();
  });
});