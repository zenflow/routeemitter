var ObsRouter = require('../../lib');
var dummy = {
    patterns: {
        home: '/',
        a: '/a',
        b: '/b(/:x)',
        c: '/c/:x/c',
        notfound: '*path'
    },
    getRouter: function(bindToWindow){
        return new ObsRouter(dummy.patterns, {bindToWindow: bindToWindow});
    }
};
module.exports = dummy;