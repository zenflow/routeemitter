var _ = require('lodash');
var EventEmitter = require('events').EventEmitter;
var cancellableNextTick = require('cancellable-next-tick');
var querystring = require('querystring');
var getRouteParser = require('./util/getRouteParser');

if (process.browser){
    var History = require('html5-history');
    var routers = [];
    History.Adapter.bind(window, 'statechange', function(){
        _.forEach(routers, function(router){
            router._update(new router.Route(window.document.location.pathname + window.document.location.search));
        });
    });
}

var Route = function(router, a, b){
    var self = this;
    if (b){
        self.name = a;
        self.params = b;
        var pattern = router.patterns[self.name];
        var route_parser = getRouteParser(router._basePath + pattern, router._cacheRouteParsers);
        var pathname = route_parser.reverse(self.params);
        if (pathname===false){
            throw new Error('Missing required parameter(s) for pattern. \r\nname: ' + JSON.stringify(self.name) + '\r\n' +
                'params: ' + JSON.stringify(self.params)+'\r\npattern: ' + pattern);
        }
        _.find(router.patterns, function(pattern, _name){
            if (_name == self.name){return true;}
            if (getRouteParser(router._basePath + router.patterns[_name], router._cacheRouteParsers).match(pathname)) {
                throw new Error('Found unreachable route. Url "' + pathname + '" (for route "' + self.name
                    + '" and params ' + JSON.stringify(self.params) + ') matches  "' + _name + '":"'+pattern+'" '
                    + '" first! Try changing the order of the patterns');
            }
        });
        var pathname_params = route_parser.match(pathname);
        var query_params = {};
        _.forEach(self.params, function(value, key){
            if (!(key in pathname_params)){
                query_params[key] = value;
            }
        });
        self.url = pathname + (JSON.stringify(query_params)=='{}' ? '' : '?' + querystring.encode(query_params));
    } else {
        self.url = a;
        self.name = null;
        self.params = null;
        if (_.startsWith(self.url, router._basePath)) {
            _.find(router.patterns, function(pattern, _name){
                var pathname_params = getRouteParser(router._basePath + pattern, router._cacheRouteParsers).match(self.url);
                if (pathname_params){
                    var index = self.url.indexOf('?');
                    var query_params = index == -1 ? {} : querystring.decode(self.url.slice(index+1));
                    self.name = _name;
                    self.params = _.assign({}, query_params, pathname_params);
                    return true;
                }
            });
        }
    }
};
Route.prototype.equals = function(route){
    var self = this;
    return _.isObject(route) && (route.name==self.name) && _.isEqual(route.params, self.params);
};

var ObsRouter = function(patterns, options){
    var self = this;
    if (!(typeof patterns=='object')){throw new Error('ObsRouter constructor expects patterns object as first argument')}
    self.patterns = patterns;
    options = _.assign({}, ObsRouter.defaults, options || {});
    self._cacheRouteParsers = options.cacheRouteParsers;
    self._basePath = options.basePath;
    self._bindToWindow = process.browser ? options.bindToWindow : false;
    if (self._bindToWindow){
        // add to module-scoped list of routers
        routers.push(self);
        // override any url input with window location
        options.url = window.document.location.pathname + window.document.location.search;
    }
    // create Route class for this Router instance
    var Super = self.Route;
    self.Route = function(a, b){
        if (!(this instanceof self.Route)){
            return new self.Route(a, b)
        }
        Super.call(this, self, a, b);
    };
    self.Route.prototype = _.create(Super.prototype);
    // initialise rest of public instance members (route & old_route)
    self.old_route = new self.Route('');
    self.route = new self.Route(options.url);
    // implement initialEmit option
    if (options.initialEmit){
        self._cancel_initial_emit = cancellableNextTick(function(){
            self._emit();
        });
    }
};

ObsRouter.defaults = {
    url: '',
    cacheRouteParsers: true,
    basePath: '/',
    bindToWindow: true,
    initialEmit: true
};

ObsRouter.prototype = _.create(EventEmitter.prototype);
ObsRouter.prototype.Route = Route;

/**
 * Cleanup method to be called when you're done with your ObsRouter instance.
 */
ObsRouter.prototype.destroy = function(){
    this.removeAllListeners();
    if (this._bindToWindow){
        routers = _.without(routers, this);
    }
    if (self._cancel_initial_emit){
        self._cancel_initial_emit()
        delete self._cancel_initial_emit;
    }
};
ObsRouter.prototype.back = function(n){
    this.go(-(n || 1));
};
ObsRouter.prototype.forward = function(n){
    this.go(n || 1);
};
ObsRouter.prototype.go = function(n){
    if (this._bindToWindow){
        process.nextTick(function(){
            History.go(n);
        });
    } else {
        console.warn('ObsRouter#back(), ObsRouter#forward(), and ObsRouter#go() are not implemented ' +
            'for server and only work on browser with bindToWindow option');
    }
};
ObsRouter.prototype.replaceUrl = function(url){
    this._change(new this.Route(url), 'replace');
};
ObsRouter.prototype.replaceRoute = function(a, b){
    this._change(this._resolveRoute(a, b), 'replace');
};
ObsRouter.prototype.replaceParams = function(params, extend){
    this._change(this._resolveParams(params, extend), 'replace')
};
ObsRouter.prototype.pushUrl = function(url){
    this._change(new this.Route(url), 'push')
};
ObsRouter.prototype.pushRoute = function(a, b){
    this._change(this._resolveRoute(a, b), 'push');
};
ObsRouter.prototype.pushParams = function(params, extend){
    this._change(this._resolveParams(params, extend), 'push');
};
ObsRouter.prototype._change = function(route, mode){
    var self = this;
    if (self.route.equals(route)){return;}
    if (self._cancel_initial_emit){
        self._cancel_initial_emit()
        delete self._cancel_initial_emit;
    }
    if (self._bindToWindow){
        switch (mode){
            case 'replace':
                process.nextTick(function() {
                    History.replaceState({}, window.document.title, route.url);
                });
                return;
            case 'push':
                process.nextTick(function() {
                    History.pushState({}, window.document.title, route.url);
                });
                return;
        }
    } else {
        switch (mode){
            case 'replace':
            case 'push':
                process.nextTick(function(){
                    self._update(route);
                });
                return;
        }
    }
    throw new Error('Unrecognized update mode \''+mode+'\'!');
};
ObsRouter.prototype._update = function(route){
    var self = this;
    if (self.route.equals(route)){return console.log('self.route.equals(route)');}
    self.old_route = self.route;
    self.route = route;
    self._emit();
};

ObsRouter.prototype._emit = function(){
    var self = this;
    self.emit('route', self.route, self.old_route);

};
ObsRouter.prototype._resolveRoute = function(a, b){
    var self = this;
    var route;
    if ((typeof a=='object') && (a instanceof self.Route)){
        route = a;
    } else if (_.isObject(a) && _.isString(a.name) && _.isObject(a.params)) {
        route = new self.Route(a.name, a.params);
    } else if ((typeof a=='string') && (!b || (typeof b=='object'))) {
        route = new self.Route(a, b || {});
    } else {
        throw new Error('Expected \'string\' for route name and \'object\' for route parameters (or instance of '
            + 'ObsRouter#Route or other object with \'name\' and \'params\' properties) \r\n'
            + 'Instead received \''+(typeof a)+'\' and \''+(typeof b)+'\'')
    }
    return route;
};
ObsRouter.prototype._resolveParams = function(params, extend){
    var self = this;
    return new self.Route(self.route.name, _.assign({}, extend ? self.route.params : {}, params));
};


module.exports = ObsRouter;
