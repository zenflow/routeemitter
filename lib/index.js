var _ = require('lodash');
var EventEmitter = require('events').EventEmitter;
var cancellableNextTick = require('cancellable-next-tick');
var querystring = require('querystring');
var getRouteParser = require('./util/getRouteParser');
if (process.browser){
    var getDocumentLocation = require('./util/getDocumentLocation');
    var getParentAnchor = require('./util/getParentAnchor');
    var History = require('html5-history');
    var routers = [];
    History.Adapter.bind(window, 'statechange', function(){
        _.forEach(routers, function(router){
            router._update(new router.Route(getDocumentLocation()));
        });
    });
}
var Route = function(a, b){
    var self = this;
    if (!self.router){throw new Error('Route#router must be attached to and inherited from Route.prototype')}
    if (b){
        self.name = a;
        self.params = b;
        var pattern = self.router.patterns[self.name];
        var route_parser = getRouteParser(self.router._patternPrefix + pattern, self.router._cacheRouteParsers);
        var pathname = route_parser.reverse(self.params);
        if (pathname===false){
            throw new Error('Missing required parameter(s) for pattern. \r\nname: ' + JSON.stringify(self.name) + '\r\n' +
                'params: ' + JSON.stringify(self.params)+'\r\npattern: ' + pattern);
        }
        _.find(self.router.patterns, function(pattern, _name){
            if (_name == self.name){return true;}
            if (getRouteParser(self.router._patternPrefix + self.router.patterns[_name], self.router._cacheRouteParsers).match(pathname)) {
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
        self.url = typeof a=='string'?a:(process.browser?getDocumentLocation():'');
        self.name = null;
        self.params = null;
        if (_.startsWith(self.url, self.router._patternPrefix)) {
            _.find(self.router.patterns, function(pattern, _name){
                var pathname_params = getRouteParser(self.router._patternPrefix + pattern, self.router._cacheRouteParsers).match(self.url);
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
Route.prototype.equals = function(a, b){
    var self = this;
    var route = self.router._resolveRoute(a, b);
    return (route.name==self.name) && _.isEqual(route.params, self.params);
};
Route.prototype.isValid = function(){return Boolean(this.name && this.params)};
Route.prototype.isPresent = function(){return (this==this.router.route) || this.equals(this.router.route);};
Route.prototype.replace = function(){return this.router.replaceRoute(this);};
Route.prototype.push = function(){return this.router.pushRoute(this);};
Route.prototype.extend = function(params){return new this.router.Route(this.name, _.assign({}, this.params, params || {}))};
var RouteEmitter = function(patterns, options){
    var self = this;
    if (!(typeof patterns=='object')){throw new Error('RouteEmitter constructor expects patterns object as first argument')}
    self.patterns = patterns;
    options = _.assign({}, RouteEmitter.defaults, options || {});
    self._cacheRouteParsers = options.cacheRouteParsers;
    self._patternPrefix = options.patternPrefix;
    self._bindToWindow = process.browser ? options.bindToWindow : false;
    var url = self._bindToWindow ? getDocumentLocation() : options.url;
    var attachLinkHandler = self._bindToWindow ? options.attachLinkHandler : false;
    if (self._bindToWindow){
        routers.push(self);
    }
    // create Route class for this Router instance
    var Super = self.Route;
    self.Route = function(a, b){
        if (!(this instanceof self.Route)){
            return new self.Route(a, b)
        }
        Super.call(this, a, b);
    };
    self.Route.prototype = _.create(Super.prototype);
    self.Route.prototype.router = self;
    // initialise rest of public instance members (route & last_route)
    self.last_route = new self.Route('');
    self.route = new self.Route(url);
    // implement attachLinkHandler option
    if (attachLinkHandler){
        var super_onclick = typeof window.document.onclick=='function' ? window.document.onclick : function(){};
        window.document.onclick = function(event){
            var next = function (){super_onclick.apply(window.document, arguments);};
            if (self.destroyed){return next();}
            var link = getParentAnchor(event.srcElement);
            if (!link || (link.origin != window.document.location.origin)){return next();}
            try {var route = new self.Route(link.pathname + link.search);}
            catch (error){event.preventDefault(); throw error;}
            if (!route.isValid()){return next();}
            route.push();
            event.preventDefault();
        };
    }
    // implement initialEmit option
    var initial_route = self.route;
    if (options.initialEmit){
        self._cancel_initial_emit = cancellableNextTick(function(){
            if (self.route==initial_route){
                delete self._cancel_initial_emit;
                self._emit();
            } else {
                throw new Error('What? Route changed from initial route but initial emit was not cancelled')
            }
        });
    }
};
RouteEmitter.defaults = {
    url: '',
    cacheRouteParsers: true,
    patternPrefix: '/',
    bindToWindow: true,
    initialEmit: true,
    attachLinkHandler: true
};
RouteEmitter.prototype = _.create(EventEmitter.prototype);
RouteEmitter.prototype.Route = Route;
RouteEmitter.prototype.destroy = function(){
    var self = this;
    self.destroyed = true;
    self.removeAllListeners();
    if (self._bindToWindow){
        routers = _.without(routers, self);
    }
    if (self._cancel_initial_emit){
        self._cancel_initial_emit();
        delete self._cancel_initial_emit;
    }
};
RouteEmitter.prototype.back = function(n){this.go(-(n || 1));};
RouteEmitter.prototype.forward = function(n){this.go(n || 1);};
RouteEmitter.prototype.go = function(n){
    var self = this;
    if (self._bindToWindow){
        process.nextTick(function(){
            History.go(n);
        });
    } else {
        console.warn('RouteEmitter#back(), RouteEmitter#forward(), and RouteEmitter#go() are not implemented ' +
            'for server and only work on browser with bindToWindow option');
    }
};
RouteEmitter.prototype.replaceUrl = function(url){this._change(new this.Route(url), 'replace');};
RouteEmitter.prototype.replaceRoute = function(a, b){this._change(this._resolveRoute(a, b), 'replace');};
RouteEmitter.prototype.pushUrl = function(url){this._change(new this.Route(url), 'push')};
RouteEmitter.prototype.pushRoute = function(a, b){this._change(this._resolveRoute(a, b), 'push');};
RouteEmitter.prototype._change = function(route, mode){
    var self = this;
    if (self.route.equals(route)){return;}
    if (self._cancel_initial_emit){
        self._cancel_initial_emit();
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
RouteEmitter.prototype._update = function(route){
    var self = this;
    if (self.route.equals(route)){return;}
    self.last_route = self.route;
    self.route = route;
    self._emit();
};
RouteEmitter.prototype._emit = function(){
    var self = this;
    self.emit('route', self.route, self.last_route);

};
RouteEmitter.prototype._resolveRoute = function(a, b){
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
            + 'RouteEmitter#Route or other object with \'name\' and \'params\' properties) \r\n'
            + 'Instead received \''+(typeof a)+'\' and \''+(typeof b)+'\'')
    }
    return route;
};
module.exports = RouteEmitter;
