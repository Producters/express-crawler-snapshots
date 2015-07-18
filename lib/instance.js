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

    this.ph = ph;
    this.pool = pool;
    this.number = number;
    this.opts = opts;
    this.exited = false;
    this._page = ph.createPage();
    this._cb = null;
    var self = this;

    ph.childProcess.on('exit', function () {
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
    this.log('info', 'released');
    this.pool.releaseInstance(this);
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
}

Instance.prototype.renderPage = function (url, cb) {
    this.log('info', 'opening ' + url);
    this._cb = cb;
    var self = this,
        timeout = setTimeout(function () {
            if (self.exited) {
                return;
            }
            self.log('error', 'timed out while opening ' + url);
            self.returnResult(null, new CrawlerSnapshotsError(self.number + " timed out while opening " + url));
            self.exit();
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
            self.returnResult(html, null);
            self.release();
        }).catch(function (err){
            self.log("error", "error rendering page " + err + " " + err.stack);
            self.returnResult(null, err);
            self.exit();
        });
};