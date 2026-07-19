'use client';

import { use, useEffect, useState } from 'react';
import { CaseForm } from '@/components/CaseForm';
import { JudgingAnimation } from '@/components/JudgingAnimation';
import { VerdictCard } from '@/components/VerdictCard';
import { ChecklistProgress } from '@/components/ChecklistProgress';
import { AppealForm } from '@/components/AppealForm';
import { LanguageToggle } from '@/components/LanguageToggle';
import { JudgeCat } from '@/components/JudgeCat';
import { useLanguage } from '@/components/LanguageProvider';
import { useVerdictStream } from '@/lib/useVerdictStream';
import { toggleTask } from '@/lib/intimacy';
import type { Case, PartyStatement, Verdict } from '@/lib/schema';

// 单机模式的 phase 状态机——所有屏在一个 route 里靠 phase 切换
// 之所以不拆多个 route，是因为单机模式下两人共用一台设备，不涉及后端房间同步，
// 全在客户端内存里流转最简单；换 route 反而丢 state。
type Phase =
  | 'input'              // 双方填写陈述（Screen 3）
  | 'judging'            // 一审动画 + 流式生成（Screen 4）
  | 'verdict'            // 一审判决书 + 接受/上诉按钮（Screen 5）
  | 'appeal-supplement'  // 上诉方补陈（Screen 6）
  | 'judging-appeal'     // 二审动画 + 流式生成（Screen 4 复用，variant='appeal'）
  | 'final-verdict'      // 二审终审判决书（Screen 5 复用，isFinal）
  | 'checklist'          // 和解 checklist（Screen 7）
  | 'done';              // 撒花页（Screen 8）

