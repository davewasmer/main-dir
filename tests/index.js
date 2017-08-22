var test = require('tape');
require('../index');

test('loads from main dir', function(t) {
  let result = require('./fixtures/with-main-dir-test');
  t.equal(result.hello, 'world');
  t.end();
});

test('loads main file relative to main dir', function(t) {
  let result = require('./fixtures/with-main-and-main-dir-test');
  t.equal(result.hello, 'world');
  t.end();
});

test('loads packages without a main dir', function(t) {
  let result = require('./fixtures/without-main-dir-test');
  t.equal(result.hello, 'world');
  t.end();
});