'use client';

import { use, useEffect, useState } from 'react';
import { nanoid } from 'nanoid';
import { CaseForm } from '@/components/CaseForm';
import { JudgingAnimation } from '@/components/JudgingAnimation';
import { VerdictCard } from '@/components/VerdictCard';
import { ChecklistProgress } from '@/components/ChecklistProgress';
import { AppealForm } from '@/components/AppealForm';
import { LanguageToggle } from '@/components/LanguageToggle';
import { JudgeCat } from '@/components/JudgeCat';
import { useLanguage } from '@/components/LanguageProvider';
import type { Case, PartyStatement } from '@/lib/schema';

// 远程模式：每 2s 拉一次房间状态，UI 根据 case 字段推断当前 phase
// hostToken 存 localStorage；首次访客生成新 token 作 guest 使用
export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { t } = useLanguage();

  // token 分配：先看 localStorage 里有没有 host token（Task 24 已存），
  // 没有的话就作为 guest 生成一个 uuid 存下来
  const [token, setToken] = useState<string>('');
  useEffect(() => {
    const key = `room-token:${code}`;
    let stored = localStorage.getItem(key);
    if (!stored) {
      stored = nanoid();
      localStorage.setItem(key, stored);
    }
    setToken(stored);
  }, [code]);

  const [caseState, setCaseState] = useState<Case | null>(null);
  const [myRole, setMyRole] = useState<'left' | 'right'>('left');
  const [notFound, setNotFound] = useState(false);
  const [myStatement, setMyStatement] = useState<PartyStatement>({
    name: '', narrative: '', grievance: '',
  });
  const [submittedLocally, setSubmittedLocally] = useState(false);
  const [showAppealForm, setShowAppealForm] = useState(false);

  // 2s 轮询房间状态——MVP 不用 WebSocket
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/rooms/${code}?token=${token}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setCaseState(data.case);
        setMyRole(data.myRole);
      } catch {
        // 瞬时错误忽略，下次 tick 会重试
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [code, token]);

  // 统一 PATCH 助手——所有 mutation 走这里
  const patch = async (action: string, payload: unknown) => {
    await fetch(`/api/rooms/${code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action, payload }),
    });
  };

  const handleSubmit = async () => {
    await patch('submit_statement', myStatement);
    setSubmittedLocally(true);
  };

  // 房间已归档（TTL 过期或从未存在）
  if (notFound) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
        <div className="text-4xl">📂</div>
        <p className="text-cinnamon">{t.error.archived}</p>
      </main>
    );
  }

  if (!caseState) {
    return (
      <main className="min-h-screen flex items-center justify-center text-cinnamon">
        Loading...
      </main>
    );
  }

  const mySide = caseState[myRole];
  const oppSide = caseState[myRole === 'left' ? 'right' : 'left'];
  const iSubmitted = !!mySide.submittedAt || submittedLocally;
  const bothSubmitted = !!(mySide.submittedAt && oppSide.submittedAt);

  const displayVerdict = caseState.finalVerdict ?? caseState.firstVerdict;
  const iAccepted =
    myRole === 'left'
      ? !!caseState.firstVerdictDecisions?.leftAccepted
      : !!caseState.firstVerdictDecisions?.rightAccepted;
  const oppAccepted =
    myRole === 'left'
      ? !!caseState.firstVerdictDecisions?.rightAccepted
      : !!caseState.firstVerdictDecisions?.leftAccepted;

  // 顶部房间码 banner——方便分享
  const codeBadge = (
    <div className="text-center py-2 bg-cream border-b border-sand text-xs text-cinnamon">
      {t.mode.your_code}:{' '}
      <span className="font-bold text-cocoa tracking-widest">{code}</span> ·{' '}
      {t.mode.share_hint}
    </div>
  );

  return (
    <main className="min-h-screen">
      {codeBadge}
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <JudgeCat state="idle" size={48} />
            <span className="text-cinnamon font-bold text-sm">
              {myRole === 'left' ? '甲方' : '乙方'}
            </span>
          </div>
          <LanguageToggle />
        </div>

        {/* 阶段 1：陈述——己方还没提交 */}
        {!displayVerdict && !iSubmitted && (
          <CaseForm
            side={myRole}
            onChange={setMyStatement}
            onSubmit={handleSubmit}
          />
        )}

        {/* 阶段 2：等对方 or 等判决生成 */}
        {!displayVerdict && iSubmitted && (
          <div className="text-center py-16">
            {!bothSubmitted ? (
              <p className="text-cinnamon">{t.input.waiting_opponent}</p>
            ) : (
              <JudgingAnimation variant="first" />
            )}
          </div>
        )}

        {/* 阶段 3：判决书 */}
        {displayVerdict && !showAppealForm && (
          <VerdictCard
            verdict={displayVerdict}
            leftName={caseState.left.name || '甲方'}
            rightName={caseState.right.name || '乙方'}
            isFinal={!!caseState.finalVerdict}
            onAccept={() => patch('accept_verdict', {})}
            onAppeal={() => setShowAppealForm(true)}
            acceptedByMe={iAccepted}
            acceptedByOpponent={oppAccepted}
          />
        )}

        {/* 阶段 4：上诉补陈 */}
        {showAppealForm && (
          <AppealForm
            side={myRole}
            role="appellant"
            onSubmit={async (supplement) => {
              await patch('submit_appeal', { supplement });
              setShowAppealForm(false);
            }}
          />
        )}

        {/* 阶段 5：Checklist——双方都接受后 */}
        {displayVerdict && iAccepted && oppAccepted && (
          <ChecklistProgress
            verdict={displayVerdict}
            completedIds={caseState.completedChecklist}
            intimacyScore={caseState.intimacyScore}
            onToggle={(taskId, points) =>
              patch('check_task', { taskId, points })
            }
          />
        )}
      </div>
    </main>
  );
}
