export class HostClient {
  constructor() {
    this.channel = new BroadcastChannel('pr-workbench:v1'); this.pending = new Map();
    this.channel.onmessage = ({ data }) => {
      const pending = this.pending.get(data?.id); if (!pending) return;
      if (data.type === 'ack') clearInterval(pending.retry);
      if (data.type !== 'response') return;
      clearTimeout(pending.timer); clearInterval(pending.retry); this.pending.delete(data.id);
      if (data.ok) pending.resolve(data.result); else pending.reject(Object.assign(new Error(data.error?.message || '操作失败'), { code: data.error?.code }));
    };
  }
  async request(method, args = {}) {
    if (location.protocol !== 'cindy-ghost:') throw new Error('请将插件安装到 Cindy 后使用。');
    const wake = await fetch('/wake'); if (!wake.ok) throw new Error('无法唤醒插件，请在 Cindy 检查插件是否已启用。');
    const id = crypto.randomUUID(), message = { type: 'request', id, method, args };
    return new Promise((resolve, reject) => {
      const retry = setInterval(() => this.channel.postMessage(message), 300);
      const timer = setTimeout(() => { clearInterval(retry); this.pending.delete(id); reject(new Error('等待宿主响应超时。分析任务可能已创建，请先在任务列表核对。')); }, 120000);
      this.pending.set(id, { resolve, reject, retry, timer }); this.channel.postMessage(message);
    });
  }
}
