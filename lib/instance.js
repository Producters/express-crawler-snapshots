var CrawlerSnapshotsError = require('./exception'),
    Promise = require('bluebird');

var DEFAULT_DELAY = 200,
    DEFAULT_TIMEOUT = 10000,
    EVAL_PAGE_FN = function evalPage() {

        //disable all scripts;
        var scripts = document.getElementsByTagName('script');
        for (var i = scripts.length -1; i >= 0; i--) {
            scripts[i].parentNode.removeChild(scripts[i]);
        }
        return document.documentElement.outerHTML;
    };


var Instance = module.exports = function Instance(ph, pool, number, opts) {

    this.pageLoads = 0;
    this.ph = ph;
    this.pool = pool;
    this.number = number;
    this.opts = opts;
    this.exited = false;
    this._page = ph.createPage();
    this._cb = null;
    var self = this;

    //fix problem when killing process
    // https://github.com/peerigon/phridge/issues/34
    ph.childProcess.stdin.on('error', function (err) {
        if (err.code === 'ECONNRESET') return;
        throw err;
    });

    ph.childProcess.cleanStdout.on('data', function(data) {
        self.log('info', 'stdout: ' + data);
    });

    ph.childProcess.on('exit', function () {
        /* 
        fixes for phridge problems, remove when prhidge fixed 
        https://github.com/peerigon/phridge/pull/37
        */
        clearTimeout(ph._pingTimeoutId);
        Object.keys(ph._pendingDeferreds).forEach(function (id) {
            this._pendingDeferreds[id].reject(new Error("Phantomjs process exited"));
        }, ph);
        /* end fixes */

        this.onExit();
    }.bind(this));
}

module.exports = Instance;

Instance.prototype.log = function (level, msg) {
    var msg = "phantomjs instance " + this.number + ": " + msg;
    if (this.opts.logger && this.opts.logger[level]) {
        this.opts.logger[level](msg);
    }
};

Instance.prototype.onExit = function () {
    this.pool.removeInstance(this);
    this.exited = true;
    this.log('info', 'process exited');
    if (this._cb) {
        this.log('error', 'process unexpectedly exited while a render was in progress');
    }
    this.returnResult(null, new CrawlerSnapshotsError("phantomjs instance " + this.number +" exited without finishing render"));
};

Instance.prototype.returnResult = function (result, error) {
    if (this._cb) {
        this._cb(result, error);
        this._cb = null;
    }
};

Instance.prototype.release = function () {
    if (this.opts.maxPageLoads && this.pageLoads >= this.opts.maxPageLoads) {
        this.log('info', 'reached max page loads, exiting');
        this.exit();
    } else {
        this.log('info', 'released');
        this.pool.releaseInstance(this);
    }
};

Instance.prototype.exit = function () {
    if (this.exited) {
        return Promise.resolve();
    } else {
        this.exited = true;
        return this.ph.dispose();
    }
};

Instance.prototype.evalPage = function (cb) {
    this._page.evaluate(this.opts.evalPageFn || EVAL_PAGE_FN, cb);
};

Instance.prototype.renderPage = function (url, cb) {
    this.log('info', 'opening ' + url);
    this._cb = cb;
    var self = this,
        timed_out = false;
        timeout = setTimeout(function () {
            if (self.exited) {
                return;
            }
            self.log('error', 'timed out while opening ' + url);
            self.returnResult(null, new CrawlerSnapshotsError(self.number + " timed out while opening " + url));
            self.exit();
            timed_out = true;
        }, this.opts.timeout || DEFAULT_TIMEOUT);

    this._page.run(url, self.opts.delay || DEFAULT_DELAY, function (url, delay, resolve, reject) {
        this.open(url, function (status) {
            if (status !== 'success') {
               return reject(new Error("unabel to open " + url));
            } else {
                var page = this;
                setTimeout(function () {
                    var text = page.evaluate(function () {
                        var scripts = document.getElementsByTagName('script');
                        for (var i = scripts.length -1; i >= 0; i--) {
                            scripts[i].parentNode.removeChild(scripts[i]);
                        }
                        return document.documentElement.outerHTML;
                    });
                    resolve(text);
                }, delay);
            }
        });
    }).then(function (html) {
        clearTimeout(timeout);
        self.log("info", "page rendered successfully");
        self.pageLoads += 1;
        self.returnResult(html, null);
        self.release();
    }).catch(function (err){
        if (!timed_out) { //if timed out, the error will be about instance exiting
            self.log("error", "error rendering page " + err + " " + err.stack);
            self.returnResult(null, err);
            self.exit();
        }
    });
};