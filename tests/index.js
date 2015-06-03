var assert = require('assert');
var test = require('tape');
var _ = require('lodash');
var asyncSeries = require('async-series');
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
});

test('converts dummy urls to routes and back to same urls', function(t){
    t.plan(dummy.urls.length);
    var router = dummy.getRouter(false);
    _.forEach(dummy.urls, function(dummy_url){
        var route = router.Route(dummy_url);
        route = router.Route(route.name, route.params);
        t.equal(route.url, dummy_url);
    });
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
});

test('converts dummy urls to dummy route equivalents', function(t){
    t.plan(dummy.urls.length*2);
    var router = dummy.getRouter(false);
    _.forEach(dummy.routes, function(dummy_route, i){
        var route = router.Route(dummy.urls[i]);
        t.equal(route.name, dummy_route.name);
        t.deepEqual(route.params, dummy_route.params);
    });
});

test('state manipulation /w bindToWindow: false', getTestStateManipulation(false));
test('state manipulation /w bindToWindow: true', getTestStateManipulation(true));

function getTestStateManipulation(bindToWindow){
    return function(t){
        if (dummy.urls.length!=dummy.routes.length){t.fail('dummy.routes.length != dummy.urls.length'); t.end(); return;}
        var router = dummy.getRouter(bindToWindow);
        var push_state_actions = _.map(_.range(dummy.urls.length), function(i){
            return function(cb){
                if (i % 2){
                    router.pushRoute(dummy.routes[i]);
                } else {
                    router.pushUrl(dummy.urls[i]);
                }
                router.once('route', function(route){
                    t.doesNotThrow(getAssertState(router, dummy.urls[i], dummy.routes[i].name, dummy.routes[i].params));
                    cb(null);
                });
            };
        });
        var pop_state_actions = _.map(_.range(dummy.urls.length-1).reverse(), function(i){
            return function(cb){
                if (process.browser && bindToWindow){
                    router.back();
                } else {
                    if (i % 2){
                        router.replaceUrl(dummy.urls[i]);
                    } else {
                        router.replaceRoute(dummy.routes[i]);
                    }
                }

                router.once('route', function(route){
                    t.doesNotThrow(getAssertState(router, dummy.urls[i], dummy.routes[i].name, dummy.routes[i].params));
                    cb(null);
                });
            };
        });
        asyncSeries([].concat(push_state_actions, pop_state_actions), function(error){
            if (error){t.fail(error); t.end(); return;}
            if (bindToWindow && process.browser){
                router.back();
                router.destroy();
            }
            t.end();
        });
    };
}

function getAssertState(router, url, route_name, route_params){
    return function(){
        assert.equal(router.route.url, url);
        assert.equal(router.route.name, route_name);
        assert.deepEqual(router.route.params, route_params);
    };
}
