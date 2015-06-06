var RouteEmitter = require('../../lib');
var _ = require('lodash');
var dummy = {
    patterns: {
        home: '',
        a: 'a',
        b: 'b(/:x)',
        c: 'c/:x/c',
        notfound: '*path'
    },
    urls: ['/a', '/b/asf', '/c/c/c', '/c/c/c?f=1', '/c/c/c/c', '/?asd=asd'],
    routes: [
        {name: 'a', params: {}},
        {name: 'b', params: {x: 'asf'}},
        {name: 'c', params: {x: 'c'}},
        {name: 'c', params: {x: 'c', f: '1'}},
        {name: 'notfound', params: {path: 'c/c/c/c'}},
        {name: 'home', params: {asd: 'asd'}}
    ],
    getRouter: function(options){
        return new RouteEmitter(dummy.patterns, _.assign({}, {
            bindToDocument: false
        }, options || {}));
    }
};
module.exports = dummy;