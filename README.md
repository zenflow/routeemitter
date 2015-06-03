# routeemitter
(a) abstract urls as named `Route`s with parameters, given a set of named url patterns (b) track a 'prev_route' & [current] 'route', optionally (and by default) bind to document location, and exposing interface for changing said route.

[![build status](https://travis-ci.org/zenflow/routeemitter.svg?branch=master)](https://travis-ci.org/zenflow/routeemitter?branch=master)
[![dependencies](https://david-dm.org/zenflow/routeemitter.svg)](https://david-dm.org/zenflow/routeemitter)
[![dev-dependencies](https://david-dm.org/zenflow/routeemitter/dev-status.svg)](https://david-dm.org/zenflow/routeemitter#info=devDependencies)

[![npm](https://nodei.co/npm/routeemitter.svg?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/routeemitter)

## installation

```
npm install --save routeemitter
```

## example

```js
var RouteEmitter = require('routeemitter');
var presenter = require('./presenter');
var api = require('./api');

var router = new RouteEmitter({
    home: '/',
    blog: '/blog(/tag/:tag)(/:slug)',
    contact: '/contact'
}, {});

router.on('route', function(route, old_route){
    presenter.updatePage(route, old_route);
    if (route.name=='blog'){
        if (route.params.tag){
            api.getBlogsByTag(route.params.tag).then(function(blogs){
                presenter.updateBlogList(blogs);
            });
        }
        if (route.params.slug){
            api.getBlogBySlug(route.params.tag).then(function(blog){
                presenter.updateCurrentBlog(blog);
            });
        }
    }
});

// pardon the jquery syntax :p anyone know a good micro module to subscribe to delegated dom events?
$('body').on('click', 'a', function(event){
    router.pushRoute(this.pathname+this.search+this.hash); // TODO: include some sugar method for this concatenation
    event.preventDefault()
});
```

## changelog

### 0.1.0
- Initial release as RouteEmitter