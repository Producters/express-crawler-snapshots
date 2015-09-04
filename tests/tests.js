var getApp = require('./testapp/app'),
    http = require('http'),
    should = require('should'),
    request = require('request'),
    sinon = require('sinon'),
    _middleware = require('../index');

var middleware = function middleware (options) {
    //wrapper to silence logger for tests
    options = options || {};
    if (!options.logger) {
        options.logger = null;
    }
    return _middleware(options);
};

describe('crawler snapshots middleware', function() {
    var server, server_errors = [];

    function startServer(middleware, cb) {
        var app =  getApp(middleware);
        app.use(function(err, req, res, next){
            server_errors.push(err);
            res.status(500).send(err.message);
        });
        server = http.Server(app);
        server.listen(3001, cb);
    }

    afterEach(function (done) {
        if(server) {
            _middleware.killAllInstances().then(function () {
                server.close(done);
                server = null;
                server_errors = [];
            });
        } else {
            done();
        }
    });

    it('should not prerender page if no trigger is provided', function(done){
        startServer(middleware(), function () {
            request('http://localhost:3001/', function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                body.indexOf('<p id="content"></p>').should.not.equal(-1);
                body.indexOf('<script>').should.not.equal(-1);
                server_errors.length.should.equal(0);
                done();
            });
        });
    });

    it('should render page if snapshot query param is provided', function (done) {
        startServer(middleware(), function () {
            request('http://localhost:3001/?snapshot=true', function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                body.indexOf('<p id="content">hello world</p>').should.not.equal(-1);
                body.indexOf('<script>').should.equal(-1);
                server_errors.length.should.equal(0);
                done();
            });
        });
    });

    it('should remove any script tags', function (done) {
        startServer(middleware(), function () {
            request('http://localhost:3001/?snapshot=true', function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                body.indexOf('<script>').should.equal(-1);
                server_errors.length.should.equal(0);
                done();
            });
        });
    });

    it('should contain html start and end tags', function (done) {
        startServer(middleware(), function () {
            request('http://localhost:3001/?snapshot=true', function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                body.indexOf('<html').should.not.equal(-1);
                body.indexOf('</html>').should.not.equal(-1);
                server_errors.length.should.equal(0);
                done();
            });
        });
    });


    it('should render page if alternative snapshot query param is provided', function (done) {
        startServer(middleware({
            snapshotTrigger: 'trigga'
        }), function () {
            request('http://localhost:3001/?trigga=true', function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                body.indexOf('<p id="content">hello world</p>').should.not.equal(-1);
                server_errors.length.should.equal(0);
                done();
            });
        });
    });

    it('should render page if ua string says its a google bot', function (done) {
        var options = {
            url: 'http://localhost:3001/',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
            }
        };
        startServer(middleware(), function () {
            request(options, function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                body.indexOf('<p id="content">hello world</p>').should.not.equal(-1);
                server_errors.length.should.equal(0);
                done();
            });
        });
    });

    it('should render page if _escaped_fragment_ query param is provided, unescaping value', function (done) {
        startServer(middleware(), function () {
            request('http://localhost:3001/printhref?_escaped_fragment_=key1=value1%26key2=value2', function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                body.indexOf('<p id="content">loc is /printhref#!key1=value1&amp;key2=value2</p>').should.not.equal(-1);
                server_errors.length.should.equal(0);
                done();
            });
        });
    });

    it('should render page if _escaped_fragment_ query param is provided, leaving other query params intact', function (done) {
        startServer(middleware(), function () {
            request('http://localhost:3001/printhref?dude=persoon&_escaped_fragment_=troll', function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                body.indexOf('<p id="content">loc is /printhref?dude=persoon#!troll</p>').should.not.equal(-1);
                server_errors.length.should.equal(0);
                done();
            });
        });
    });

    it('should queue simultaneous requests and process them successfully, in sequence', function (done) {
        var mw = middleware();

        sinon.spy(mw._pool.queued_get_instance_callbacks, 'push');

        startServer(mw, function () {
            var calls = 3, callback, finallly;

            callback = function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                body.indexOf('<p id="content">hello world</p>').should.not.equal(-1);
                if (--calls === 0) {
                    finallly();
                }
            };

            finallly = function () {

                //queue is empty, one available instance
                mw._pool.queued_get_instance_callbacks.length.should.equal(0)
                mw._pool.instances.length.should.equal(1);
                mw._pool.available_instances.length.should.equal(1);

                //check callback was queued twice
                mw._pool.queued_get_instance_callbacks.push.calledTwice.should.be.true;
                server_errors.length.should.equal(0);
                done();
            };

            request('http://localhost:3001/?snapshot=true', callback);
            request('http://localhost:3001/?snapshot=true', callback);
            request('http://localhost:3001/?snapshot=true', callback);
        });
    });

    it('should process non simultaneous rquests without spawning additional instances or queuing', function (done) {
        var mw = middleware();

        sinon.spy(mw._pool.queued_get_instance_callbacks, 'push');

        startServer(mw, function () {

            request('http://localhost:3001/?snapshot=true', function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);

                request('http://localhost:3001/?snapshot=true', function(error, response, body) {
                    should.not.exist(error);
                    response.statusCode.should.equal(200);

                    //once instance
                    mw._pool.instances.length.should.equal(1);
                    mw._pool.available_instances.length.should.equal(1);

                    //no queues
                    mw._pool.queued_get_instance_callbacks.push.called.should.be.false;
                    server_errors.length.should.equal(0);
                    done();
                });
            });

        });
    });

    it('if pool size allows it, should process simultaneous requests by spawning extra instances', function (done) {
        var mw = middleware({
            maxInstances: 3
        });

        sinon.spy(mw._pool.queued_get_instance_callbacks, 'push');

        startServer(mw, function () {
            var calls = 3, callback, finallly;

            callback = function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                body.indexOf('<p id="content">hello world</p>').should.not.equal(-1);
                if (--calls === 0) {
                    finallly();
                }
            };

            finallly = function () {
                //three instances are available
                mw._pool.instances.length.should.equal(3);
                mw._pool.available_instances.length.should.equal(3);

                //check callback was not called
                mw._pool.queued_get_instance_callbacks.push.called.should.be.false;
                server_errors.length.should.equal(0);
                done();
            };

            request('http://localhost:3001/?snapshot=true', callback);
            request('http://localhost:3001/?snapshot=true', callback);
            request('http://localhost:3001/?snapshot=true', callback);
        });
    });

    it('when exceeding pool size should start queueing (pool size > 1)', function (done) {
        var mw = middleware({
            maxInstances: 2
        });

        sinon.spy(mw._pool.queued_get_instance_callbacks, 'push');

        startServer(mw, function () {
            var calls = 3, callback, finallly;

            callback = function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                body.indexOf('<p id="content">hello world</p>').should.not.equal(-1);
                if (--calls === 0) {
                    finallly();
                }
            };

            finallly = function () {
                //three instances are available
                mw._pool.instances.length.should.equal(2);
                mw._pool.available_instances.length.should.equal(2);

                //check callback was not called
                mw._pool.queued_get_instance_callbacks.push.calledOnce.should.be.true;
                server_errors.length.should.equal(0);
                done();
            };

            request('http://localhost:3001/?snapshot=true', callback);
            request('http://localhost:3001/?snapshot=true', callback);
            request('http://localhost:3001/?snapshot=true', callback);
        });
    });

    it('should handle killed processes properly', function (done) {
        var mw = middleware();

        startServer(mw, function () {
            request('http://localhost:3001/?snapshot=true', function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                mw._pool.instances.length.should.equal(1);
                mw._pool.instances_active.should.equal(1);
                mw._pool.available_instances.length.should.equal(1);
                //kill the process
                mw._pool.instances[0].ph.childProcess.kill();

                //wait for it to die
                setTimeout(function(){
                    mw._pool.instances.length.should.equal(0);
                    mw._pool.instances_active.should.equal(0);
                    mw._pool.available_instances.length.should.equal(0);
                    request('http://localhost:3001/?snapshot=true', function(error, response, body) {
                        should.not.exist(error);
                        response.statusCode.should.equal(200);
                        mw._pool.instances.length.should.equal(1);
                        mw._pool.instances_active.should.equal(1);
                        mw._pool.available_instances.length.should.equal(1);
                        server_errors.length.should.equal(0);
                        done();
                    });

                }, 100);
            });
        });
    });

    it('should handle process killed during request handling properly', function (done) {
        var _mw = middleware(),
            mw = function(req, res, next) {
                _mw(req,  res, function (err) {
                    should.exist(err);
                    next(err);
                });
            };

        _mw._pool.spawnInstance = function (cb) {
            _mw._pool.constructor.prototype.spawnInstance.call(_mw._pool, function (phantom) {
                phantom.ph.childProcess.kill('SIGKILL');
                cb(phantom);
            });
        };

        startServer(mw, function () {
            request('http://localhost:3001/?snapshot=true', function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(500);
                body.indexOf('exited without finishing render').should.not.equal(-1);
                _mw._pool.instances.length.should.equal(0);
                _mw._pool.instances_active.should.equal(0);
                _mw._pool.available_instances.length.should.equal(0);
                server_errors.length.should.equal(1);
                done();
            });
        });
    });

    it('should make second attempt to render if attempts > 1 and killed the first  time', function (done) {
        var _mw = middleware({
            attempts: 2
        }),
        mw = function(req, res, next) {
            _mw(req,  res, function (err) {
                should.not.exist(err);
                next(err);
            });
        };

        var first_killed = false;

        _mw._pool.spawnInstance = function (cb) {
            _mw._pool.constructor.prototype.spawnInstance.call(_mw._pool, function (phantom) {
                if (!first_killed) {
                    phantom.ph.childProcess.kill('SIGKILL');
                    first_killed = true;
                }
                cb(phantom);
            });
        };

        startServer(mw, function () {
            request('http://localhost:3001/?snapshot=true', function(error, response, body) {
                response.statusCode.should.equal(200);
                body.indexOf('<p id="content">hello world</p>').should.not.equal(-1);
                body.indexOf('<script>').should.equal(-1);
                server_errors.length.should.equal(0);
                done();
            });
        });
    });



    it('timeout should terminate phantom process and return error', function (done) {
        var mw = middleware({
            timeout: 1
        });

        startServer(mw, function  () {
            request('http://localhost:3001/?snapshot=true', function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(500);
                body.indexOf('timed out while opening').should.not.equal(-1);
                //wait for termination to process
                setTimeout(function(){
                    mw._pool.instances.length.should.equal(0);
                    mw._pool.instances_active.should.equal(0);
                    mw._pool.available_instances.length.should.equal(0);
                    server_errors.length.should.equal(1);
                    done();
                }, 100);
            });
        });
    });

    it('if max page loads enabled, should restart instance every x loads', function (done) {
        var mw = middleware({
            maxPageLoads: 2
        });

        startServer(mw, function() {
            request('http://localhost:3001/?snapshot=true', function () {
                mw._pool.instances.length.should.equal(1);
                mw._pool.instances[0].number.should.equal(0);
                request('http://localhost:3001/?snapshot=true', function () {
                    mw._pool.instances.length.should.equal(1);
                    mw._pool.instances[0].number.should.equal(0);
                    request('http://localhost:3001/?snapshot=true', function () {
                        mw._pool.instances.length.should.equal(1);
                        mw._pool.instances[0].number.should.equal(1);
                        done();
                    });
                });
            });
        });
    });
});