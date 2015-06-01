var assert = require('assert');
var test = require('tape');
var _ = require('lodash');
var dummy = require('./dummy');
var ObsRouter = require('../lib');

test('stateless members', function(t){
    t.plan(4);
    var router = dummy.getRouter(false);

    t.equal(typeof router.patterns, 'object');
    t.deepEqual(router.patterns, dummy.patterns);

    t.equal(typeof router.Route, 'function');
    t.ok(router.Route.prototype instanceof ObsRouter.prototype.Route);

    //router.destroy(); not nocessary here since !listeners && !bindToWindow
});
test('initial state with bindToWindow: false', function(t){
    t.plan(1);
    var router = dummy.getRouter(false);

    t.doesNotThrow(getAssertState(router, '', 'notfound', {path: ''}));

    //router.destroy(); not nocessary here since !listeners && !bindToWindow
});

function getAssertState(router, url, route_name, route_params){
    return function(){
        assert.equal(router.route.url, url);
        assert.equal(router.route.name, route_name);
        assert.deepEqual(router.route.params, route_params);
    };
}