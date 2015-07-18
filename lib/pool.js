var phridge = require('phridge'),
    CrawlerSnapshotsError = require('./exception'),
    Instance = require('./instance'),
    Promise = require('bluebird');

var Pool = module.exports = function Pool(max_instances, opts) {
    this.max_instances = max_instances;
    this.instances = [];
    this.available_instances = [];
    this.queued_get_instance_callbacks = [];
    this.instance_no = 0;
    this.instances_active = 0;
    this.opts = opts;
}

Pool.prototype.killAllInstances = function () {
    return Promise.all(this.instances.map(function(instance) {
        return instance.exit();
    }));
};
    
Pool.prototype.spawnInstance = function spawnInstance(cb) {
    var instance_no = this.instance_no ++,
        instance,
        self = this;

    this.instances_active ++;

    this.log('info', 'starting phantomjs instance ' + instance_no + '...');

    phridge.spawn({
        loadImages: false,
    }).then(function (phantom) {
        self.log('info', 'phantomjs instance ' + instance_no + ' started');
        instance = new Instance(phantom, self, instance_no, self.opts);
        self.instances.push(instance);
        cb(instance);
    }).catch(function (error) {
        self.log('error', 'phantomjs instance ' + instance_no + ' failed to start');
        cb(null, error);
    });
};

Pool.prototype.log = function (level, msg) {
    var msg = 'phantomjs pool: ' + msg;
    if (this.opts.logger && this.opts.logger[level]) {
        this.opts.logger[level](msg);
    }
};

Pool.prototype.processQueue = function () {
    if (this.queued_get_instance_callbacks.length) {
        this.log('info', 'processing next queued request, queue length is now ' + (this.queued_get_instance_callbacks.length -1 ));
        this.getInstance(this.queued_get_instance_callbacks.shift());
    }
}

Pool.prototype.removeInstance = function (instance) {
    this.instances = this.instances.filter(function(i) {
        return i !== instance;
    });
    this.available_instances = this.available_instances.filter(function(i){
        return i !== instance;
    });
    this.instances_active --;
    this.processQueue();
};

Pool.prototype.releaseInstance = function (instance) {
    this.available_instances.push(instance);
    this.processQueue();
};

Pool.prototype.getInstance = function getInstance(cb) {
    if (this.available_instances.length) {
        cb(this.available_instances.shift());
    } else if (this.instances_active < this.max_instances) {
        this.spawnInstance(cb);
    } else {
        this.queued_get_instance_callbacks.push(cb);
        this.log('info', 'queued a request for phantomjs instance. queue length is ' + this.queued_get_instance_callbacks.length);
    }
};