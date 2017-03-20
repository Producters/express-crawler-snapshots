[![Build Status](https://travis-ci.org/Producters/express-crawler-snapshots.svg)](https://travis-ci.org/Producters/express-crawler-snapshots)
[![Dependency Status](https://www.versioneye.com/user/projects/5563557e366466001bd00100/badge.svg?style=flat)](https://www.versioneye.com/user/projects/5563557e366466001bd00100)

Express Crawler Snapshots
=====================================

The purpose of this express middleware is to pre-render javascript heavy pages for crawlers that can't do execute javacript on their own. It is intended as a drop-in solution with minimal configuration.  

It detects search engine crawler requests by inspect User-Agent header and proxies their requests to a phantomjs instance. Phantomjs render the page fully including any async javascript and resulting static html is proxied back to the crawler.  

Please note, if you use html5 history (no hashbangs) in your application, don't add a `<meta name="fragment" content="!">` tag for this to work correctly.


# Features

* Phantomjs process pooling
* Request queuing when no phantomjs instances are immediately available
* Automatic search engine bot detection via user agent string
* '_escaped_fragment_' semantics support
* Forced timeout for phantomjs page renders
* Optional caching

# Requirements

Phantomjs 1.3+. "phantomjs" binary must be available on sys path. See http://phantomjs.org/download.html for download & install instructions

# Install

```sh
npm install express-crawler-snapshots --save
```

# Use
Just add it as express middleware, before route handlers
```javascript

var crawlerSnapshots = require('express-crawler-snapshots');

var app = express();

//make sure you include the middleware before route handlers
app.use(crawlerSnapshots(/* {options} */));

app.use('/', require('./routes'));
```
Once that is done, open  http://yourapp.com/?snapshot=true and view source to verify that it's working

# Options

Option       |  Default      | Decription
-------------|---------------|------------
timeout      | 10000          | ms, how long to wait for page to load on a phantomjs instance
delay        |  200          | ms, how long to wait for javascript to settle on the page
snapshotTrigger| 'snapshot'  | string, query param, which if present, will trigger static page render
agents       |see source     | list of UA strings for crawler bots
shouldRender | snapshot trigger found in query params OR user agent matches one of the agents OR _escaped_fragment_ fonund in query params | function(req, options) { return bool;}
protocol     | same as request | string, 'http' or 'https'
domain       | same as request | string. Use this if you want phantomjs to call 'localhost'
maxInstances | 1               | max number of phantomjs instances to use
logger       | console         | object that implements 'info', 'warn', 'error' methods. Set to null for silent operation
attempts     | 1               | number of attempts to render a page, in case phantomjs crashes or times out. Set to > 1 if phantomjs is unstable for you
loadImages   | true            | should phantom load images. Careful: there's a mem leak with older versions of QT: https://github.com/ariya/phantomjs/issues/11390  
maxPageLoads | 100               | if > 0, will kill phantomjs instance after x pages is loaded. Useful to work around mem leaks
phantomConfig| {}               | an object which will be passed as config to PhantomJS

# Kill all phantom instances programtically

In some rare cases you might want to kill all phantomjs instances programatically. For example, a http server won't close if it's serving an app that has this middleware active and some phantomjs instances spawned - the instances are holding onto open connections.

```javascript
var crawlerSnapshots = require('express-crawler-snapshots');
crawlerSnapshots.killAllInstances.then(function() {
   // done
});
```

# What it does

1. Request passing through middleware is inspected. If it either: contains search engine bot's user agent string, contains 'snaphsot' query param or contains '_escaped_fragment_' query param
2. Url is edited: if it contains 'snapshot' parameter, it is removed; if it contains '_escaped_fragment_' parameter, it is transformed as per google spec to use "#!"
3. A phantomjs instance is retrieved from pool; If none are available, request is queued until one becomes available after a previous request completes
4. Phantomjs renders the page
5. &lt;script&gt; tags are removed to prevent being execute again by however consumes the result
6. Resulting html is written to response, phantomjs instance is released to pool

# Phantomjs process management

New phantomjs processes are started when a bot requests comes in, number of active phantomjs processes is < maxInstanes and all active processes are currently rendering a page.   
If maxInstances is reached, all phantomjs instances are busy and a new request comes in, the request is queued untll a phantomjs instance becomes available. Queue operates on first in, first out basis.  
If a phantomjs process is killed from outside/dies, it's handled cleaned up gracefully and will be replaced with next request - feel free to kill them on whim :)  
There's a hard timeout on opening a page and rendering content. If timeout is reached and render is still not complete, phantomjs instance is assumed toe be fubar and is forcefully killed.  
Note that if an error happens while rendering a page, currently there are no retries - midleware produces an error.

# Test

```sh
npm test
```
