[![Build Status](https://travis-ci.org/Producters/express-crawler-snapshots.svg)](https://travis-ci.org/Producters/express-crawler-snapshots)
[![Dependency Status](https://www.versioneye.com/user/projects/5563557e366466001bd00100/badge.svg?style=flat)](https://www.versioneye.com/user/projects/5563557e366466001bd00100)

Express Crawler Snapshots
=====================================
This is express.js middleware that intercepts requests coming from search engine crawler bots, renders the requested page & executes javascript on the server using phantomjs and returns rendered static html.  
It is intended for use on javascript heavy websites, where some or all content is rendered by javascript. Most search engine bots don't execute javascript, so in order for them to index the entire content we need to render it server side.

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


# Test

```sh
npm test
```

Todo: test failure scenarios, stress tests
