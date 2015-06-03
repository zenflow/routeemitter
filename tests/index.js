var assert = require('assert');
var test = require('tape');
var _ = require('lodash');
var asyncSeries = require('async-series');
var dummy = require('./dummy');
var RouteEmitter = require('../lib');

test('stateless members', function(t){
    t.plan(4);
    var router = dummy.getRouter();
    t.equal(typeof router.patterns, 'object');
    t.deepEqual(router.patterns, dummy.patterns);
    t.equal(typeof router.Route, 'function');
    t.ok(router.Route.prototype instanceof RouteEmitter.prototype.Route);
});
test('throws error if we try to get unreachable route', function(t){
    t.plan(1);
    var router = dummy.getRouter();
    t.throws(function(){
        router.Route('notfound', {path: 'a'});
    });
});
test('route to url and to route', getTestRouteToUrlToRoute());
test('route to url and to route /w patternPrefix: /anything/', getTestRouteToUrlToRoute({patternPrefix: '/anything/'}));
test('url to route to url', getTestUrlToRouteToUrl());
test('url to route to url /w patternPrefix: /anything/', getTestUrlToRouteToUrl({patternPrefix: '/anything/'}));
test('dummy urls match dummy routes', getTestUrlsMatchRoutes());
test('dummy urls match dummy routes /w patternPrefix: /anything/', getTestUrlsMatchRoutes({patternPrefix: '/anything/'}));
test('state manipulation /w bindToWindow: false', getTestStateManipulation({bindToWindow: false}));
test('state manipulation /w bindToWindow: true', getTestStateManipulation({bindToWindow: true}));
test('*** not a test***', function(t){
    t.end();
    if (process.browser){
        window.RouteEmitter = RouteEmitter;
        window.router = dummy.getRouter({bindToWindow: true});
        _.forEach(dummy.urls, function(url){
            var route = window.router.Route(url);
            var anchor_el = window.document.createElement('a');
            anchor_el.setAttribute('href', route.url);
            anchor_el.appendChild(window.document.createTextNode(route.name+' '+JSON.stringify(route.params)));
            var pre_el = window.document.createElement('pre');
            pre_el.appendChild(anchor_el);
            window.document.body.appendChild(pre_el);
        });
        var pre_el = window.document.createElement('pre');
        pre_el.appendChild(window.document.createTextNode(' --- '));
        window.document.body.appendChild(pre_el);
        window.router.on('route', function(route, last_route){
            var pre_el = window.document.createElement('pre');
            pre_el.appendChild(window.document.createTextNode(route.name+' '+JSON.stringify(route.params)));
            window.document.body.appendChild(pre_el);
        });
    }
});

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
        var initial_route = router.route;
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
                if (router.route.equals(initial_route)){
                    router.destroy();
                    t.end();
                } else {
                    router.back();
                    router.once('route', function(route, last_route){
                        router.destroy();
                        t.end();
                    });
                }
            } else {
                t.end();
            }
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
