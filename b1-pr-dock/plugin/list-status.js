export const prKey = pr => `${pr.repo}#${pr.number}`;

// One shared limit across page changes; obsolete responses never update the new page.
export class ListStatusLoader {
  constructor(load, onChange, concurrency = 3) {
    this.load = load; this.onChange = onChange; this.concurrency = concurrency;
    this.cache = new Map(); this.revisions = new Map();
    this.generation = 0; this.active = 0; this.queue = [];
  }
  get(pr) { return this.cache.get(prKey(pr)); }
  record(pr, value) {
    const key = prKey(pr);
    this.revisions.set(key, (this.revisions.get(key) || 0) + 1);
    this.cache.set(key, value); this.onChange();
  }
  show(items, { reset = false } = {}) {
    this.generation++;
    if (reset) { this.cache.clear(); this.revisions.clear(); }
    const unique = new Map(items.map(pr => [prKey(pr), pr]));
    this.queue = [...unique.values()].filter(pr => !this.cache.has(prKey(pr)));
    this.drain();
  }
  drain() {
    while (this.active < this.concurrency && this.queue.length) {
      const pr = this.queue.shift(), key = prKey(pr), generation = this.generation;
      const revision = this.revisions.get(key) || 0;
      this.active++;
      Promise.resolve().then(() => this.load(pr)).then(
        value => this.publish(pr, value, generation, revision),
        error => this.publish(pr, { state: 'unknown', error: error.message || '无法读取 CI 状态' }, generation, revision),
      ).finally(() => { this.active--; this.drain(); });
    }
  }
  publish(pr, value, generation, revision) {
    if (generation !== this.generation || revision !== (this.revisions.get(prKey(pr)) || 0)) return;
    this.record(pr, value);
  }
}
