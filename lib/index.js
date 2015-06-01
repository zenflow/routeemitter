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
        var route_parser = getRouteParser(router.patterns[self.name], self._cacheRouteParsers);
        var pathname = route_parser.reverse(self.params);
        if (pathname===false){throw new Error('Missing required parameter(s) for route');}
        _.find(router.patterns, function(pattern, _name){
            if (_name == self.name){return true;}
            if (getRouteParser(router.patterns[_name], self._cacheRouteParsers).match(pathname)) {
                throw new Error('Found unreachable route. Url "' + pathname + '" (for route "' + self.name
                    + '" and params ' + JSON.stringify(self.params) + ') matches route "' + _name
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
        self.url =  pathname + (JSON.stringify(query_params)=='{}' ? '' : '?' + querystring.encode(query_params));
    } else {
        self.url = a;
        self.name = null;
        self.params = null;
        _.find(router.patterns, function(pattern, _name){
            var pathname_params = getRouteParser(pattern, self._cacheRouteParsers).match(self.url);
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
Route.prototype.equals = function(route){
    var self = this;
    return (self.name==route.name) && _.isEqual(self.params, route.params);
};

var ObsRouter = function(patterns, options){
    var self = this;
    if (!(typeof patterns=='object')){throw new Error('ObsRouter constructor expects patterns object as first argument')}
    self.patterns = patterns;
    options = options || {};
    self._cacheRouteParsers = 'cacheRouteParsers' in options ? options.cacheRouteParsers : true;
    self._bindToWindow = process.browser ? ('bindToWindow' in options ? options.bindToWindow : true) : false;
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
    self.route = new self.Route(options.url || '');
    // implement initialEmit option
    if ('initialEmit' in options ? options.initialEmit : true){
        var cancel = cancellableNextTick(function(){
            self._emit();
        });
        self.once('url', cancel);
    }
};

ObsRouter.prototype = _.create(EventEmitter.prototype);

/**
 * Cleanup method to be called when you're done with your ObsRouter instance.
 */
ObsRouter.prototype.destroy = function(){
    this.removeAllListeners();
    if (this._bindToWindow){
        routers = _.without(routers, this);
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
        History.go(n);
    } else {
        console.warn('ObsRouter#back(), ObsRouter#forward(), and ObsRouter#go() only work on browser with bindToWindow option');
    }
};
ObsRouter.prototype.replaceUrl = function(url){
    this._update(new this.Route(url), 'replace');
};
ObsRouter.prototype.replaceRoute = function(a, b){
    this._update(this._resolveRoute(a, b), 'replace');
};
ObsRouter.prototype.replaceParams = function(params, extend){
    this._update(this._resolveParams(params, extend), 'replace')
};
ObsRouter.prototype.pushUrl = function(url){
    this._update(new this.Route(url), 'push')
};
ObsRouter.prototype.pushRoute = function(a, b){
    this._update(this._resolveRoute(a, b), 'push');
};
ObsRouter.prototype.pushParams = function(params, extend){
    this._update(this._resolveParams(params, extend), 'push');
};
ObsRouter.prototype.Route = Route;

ObsRouter.prototype._update = function(route, mode){
    var self = this;
    if (self.route.equals(route)){return;}
    if (self._bindToWindow && mode){
        switch (mode){
            case 'replace': History.replaceState({}, window.document.title, route.url); return;
            case 'push': History.pushState({}, window.document.title, route.url); return;
            default: throw new Error('Unrecognized update mode \''+mode+'\'!');
        }
    }
    self.old_route = self.route;
    self.route = route;
    self._emit();
};

ObsRouter.prototype._emit = function(){
    var self = this;

};
ObsRouter.prototype._resolveRoute = function(a, b){
    var self = this;
    var route;
    if (a instanceof self.Route){
        route = a;
    } else if (a instanceof Route){
        route = new self.Route(a.name, a.params);
    } else if ((typeof a=='string') && (!b || (typeof b=='object'))) {
        route = new self.Route(a, b || {});
    } else {
        throw new Error('Expected \'string\' for route name and \'object\' for route parameters (or instance of either '
            + 'ObsRouter#Route or router.Route) \r\nInstead received \''+(typeof a)+'\' and \''+(typeof b)+'\'')
    }
    return route;
};
ObsRouter.prototype._resolveParams = function(params, extend){
    var self = this;
    return new self.Route(self.route.name, _.assign({}, extend ? self.route.params : {}, params));
};


module.exports = ObsRouter;
