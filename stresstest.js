var request = require('request'),
    http = require('http'),
    argv = require('minimist')(process.argv.slice(2)),
    interval = argv.interval || argv.i || 2000;
    simultaneous = argv.simultaneous || argv.s || 1;
    url  = argv.url || argv.u || 'http://localhost:3000';

if (argv.h || argv.help) {
    console.log('Usage: node stresstest.js --interval 2000 --simultaneous 3 --url http://localhost:3000');
    return;
}

var success = 0, errors = 0, count = 0;

setInterval(function () {

    for(var i = 0; i < simultaneous; i ++) {
        (function (reqNo) {
            console.log('starting request ' + (reqNo));
            var start = Date.now();
            request({
                url: url + '?reqNo=' + reqNo,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
                }
            }, function  (error, response, body) {
                if (error) {
                    console.log('error', error);
                }
                if (error || response.statusCode !== 200) {
                    errors += 1;
                } else {
                    success += 1;
                }
                console.log('finished ' + reqNo +' successes: ' + success + ' error: '+ errors + ' time: ' + (Date.now() -start));
            });
        }) (++count);
    }

}, interval);