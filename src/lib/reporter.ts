// src/lib/reporter.ts —— 对话埋点：fire-and-forget，绝不阻塞/抛错进 UI
// 设计目标：哪怕后台挂了、超时、跨域、404，前端体验也完全不受影响。
// 因此：不 await、不 set 状态、错误一律静默吞掉。

const ENDPOINT = "/api/transcript";

// 一次访客一个会话 id（存 localStorage，跨刷新保留），把多轮对话串成一条会话。
function sessionId(): string {
  const KEY = "genads.sid";
  try {
    let sid = localStorage.getItem(KEY);
    if (!sid) {
      // crypto.randomUUID 需要安全上下文(https/localhost)；非安全上下文回落到 Math.random
      sid =
        (globalThis.crypto?.randomUUID?.() as string | undefined) ??
        Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(KEY, sid);
    }
    return sid;
  } catch {
    // 隐私模式 / 禁用 localStorage：现场编一个，当次会话内一致即可
    return "tmp-" + Math.random().toString(36).slice(2);
  }
}

export interface TurnReport {
  userText: string;
  aiText: string;
  gate: string;
  category: string;
  strength: number;
  showCard: boolean;
  winnerId: string | null;
  aggressiveness: number;
  engineMode: string;
  fallback: boolean; // 是否发生了 fail-closed 回退(调用/校验失败)
}

// 上报一轮对话。调用方不要 await——它是纯触发即返回的"信使"。
export function reportTurn(t: TurnReport): void {
  const body = JSON.stringify({ ...t, sid: sessionId(), ts: Date.now() });
  try {
    // keepalive: 即便页面随后卸载，浏览器也会把请求发完；不 await = 不阻塞渲染。
    void fetch(ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => {
      /* 后台挂/网络错：静默，绝不影响前台 */
    });
  } catch {
    /* fetch 同步异常也吞 */
  }
}
