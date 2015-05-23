Express Crawler Snapshots
=====================================
Express.js middleware that detects search engine bot requests and pre-renders the page on the server using phantomjs, executing any javascript and returning fully rendered static html.  
Intended for apps where content is rendered primarily using javascript (eg, angular, ember, react based frontend) to make sure that bots get to see the entire content.  

# Features

* Phantomjs process pooling
* Request queuing when no phantomjs instances are immediately available
* Automatic search engine bot detection via user agent string
* '_escaped_fragment_' semantics support
* Forced timeout for phantomjs page renders


# Requirements

Phantomjs 1.3+. "phantomjs" binary must be available on sys path

# Usage

```javascript

var crawlerSnapshots = require('express-crawler-snapshots');

var app = express();

//make sure you include the middleware before route handlers
app.use(crawlerSnapshots(/*{options}*/));

app.use('/', require('./routes'));
```

# Options

Option       |  Default      | Decription
-------------|---------------|------------
timeout      | 2000          | ms, how long to wait for page to load on a phantomjs instance
delay        |  200          | ms, how long to wait for javascript to settle on the page
snapshotTrigger| 'snapshot'  | string, query param, which if present, will trigger static page render
agents       |see source     | list of UA strings for crawler bots
shouldRender | snapshot trigger found in query params OR user agent matches one of the agents OR _escaped_fragment_ fonund in query params | function(req, options) { return bool;}
protocol     | same as request | string, 'http' or 'https'
domain       | same as request | string. Use this if you want phantomjs to call 'localhost' for example
maxInstances | 1               | max number of phantomjs instances to use
logger       | console         | console-like object that implements 'log', 'warn', 'error' method. Set to null for silent operation


# Test

TODO  