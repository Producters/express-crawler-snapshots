var express = require('express');

function getApp(middleware) {
    var app = express();
    app.use(middleware);
    app.get('/', function(req, res) {
        res.send('<html><body><p id="content"></p>' + 
            '<script>document.getElementById("content").innerHTML="hello " + "world";</script>' +
            '</body></html>');
    });
    app.get('/other', function(req, res) {
        res.send('<html><body><p id="content"></p>' + 
            '<script>document.getElementById("content").innerHTML="other " + "world";</script>' +
            '</body></html>');
    });
    return app;
}

module.exports = getApp;