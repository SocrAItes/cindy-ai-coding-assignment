import { repoName, httpsLink, checkState, aggregateChecks, clipUtf8 } from './core.js';
export class GitHub {
  constructor(fetch) { this.fetch = fetch; }
  async response(path, accept = 'application/vnd.github+json') {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('GitHub API 路径无效');
    const r = await this.fetch({ url: 'https://api.github.com' + path, method: 'GET', headers: { Accept: accept, 'X-GitHub-Api-Version': '2026-03-10' }, timeoutMs: 30000 });
    if (!r.ok) throw new Error(r.message || 'GitHub 网络请求失败');
    if (r.status < 200 || r.status >= 300) {
      const messages = { 401: 'GitHub 登录已失效，请检查连接。', 403: 'GitHub 权限不足或请求受到限流，请检查授权与稍后刷新。', 404: 'GitHub 资源不存在，或当前账号没有访问权限。', 429: 'GitHub 请求受到限流，请稍后刷新。' };
      throw Object.assign(new Error(messages[r.status] || `GitHub 返回 ${r.status}`), { status: r.status });
    }
    return r;
  }
  async json(path) { const r = await this.response(path); if (r.truncated) throw new Error('GitHub 响应被截断，不能作为完整数据。'); return JSON.parse(r.body); }
  async pages(path, field) {
    const all = [];
    for (let page = 1; page <= 10; page++) {
      const data = await this.json(path + (path.includes('?') ? '&' : '?') + `per_page=100&page=${page}`);
      const items = field ? data[field] : data;
      if (!Array.isArray(items)) throw new Error('GitHub 响应格式异常');
      all.push(...items);
      if (items.length < 100) return { items: all, limited: !!data.incomplete_results };
    }
    return { items: all, limited: true };
  }
  async list() {
    const user = await this.json('/user');
    const queries = [`is:pr is:open author:${user.login}`, `is:pr is:open review-requested:${user.login}`];
    const results = await Promise.all(queries.map(q => this.pages('/search/issues?q=' + encodeURIComponent(q) + '&sort=updated&order=desc', 'items')));
    const map = new Map();
    results.forEach((result, index) => result.items.forEach(item => {
      const match = new URL(item.repository_url).pathname.match(/^\/repos\/([^/]+\/[^/]+)$/);
      if (!match) return;
      const repo = repoName(match[1]), key = repo + '#' + item.number;
      const previous = map.get(key);
      map.set(key, { repo, number: item.number, title: item.title, url: httpsLink(item.html_url), updatedAt: item.updated_at,
        authored: index === 0 || !!previous?.authored, reviewRequested: index === 1 || !!previous?.reviewRequested });
    }));
    return { login: user.login, prs: [...map.values()].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)), limited: results.some(r => r.limited) };
  }
  async pr(repo, number) {
    repoName(repo); if (!Number.isSafeInteger(number) || number < 1) throw new Error('PR 编号无效');
    const p = await this.json(`/repos/${repo}/pulls/${number}`);
    return { repo, number, title: p.title, sha: p.head.sha, headRepo: p.head.repo?.full_name || repo, url: httpsLink(p.html_url) };
  }
  async checks(pr) {
    const base = `/repos/${repoName(pr.repo)}/commits/${pr.sha}`;
    const results = await Promise.allSettled([this.pages(base + '/check-runs?filter=latest', 'check_runs'), this.pages(base + '/statuses')]);
    const checks = []; let incomplete = false; const notices = [];
    results.forEach((r,index) => {
      if (r.status === 'rejected') { incomplete = true; notices.push(r.reason.message); return; }
      incomplete ||= r.value.limited;
      if (index === 0) r.value.items.forEach(c => checks.push({ kind: 'check', id: String(c.id), name: c.name, state: checkState(c.status,c.conclusion), url: httpsLink(c.details_url) || httpsLink(c.html_url), conclusion: c.conclusion }));
      else { const seen = new Set(); for (const c of r.value.items) { if(seen.has(c.context))continue; seen.add(c.context); checks.push({ kind: 'status', id: String(c.id), name: c.context, state: ({success:'passed',failure:'failed',error:'failed',pending:'running'})[c.state] || 'unknown', url: httpsLink(c.target_url), description: c.description }); } }
    });
    return { checks, incomplete, notices, state: aggregateChecks(checks, incomplete) };
  }
  async output(pr, check) {
    if (check.kind === 'status') return { kind: '状态说明', text: check.description || '此 CI 服务未通过 GitHub 提供日志，请打开对应检查页面。', notice: '不是完整日志。' };
    const detail = await this.json(`/repos/${repoName(pr.repo)}/check-runs/${encodeURIComponent(check.id)}`);
    const annotations = await this.pages(`/repos/${pr.repo}/check-runs/${encodeURIComponent(check.id)}/annotations`);
    const text = [detail.output?.title, detail.output?.summary, detail.output?.text, ...annotations.items.map(a => `${a.path}:${a.start_line}\n${a.title || ''}\n${a.message || ''}\n${a.raw_details || ''}`)].filter(Boolean).join('\n\n');
    return { kind: '检查输出与注释', text: clipUtf8(text || '该检查没有提供可读输出。请打开 GitHub 检查页面查看完整日志。', 24000), notice: '当前展示 GitHub 检查输出和注释；完整原始日志通过检查链接查看。' + (annotations.limited ? '注释尚未完整加载。' : '') };
  }
  async analysisEvidence(pr, check) {
    const current = await this.pr(pr.repo, pr.number);
    if (current.sha !== pr.sha) throw Object.assign(new Error('PR 已出现新提交，请刷新后再分析。'), { code: 'STALE_COMMIT' });
    const latest = await this.checks(current);
    const selected = latest.checks.find(item => item.kind === check.kind && item.id === check.id);
    if (!selected || selected.state !== 'failed') {
      throw Object.assign(new Error('这项失败检查已更新或被新的运行替代，请刷新后重新选择。'), { code: 'CHECK_CHANGED' });
    }
    const output = await this.output(current, selected);
    // A push may arrive while check output is being fetched.
    const head = await this.pr(pr.repo, pr.number);
    return { pr: current, check: selected, output, currentSha: head.sha };
  }
}
