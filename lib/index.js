var _ = require('lodash');
var EventEmitter = require('events').EventEmitter;
var querystring = require('querystring');
var getRouteParser = require('./util/getRouteParser');
var client = process.browser ? require('./client') : undefined;
var Route = function(a, b){
    var self = this;
    if (!self.router){throw new Error('Route.prototype.router not found')}
    if (_.isObject(a) && _.isString(a.name) && _.isObject(a.params)){
        self._initByNameAndParams(a.name, a.params);
    } else if (_.isObject(a) && _.isString(a.pathname) && _.isString(a.search) && _.isString(a.hash)){
        self._initByUrl(a.pathname + a.search + a.hash);
    } else if (_.isString(a) && _.isUndefined(b)){
        self._initByUrl(a);
    } else if (_.isString(a) && _.isObject(b)){
        self._initByNameAndParams(a, b);
    } else if (_.isUndefined(a)){
        self._initByUrl(process.browser ? client.getUrl() : '');
    } else {
        throw new Error('invalid Route constructor arguments');
    }
};
Route.prototype._initByUrl = function(url){
    var self = this;
    self.url = url;
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
};
Route.prototype._initByNameAndParams = function(name, params){
    var self = this;
    self.name = name;
    self.params = params;
    var pattern = self.router.patterns[name];
    var route_parser = getRouteParser(self.router._patternPrefix + pattern, self.router._cacheRouteParsers);
    var pathname = route_parser.reverse(params);
    if (pathname===false){
        throw new Error('Missing required parameter(s) for pattern. \r\nname: ' + JSON.stringify(name) + '\r\n' +
            'params: ' + JSON.stringify(params)+'\r\npattern: ' + pattern);
    }
    _.find(self.router.patterns, function(pattern, _name){
        if (_name == name){return true;}
        if (getRouteParser(self.router._patternPrefix + self.router.patterns[_name], self.router._cacheRouteParsers).match(pathname)) {
            throw new Error('Found unreachable route. Url "' + pathname + '" (for route "' + name
                + '" and params ' + JSON.stringify(params) + ') matches  "' + _name + '":"'+pattern+'" '
                + '" first! Try changing the order of the patterns');
        }
    });
    var pathname_params = route_parser.match(pathname);
    var query_params = {};
    _.forEach(params, function(value, key){
        if (!(key in pathname_params)){
            query_params[key] = value;
        }
    });
    self.url = pathname + (JSON.stringify(query_params)=='{}' ? '' : '?' + querystring.encode(query_params));
};
Route.prototype.equals = function(a, b){
    var self = this;
    if (_.isObject(a) && _.isString(a.name) && _.isObject(a.params)){
        return (a.name==self.name) && _.isEqual(a.params, self.params);
    } else if (_.isObject(a) && _.isString(a.pathname) && _.isString(a.search) && _.isString(a.hash)){
        return (a.pathname + a.search + a.hash) == self.url;
    } else if (_.isString(a) && _.isUndefined(b)){
        return a == self.url;
    } else if (_.isString(a) && _.isObject(b)){
        return (a==self.name) && _.isEqual(b, self.params);
    } else {
        throw new Error('invalid Route#equals() arguments');
    }
};
Route.prototype.isValid = function(){return Boolean(this.name && this.params)};
Route.prototype.isPresent = function(){return this.equals(this.router.route);};
Route.prototype.replace = function(){return this.router.replace(this);};
Route.prototype.push = function(){return this.router.push(this);};
Route.prototype.extend = function(params){return new this.router.Route(this.name, _.assign({}, this.params, params || {}))};
var RouteEmitter = function(patterns, options){
    var self = this;
    if (!(typeof patterns=='object')){throw new Error('RouteEmitter constructor expects patterns object as first argument')}
    self.patterns = patterns;
    // process options
    options = _.assign({}, RouteEmitter.defaults, options || {});
    self._cacheRouteParsers = options.cacheRouteParsers;
    self._patternPrefix = options.patternPrefix;
    var initialEmit = options.initialEmit;
    self._bindToDocument = process.browser && options.bindToDocument;
    var url = self._bindToDocument && client.getUrl() || options.url;
    // initialise
    if (self._bindToDocument){client.bindRouter(self);}
    self.Route = self._getRouteClass(self.Route);
    self.last_route = null;
    self.route = new self.Route(url);
    if (initialEmit){
        process.nextTick(function(){
            if (self.last_route){return;} //location already changed and triggered initial emit
            if (self.route.url!=url){throw new Error('url unexpectedly changed');} //***
            if (self._bindToDocument && (client.getUrl()!=url)){throw new Error('Document location changed??');}//***
            //console.log('initialEmit');
            self._emit();
        });
    }
};
RouteEmitter.defaults = {
    url: '',
    cacheRouteParsers: true,
    patternPrefix: '/',
    initialEmit: true,
    bindToDocument: true
};
RouteEmitter.prototype = _.create(EventEmitter.prototype);
RouteEmitter.prototype.Route = Route;
RouteEmitter.prototype.replace = function(a, b){this._change('replace', a, b);};
RouteEmitter.prototype.push = function(a, b){this._change('push', a, b);};
RouteEmitter.prototype.back = function(n){this.go(-(n || 1));};
RouteEmitter.prototype.forward = function(n){this.go(n || 1);};
RouteEmitter.prototype.go = function(n){
    var self = this;
    if (!self._bindToDocument){
        throw new Error('RouteEmitter#back(), RouteEmitter#forward(), and RouteEmitter#go() are not implemented ' +
            'for server (yet) and only work on browser with bindToDocument option');
    }
    client.go(n);
};
RouteEmitter.prototype.destroy = function(){
    var self = this;
    self.destroyed = true;
    self.removeAllListeners();
    if (self._bindToDocument){client.unbindRouter(self);}
};
RouteEmitter.prototype._change = function(mode, a, b){
    var self = this;
    var route = self._resolveRoute(a, b);
    if (self.route.equals(route)){return;}
    if (self._bindToDocument){
        client.change(mode, route)
    } else {
        self._update(route);
    }
};
RouteEmitter.prototype._update = function(route){
    var self = this;
    if (self.route.equals(route)){throw new Error('No update to be made to [current] route');}
    self.last_route = self.route;
    self.route = route;
    self._emit();
};
RouteEmitter.prototype._emit = function(){
    var self = this;
    //console.log('_emit');
    self.emit('route', self.route, self.last_route);
};
RouteEmitter.prototype._resolveRoute = function(a, b){
    return _.isObject(a) && (a instanceof this.Route) ? a : new this.Route(a, b);
};
RouteEmitter.prototype._getRouteClass = function(Super){
    var self = this;
    var Route = function(a, b){
        if (!(this instanceof Route)){
            return new self.Route(a, b);
        }
        Super.call(this, a, b);
    };
    Route.prototype = _.create(Super.prototype);
    Route.prototype.router = self;
    return Route;
};

module.exports = RouteEmitter;
