var RouteParser = require('route-parser');

var route_parser_cache = {};
var getRouteParser = function(pattern, cache){
    if (pattern in route_parser_cache){
        return route_parser_cache[pattern];
    }
    try {
        var route_parser = new RouteParser(pattern);
    } catch (error){
        throw new Error('Could not parse url pattern "' + pattern + '": ' + error.message);
    }
    if (cache){
        route_parser_cache[pattern] = route_parser;
    }
    return route_parser;
};

module.exports = getRouteParser;