var Pool = require('./lib/pool'),
    Instance = require('./lib/instance'),
    querystring = require('querystring'),
    Promise = require('bluebird');

var shouldRender = function shouldRender (req, options) {
    if (req.query._escaped_fragment_) {
        return true;
    }
    if (options.snapshotTrigger && req.query[options.snapshotTrigger]) {
        return true;
    }
    var ua = req.headers['user-agent'];
    if (ua && options.agents && options.agents.length) {
        for ( var i = 0, agent; agent = options.agents[i++];) {
            if (ua.indexOf(agent) !== -1) {
                return true;
            }
        }
    }
    return false;
}

var makeUrl = function makeUrl(req, options) {
        //construct url that will be called by phantomjs

        //base url
        var url = (options.protocol || req.protocol) + '://' + (options.host || req.get('host'));

        //handle escaped fragment
        if (req.query._escaped_fragment_) {
            var params = JSON.parse(JSON.stringify(req.query));
            delete params._escaped_fragment_;
            params = querystring.stringify(params);
            url += req.path + (params ? '?' + params : '') + "#!" +  querystring.unescape(req.query._escaped_fragment_);

        //else, just remove snapshot trigger if present
        } else {
            url += req.originalUrl;
            if (options.snapshotTrigger && url.indexOf(options.snapshotTrigger + '=') != -1) {
                url = url.replace(options.snapshotTrigger + '=', '_' + options.snapshotTrigger + '=');
            }
        }
        return url;
    }

var SETTINGS = {
    timeout: 10000, //how long to wait for page to load
    delay: 300, //how long to wait for initial javascript to settle
    snapshotTrigger: 'snapshot', //query param to trigger snapshot render on
    agents: ['Googlebot', 'Baiduspider', 'ia_archiver',
        'R6_FeedFetcher', 'NetcraftSurveyAgent', 'Sogou web spider',
        'bingbot', 'Yahoo! Slurp', 'facebookexternalhit', 'PrintfulBot',
        'msnbot', 'Twitterbot', 'UnwindFetchor', 'YandexBot', 'DuckDuckBot',
        'Ask Jeeves', 'urlresolver', 'Butterfly', 'TweetmemeBot',
        'Google (+https://developers.google.com/+/web/snippet/)' //google +
    ], //user agents to trigger snapshot render on
    shouldRender: shouldRender, //function that determines wether to render snapshot\\
    makeUrl: makeUrl,
    protocol: null, // 'http' or 'https', by default same as initial request
    host: null,  //domain, by default same as initial request. this is where you can put 'localhost'
    maxInstances: 1,
    attempts: 1,
    loadImages: true,
    maxPageLoads: 100,
    logger: console,
    cache: null
}


var expressCrawlerSnapshots = function expressCrawlerSnapshots(options) {

    options = options || {};

    Object.keys(SETTINGS).forEach(function (key) {
        if (!options.hasOwnProperty(key)) {
            options[key] = SETTINGS[key];
        }
    });

    var pool = new Pool(options.maxInstances, options);
    expressCrawlerSnapshots._pools.push(pool);

    if (options.cache) {
        console.warn('caching disabled due to lib problem, write me if you need it');
    }

    function log() {
        if (options.logger) {
            options.logger.info.apply(options.logger, arguments);
        }
    }

    var middleware = function expressCrawlerSnapshotsMiddleware(req, res, next) {
        if (options.shouldRender(req, options)) {
            if (options.logger) {
                options.logger.info("intercepted bot request by [" + req.headers['user-agent'] + "]");
            }

            var attempt = 1,
                url = options.makeUrl(req, options);

            function tryRender() {
                pool.getInstance(function (instance, err){
                    if (err) {
                        next(err);
                    } else {
                        instance.renderPage(url, function (result, err) {
                            if (err) {

                                if (attempt < options.attempts) {
                                    log("attempt #"  + attempt + " to render " + url + " failed: ", err && err.message ? err.message : err, " trying again...");
                                    attempt += 1;
                                    tryRender();
                                } else {
                                    next(err);
                                }
                            } else {
                                res.send(result);
                            }
                        });
                    }
                });
            }

            tryRender();
        } else {
            next();
        }
    };

    middleware._pool = pool;
    return middleware;
};

expressCrawlerSnapshots._pools = [];

expressCrawlerSnapshots.killAllInstances = function () {
    return Promise.all(this._pools.map(function (pool) {
        return pool.killAllInstances();
    }));
};

process.on('exit', function () {
    expressCrawlerSnapshots.killAllInstances();
});

module.exports = expressCrawlerSnapshots;