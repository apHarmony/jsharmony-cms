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

var componentPrefix = '<% locals.renderTemplate = locals.renderTemplate.bind(null, locals); function getEJSOutput(f){ var pos = __output.length; f(); return __output.substr(pos); } %>';

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
    htdoc.trimRemoved();
    assert.equal(htdoc.content,'<html><body third="123 456" second="def ghi"></body></html>');
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
    htdoc.trimRemoved();
    assert.equal(htdoc.content,'<html><body third="123 456" first="def ghi"></body></html>');
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
    htdoc.trimRemoved();
    assert.equal(htdoc.content,'<html><body third="123 456" first="abc def ghi"></body></html>');
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
      '<script type="text/javascript" class="removeOnPublish" src="/js/jsHarmonyCMS.js"></script>',
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
      '<script type="text/javascript" class="removeOnPublish" src="/js/jsHarmonyCMS.js"></script>',
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
      '<script type="text/javascript" class="removeOnPublish" src="/js/jsHarmonyCMS.js"></script>',
      'Test<%=abcdef%>Test2<div id="<%=defghji+"abc"%>"></div>',
      '</body>',
      '</html>',
    ].join(''));
    done();
  });

  it('Template Variables', function(done) {
    var rslt = funcs.generateEditorTemplate([
      'Test %%%URL%%% Test',
    ].join(''), { template_variables: { "URL": "http://test" } });
    assert.equal(rslt, [
      '<!DOCTYPE HTML><html>',
      '<head>',
      '</head>',
      '<body>',
      '<script type="text/javascript" class="removeOnPublish" src="/js/jsHarmonyCMS.js"></script>',
      'Test http://test Test',
      '</body>',
      '</html>',
    ].join(''));
    done();
  });
});