// 单机模式：所有屏在一个页面里，用 phase state 切换
export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  // Next 16 的 route params 是 Promise——用 React 19 的 use() 解包
  const { id } = use(params);
  const { language, t } = useLanguage();
  const stream = useVerdictStream();

  // 双方陈述——单机模式两人共用一台，同时可见（并排两个 CaseForm）
  const [left, setLeft] = useState<PartyStatement>({ name: '', narrative: '', grievance: '' });
  const [right, setRight] = useState<PartyStatement>({ name: '', narrative: '', grievance: '' });
  const [phase, setPhase] = useState<Phase>('input');

  // caseState 缓存最新的完整 Case——包括判决、决定、亲密度
  // 一审完成后写入 firstVerdict；checklist 勾选走 toggleTask 更新 intimacyScore/completedChecklist
  const [caseState, setCaseState] = useState<Case | null>(null);
  // 二审判决单独放——避免和一审混淆，displayVerdict 优先取它
  const [finalVerdict, setFinalVerdict] = useState<Verdict | null>(null);
  // 上诉方是 left 还是 right——决定 AppealForm 的 side 和 case.appeal.appellant
  const [appellant, setAppellant] = useState<'left' | 'right' | null>(null);

  // 构建当前 case data——每次都从最新的双方陈述 + caseState 拼装
  // 不用 useMemo：调用点少（handleSubmit/effect/appeal），每次拼一份新 object 反而更清晰
  const buildCase = (): Case => ({
    id,
    language,
    mode: 'single',
    createdAt: Date.now(),
    left,
    right,
    intimacyScore: caseState?.intimacyScore ?? 0,
    completedChecklist: caseState?.completedChecklist ?? [],
    firstVerdict: caseState?.firstVerdict,
    firstVerdictDecisions: caseState?.firstVerdictDecisions,
    appeal: caseState?.appeal,
    finalVerdict: caseState?.finalVerdict,
  });

  // ===== 一审：CaseForm 提交后触发 SSE 流式生成 =====
  const handleSubmit = async () => {
    setPhase('judging');
    const c = buildCase();
    await stream.start(c, false);
  };

  // 用 effect 监听 stream 完成——避免 render 期 setState 的死循环
  // 依赖只列 done + phase：buildCase 每次 render 都是新引用，不该触发本 effect
  useEffect(() => {
    if (stream.done && phase === 'judging') {
      // 一审完成：把 partial verdict 落到 caseState.firstVerdict
      const c = buildCase();
      c.firstVerdict = stream.partial as Verdict;
      setCaseState(c);
      setPhase('verdict');
      stream.reset();
    }
    if (stream.done && phase === 'judging-appeal') {
      // 二审完成：单独放到 finalVerdict——displayVerdict 会优先取它
      setFinalVerdict(stream.partial as Verdict);
      setPhase('final-verdict');
      stream.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.done, phase]);

  const handleAccept = () => {
    // 一审/二审都走这个入口——直接进 checklist（单机模式不需要双方分别接受）
    setPhase('checklist');
  };

  const handleAppealClick = (who: 'left' | 'right') => {
    setAppellant(who);
    setPhase('appeal-supplement');
  };

  // ===== 二审：上诉方提交补充陈述 =====
  const handleAppealSubmit = async (supplement: string) => {
    // 单机模式简化：不需要对方回应等待窗口，两人共用一台可口头协商
    // 只记录发起方 + 补陈内容即可；respondentSupplement 留空
    setPhase('judging-appeal');
    const c = buildCase();
    if (c.firstVerdict && appellant) {
      c.appeal = { appellant, appellantSupplement: supplement };
      await stream.start(c, true);
    }
  };

  // ===== Checklist：勾选/取消勾选一个任务 =====
  const handleToggleTask = (taskId: string, _points: number) => {
    if (!caseState) return;
    // 亲密度累加走 toggleTask——保证 case 状态不可变、intimacyScore 精确同步
    const verdict = finalVerdict ?? caseState.firstVerdict!;
    const next = toggleTask(caseState, taskId, verdict);
    setCaseState(next);

    // 全部勾完 → done phase（延迟 800ms 让最后一次 "+N 🌿" 弹窗看得见）
    if (next.completedChecklist.length === verdict.reconciliation_checklist.length) {
      setTimeout(() => setPhase('done'), 800);
    }
  };

  // 显示时优先用 finalVerdict——二审后一审判决作废
  const displayVerdict = finalVerdict ?? caseState?.firstVerdict;
  const partialVerdict = stream.partial;

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto space-y-6">
      {/* 顶栏：猫头（按 phase 切状态）+ 标题 + 语言切换 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <JudgeCat
            state={phase === 'judging' ? 'judging' : phase === 'judging-appeal' ? 'reviewing' : 'idle'}
            size={56}
          />
          <span className="text-cinnamon font-bold">{t.app.title}</span>
        </div>
        <LanguageToggle />
      </div>

      {/* Phase: input——并排两份 CaseForm，右侧带提交按钮 */}
      {phase === 'input' && (
        <div className="grid md:grid-cols-2 gap-4">
          <CaseForm side="left" onChange={setLeft} />
          <CaseForm side="right" onChange={setRight} onSubmit={handleSubmit} />
        </div>
      )}

      {/* Phase: judging（一审 or 二审）——展示动画 + 已到齐的 partial verdict */}
      {(phase === 'judging' || phase === 'judging-appeal') && (
        <>
          <JudgingAnimation variant={phase === 'judging-appeal' ? 'appeal' : 'first'} />
          {/* 流式生成过程中，section 逐个填充；只要有一个 key 就展示卡片 */}
          {Object.keys(partialVerdict).length > 0 && (
            <VerdictCard
              verdict={partialVerdict}
              leftName={left.name}
              rightName={right.name}
            />
          )}
        </>
      )}

      {/* Phase: verdict——一审判决 + 接受按钮 + 双方谁上诉的两个链接 */}
      {phase === 'verdict' && caseState?.firstVerdict && (
        <>
          <VerdictCard
            verdict={caseState.firstVerdict}
            leftName={left.name}
            rightName={right.name}
            onAccept={handleAccept}
            onAppeal={() => handleAppealClick('left')}
          />
          {/* 单机模式两人共用屏幕：VerdictCard 的 onAppeal 默认走 left；
              这里额外补一行链接让 right 也能发起上诉 */}
          <div className="flex gap-2 justify-center text-sm">
            <button
              className="text-cinnamon underline hover:text-rose"
              onClick={() => handleAppealClick('left')}
            >
              {left.name} 上诉
            </button>
            <span>·</span>
            <button
              className="text-cinnamon underline hover:text-rose"
              onClick={() => handleAppealClick('right')}
            >
              {right.name} 上诉
            </button>
          </div>
        </>
      )}

      {/* Phase: appeal-supplement——上诉方补陈表单 */}
      {phase === 'appeal-supplement' && appellant && (
        <AppealForm
          side={appellant}
          role="appellant"
          onSubmit={handleAppealSubmit}
        />
      )}

      {/* Phase: final-verdict——二审终局判决，只有接受按钮 */}
      {phase === 'final-verdict' && finalVerdict && (
        <VerdictCard
          verdict={finalVerdict}
          leftName={left.name}
          rightName={right.name}
          isFinal
          onAccept={handleAccept}
        />
      )}

      {/* Phase: checklist——和解任务 + 亲密度累计 */}
      {phase === 'checklist' && displayVerdict && caseState && (
        <ChecklistProgress
          verdict={displayVerdict}
          completedIds={caseState.completedChecklist}
          intimacyScore={caseState.intimacyScore}
          onToggle={handleToggleTask}
        />
      )}

      {/* Phase: done——撒花庆祝 + 亲密度总分 + 重置按钮 */}
      {phase === 'done' && caseState && displayVerdict && (
        <div className="text-center py-12 space-y-4">
          <div className="text-6xl">✨🌸🐾💚</div>
          <div className="text-accept text-xl font-bold">{t.checklist.success}</div>
          <div className="text-7xl font-black text-accept">+{caseState.intimacyScore}</div>
          <div className="text-cinnamon">{t.checklist.total}</div>
          <button
            onClick={() => (window.location.href = '/')}
            className="mt-6 px-8 py-3 rounded-full bg-accept text-cream font-bold hover:shadow-lg transition"
          >
            {t.checklist.next_case}
          </button>
        </div>
      )}

      {/* 错误提示——SSE 层失败时，展示猫猫犯困的提示 + 重试链接 */}
      {stream.error && (
        <div className="text-center text-rose bg-rose/10 border-2 border-rose/40 rounded-xl p-4">
          🐾 {t.error.sleepy}
          <button
            onClick={() => window.location.reload()}
            className="ml-3 underline"
          >
            {t.error.retry}
          </button>
        </div>
      )}
    </main>
  );
}
