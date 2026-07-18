'use client';

import { useState, useCallback } from 'react';
import type { Case, Verdict } from './schema';

type StreamState = {
  partial: Partial<Verdict>;   // 已到达的 section 逐步填充
  done: boolean;
  error: string | null;
  loading: boolean;
  retryAttempt: number;        // spec §7 retry: 服务端 emit 时更新，UI 可展示
};

// SSE 客户端 hook——发起 POST /api/verdict，逐段累积判决
export function useVerdictStream() {
  const [state, setState] = useState<StreamState>({
    partial: {},
    done: false,
    error: null,
    loading: false,
    retryAttempt: 0,
  });

  const start = useCallback(async (caseData: Case, isAppeal: boolean) => {
    setState({ partial: {}, done: false, error: null, loading: true, retryAttempt: 0 });

    try {
      const res = await fetch('/api/verdict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case: caseData, isAppeal }),
      });

      if (!res.ok || !res.body) throw new Error(`Bad response: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // 逐 chunk 读取 SSE——按 \n\n 分包
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const dataLine = part.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json) continue;
          try {
            const ev = JSON.parse(json);
            if (ev.type === 'section') {
              setState((prev) => ({
                ...prev,
                partial: { ...prev.partial, [ev.section]: ev.content },
              }));
            } else if (ev.type === 'done') {
              setState((prev) => ({
                ...prev,
                partial: ev.verdict,
                done: true,
                loading: false,
              }));
              return ev.verdict as Verdict;
            } else if (ev.type === 'error') {
              throw new Error(ev.message);
            } else if (ev.type === 'retry') {
              setState((prev) => ({ ...prev, retryAttempt: ev.attempt, partial: {} }));
            }
          } catch (e) {
            // 单条 JSON 解析错，忽略继续读——非致命
            // 但若是内部 throw（如上面的 error/done 分支）会传播到外层 catch
            if (e instanceof Error && e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }
    } catch (err) {
      setState((prev) => ({ ...prev, error: (err as Error).message, loading: false }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ partial: {}, done: false, error: null, loading: false, retryAttempt: 0 });
  }, []);

  return { ...state, start, reset };
}
