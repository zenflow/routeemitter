var assert = require('assert');
var test = require('tape');
var _ = require('lodash');
var dummy = require('./dummy');
var ObsRouter = require('../lib');

if (process.browser){
    window.ObsRouter = ObsRouter;
}

test('stateless members', function(t){
    t.plan(4);
    var router = dummy.getRouter(false);
    t.equal(typeof router.patterns, 'object');
    t.deepEqual(router.patterns, dummy.patterns);
    t.equal(typeof router.Route, 'function');
    t.ok(router.Route.prototype instanceof ObsRouter.prototype.Route);
    //router.destroy(); not nocessary here since !listeners && !bindToWindow
});
test('converts dummy urls to routes and back to same urls', function(t){
    t.plan(dummy.urls.length);
    var router = dummy.getRouter(false);
    _.forEach(dummy.urls, function(dummy_url){
        var route = router.Route(dummy_url);
        route = router.Route(route.name, route.params);
        t.equal(route.url, dummy_url);
    });
    //router.destroy(); not nocessary here since !listeners && !bindToWindow
});

test('converts dummy routes to urls and back to same routes', function(t){
    t.plan(dummy.routes.length*2);
    var router = dummy.getRouter(false);
    _.forEach(dummy.routes, function(dummy_route){
        var route = router.Route(dummy_route.name, dummy_route.params);
        route = router.Route(route.url);
        t.equal(route.name, dummy_route.name);
        t.deepEqual(route.params, dummy_route.params);
    });
    //router.destroy(); not nocessary here since !listeners && !bindToWindow
});
test('converts dummy urls to dummy route equivalents', function(t){
    if (dummy.urls.length!=dummy.routes.length){return t.fail('dummy.routes.length != dummy.urls.length')}
    t.plan(dummy.routes.length*2);
    var router = dummy.getRouter(false);
    _.forEach(dummy.routes, function(dummy_route, i){
        var route = router.Route(dummy.urls[i]);
        t.equal(route.name, dummy_route.name);
        t.deepEqual(route.params, dummy_route.params);
    });
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