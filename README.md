# routeemitter
Isomorphic url router to (a) abstract urls as `Route`s, and (b) track and manipulate a "current" route, optionally (and by default) binding to document location on browser

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
}, {/* options... */});

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

```

## changelog

### 0.1.0
- Initial release as RouteEmitter