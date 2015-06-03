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
    var router = dummy.getRouter();
    t.equal(typeof router.patterns, 'object');
    t.deepEqual(router.patterns, dummy.patterns);
    t.equal(typeof router.Route, 'function');
    t.ok(router.Route.prototype instanceof ObsRouter.prototype.Route);
});
test('route to url and to route', getTestRouteToUrlToRoute());
test('route to url and to route /w patternPrefix: /anything/', getTestRouteToUrlToRoute({patternPrefix: '/anything/'}));
test('url to route to url', getTestUrlToRouteToUrl());
test('url to route to url /w patternPrefix: /anything/', getTestUrlToRouteToUrl({patternPrefix: '/anything/'}));
test('dummy urls match dummy routes', getTestUrlsMatchRoutes());
test('dummy urls match dummy routes /w patternPrefix: /anything/', getTestUrlsMatchRoutes({patternPrefix: '/anything/'}));
test('state manipulation /w bindToWindow: false', getTestStateManipulation({bindToWindow: false}));
test('state manipulation /w bindToWindow: true', getTestStateManipulation({bindToWindow: true}));

function getTestUrlToRouteToUrl(options){
    options = options || {};
    return function(t){
        t.plan(dummy.urls.length);
        var router = dummy.getRouter(options);
        _.forEach(dummy.urls, function(dummy_url){
            var full_dummmy_url = (options.patternPrefix ? options.patternPrefix.substr(0, options.patternPrefix.length-1) : '') + dummy_url;
            var route = router.Route(full_dummmy_url);
            route = router.Route(route.name, route.params);
            t.equal(route.url, full_dummmy_url);
        });
    };
}
function getTestRouteToUrlToRoute(options){
    options = options || {};
    return function(t){
        t.plan(dummy.routes.length*2);
        var router = dummy.getRouter(options);
        _.forEach(dummy.routes, function(dummy_route){
            var route = router.Route(dummy_route.name, dummy_route.params);
            route = router.Route(route.url);
            t.equal(route.name, dummy_route.name);
            t.deepEqual(route.params, dummy_route.params);
        });
    };
}

function getTestUrlsMatchRoutes(options){
    options = options || {};
    return function(t){
        t.plan(dummy.urls.length*2);
        var router = dummy.getRouter(options);
        _.forEach(dummy.routes, function(dummy_route, i){
            var dummy_url = dummy.urls[i];
            var full_dummmy_url = (options.patternPrefix ? options.patternPrefix.substr(0, options.patternPrefix.length-1) : '') + dummy_url;
            var route = router.Route(full_dummmy_url);
            t.equal(route.name, dummy_route.name);
            t.deepEqual(route.params, dummy_route.params);
        });
    };
}

function getTestStateManipulation(options){
    options = options || {};
    return function(t){
        if (dummy.urls.length!=dummy.routes.length){t.fail('dummy.routes.length != dummy.urls.length'); t.end(); return;}
        var router = dummy.getRouter(options);
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
                if (process.browser && options.bindToWindow){
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
            if (process.browser && options.bindToWindow){
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
