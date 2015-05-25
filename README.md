[![Build Status](https://travis-ci.org/Producters/express-crawler-snapshots.svg)](https://travis-ci.org/Producters/express-crawler-snapshots)
[![Dependency Status](https://www.versioneye.com/user/projects/5563557e366466001bd00100/badge.svg?style=flat)](https://www.versioneye.com/user/projects/5563557e366466001bd00100)

Express Crawler Snapshots
=====================================
If your website  is javascript heavy - it's built using angular, ember, tons of jquery or similar - it renders most or all of it's content using javascript & ajax. This means that javascript-challenged search engine bots don't see much when crawling it.

This is express.js middleware that fixes the problem by intercepting search engine bot requests, rendering the page fully on the server using phantomjs, executing any javascript and returning resulting html. This way bots get to see the full content of the website as if it was static html.

# Features

* Phantomjs process pooling
* Request queuing when no phantomjs instances are immediately available
* Automatic search engine bot detection via user agent string
* '_escaped_fragment_' semantics support
* Forced timeout for phantomjs page renders

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
timeout      | 2000          | ms, how long to wait for page to load on a phantomjs instance
delay        |  200          | ms, how long to wait for javascript to settle on the page
snapshotTrigger| 'snapshot'  | string, query param, which if present, will trigger static page render
agents       |see source     | list of UA strings for crawler bots
shouldRender | snapshot trigger found in query params OR user agent matches one of the agents OR _escaped_fragment_ fonund in query params | function(req, options) { return bool;}
protocol     | same as request | string, 'http' or 'https'
domain       | same as request | string. Use this if you want phantomjs to call 'localhost'
maxInstances | 1               | max number of phantomjs instances to use
logger       | console         | console-like object that implements 'log', 'warn', 'error' method. Set to null for silent operation

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
