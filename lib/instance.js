var CrawlerSnapshotsError = require('./exception');

var DEFAULT_DELAY = 200,
    DEFAULT_TIMEOUT = 2000,
    EVAL_PAGE_FN = function evalPage() {

        //disable all scripts;
        var scripts = document.getElementsByTagName('script');
        for (var i = 0, script; script = scripts[i++];) {
            script.parentNode.removeChild(script);
        }
        return document.documentElement.innerHTML;
    };


var Instance = module.exports = function Instance(ph, pool, number, opts) {

    this.ph = ph;
    this.pool = pool;
    this.number = number;
    this.opts = opts;
    this.exited = false;
    this._page = null;
    this._cb = null;
    var self = this;
    ph.onExit = function () {
        self.log('log', 'ph exited');
        self.onExit();
    };
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
    this.log('log', 'process exited');
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
    if (this._page) {
        this._page.close();
        this._page = null;
    }
    this.log('log', 'released');
    this.pool.releaseInstance(this);
};

Instance.prototype.exit = function () {
    if (this.exited) {
        return;
    } else {
        this.exited = true;
        this.ph.exit();
    }
};

Instance.prototype._createPage = function (cb) {
    var self = this;
    this.ph.createPage(function (page) {
        self._page = page;
        cb(page);
    });
};

Instance.prototype.evalPage = function (cb) {
    this._page.evaluate(this.opts.evalPageFn || EVAL_PAGE_FN, cb);
}

Instance.prototype.renderPage = function (url, cb) {
    this.log('log', 'rendering ' + url);
    this._cb = cb;
    var self = this,
        timeout = setTimeout(function () {
            if (self.exited) {
                return;
            }
            self.log('error', 'timed out while opening ' + url);
            self.returnResult(null, new CrawlerSnapshotsError("timed out while opening " + url));
            self.exit();
        }, this.opts.timeout || DEFAULT_TIMEOUT);

    this._createPage(function (page) {
        page.open(url, function (status) {
            if (status !== 'success') {
                var msg = "failed to open " + url + ", status was " + status;
                self.log('error', msg);
                self.returnResult(null, new CrawlerSnapshotsError("phantomjs " + msg));
                self.exit();
            } else {
                setTimeout(function () {
                    if (self.exited) {
                        return;
                    }
                    self.evalPage(function (result) {
                        clearTimeout(timeout);
                        if (self.exited) {
                            return;
                        }
                        self.log('log', 'rendered ' + url + ' successfully');
                        self.returnResult(result, null);
                        self.release();
                    }); 
                }, self.opts.delay || DEFAULT_DELAY);
            }
        });
    });
};