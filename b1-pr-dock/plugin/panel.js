import { HostClient } from './client.js';
import { sourceLinks } from './core.js';
import { ListStatusLoader } from './list-status.js';
const host = new HostClient(), root = document.getElementById('cindy-pr-columns');
const state = { list: [], listLoaded: false, snapshot: null, checkId: null, output: null, scope: 'all', page: 0, loading: false, outputLoading: false, error: '', notice: '', busy: false, progress: null };
const pageSize = 20;
const summaries = new ListStatusLoader(pr => host.request('ci', { repo: pr.repo, number: pr.number }), () => render());
const filteredList = () => state.list.filter(p => state.scope === 'all' || (state.scope === 'mine' ? p.authored : p.reviewRequested));
const pageItems = () => filteredList().slice(state.page * pageSize, (state.page + 1) * pageSize);
function showPage() { summaries.show(pageItems()); render(); }
let selection = 0, outputGeneration = 0;
const names = { failed:'失败',passed:'通过',running:'运行中',unknown:'未知',none:'暂无检查',skipped:'跳过',cancelled:'已取消',loading:'读取中' };
const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const checkId = c => c.kind + ':' + c.id;
function link(href, label) { return href ? `<a href="${esc(href)}">${esc(label)}</a>` : `<span>${esc(label)}</span>`; }
function status(tone, label, hint = '') { return `<span class="p-state p-${tone}" title="${esc(hint)}"><span class="p-dot" aria-hidden="true"></span>${esc(label || names[tone] || tone)}</span>`; }
function currentCheck() { return state.snapshot?.checks.find(c => checkId(c) === state.checkId); }
function analysisText(page) {
  const candidate = Array.isArray(page) ? page : page?.items || page?.messages;
  const items = Array.isArray(candidate) ? candidate : [];
  const messages = items.filter(item => item.role === 'assistant').map(item => {
    if (typeof item.text === 'string') return item.text;
    if (typeof item.content === 'string') return item.content;
    if (Array.isArray(item.content)) return item.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
    return '';
  }).filter(Boolean);
  const remaining = page?.hasMore ? '还有任务消息未读完，请再次刷新分析进展。' : '';
  return [messages.join('\n\n'), remaining].filter(Boolean).join('\n\n') || '尚未收到可读回复。你可以在 Cindy 任务列表查看或接手。';
}
async function refresh() {
  if (state.loading) return;
  const old = state.snapshot?.pr;
  selection++; outputGeneration++; summaries.show([], { reset: true });
  state.loading = true; state.error = ''; state.notice = ''; state.page = 0;
  state.snapshot = null; state.output = null; state.checkId = null; state.progress = null; state.outputLoading = false;
  state.list = []; state.listLoaded = false; render();
  try {
    const data = await host.request('list'); state.list = data.prs; state.listLoaded = true;
    state.notice = data.limited ? 'GitHub 搜索结果不完整或已达到 1000 条上限，当前列表可能有遗漏。' : '';
    showPage();
    const next = pageItems().find(p => p.repo === old?.repo && p.number === old?.number) || pageItems()[0];
    if (next) await inspect(next); else { selection++; outputGeneration++; state.snapshot = null; state.output = null; }
  } catch (error) { state.listLoaded = false; state.error = error.message; }
  finally { state.loading = false; render(); }
}
async function inspect(pr) {
  const generation = ++selection; ++outputGeneration;
  state.snapshot = { pr, checks: [], notices: [], state: 'unknown' }; state.checkId = null; state.output = null; state.outputLoading = false; state.progress = null; state.error = ''; render();
  try {
    const data = await host.request('inspect', { repo: pr.repo, number: pr.number }); if (generation !== selection) return;
    state.snapshot = data;
    summaries.record(pr, { sha: data.pr.sha, state: data.state, count: data.checks.length, incomplete: data.incomplete, notice: data.notices.join('；') });
    const first = data.checks.find(c => c.state === 'failed') || data.checks.find(c => c.state === 'running') || data.checks[0];
    state.checkId = first ? checkId(first) : null;
    if (first) await output();
  } catch (error) { if (generation === selection) state.error = error.message; }
  finally { render(); }
}
async function output() {
  const generation = ++outputGeneration, prGeneration = selection;
  const pr = state.snapshot.pr; const id = state.checkId;
  state.output = null; state.outputLoading = true; state.progress = null; state.error = ''; render();
  try {
    const data = await host.request('output', { repo: pr.repo, number: pr.number, checkId: id });
    if (generation === outputGeneration && prGeneration === selection) {
      state.output = data.output;
      state.progress = data.record ? { record: data.record } : null;
    }
  } catch (error) { if (generation === outputGeneration && prGeneration === selection) state.error = error.message; }
  finally { if (generation === outputGeneration) state.outputLoading = false; render(); }
}
async function analyze() {
  if (state.busy) return;
  const pr = state.snapshot.pr, generation = selection, id = state.checkId;
  state.busy = true; state.error = ''; render();
  try {
    await host.request('analyze', { repo: pr.repo, number: pr.number, checkId: id });
    const progress = await host.request('progress', { repo: pr.repo, number: pr.number, checkId: id });
    if (generation === selection && id === state.checkId) state.progress = progress;
  } catch (error) { state.error = error.message; }
  finally { state.busy = false; render(); }
}
async function progress() {
  const pr = state.snapshot.pr, generation = selection, id = state.checkId;
  try { const data = await host.request('progress', { repo: pr.repo, number: pr.number, checkId: id }); if (generation === selection && id === state.checkId) state.progress = data; }
  catch(error) { state.error = error.message; } render();
}
function prRow(item, index, selected) {
  const ci = summaries.get(item) || { state: 'loading' };
  const label = ci.error ? '读取失败' : names[ci.state] || '未知';
  return `<button class="p-row" data-index="${index}" aria-pressed="${selected?.repo===item.repo&&selected?.number===item.number}"><span class="p-row-title">${esc(item.title)}</span><span class="p-row-meta">${esc(item.repo)} #${item.number}</span><span class="p-row-bottom">${status(ci.state, label, ci.error || ci.notice || (ci.sha ? '提交 ' + ci.sha : '正在读取最新提交的 CI'))}<span>${item.reviewRequested?'待我审阅':'我创建的'}</span></span></button>`;
}
function render() {
  const filtered = filteredList(), visible = pageItems();
  const snapshot = state.snapshot, pr = snapshot?.pr, check = currentCheck();
  const links = pr?.sha && check ? sourceLinks(pr, check) : null;
  const text = state.output?.text || (state.outputLoading ? '正在读取检查输出…' : '选择检查以读取输出。');
  const record = state.progress?.record;
  const errorText = /凭证.*不可用|未检测到本机 gh 登录/.test(state.error) ? 'GitHub 尚未连接。请在「插件 → PR Dock」中连接账号，然后刷新。' : state.error;
  root.innerHTML = `<div class="p-window"><header class="p-toolbar"><div class="p-titlebar"><h1>PR Dock</h1><div class="p-updated"><button class="p-quiet" data-action="refresh" ${state.loading?'disabled':''}>${state.loading?'加载中…':'刷新'}</button></div></div><div class="p-tabs">${[['all','全部'],['mine','我创建的'],['review','待我审阅']].map(([id,label])=>`<button class="p-tab" data-scope="${id}" aria-pressed="${state.scope===id}">${label}</button>`).join('')}</div></header>
  ${state.error?`<p class="p-error" role="alert">${esc(errorText)}</p>`:''}${state.notice?`<p class="p-notice">${esc(state.notice)}</p>`:''}
  <div class="p-body"><nav class="p-pane p-list" aria-label="PR 列表"><div class="p-panehead"><h2>PR 列表</h2><span>${state.listLoaded ? filtered.length + ' 个开放' : '—'}</span></div><div class="p-rows">${visible.map((item,i)=>prRow(item,i,pr)).join('')}${!visible.length?`<div class="p-message">${state.loading?'正在读取 PR…':state.listLoaded?'当前范围没有开放的 PR。':'尚未读取 PR，请检查 GitHub 连接。'}</div>`:''}</div>${filtered.length>pageSize?`<div class="p-pager"><button data-page="prev" ${state.page===0?'disabled':''}>上一页</button><span>${state.page*pageSize+1}–${Math.min((state.page+1)*pageSize,filtered.length)} / ${filtered.length}</span><button data-page="next" ${(state.page+1)*pageSize>=filtered.length?'disabled':''}>下一页</button></div>`:''}</nav>
  <nav class="p-pane p-checks" aria-label="检查列表"><div class="p-panehead"><h2>检查列表</h2><span>${snapshot?.checks.length||0} 项</span></div>${(snapshot?.checks||[]).map(c=>`<button class="p-checkrow" data-check="${esc(checkId(c))}" aria-pressed="${checkId(c)===state.checkId}"><span class="p-symbol p-${c.state}">${c.state==='failed'?'×':c.state==='passed'?'✓':'·'}</span><span><strong>${esc(c.name)}</strong><span class="p-checkmeta">${esc(names[c.state])}</span></span></button>`).join('')}${snapshot?.notices.map(n=>`<p class="p-note p-panelnote">${esc(n)}</p>`).join('')||''}${snapshot&&!snapshot.checks.length?'<div class="p-message">暂无可读检查。请确认 CI 是否运行及账号是否有权限。</div>':''}</nav>
  <article class="p-pane p-logdetail" aria-live="polite"><div class="p-panehead"><h2>${state.output?.kind||'检查输出'}</h2><span>${check?esc(names[check.state]):''}</span></div>${check?`<div class="p-loghead"><div class="p-logtitle"><h3>${esc(check.name)}</h3>${status(check.state)}</div><div class="p-logmeta">${esc(pr.repo)} #${pr.number} · ${esc(pr.sha.slice(0,7))}</div></div>`:''}<div class="p-log">${text.split('\n').map((line,i)=>`<div class="p-logline"><span>${i+1}</span><code>${esc(line||' ')}</code></div>`).join('')}</div>${links?`<div class="p-actions"><div class="p-actionbar">${check.state==='failed'?`<button class="p-button" data-action="analyze" ${state.busy?'disabled':''}>${state.busy?'正在交接…':record?'查看分析进展':'交给 Cindy 排查'}</button>`:''}${link(links.check,'打开完整检查 ↗')}</div><p class="p-note">附带 ${link(links.pr,'#'+pr.number)}、${link(links.commit,'提交 '+pr.sha.slice(0,7))} 和 ${link(links.check,check.name+' 输出')}。</p><p class="p-note">${esc(state.output?.notice||'')}</p>${record?`<div class="p-task"><strong>分析任务 · ${esc(record.phase==='accepted'?'已接收':'待核对')}</strong><p>任务 ID：${esc(record.taskId)}</p><button class="p-quiet" data-action="progress">刷新分析进展</button><pre class="p-result">${esc(analysisText(state.progress.messages))}</pre><p class="p-note">可在 Cindy 任务列表接手。本版本未提供已核实的自有任务直接打开接口。</p></div>`:''}</div>`:''}</article></div><footer class="p-footer"><span>${state.listLoaded?'GitHub 已连接':'GitHub 连接待确认'}</span><span>${pr?esc(pr.repo)+' #'+pr.number:''}</span></footer></div>`;
  root.querySelectorAll('[data-index]').forEach(button=>button.onclick=()=>inspect(visible[Number(button.dataset.index)]));
}
root.onclick = event => {
  const b=event.target.closest('button'); if(!b)return;
  if(b.dataset.scope) { state.scope=b.dataset.scope; state.page=0; showPage(); }
  else if(b.dataset.page) { state.page = Math.max(0, Math.min(Math.ceil(filteredList().length/pageSize)-1, state.page + (b.dataset.page==='next'?1:-1))); showPage(); }
  else if(b.dataset.check) { state.checkId=b.dataset.check; output(); }
  else if(b.dataset.action==='refresh') refresh();
  else if(b.dataset.action==='analyze') state.progress?progress():analyze();
  else if(b.dataset.action==='progress') progress();
};
render(); refresh();
