var phantom = require('phantom');

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

function CrawlerSnapshotsError(message) {
  this.name = 'MyError';
  this.message = message || 'Default Message';
}
CrawlerSnapshotsError.prototype = Object.create(Error.prototype);
CrawlerSnapshotsError.prototype.constructor = CrawlerSnapshotsError;

var SETTINGS = {
    timeout: 2000, //how long to wait for page to load
    delay: 200, //how long to wait for initial javascript to settle
    snapshotTrigger: 'snapshot', //query param to trigger snapshot render on
    agents: ['Googlebot', 'Baiduspider', 'ia_archiver',
        'R6_FeedFetcher', 'NetcraftSurveyAgent', 'Sogou web spider',
        'bingbot', 'Yahoo! Slurp', 'facebookexternalhit', 'PrintfulBot',
        'msnbot', 'Twitterbot', 'UnwindFetchor', 'YandexBot', 'DuckDuckBot',
        'Ask Jeeves', 'urlresolver', 'Butterfly', 'TweetmemeBot'
    ], //user agents to trigger snapshot render on
    shouldRender: shouldRender, //function that determines wether to render snapshot
    protocol: null, // 'http' or 'https', by default same as initial request
    host: null,  //domain, by default same as initial request. this is where you can put 'localhost'
    maxInstances: 1
}


var expressCrawlerSnapshots = function expressCrawlerSnapshots(options) {

    var queue = [], available_instances = [], instances_engaged = 0;

    //set defaults
    options = options || {};

    var log = options.log || function (msg) {
        console.log(msg);
    };

    Object.keys(SETTINGS).forEach(function (key) {
        if (!options.hasOwnProperty(key)) {
            options[key] = SETTINGS[key];
        }
    });


    function makeUrl(req) {
        //construct url that will be called by phantomjs
        var url = (options.protocol || req.protocol) + '://' + (options.host || req.get('host'));
        if (req.query._escaped_fragment_) {
            url += req.query._escaped_fragment_;
        } else {
            url += req.originalUrl;
            if (options.snapshotTrigger && url.indexOf(options.snapshotTrigger + '=') != -1) {
                url = url.replace(options.snapshotTrigger + '=', '_' + options.snapshotTrigger + '=');
            }
        }
        return url;
    }

    function renderNext() {
        if (queue.length) {
            log("processing next snapshot from queue");
            getPhantomInstance(queue.shift());
        }
    }

    function _getPhantomInstance(cb) {
        if (available_instances.length) {
            var ph = available_instances.shift();
            ph._released = false;
            cb(ph);
        } else { 
            log('starting new phantom instance...');

            phantom.create("--web-security=no", "--ignore-ssl-errors=yes", 
                { 
                    onExit: function () {
                        log("phantomjs exited before fully starting");
                        instances_engaged --;
                        cb(null, new CrawlerSnapshotsError("Phantom failed to start"));
                    }
                }, 
                function (ph, err) {
                    if (err) {
                        instances_engaged --;
                        log("faield to start phantom instance");
                        cb(null, new CrawlerSnapshotsError('Faield to start phantom instance: ' + err));
                        renderNext();
                    } else {
                        ph._released = false;
                        ph._number = instances_engaged;
                        log('phantom #' + ph._number +' started');
                        ph._release = function () {
                            if (!this._released) {
                                log('releasing phantom instance #' + ph._number);
                                this._released = true;
                                available_instances.push(this);
                                instances_engaged --;
                                if(instances_engaged < 0) {
                                    console.log('shiiit');

                                }
                                renderNext();
                            }
                        }
                        ph._destroy = function (noexit) {
                            if (!this._released) {
                                log('destroying phantom instance #' + ph._released);
                                this._released = true;
                                instances_engaged --;
                                available_instances = available_instances.filter( function(inst) {
                                    return inst !== this;
                                }, this);
                                if (!noexit) {
                                    this.exit();
                                }
                                renderNext();
                            }
                        }

                        ph.onExit = function () {
                            log('phantom instance #' + ph._number + ' terminated');
                            ph._destroy(true);
                        }

                        cb(ph, null);
                    }
                }
            );
        }
    }

    function getPhantomInstance(cb) {
        if (instances_engaged < options.maxInstances) {
            instances_engaged ++;
            log("rendering immediately");
            _getPhantomInstance(cb);
        } else {
            log("queuing render");
            queue.push(cb);
        }
    }

    function evalPage() {

        //disable all scripts;
        var scripts = document.getElementsByTagName('script');
        for (var i = 0, script; script = scripts[i++];) {
            script.parentNode.removeChild(script);
        }
        return document.documentElement.innerHTML;
    }

    function renderSnapshot(url, cb) {
        log("render snapshot for url " + url + " started");
        getPhantomInstance(function (ph, err) {
            if(err) {
                cb(null, err);
                return;
            }
            var returned = false,
                timeout = setTimeout(function () {
                log('ph instance #' + ph._number + ' timed out! killing it');
                ph._destroy();
                cb(null, new CrawlerSnapshotsError("Phantom intance timed out")),
                returned = true;
            }, options.timeout);

            ph.createPage(function (page) {
                page.open(url, function (status) {
                    if (returned) {
                        return;
                    }
                    if (status !== 'success') {
                        log('ph instance #' + ph._number + ' received status ' + status + ' for url ' + url);
                        cb(null, new CrawlerSnapshotsError('Bad status: ' +status));
                    } else {
                        setTimeout(function () {
                            if (returned) {
                                return;
                            }
                            page.evaluate(evalPage, function (result) {
                                log('instance #' + ph._number + ' succesfully rendered snapshot for url ' + url);
                                clearTimeout(timeout);
                                ph._release();
                                cb(result, null);
                            });
                        }, options.delay);
                    }
                });
            });
        });
    }

   return function expressCrawlerSnapshotsMiddleware(req, res, next) {
        if (options.shouldRender(req, options)) {
            renderSnapshot(makeUrl(req), function(html, err) {
                log('render snapshot complete', err);
                if (err) {
                    next(err);
                } else {
                    res.send(html);
                }
            });
        } else {
            next();
        }
    };
};

module.exports = expressCrawlerSnapshots;
module.exports.CrawlerSnapshotsError = CrawlerSnapshotsError;