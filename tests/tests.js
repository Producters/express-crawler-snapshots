var getApp = require('./testapp/app'),
    http = require('http'),
    should = require('should'),
    request = require('request'),
    middleware = require('../index');

describe('crawler snapshots middleware', function() {
    var server;

    function startServer(middleware, cb) {
        var app =  getApp(middleware);
        server = http.Server(app);
        server.listen(3001, cb);
    }

    afterEach(function (done) {
        if(server) {
            console.log('stopping server..');
            server.close(done);
            server = null;
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
                done();
            });
        });
    });

    it('should render page if _escaped_fragment_ query param is provided', function (done) {
        startServer(middleware(), function () {
            request('http://localhost:3001/?_escaped_fragment_=/other', function(error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                body.indexOf('<p id="content">other world</p>').should.not.equal(-1);
                done();
            });
        });
    });
});