if (!process.browser){throw new Error('this is a client-only module');}
var _ = require('lodash');
var History = require('html5-history');
var routers = [];
var client = {
    bindRouter: function(router){
        routers.push(router);
        attachLinkHandler(router);
    },
    unbindRouter: function(router){
        routers = _.without(routers, router);
        //main script will set router.destroyed = true :p
    },
    go: function(n){
        History.go(n);
    },
    getUrl: function (){
        return window.document.location.pathname + window.document.location.search + window.document.location.hash;
    },
    changeUrl: function(url, mode){
        switch (mode){
            case 'push': History.pushState({}, window.document.title, url); break;
            case 'replace': History.replaceState({}, window.document.title, url); break;
            default: throw new Error('Unrecognized update mode \''+mode+'\'!');
        }
    }
};

History.Adapter.bind(window, 'statechange', function(){
    _.forEach(routers, function(router){
        router._update(new router.Route());
    });
});

function attachLinkHandler(route){
    var super_onclick = typeof window.document.onclick=='function' ? window.document.onclick : function(){};
    window.document.onclick = function(event){
        var next = function (){super_onclick.apply(window.document, arguments);};
        if (router.destroyed || !event){return next();}
        var link = getAnchor(event.srcElement);
        if (!link || (link.origin != window.document.location.origin)){return next();}
        try {var route = new router.Route(link.pathname + link.search);}
        catch (error){event.preventDefault(); throw error;}
        if (!route.isValid()){return next();}
        route.push();
        event.preventDefault();
    };
}
function getAnchor(element, deep){
    if (typeof deep!='number'){
        deep = 16;
    }
    if ((typeof element=='object') && (element instanceof window.Element) && (element.tagName.toLowerCase() == 'a')){
        return element;
    }
    return (deep > 0) && element.parentElement && getAnchor(element.parentElement, deep - 1);
}

module.exports = client;