describe('Page Deployment Template Generation', function() {
  it('Header Tags Replaced', function(done) {
    var rslt = funcs.generateDeploymentTemplate(null, [
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
      '<% if(page.seo.keywords){ %><meta content="<%=page.seo.keywords%>" name="keywords" /><% } %>',
      '<% if(page.seo.metadesc){ %><meta content="<%=page.seo.metadesc%>" name="description" /><% } %>',
      '<% if(page.seo.canonical_url){ %><link href="<%=page.seo.canonical_url%>" rel="canonical" /><% } %>',
      '<% if(page.css){ %><style type="text/css"><%-page.css%></style><% } %>',
      '<% if(page.js){ %><script type="text/javascript"><%-page.js%></script><% } %>',
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
    var rslt = funcs.generateDeploymentTemplate(null, [
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
      '<% if(page.js){ %><script type="text/javascript"><%-page.js%></script><% } %>',
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
    var rslt = funcs.generateDeploymentTemplate(null, [
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
      '<% if(page.js){ %><script type="text/javascript"><%-page.js%></script><% } %>',
      '<%-page.header%>',
      '<%-page.footer%>',
      '</html>',
    ].join(''));
    done();
  });
  it('Header Tags Added if BODY Tag Exists', function(done) {
    var rslt = funcs.generateDeploymentTemplate(null, [
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
      '<% if(page.js){ %><script type="text/javascript"><%-page.js%></script><% } %>',
      '<%-page.header%>',
      '<body>',
      '<%-page.footer%>',
      '</body>',
      '</html>',
    ].join(''));
    done();
  });
  it('Header Tags Added if DOCTYPE Tag Exists', function(done) {
    var rslt = funcs.generateDeploymentTemplate(null, [
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
      '<% if(page.js){ %><script type="text/javascript"><%-page.js%></script><% } %>',
      '<%-page.header%>',
      'Test Content',
      '<%-page.footer%>',
    ].join(''));
    done();
  });
  it('Header Tags Added if DOCTYPE and BODY Tags Exists', function(done) {
    var rslt = funcs.generateDeploymentTemplate(null, [
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
      '<% if(page.js){ %><script type="text/javascript"><%-page.js%></script><% } %>',
      '<%-page.header%>',
      '<body>',
      '<%-page.footer%>',
      '</body>',
    ].join(''));
    done();
  });
  it('Header Tags Added if no tags exist', function(done) {
    var rslt = funcs.generateDeploymentTemplate(null, [
      'Test Content',
    ].join(''));
    assert.equal(rslt, [
      '<% if(page.seo.title){ %><title><%=page.seo.title%></title><% } %>',
      '<% if(page.seo.keywords){ %><meta name="keywords" content="<%=page.seo.keywords%>" /><% } %>',
      '<% if(page.seo.metadesc){ %><meta name="description" content="<%=page.seo.metadesc%>" /><% } %>',
      '<% if(page.seo.canonical_url){ %><link rel="canonical" href="<%=page.seo.canonical_url%>" /><% } %>',
      '<% if(page.css){ %><style type="text/css"><%-page.css%></style><% } %>',
      '<% if(page.js){ %><script type="text/javascript"><%-page.js%></script><% } %>',
      '<%-page.header%>',
      'Test Content',
      '<%-page.footer%>',
    ].join(''));
    done();
  });
  it('Component Tag', function(done) {
    var rslt = funcs.generateDeploymentTemplate(null, [
      '<div cms-component="menus/main.top" cms-menu-tag="main"></div>',
      'Test Content',
      '<div cms-component="sidebar"></div>',
      '<div cms-component="tiles" cms-component-properties=\'{"cssClass":"testClass"}\' cms-component-data=\'[{"image":"test"}]\'></div>',
    ].join(''));
    assert.equal(rslt, [
      '<% if(page.seo.title){ %><title><%=page.seo.title%></title><% } %>',
      '<% if(page.seo.keywords){ %><meta name="keywords" content="<%=page.seo.keywords%>" /><% } %>',
      '<% if(page.seo.metadesc){ %><meta name="description" content="<%=page.seo.metadesc%>" /><% } %>',
      '<% if(page.seo.canonical_url){ %><link rel="canonical" href="<%=page.seo.canonical_url%>" /><% } %>',
      '<% if(page.css){ %><style type="text/css"><%-page.css%></style><% } %>',
      '<% if(page.js){ %><script type="text/javascript"><%-page.js%></script><% } %>',
      '<%-page.header%>',
      '<div><%-renderComponent("menus/main.top", {"menu_tag":"main"})%></div>',
      'Test Content',
      '<div><%-renderComponent("sidebar")%></div>',
      '<div><%-renderComponent("tiles", {"properties":{"cssClass":"testClass"},"data":[{"image":"test"}]})%></div>',
      '<%-page.footer%>',
    ].join(''));
    done();
  });
  it('Inline Component Template', function(done) {
    var template = {};
    var rslt = funcs.generateDeploymentTemplate(template, [
      '<script type="text/cms-component-template">',
      '<cms-component-config>{ "id": "menus/top", "target": "page", }</cms-component-config>',
      '<ul class="links">',
      '<li jsh-foreach-item="menu.topItems"><a href="<%~item.href%>" onclick="<%~item.onclick%>" target="<%~item.target%>"><%-item.html%></a></li>',
      '</ul>',
      '</script>',
      '<div cms-component="menus/main.top" cms-menu-tag="main"></div>',
      'Test Content',
      '<div cms-component="sidebar"></div>',
      '<div cms-component="tiles" cms-component-properties=\'{"cssClass":"testClass"}\' cms-component-data=\'[{"image":"test"}]\'></div>',
    ].join(''));
    assert.equal(rslt, [
      '<% if(page.seo.title){ %><title><%=page.seo.title%></title><% } %>',
      '<% if(page.seo.keywords){ %><meta name="keywords" content="<%=page.seo.keywords%>" /><% } %>',
      '<% if(page.seo.metadesc){ %><meta name="description" content="<%=page.seo.metadesc%>" /><% } %>',
      '<% if(page.seo.canonical_url){ %><link rel="canonical" href="<%=page.seo.canonical_url%>" /><% } %>',
      '<% if(page.css){ %><style type="text/css"><%-page.css%></style><% } %>',
      '<% if(page.js){ %><script type="text/javascript"><%-page.js%></script><% } %>',
      '<%-page.header%>',
      '<div><%-renderComponent("menus/main.top", {"menu_tag":"main"})%></div>',
      'Test Content',
      '<div><%-renderComponent("sidebar")%></div>',
      '<div><%-renderComponent("tiles", {"properties":{"cssClass":"testClass"},"data":[{"image":"test"}]})%></div>',
      '<%-page.footer%>',
    ].join(''));
    assert(template.components['menus/top'].title == 'menus/top');
    done();
  });
  it('Inline Component Template Inside Content Area', function(done) {
    var template = {};
    var rslt = funcs.generateDeploymentTemplate(template, [
      '<div cms-content-editor="page.content.body">',
      '<script type="text/cms-component-template">',
      '<cms-component-config>{ "id": "menus/top", "target": "page", }</cms-component-config>',
      '<ul class="links">',
      '<li jsh-foreach-item="menu.topItems"><a href="<%~item.href%>" onclick="<%~item.onclick%>" target="<%~item.target%>"><%-item.html%></a></li>',
      '</ul>',
      '</script>',
      '<div cms-component="menus/main.top" cms-menu-tag="main"></div>',
      'Test Content',
      '<div cms-component="sidebar"></div>',
      '<div cms-component="tiles" cms-component-properties=\'{"cssClass":"testClass"}\' cms-component-data=\'[{"image":"test"}]\'></div>',
      '</div>',
    ].join(''));
    assert.equal(rslt, [
      '<% if(page.seo.title){ %><title><%=page.seo.title%></title><% } %>',
      '<% if(page.seo.keywords){ %><meta name="keywords" content="<%=page.seo.keywords%>" /><% } %>',
      '<% if(page.seo.metadesc){ %><meta name="description" content="<%=page.seo.metadesc%>" /><% } %>',
      '<% if(page.seo.canonical_url){ %><link rel="canonical" href="<%=page.seo.canonical_url%>" /><% } %>',
      '<% if(page.css){ %><style type="text/css"><%-page.css%></style><% } %>',
      '<% if(page.js){ %><script type="text/javascript"><%-page.js%></script><% } %>',
      '<%-page.header%>',
      '<div><%-page.content["body"]%></div>',
      '<%-page.footer%>',
    ].join(''));
    assert(template.components['menus/top'].title == 'menus/top');
    done();
  });
  it('Template Variables', function(done) {
    var rslt = funcs.generateDeploymentTemplate(null, [
      '<html>',
      '<head>',
      '</head>',
      '<body>',
      'Test %%%URL%%% Test',
      '</body>',
      '</html>',
    ].join(''), { template_variables: { "URL": "http://test" } });
    assert.equal(rslt, [
      '<html>',
      '<head>',
      '<% if(page.seo.title){ %><title><%=page.seo.title%></title><% } %>',
      '<% if(page.seo.keywords){ %><meta name="keywords" content="<%=page.seo.keywords%>" /><% } %>',
      '<% if(page.seo.metadesc){ %><meta name="description" content="<%=page.seo.metadesc%>" /><% } %>',
      '<% if(page.seo.canonical_url){ %><link rel="canonical" href="<%=page.seo.canonical_url%>" /><% } %>',
      '<% if(page.css){ %><style type="text/css"><%-page.css%></style><% } %>',
      '<% if(page.js){ %><script type="text/javascript"><%-page.js%></script><% } %>',
      '<%-page.header%>',
      '</head>',
      '<body>',
      'Test http://test Test',
      '<%-page.footer%>',
      '</body>',
      '</html>',
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
  it('Extract EJS parseOnly', function(done) {
    var htdoc = new funcs.HTMLDoc([
      '<div class="<%=test%>">',
      'Test Content <%=value%>',
      '</div>',
    ].join(''), { extractEJS: 'parseOnly' });
    var nodeContent = '';
    htdoc.applyNodes([
      { //Apply properties
        pred: function(node){ return htdoc.isTag(node, 'div'); },
        exec: function(node){
          nodeContent = htdoc.getNodeContent(node);
        }
      },
    ]);
    assert.equal(nodeContent, [
      'Test Content <%=value%>',
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
    htdoc.trimRemoved();
    assert.equal(htdoc.content, [
      '<div style="basicStyle;moreStyle" class="<%=test%> moreClass">',
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
    htdoc.trimRemoved();
    assert.equal(htdoc.content, [
      '<%=before%><%=after%><%=before2%><%=wrapPre%><div style="basicStyle;moreStyle" class="<%=test%> moreClass">',
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
        '<div class="inner flex flex-3" jsh-group-items-into="3" jsh-group-items-into="3">',
        '</div>',
      ].join(''));
    }, /Duplicate attribute "jsh-group-items-into"/);
    done();
  });

  it('Basic Component Generated', function(done) {
    var componentConfig = { data: { fields: [ { name: 'title' } ] } };
    var rslt = funcs.generateComponentTemplate(componentConfig, [
      '<script type="text/cms-component-config">',
      '{ "title": "Local Tiles <%=sampleEjs%>" }',
      '</script>',
      '<section class="tiles wrapper <%=component.cssClass%>" style="<%=component.cssStyle%>" cms-component-editor-add-class="preview">',
      '  <div class="inner flex flex-3" jsh-group-items-into="3" cms-component-editor-remove-class="flex-3">',
      '    <div jsh-foreach-item class="flex-item box <%=item.cssClass%>">',
      '      <div class="image fit">',
      '        <img src="<%=item.image%>" alt="<%=item.title%>" />',
      '      </div>',
      '      <div class="content">',
      '        <h3 cms-content-editor="item.title" cms-content-editor-type="simple">Head</h3>',
      '        <p cms-content-editor="item.body" cms-editor-on-p></p>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</section>',
    ].join(''));
    assert.equal(rslt, [
      componentPrefix,
      '<section class="tiles wrapper <%=component.cssClass%> <%=(isInComponentEditor?"preview":"")%>" style="<%=component.cssStyle%>">',
      '  <% (function(){ let jsh_groups = (function(groupFunc, items){let rslt = {};for(let i=0;i<items.length;i++){let key = groupFunc(items[i], i);if(!(key in rslt)) rslt[key] = [];rslt[key].push(items[i]);}return rslt;})(function(item, jsh_group_item_index){return (Math.floor(jsh_group_item_index/3)+1);}, items); let jsh_subgroup_first = true; for(let jsh_group_index in jsh_groups){ let items=jsh_groups[jsh_group_index]; if(jsh_subgroup_first){ jsh_subgroup_first = false; }else{ %><% } (function(){ %><div class="inner flex  <%=(!isInComponentEditor?"flex-3":"")%>">',
      '    <% for(let jsh_item_index=(1);jsh_item_index<=(((items)||[]).length);jsh_item_index+=(1+0)){ let item = ((items)||[])[jsh_item_index-1]; if(jsh_item_index>(1)){ %><% } if((item)&&(item).jsh_validation_errors){ %><%-renderPlaceholder({ errors: (item).jsh_validation_errors })%><% } else { %><div class="flex-item box <%=item.cssClass%>">',
      '      <div class="image fit">',
      '        <img src="<%=item.image%>" alt="<%=item.title%>" />',
      '      </div>',
      '      <div class="content">',
      '        <h3 <% if(renderType=="gridItemPreview"){ %>data-component-title-editor="title"<% } %>><%-item.title%></h3>',
      '        <p <% if(renderType=="gridItemPreview"){ %>data-component-full-editor="body"<% } %>><%-item.body%></p>',
      '      </div>',
      '    </div><% } } %>',
      '  </div><% })(); } })(); %>',
      '</section>',
    ].join(''));
    assert(componentConfig.data.fields[0].default == 'Head');
    done();
  });

  it('Component Config Tag', function(done) {
    var templateContent = [
      '<cms-component-config>',
      '{ "title": "Local Tiles" }',
      '</cms-component-config>',
      '<div jsh-foreach-item class="flex-item box <%=item.cssClass%>">',
      '<img src="<%=item.image%>" alt="<%=item.title%>" />',
      '</div>',
    ].join('');
    var templateParts = funcs.parseConfig(templateContent, 'cms-component-config', 'cms-component-config', { extractFromContent: true });
    assert.equal(templateParts.content, [
      '<div jsh-foreach-item class="flex-item box <%=item.cssClass%>">',
      '<img src="<%=item.image%>" alt="<%=item.title%>" />',
      '</div>',
    ].join(''));
    assert.deepEqual(templateParts.config, { title: 'Local Tiles' });
    var rslt = funcs.generateComponentTemplate(templateParts.config, templateContent);
    assert.equal(rslt, [
      componentPrefix,
      '<% for(let jsh_item_index=(1);jsh_item_index<=(((items)||[]).length);jsh_item_index+=(1+0)){ let item = ((items)||[])[jsh_item_index-1]; if(jsh_item_index>(1)){ %><% } if((item)&&(item).jsh_validation_errors){ %><%-renderPlaceholder({ errors: (item).jsh_validation_errors })%><% } else { %><div class="flex-item box <%=item.cssClass%>">',
      '<img src="<%=item.image%>" alt="<%=item.title%>" />',
      '</div><% } } %>',
    ].join(''));
    done();
  });

  it('containerSlurp - outside of node', function(done) {
    assert.throws(function(){
      var rslt = funcs.generateComponentTemplate(null, [
        '<ul jsh-template="menu"></ul>',
        '<%~test%>',
      ].join(''));
    }, /must be inside an HTML element/);
    done();
  });

  it('containerSlurp - extra attribute', function(done) {
    assert.throws(function(){
      var rslt = funcs.generateComponentTemplate(null, [
        '<ul jsh-template="menu" style="<%~test%> "></ul>',
      ].join(''));
    }, /must be the only text within/);
    done();
  });

  it('containerSlurp - extra content', function(done) {
    assert.throws(function(){
      var rslt = funcs.generateComponentTemplate(null, [
        '<ul jsh-template="menu"><%~test%> </ul>',
      ].join(''));
    }, /must be the only text within/);
    done();
  });

  it('containerSlurp - start tag', function(done) {
    assert.throws(function(){
      var rslt = funcs.generateComponentTemplate(null, [
        '<ul jsh-template="menu" <%~test%>></ul>',
      ].join(''));
    }, /can only be used for attribute values or HTML element content/);
    done();
  });

  it('containerSlurp - end tag', function(done) {
    assert.throws(function(){
      var rslt = funcs.generateComponentTemplate(null, [
        '<ul jsh-template="menu"></ul <%~test%>>',
      ].join(''));
    }, /can only be used for attribute values or HTML element content/);
    done();
  });

  it('containerSlurp - parent deleted', function(done) {
    var rslt = funcs.generateComponentTemplate(null, [
      '<script type="text/cms-component-config"><%~test%></script>',
    ].join(''));
    assert.equal(rslt, componentPrefix);
    done();
  });

  it('containerSlurp - attribute', function(done) {
    var rslt = funcs.generateComponentTemplate(null, [
      '<ul style="<%~test%>"></ul>',
    ].join(''));
    assert.equal(rslt, [
      componentPrefix,
      '<ul<% if(!isNullUndefinedEmpty(test)){ %> style="<%=test%>"<% } %>></ul>',
    ].join(''));
    done();
  });

  it('containerSlurp - content', function(done) {
    var rslt = funcs.generateComponentTemplate(null, [
      '<ul><%~test%></ul>',
    ].join(''));
    assert.equal(rslt, [
      componentPrefix,
      '<% if(!isNullUndefinedEmpty(test)){ %><ul><%=test%></ul><% } %>',
    ].join(''));
    done();
  });

  it('containerSlurp - <%~=', function(done) {
    var rslt = funcs.generateComponentTemplate(null, [
      '<ul><%~=test%></ul>',
    ].join(''));
    assert.equal(rslt, [
      componentPrefix,
      '<% if(!isNullUndefinedEmpty(test)){ %><ul><%= test%></ul><% } %>',
    ].join(''));
    done();
  });

  it('containerSlurp - <%~-', function(done) {
    var rslt = funcs.generateComponentTemplate(null, [
      '<ul><%~-test%></ul>',
    ].join(''));
    assert.equal(rslt, [
      componentPrefix,
      '<% if(!isNullUndefinedEmpty(test)){ %><ul><%- test%></ul><% } %>',
    ].join(''));
    done();
  });

  it('containerSlurp - <%~_', function(done) {
    var rslt = funcs.generateComponentTemplate(null, [
      '<ul><%~_test%></ul>',
    ].join(''));
    assert.equal(rslt, [
      componentPrefix,
      '<% if(!isNullUndefinedEmpty(test)){ %><ul><%_ test%></ul><% } %>',
    ].join(''));
    done();
  });

  it('containerSlurp - -%>', function(done) {
    var rslt = funcs.generateComponentTemplate(null, [
      '<ul><%~_test-%></ul>',
    ].join(''));
    assert.equal(rslt, [
      componentPrefix,
      '<% if(!isNullUndefinedEmpty(test)){ %><ul><%_ test-%></ul><% } %>',
    ].join(''));
    done();
  });

  it('containerSlurp - _%>', function(done) {
    var rslt = funcs.generateComponentTemplate(null, [
      '<ul><%~test_%></ul>',
    ].join(''));
    assert.equal(rslt, [
      componentPrefix,
      '<% if(!isNullUndefinedEmpty(test)){ %><ul><%=test_%></ul><% } %>',
    ].join(''));
    done();
  });

  it('Foreach / Templates', function(done) {
    var rslt = funcs.generateComponentTemplate(null, [
      '<ul jsh-template="menu">',
      '  <li jsh-foreach-item class="<%~item.class%>" style="<%~item.style%>">',
      '    <a href="<%~item.href%>" onclick="<%~item.onclick%>" target="<%~item.target%>"><%~-item.html%></a>',
      '    <%-renderTemplate("menu", item.children)%>',
      '  </li>',
      '</ul>',
      '<%-renderTemplate("menu", menu.tree)%>',
    ].join(''));
    assert.equal(rslt, [
      componentPrefix,
      '<% (locals.jsh_render_templates=locals.jsh_render_templates||{})["menu"] = function(items){ %>',
      '<ul>',
      '  <% for(let jsh_item_index=(1);jsh_item_index<=(((items)||[]).length);jsh_item_index+=(1+0)){ let item = ((items)||[])[jsh_item_index-1]; if(jsh_item_index>(1)){ %><% } if((item)&&(item).jsh_validation_errors){ %><%-renderPlaceholder({ errors: (item).jsh_validation_errors })%><% } else { %>',
      '<li<% if(!isNullUndefinedEmpty(item.class)){ %> class="<%=item.class%>"<% } %><% if(!isNullUndefinedEmpty(item.style)){ %> style="<%=item.style%>"<% } %>>',
      '    <% if(!isNullUndefinedEmpty(item.html)){ %><a<% if(!isNullUndefinedEmpty(item.href)){ %> href="<%=item.href%>"<% } %><% if(!isNullUndefinedEmpty(item.onclick)){ %> onclick="<%=item.onclick%>"<% } %><% if(!isNullUndefinedEmpty(item.target)){ %> target="<%=item.target%>"<% } %>><%- item.html%></a><% } %>',
      '    <%-renderTemplate("menu", item.children)%>',
      '  </li><% } } %>',
      '</ul>',
      '<% } %><%-renderTemplate("menu", menu.tree)%>',
    ].join(''));
    done();
  });

  it('Template Variables', function(done) {
    var componentConfig = { data: { fields: [ { name: 'title' } ] } };
    var rslt = funcs.generateComponentTemplate(componentConfig, [
      '<section class="tiles wrapper <%=component.cssClass%>" style="<%=component.cssStyle%>" cms-component-editor-add-class="preview">',
      'Test %%%url%%% Test',
      '</section>',
    ].join(''), { template_variables: { url: 'http://test' } });
    assert.equal(rslt, [
      componentPrefix,
      '<section class="tiles wrapper <%=component.cssClass%> <%=(isInComponentEditor?"preview":"")%>" style="<%=component.cssStyle%>">',
      'Test http://test Test',
      '</section>',
    ].join(''));
    done();
  });
});


describe('Menu Generation', function() {
  it('Basic Menu Rendering', function(done) {
    var menu = {
      "menu_items": [
        {"menu_item_id":2,"menu_item_parent_id":null,"menu_item_path":"/2/","menu_item_type":"TEXT","menu_item_text":"Home","menu_item_link_type":"PAGE","menu_item_link_dest":"1"},
        {"menu_item_id":3,"menu_item_parent_id":null,"menu_item_path":"/3/","menu_item_type":"TEXT","menu_item_text":"About","menu_item_link_type":"PAGE","menu_item_link_dest":"2"},
        {"menu_item_id":7,"menu_item_parent_id":3,"menu_item_path":"/3/7/","menu_item_type":"TEXT","menu_item_text":"Careers","menu_item_link_type":"PAGE","menu_item_link_dest":"14"},
        {"menu_item_id":8,"menu_item_parent_id":7,"menu_item_path":"/3/7/8/","menu_item_type":"TEXT","menu_item_text":"Designer","menu_item_link_type":"PAGE","menu_item_link_dest":"14"},
        {"menu_item_id":9,"menu_item_parent_id":7,"menu_item_path":"/3/7/9/","menu_item_type":"TEXT","menu_item_text":"Developer","menu_item_link_type":"PAGE","menu_item_link_dest":"14"},
        {"menu_item_id":4,"menu_item_parent_id":null,"menu_item_path":"/4/","menu_item_type":"TEXT","menu_item_text":"Services","menu_item_link_type":"PAGE","menu_item_link_dest":"3"},
        {"menu_item_id":6,"menu_item_parent_id":null,"menu_item_path":"/6/","menu_item_type":"TEXT","menu_item_text":"Testimonials","menu_item_link_type":"PAGE","menu_item_link_dest":"11"},
        {"menu_item_id":5,"menu_item_parent_id":null,"menu_item_path":"/5/","menu_item_type":"TEXT","menu_item_text":"Contact","menu_item_link_type":"PAGE","menu_item_link_dest":"8"}
      ]
    };
    funcs.createMenuTree(menu);

    var template = funcs.generateComponentTemplate(null, [
      '<%=iif(menu.tree.length>3,"Y","N")%>',
      '<%=iif(menu.tree.length<=3,"Y","N")%>',
      '<ul jsh-template="menu">',
      '  <li jsh-foreach-item class="<%~item.class%>" style="<%~item.style%>">',
      '    <a href="<%~item.href%>" onclick="<%~item.onclick%>" target="<%~item.target%>"><%-item.html%></a>',
      '    <%-renderTemplate("menu", item.children)%>',
      '  </li>',
      '</ul>',
      '<%-renderTemplate("menu", menu.tree)%>',
    ].join(''));
    
    var rslt = funcs.renderComponent(template, null, null, { menu: menu });

    assert.equal(rslt, [
      'YN<ul>',

      '  <li>',
      '    <a href="#">Home</a>    ',
      '  </li>',
      
      '<li>',
      '    <a href="#">About</a>',
          '    <ul>',
          '  <li>',
          '    <a href="#">Careers</a>',
              '    <ul>',
              '  <li>',
              '    <a href="#">Designer</a>    ',
              '  </li>',
              '<li>',
              '    <a href="#">Developer</a>    ',
              '  </li>',
              '</ul>',
          '  </li>',
          '</ul>',
      '  </li>',

      '<li>',
      '    <a href="#">Services</a>    ',
      '  </li>',

      '<li>',
      '    <a href="#">Testimonials</a>    ',
      '  </li>',

      '<li>',
      '    <a href="#">Contact</a>    ',
      '  </li>',
      
      '</ul>',
    ].join(''));

    assert.equal(template, [
      componentPrefix,
      '<%=iif(menu.tree.length>3,"Y","N")%>',
      '<%=iif(menu.tree.length<=3,"Y","N")%>',
      '<% (locals.jsh_render_templates=locals.jsh_render_templates||{})["menu"] = function(items){ %>',
      '<ul>',
      '  <% for(let jsh_item_index=(1);jsh_item_index<=(((items)||[]).length);jsh_item_index+=(1+0)){ let item = ((items)||[])[jsh_item_index-1]; if(jsh_item_index>(1)){ %><% } if((item)&&(item).jsh_validation_errors){ %><%-renderPlaceholder({ errors: (item).jsh_validation_errors })%><% } else { %>',
      '<li<% if(!isNullUndefinedEmpty(item.class)){ %> class="<%=item.class%>"<% } %><% if(!isNullUndefinedEmpty(item.style)){ %> style="<%=item.style%>"<% } %>>',
      '    <a<% if(!isNullUndefinedEmpty(item.href)){ %> href="<%=item.href%>"<% } %><% if(!isNullUndefinedEmpty(item.onclick)){ %> onclick="<%=item.onclick%>"<% } %><% if(!isNullUndefinedEmpty(item.target)){ %> target="<%=item.target%>"<% } %>><%-item.html%></a>',
      '    <%-renderTemplate("menu", item.children)%>',
      '  </li><% } } %>',
      '</ul>',
      '<% } %><%-renderTemplate("menu", menu.tree)%>',
    ].join(''));

    
    done();
  });
});

describe('Template tags', function() {
  var menu = {
    "menu_items": [
      {"menu_item_id":2,"menu_item_parent_id":null,"menu_item_path":"/2/","menu_item_type":"TEXT","menu_item_text":"Home","menu_item_link_type":"PAGE","menu_item_link_dest":"1"},
      {"menu_item_id":3,"menu_item_parent_id":null,"menu_item_path":"/3/","menu_item_type":"TEXT","menu_item_text":"About","menu_item_link_type":"PAGE","menu_item_link_dest":"2","menu_item_class":"highlight"},
      {"menu_item_id":7,"menu_item_parent_id":3,"menu_item_path":"/3/7/","menu_item_type":"TEXT","menu_item_text":"Careers","menu_item_link_type":"PAGE","menu_item_link_dest":"14"},
      {"menu_item_id":8,"menu_item_parent_id":7,"menu_item_path":"/3/7/8/","menu_item_type":"TEXT","menu_item_text":"Designer","menu_item_link_type":"MEDIA","menu_item_link_dest":"14"},
      {"menu_item_id":9,"menu_item_parent_id":7,"menu_item_path":"/3/7/9/","menu_item_type":"TEXT","menu_item_text":"Developer","menu_item_link_type":"MEDIA","menu_item_link_dest":"14"},
      {"menu_item_id":4,"menu_item_parent_id":null,"menu_item_path":"/4/","menu_item_type":"TEXT","menu_item_text":"Services","menu_item_link_type":"PAGE","menu_item_link_dest":"3"},
      {"menu_item_id":6,"menu_item_parent_id":null,"menu_item_path":"/6/","menu_item_type":"TEXT","menu_item_text":"Testimonials","menu_item_link_type":"PAGE","menu_item_link_dest":"11"},
      {"menu_item_id":5,"menu_item_parent_id":null,"menu_item_path":"/5/","menu_item_type":"TEXT","menu_item_text":"Contact","menu_item_link_type":"PAGE","menu_item_link_dest":"8"}
    ]
  };
  var errorMenu = JSON.parse(JSON.stringify(menu));
  errorMenu.menu_items[1].jsh_validation_errors = 'Test error';
  errorMenu.menu_items[6].jsh_validation_errors = 'Test error2';

  funcs.createMenuTree(menu);
  funcs.createMenuTree(errorMenu);

  it('jsh-group-items', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      '<div jsh-group-items="menu.tree" jsh-group-items-into="3" class="container">',
      '<div jsh-foreach-item class="<%~item.class%>" style="<%~item.style%>"><%-item.html%></div>',
      '</div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: menu });
    assert.equal(rslt, [
      '<div class="container">',
      '<div>Home</div>',
      '<div class="highlight">About</div>',
      '<div>Services</div>',
      '</div>',
      '<div class="container">',
      '<div>Testimonials</div>',
      '<div>Contact</div>',
      '</div>',
    ].join(''));
    done();
  });

  it('jsh-group-items-separator', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      '<div jsh-group-items="menu.tree" jsh-group-items-into="3" jsh-group-items-separator=" | " class="container">',
      '<div jsh-foreach-item class="<%~item.class%>" style="<%~item.style%>"><%-item.html%></div>',
      '</div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: menu });
    assert.equal(rslt, [
      '<div class="container">',
      '<div>Home</div>',
      '<div class="highlight">About</div>',
      '<div>Services</div>',
      '</div> | ',
      '<div class="container">',
      '<div>Testimonials</div>',
      '<div>Contact</div>',
      '</div>',
    ].join(''));
    done();
  });

  it('jsh-group-items-by', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      '<div jsh-group-items="menu.allItems" jsh-group-items-by="item.menu_item_link_type" jsh-group-items-index="link_type" class="container">',
      '<%=link_type%>',
      '<div jsh-foreach-item class="<%~item.class%>" style="<%~item.style%>"><%-item.html%></div>',
      '</div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: menu });
    assert.equal(rslt, [
      '<div class="container">',
      'PAGE',
      '<div>Home</div>',
      '<div class="highlight">About</div>',
      '<div>Careers</div>',
      '<div>Services</div>',
      '<div>Testimonials</div>',
      '<div>Contact</div>',
      '</div>',
      '<div class="container">',
      'MEDIA',
      '<div>Designer</div>',
      '<div>Developer</div>',
      '</div>',
    ].join(''));
    done();
  });

  it('jsh-group-items nested', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      '<div jsh-group-items="menu.allItems" jsh-group-items-by="item.menu_item_link_type" jsh-group-items-index="link_type" class="container">',
      '<%=link_type%>',
      '<div jsh-group-items-into="3" class="subcontainer">',
      '<div jsh-foreach-item class="<%~item.class%>" style="<%~item.style%>"><%-item.html%></div>',
      '</div>',
      '</div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: menu });
    assert.equal(rslt, [
      '<div class="container">',
      'PAGE',
      '<div class="subcontainer">',
      '<div>Home</div>',
      '<div class="highlight">About</div>',
      '<div>Careers</div>',
      '</div>',
      '<div class="subcontainer">',
      '<div>Services</div>',
      '<div>Testimonials</div>',
      '<div>Contact</div>',
      '</div>',
      '</div>',
      '<div class="container">',
      'MEDIA',
      '<div class="subcontainer">',
      '<div>Designer</div>',
      '<div>Developer</div>',
      '</div>',
      '</div>',
    ].join(''));
    done();
  });

  it('jsh-group-items with item errors', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      '<div jsh-group-items="menu.tree" jsh-group-items-into="3" class="container">',
      '<div jsh-foreach-item class="<%~item.class%>" style="<%~item.style%>">',
      '<%-item.html%>',
      '</div>',
      '</div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: errorMenu, renderPlaceholder: function(params){ return '***ERROR***'+(params||{}).errors; } });
    assert.equal(rslt, [
      '<div class="container">',
      '<div>Home</div>',
      '***ERROR***Test error',
      '<div>Services</div>',
      '</div>',
      '<div class="container">',
      '***ERROR***Test error2',
      '<div>Contact</div>',
      '</div>',
    ].join(''));
    done();
  });

  it('jsh-group-items with index and subgroup variable', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      '<div jsh-group-items="menu.tree" jsh-group-items-into="3" jsh-group-items-index="idx" jsh-group-items-subgroup="groupof3" class="container">',
      'Group <%=idx%>',
      '<div jsh-foreach-item="groupof3" jsh-foreach-item-index="idx" class="<%~item.class%>" style="<%~item.style%>"><%=idx%><%-item.html%></div>',
      '</div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: menu });
    assert.equal(rslt, [
      '<div class="container">',
      'Group 1',
      '<div>1Home</div>',
      '<div class="highlight">2About</div>',
      '<div>3Services</div>',
      '</div>',
      '<div class="container">',
      'Group 2',
      '<div>1Testimonials</div>',
      '<div>2Contact</div>',
      '</div>',
    ].join(''));
    done();
  });

  it('jsh-foreach-item basic', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      '<div jsh-foreach-item="menu.tree" class="<%~item.class%>" style="<%~item.style%>"><%-item.html%></div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: menu });
    assert.equal(rslt, [
      '<div>Home</div>',
      '<div class="highlight">About</div>',
      '<div>Services</div>',
      '<div>Testimonials</div>',
      '<div>Contact</div>',
    ].join(''));
    done();
  });

  it('jsh-foreach-item with separator', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      '<div jsh-foreach-item="menu.tree" jsh-foreach-item-separator=" " class="<%~item.class%>" style="<%~item.style%>"><%-item.html%></div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: menu });
    assert.equal(rslt, [
      '<div>Home</div> ',
      '<div class="highlight">About</div> ',
      '<div>Services</div> ',
      '<div>Testimonials</div> ',
      '<div>Contact</div>',
    ].join(''));
    done();
  });

  it('jsh-foreach-item with start & end', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      '<div jsh-foreach-item="menu.tree" jsh-foreach-item-start="2" jsh-foreach-item-end="menu.tree.length-2" class="<%~item.class%>" style="<%~item.style%>"><%-item.html%></div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: menu });
    assert.equal(rslt, [
      '<div class="highlight">About</div>',
      '<div>Services</div>',
    ].join(''));
    done();
  });

  it('jsh-foreach-item with skip even', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      '<div jsh-foreach-item="menu.tree" jsh-foreach-item-skip="1" class="<%~item.class%>" style="<%~item.style%>"><%-item.html%></div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: menu });
    assert.equal(rslt, [
      '<div>Home</div>',
      '<div>Services</div>',
      '<div>Contact</div>',
    ].join(''));
    done();
  });

  it('jsh-foreach-item with skip odd', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      '<div jsh-foreach-item="menu.tree" jsh-foreach-item-start="2" jsh-foreach-item-skip="1" class="<%~item.class%>" style="<%~item.style%>"><%-item.html%></div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: menu });
    assert.equal(rslt, [
      '<div class="highlight">About</div>',
      '<div>Testimonials</div>',
    ].join(''));
    done();
  });

  it('jsh-foreach-item with variable and index', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      '<div jsh-foreach-item="menu.tree" jsh-foreach-item-variable="menuitem" jsh-foreach-item-index="idx" class="<%~menuitem.class%>" style="<%~menuitem.style%>">',
      '<%=idx%><%-menuitem.html%>',
      '</div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: menu });
    assert.equal(rslt, [
      '<div>1Home</div>',
      '<div class="highlight">2About</div>',
      '<div>3Services</div>',
      '<div>4Testimonials</div>',
      '<div>5Contact</div>',
    ].join(''));
    done();
  });

  it('jsh-foreach-item with data_errors', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      '<div jsh-foreach-item="menu.tree" class="<%~item.class%>" style="<%~item.style%>"><%-item.html%></div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: errorMenu, renderPlaceholder: function(params){ return '***ERROR***'+(params||{}).errors; } });
    assert.equal(rslt, [
      '<div>Home</div>',
      '***ERROR***Test error',
      '<div>Services</div>',
      '***ERROR***Test error2',
      '<div>Contact</div>',
    ].join(''));
    done();
  });

  it('jsh-foreach-item with data_errors via jsh-template', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      '<div jsh-template="menuTemplate" jsh-template-items="menuitems" jsh-foreach-item="menuitems" class="<%~item.class%>" style="<%~item.style%>"><%-item.html%></div>',
      '<%-renderTemplate("menuTemplate", menu.tree)%>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: errorMenu, renderPlaceholder: function(params){ return '***ERROR***'+(params||{}).errors; } });
    assert.equal(rslt, [
      '<div>Home</div>',
      '***ERROR***Test error',
      '<div>Services</div>',
      '***ERROR***Test error2',
      '<div>Contact</div>',
    ].join(''));
    done();
  });

  it('jsh-foreach-item undefined', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      'Start<div jsh-foreach-item="menu.zzz" class="<%~item.class%>" style="<%~item.style%>"><%-item.html%></div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: errorMenu, renderPlaceholder: function(params){ return '***ERROR***'+(params||{}).errors; } });
    assert.equal(rslt, [
      'Start',
    ].join(''));
    done();
  });

  it('iif function', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      '<div jsh-foreach-item="menu.tree" jsh-foreach-item-index="idx" class="<%~item.class%>" style="<%~item.style%>">',
      '<%=iif(idx%2==0,"EVEN","ODD")%> ',
      '<%-item.html%>',
      '</div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: menu });
    assert.equal(rslt, [
      '<div>ODD Home</div>',
      '<div class="highlight">EVEN About</div>',
      '<div>ODD Services</div>',
      '<div>EVEN Testimonials</div>',
      '<div>ODD Contact</div>',
    ].join(''));
    done();
  });
  

  it('jsh-for-item with variable', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      '<div jsh-for-item="menu.tree[1]" jsh-for-item-variable="menuitem" class="<%~menuitem.class%>" style="<%~menuitem.style%>">',
      '<%-menuitem.html%>',
      '</div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: menu });
    assert.equal(rslt, [
      '<div class="highlight">About</div>',
    ].join(''));
    done();
  });

  it('jsh-for-item undefined', function(done) {
    var template = funcs.generateComponentTemplate(null, [
      'Start<div jsh-for-item="menu.zzz" class="<%~menuitem.class%>" style="<%~menuitem.style%>">',
      '<%-item.html%>',
      '</div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { menu: menu });
    assert.equal(rslt, [
      'Start',
    ].join(''));
    done();
  });
});


