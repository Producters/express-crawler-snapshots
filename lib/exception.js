function CrawlerSnapshotsError(message) {
  this.name = 'CrawlerSnapshotsError';
  this.message = message || 'Default Message';
}
CrawlerSnapshotsError.prototype = Object.create(Error.prototype);
CrawlerSnapshotsError.prototype.constructor = CrawlerSnapshotsError;

module.exports = CrawlerSnapshotsError;