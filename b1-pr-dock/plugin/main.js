(async () => {
  const [{ GitHub }, { sourceLinks, evidenceKey, startAnalysis }] = await Promise.all([import('./github.js'), import('./core.js')]);
  const channel = new BroadcastChannel('pr-workbench:v1');
  const github = new GitHub(request => cindy.fetch(request));
  const snapshots = new Map(), requests = new Map();
  const storage = {
    async read() { const r = await fetch('/kv'); if (!r.ok) throw new Error('无法读取插件状态'); return r.json(); },
    async write(value) { const r = await fetch('/kv', { method: 'PUT', body: JSON.stringify(value) }); if (!r.ok) throw new Error('无法保存插件状态，已停止派发。'); },
  };
  const lookup = (repo, number) => {
    const snapshot = snapshots.get(repo + '#' + number);
    if (!snapshot) throw new Error('请先选择并加载 PR');
    return snapshot;
  };
  async function handle(method, args = {}) {
    if (method === 'list') return github.list();
    if (method === 'inspect' || method === 'ci') {
      const pr = await github.pr(args.repo, Number(args.number)), result = await github.checks(pr);
      if (method === 'ci') return { sha: pr.sha, state: result.state, count: result.checks.length, incomplete: result.incomplete, notice: result.notices.join('；') };
      const snapshot = { pr, ...result };
      snapshots.set(pr.repo + '#' + pr.number, snapshot);
      return snapshot;
    }
    const snapshot = lookup(args.repo, Number(args.number));
    const { pr } = snapshot;
    const check = snapshot.checks.find(c => `${c.kind}:${c.id}` === args.checkId);
    if (!check) throw new Error('当前 PR 中找不到这项检查，请刷新');
    const key = evidenceKey(pr, check);
    if (method === 'output') {
      const output = await github.output(pr, check);
      return { output, links: sourceLinks(pr, check) };
    }
    if (method === 'analyze') {
      if (!cindy.tasks) throw new Error('当前 Cindy 不支持插件任务接口。');
      const evidence = await github.analysisEvidence(pr, check);
      return startAnalysis({ tasks: cindy.tasks, storage, ...evidence });
    }
    if (method === 'progress') {
      const record = (await storage.read()).analysisRecords?.[key];
      if (!record?.taskId) throw new Error('这项检查还没有关联的分析任务');
      return { record, messages: await cindy.tasks.readMessages({ taskId: record.taskId, limit: 20 }),
        run: record.runId ? await cindy.tasks.getRun({ runId: record.runId }) : null };
    }
    throw new Error('不支持的操作');
  }
  channel.onmessage = async ({ data }) => {
    if (data?.type !== 'request' || typeof data.id !== 'string' || data.id.length > 100) return;
    const signature = JSON.stringify([data.method, data.args]);
    const existing = requests.get(data.id);
    if (existing && existing.signature !== signature) return;
    channel.postMessage({ type: 'ack', id: data.id });
    let entry = existing;
    if (!entry) {
      entry = { signature, promise: handle(data.method, data.args).then(result => ({ ok: true, result }), error => ({ ok: false, error: { message: error.message, code: error.code } })) };
      requests.set(data.id, entry);
      if (requests.size > 80) requests.delete(requests.keys().next().value);
    }
    channel.postMessage({ type: 'response', id: data.id, ...await entry.promise });
  };
  cindy.onHostMessage(async msg => {
    if (msg.type !== 'tool-call') return;
    try {
      let result;
      if (msg.tool === 'list_prs') {
        const data = await handle('list');
        const limit = Math.min(50, Math.max(1, Number(msg.args.limit) || 20));
        result = { ...data, total: data.prs.length, prs: data.prs.slice(0, limit), more: data.prs.length > limit };
      } else if (msg.tool === 'inspect_pr') {
        const data = await handle('inspect', msg.args);
        const failed = data.checks.filter(c => c.state === 'failed');
        result = { ...data, failures: await Promise.all(failed.slice(0, 5).map(async check => ({ check, links: sourceLinks(data.pr, check), output: await github.output(data.pr, check) }))) };
      } else throw new Error('未知工具');
      cindy.send({ type: 'tool-result', callId: msg.callId, ok: true, result });
    } catch (error) {
      cindy.send({ type: 'tool-result', callId: msg.callId, ok: false, message: error.message });
    }
  });
})();