describe('Sitemap', function() {
  var sitemap = {
    "sitemap_items":[
      {"sitemap_item_id":"1","sitemap_item_parent_id":"","sitemap_item_path":"/1/","sitemap_item_text":"Home","sitemap_item_type":"TEXT","sitemap_item_tag":"","sitemap_item_style":"","sitemap_item_class":"","sitemap_item_exclude_from_breadcrumbs":"0","sitemap_item_exclude_from_parent_menu":"0","sitemap_item_hide_menu_parents":"0","sitemap_item_hide_menu_siblings":"0","sitemap_item_hide_menu_children":"0","sitemap_item_link_type":"PAGE","sitemap_item_link_dest":"1","sitemap_item_link_target":""},
      {"sitemap_item_id":"2","sitemap_item_parent_id":"1","sitemap_item_path":"/1/2/","sitemap_item_text":"About","sitemap_item_type":"TEXT","sitemap_item_tag":"","sitemap_item_style":"","sitemap_item_class":"","sitemap_item_exclude_from_breadcrumbs":"0","sitemap_item_exclude_from_parent_menu":"0","sitemap_item_hide_menu_parents":"1","sitemap_item_hide_menu_siblings":"1","sitemap_item_hide_menu_children":"0","sitemap_item_link_type":"PAGE","sitemap_item_link_dest":"2","sitemap_item_link_target":""},
      {"sitemap_item_id":"11","sitemap_item_parent_id":"2","sitemap_item_path":"/1/2/11/","sitemap_item_text":"Careers","sitemap_item_type":"TEXT","sitemap_item_tag":"","sitemap_item_style":"","sitemap_item_class":"","sitemap_item_exclude_from_breadcrumbs":"0","sitemap_item_exclude_from_parent_menu":"0","sitemap_item_hide_menu_parents":"0","sitemap_item_hide_menu_siblings":"0","sitemap_item_hide_menu_children":"0","sitemap_item_link_type":"PAGE","sitemap_item_link_dest":"10","sitemap_item_link_target":""},
      {"sitemap_item_id":"3","sitemap_item_parent_id":"1","sitemap_item_path":"/1/3/","sitemap_item_text":"Services","sitemap_item_type":"TEXT","sitemap_item_tag":"","sitemap_item_style":"","sitemap_item_class":"","sitemap_item_exclude_from_breadcrumbs":"0","sitemap_item_exclude_from_parent_menu":"0","sitemap_item_hide_menu_parents":"0","sitemap_item_hide_menu_siblings":"0","sitemap_item_hide_menu_children":"0","sitemap_item_link_type":"PAGE","sitemap_item_link_dest":"3","sitemap_item_link_target":""},
      {"sitemap_item_id":"4","sitemap_item_parent_id":"3","sitemap_item_path":"/1/3/4/","sitemap_item_text":"Engage Users","sitemap_item_type":"TEXT","sitemap_item_tag":"","sitemap_item_style":"","sitemap_item_class":"","sitemap_item_exclude_from_breadcrumbs":"0","sitemap_item_exclude_from_parent_menu":"0","sitemap_item_hide_menu_parents":"0","sitemap_item_hide_menu_siblings":"0","sitemap_item_hide_menu_children":"0","sitemap_item_link_type":"PAGE","sitemap_item_link_dest":"4","sitemap_item_link_target":""},
      {"sitemap_item_id":"5","sitemap_item_parent_id":"3","sitemap_item_path":"/1/3/5/","sitemap_item_text":"Expand Capability","sitemap_item_type":"TEXT","sitemap_item_tag":"","sitemap_item_style":"","sitemap_item_class":"","sitemap_item_exclude_from_breadcrumbs":"0","sitemap_item_exclude_from_parent_menu":"0","sitemap_item_hide_menu_parents":"0","sitemap_item_hide_menu_siblings":"0","sitemap_item_hide_menu_children":"0","sitemap_item_link_type":"PAGE","sitemap_item_link_dest":"5","sitemap_item_link_target":""},
      {"sitemap_item_id":"12","sitemap_item_parent_id":"5","sitemap_item_path":"/1/3/5/12","sitemap_item_text":"Expand #1","sitemap_item_type":"TEXT","sitemap_item_tag":"","sitemap_item_style":"","sitemap_item_class":"","sitemap_item_exclude_from_breadcrumbs":"0","sitemap_item_exclude_from_parent_menu":"0","sitemap_item_hide_menu_parents":"0","sitemap_item_hide_menu_siblings":"0","sitemap_item_hide_menu_children":"0","sitemap_item_link_type":"PAGE","sitemap_item_link_dest":"21","sitemap_item_link_target":""},
      {"sitemap_item_id":"13","sitemap_item_parent_id":"5","sitemap_item_path":"/1/3/5/13","sitemap_item_text":"Expand #2","sitemap_item_type":"TEXT","sitemap_item_tag":"","sitemap_item_style":"","sitemap_item_class":"","sitemap_item_exclude_from_breadcrumbs":"0","sitemap_item_exclude_from_parent_menu":"0","sitemap_item_hide_menu_parents":"0","sitemap_item_hide_menu_siblings":"0","sitemap_item_hide_menu_children":"0","sitemap_item_link_type":"PAGE","sitemap_item_link_dest":"22","sitemap_item_link_target":""},
      {"sitemap_item_id":"6","sitemap_item_parent_id":"3","sitemap_item_path":"/1/3/6/","sitemap_item_text":"Deliver Results","sitemap_item_type":"TEXT","sitemap_item_tag":"","sitemap_item_style":"","sitemap_item_class":"","sitemap_item_exclude_from_breadcrumbs":"0","sitemap_item_exclude_from_parent_menu":"0","sitemap_item_hide_menu_parents":"0","sitemap_item_hide_menu_siblings":"0","sitemap_item_hide_menu_children":"0","sitemap_item_link_type":"PAGE","sitemap_item_link_dest":"6","sitemap_item_link_target":""},
      {"sitemap_item_id":"7","sitemap_item_parent_id":"3","sitemap_item_path":"/1/3/7/","sitemap_item_text":"Improve Forecasts","sitemap_item_type":"TEXT","sitemap_item_tag":"","sitemap_item_style":"","sitemap_item_class":"","sitemap_item_exclude_from_breadcrumbs":"0","sitemap_item_exclude_from_parent_menu":"0","sitemap_item_hide_menu_parents":"0","sitemap_item_hide_menu_siblings":"0","sitemap_item_hide_menu_children":"0","sitemap_item_link_type":"PAGE","sitemap_item_link_dest":"7","sitemap_item_link_target":""},
      {"sitemap_item_id":"8","sitemap_item_parent_id":"1","sitemap_item_path":"/1/8/","sitemap_item_text":"Contact","sitemap_item_type":"TEXT","sitemap_item_tag":"","sitemap_item_style":"","sitemap_item_class":"","sitemap_item_exclude_from_breadcrumbs":"0","sitemap_item_exclude_from_parent_menu":"0","sitemap_item_hide_menu_parents":"0","sitemap_item_hide_menu_siblings":"0","sitemap_item_hide_menu_children":"0","sitemap_item_link_type":"PAGE","sitemap_item_link_dest":"8","sitemap_item_link_target":""},
      {"sitemap_item_id":"9","sitemap_item_parent_id":"","sitemap_item_path":"/9/","sitemap_item_text":"Elements","sitemap_item_type":"TEXT","sitemap_item_tag":"","sitemap_item_style":"","sitemap_item_class":"","sitemap_item_exclude_from_breadcrumbs":"1","sitemap_item_exclude_from_parent_menu":"1","sitemap_item_hide_menu_parents":"0","sitemap_item_hide_menu_siblings":"0","sitemap_item_hide_menu_children":"0","sitemap_item_link_type":"","sitemap_item_link_dest":"","sitemap_item_link_target":""},
      {"sitemap_item_id":"10","sitemap_item_parent_id":"9","sitemap_item_path":"/9/10/","sitemap_item_text":"App Animation","sitemap_item_type":"TEXT","sitemap_item_tag":"","sitemap_item_style":"","sitemap_item_class":"","sitemap_item_exclude_from_breadcrumbs":"0","sitemap_item_exclude_from_parent_menu":"0","sitemap_item_hide_menu_parents":"0","sitemap_item_hide_menu_siblings":"0","sitemap_item_hide_menu_children":"0","sitemap_item_link_type":"PAGE","sitemap_item_link_dest":"9","sitemap_item_link_target":""}
    ]
  };

  it('Sitemap Template', function(done) {
    var pageSitemap = funcs.getPageSitemapRelatives(sitemap, 10);
    funcs.createSitemapTree(pageSitemap);
    var template = funcs.generateComponentTemplate(null, [
      '<div class="xsidenav">',
      '  <div jsh-for-item="sitemap.root" class="xsidenav_head" style="<%~item.style%>">',
      '    <a class="xsidenav_more" href="#" onclick="xsidenav_more_click(this); return false;">',
      '      <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M0 0h24v24H0z" fill="none"/><path d="M4 14h4v-4H4v4zm0 5h4v-4H4v4zM4 9h4V5H4v4zm5 5h12v-4H9v4zm0 5h12v-4H9v4zM9 5v4h12V5H9z"/></svg>',
      '    </a>',
      '    <div class="xsidenav_item">',
      '      <a href="<%~item.href%>" onclick="<%~item.onclick%>" target="<%~item.target%>"><%-item.html%></a>',
      '    </div>',
      '  </div>',
      '  <div class="xsidenav_tree">',
      '    <ul jsh-template="sitemap-items">',
      '      <li jsh-foreach-item class="<%~item.class%>" style="<%~item.style%>">',
      '        <div class="xsidenav_item <%=iif(item.selected,"selected")%>">',
      '          <a href="<%~item.href%>" onclick="<%~item.onclick%>" target="<%~item.target%>"><%-item.html%></a>',
      '          <%-renderTemplate("sitemap-items", item.children)%>',
      '        </div>',
      '      </li>',
      '    </ul>',
      '    <%-renderTemplate("sitemap-items", ((!sitemap.parents && (sitemap.tree.length > 1)) ? sitemap.tree : sitemap.root.children))%>',
      '  </div>',
      '</div>',
    ].join(''));
    var rslt = funcs.renderComponent(template, null, null, { sitemap: pageSitemap });
    assert.equal(rslt, [
      '<div class="xsidenav">',
      '  <div class="xsidenav_head">',
      '    <a class="xsidenav_more" href="#" onclick="xsidenav_more_click(this); return false;">',
      '      <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M0 0h24v24H0z" fill="none"/><path d="M4 14h4v-4H4v4zm0 5h4v-4H4v4zM4 9h4V5H4v4zm5 5h12v-4H9v4zm0 5h12v-4H9v4zM9 5v4h12V5H9z"/></svg>',
      '    </a>',
      '    <div class="xsidenav_item">',
      '      <a href="#">About</a>',
      '    </div>',
      '  </div>',
      '  <div class="xsidenav_tree">',
      '        <ul>',
      '      <li>',
      '        <div class="xsidenav_item selected">',
      '          <a href="#">Careers</a>',
      '                  </div>',
      '      </li>',
      '    </ul>',
      '  </div>',
      '</div>',
    ].join(''));
    done();
  });
});

