function CrawlerSnapshotsError(message) {
  this.name = 'MyError';
  this.message = message || 'Default Message';
}
CrawlerSnapshotsError.prototype = Object.create(Error.prototype);
CrawlerSnapshotsError.prototype.constructor = CrawlerSnapshotsError;

module.exports = CrawlerSnapshotsError;