describe('Component Export', function() {
  function getParams(templateCode){
    var rslt = {
      branchData: {
        site_files: {
          'folder1/file1.html': '',
          'folder1/file2.html': '',
          'folder2/file1.html': '',
        },
        component_export_template_html: {
          'menu/top': [
            funcs.generateComponentTemplate(null, templateCode)
          ]
        },
        component_templates: {
          'menu/top': {
            'export': [
              {}
            ]
          }
        },
      },
    };
    rslt.branchData.fsOps = funcs.deploy_getFS(rslt.branchData.site_files);
    return rslt;
  }

  it('Wildcard Export - Add File', function(done) {
    var params = getParams('<% addFile("menu/menu1.html", "Menu content"); %>');
    funcs.deploy_exportComponentRender(jsh, params.branchData, null, 'menu/top', params.branchData.component_templates['menu/top'].export[0], 0);
    assert(params.branchData.fsOps.addedFiles['menu/menu1.html'] == 'Menu content');
    return done();
  });

  it('Wildcart Export - Add File Conflict', function(done) {
    var params = getParams('<% addFile("menu/menu1.html", "Menu content"); addFile("folder1/file1.html"); %>');
    assert.throws(function(){
      funcs.deploy_exportComponentRender(jsh, params.branchData, null, 'menu/top', params.branchData.component_templates['menu/top'].export[0], 0);
    }, /file already exists/);
    return done();
  });

  it('Wildcart Export - Invalid File Name', function(done) {
    var params = getParams('<% addFile("menu\\\\menu1.html", "Menu content"); %>');
    assert.throws(function(){
      funcs.deploy_exportComponentRender(jsh, params.branchData, null, 'menu/top', params.branchData.component_templates['menu/top'].export[0], 0);
    }, /is not allowed in file path/);
    return done();
  });

  it('Wildcart Export - Invalid File Name \\', function(done) {
    var params = getParams('<% addFile("/menu/menu1.html", "Menu content"); %>');
    assert.throws(function(){
      funcs.deploy_exportComponentRender(jsh, params.branchData, null, 'menu/top', params.branchData.component_templates['menu/top'].export[0], 0);
    }, /File path cannot begin with/);
    return done();
  });
  
  it('Wildcart Export - Invalid File Name %', function(done) {
    var params = getParams('<% addFile("menu/menu1|.html", "Menu content"); %>');
    assert.throws(function(){
      funcs.deploy_exportComponentRender(jsh, params.branchData, null, 'menu/top', params.branchData.component_templates['menu/top'].export[0], 0);
    }, /Invalid characters in file path/);
    return done();
  });

  it('Wildcart Export - Delete Added File', function(done) {
    var params = getParams('<% addFile("menu/menu1.html", "Menu content"); deleteFile("menu/menu1.html"); %>');
    funcs.deploy_exportComponentRender(jsh, params.branchData, null, 'menu/top', params.branchData.component_templates['menu/top'].export[0], 0);
    assert(_.isEmpty(params.branchData.fsOps.addedFiles));
    return done();
  });

  it('Wildcart Export - Delete Site File', function(done) {
    var params = getParams('<% addFile("menu/menu1.html", "Menu content"); deleteFile("folder1/file1.html"); %>');
    funcs.deploy_exportComponentRender(jsh, params.branchData, null, 'menu/top', params.branchData.component_templates['menu/top'].export[0], 0);
    assert(params.branchData.fsOps.addedFiles['menu/menu1.html'] == 'Menu content');
    assert(params.branchData.fsOps.deletedFilesUpper['FOLDER1/FILE1.HTML']=='folder1/file1.html');
    return done();
  });

  it('Wildcart Export - Cannot Delete Added File Twice', function(done) {
    var params = getParams('<% addFile("menu/menu1.html", "Menu content"); deleteFile("menu/menu1.html"); deleteFile("menu/menu1.html"); %>');
    assert.throws(function(){
      funcs.deploy_exportComponentRender(jsh, params.branchData, null, 'menu/top', params.branchData.component_templates['menu/top'].export[0], 0);
    }, /file not found/);
    return done();
  });

  it('Wildcart Export - Cannot Delete Site File Twice', function(done) {
    var params = getParams('<% addFile("menu/menu1.html", "Menu content"); deleteFile("folder1/file1.html"); deleteFile("folder1/file1.html"); %>');
    assert.throws(function(){
      funcs.deploy_exportComponentRender(jsh, params.branchData, null, 'menu/top', params.branchData.component_templates['menu/top'].export[0], 0);
    }, /file already deleted/);
    return done();
  });

  it('Wildcart Export - Can Add and Delete Twice', function(done) {
    var params = getParams('<% addFile("menu/menu1.html", "Menu content"); deleteFile("menu/menu1.html"); addFile("menu/menu1.html", "Menu content"); deleteFile("menu/menu1.html"); %>');
    funcs.deploy_exportComponentRender(jsh, params.branchData, null, 'menu/top', params.branchData.component_templates['menu/top'].export[0], 0);
    assert(_.isEmpty(params.branchData.fsOps.addedFiles));
    return done();
  });

  it('Wildcart Export - Delete Twice with HasFile', function(done) {
    var params = getParams('<% addFile("menu/menu1.html", "Menu content"); if(hasFile("menu/menu1.html")) deleteFile("menu/menu1.html"); if(hasFile("menu/menu1.html")) deleteFile("menu/menu1.html"); %>');
    funcs.deploy_exportComponentRender(jsh, params.branchData, null, 'menu/top', params.branchData.component_templates['menu/top'].export[0], 0);
    assert(_.isEmpty(params.branchData.fsOps.addedFiles));
    return done();
  });

  it('Wildcart Export - getEJSOutput', function(done) {
    var params = getParams([
      '<% function getTemplate(type){ return getEJSOutput(function(){ -%>',
      '<div><%=type%></div>',
      '<% }) } %>',
      '<% addFile("file1", getTemplate("abc")); addFile("file2", getTemplate("abc&d")); %>'
    ].join(''));
    funcs.deploy_exportComponentRender(jsh, params.branchData, null,  'menu/top', params.branchData.component_templates['menu/top'].export[0], 0);
    assert(params.branchData.fsOps.addedFiles['file1'] == '<div>abc</div>');
    assert(params.branchData.fsOps.addedFiles['file2'] == '<div>abc&amp;d</div>');
    return done();
  });
});