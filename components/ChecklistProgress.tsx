'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { Verdict } from '@/lib/schema';
import { useLanguage } from './LanguageProvider';
import { totalPossibleIntimacy } from '@/lib/intimacy';

type Props = {
  verdict: Verdict;
  completedIds: string[];
  intimacyScore: number;
  onToggle: (taskId: string, points: number) => void;
};

// 和解 checklist——每项可点击勾选，勾选时右上飘 "+X 🌿" 弹窗
// 亲密度分数由父组件维护（单机模式用 lib/intimacy，远程模式走 API）
export function ChecklistProgress({
  verdict, completedIds, intimacyScore, onToggle,
}: Props) {
  const { t } = useLanguage();
  const [popup, setPopup] = useState<{ id: number; points: number } | null>(null);
  const total = totalPossibleIntimacy(verdict);

  const handleClick = (taskId: string, points: number) => {
    const isNewlyChecked = !completedIds.includes(taskId);
    onToggle(taskId, points);
    if (isNewlyChecked) {
      // 弹窗停留 1.5s——够看清但不干扰下一次点击
      setPopup({ id: Date.now(), points });
      setTimeout(() => setPopup(null), 1500);
    }
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-cream to-peach p-6 border-2 border-accept/50 relative">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-accept text-xs font-bold uppercase tracking-widest">
          🌿 {t.checklist.title}
        </span>
        <span className="text-cocoa font-bold">
          {t.checklist.total} · {intimacyScore} / {total}
        </span>
      </div>

      <div className="space-y-2">
        {verdict.reconciliation_checklist.map((task) => {
          const isChecked = completedIds.includes(task.id);
          return (
            <button
              key={task.id}
              onClick={() => handleClick(task.id, task.intimacy_points)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left border transition ${
                isChecked
                  ? 'bg-accept/20 border-accept/40'
                  : 'bg-white border-accept/20 hover:border-accept/50'
              }`}
            >
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  isChecked ? 'bg-accept border-accept' : 'border-accept/60'
                }`}
              >
                {isChecked && <span className="text-cream text-xs">✓</span>}
              </div>
              <span className="text-cocoa flex-1">{task.task}</span>
              <span className="text-xs text-accept font-bold">+{task.intimacy_points}</span>
            </button>
          );
        })}
      </div>

      {/* 飘浮 +N 弹窗——右上角上升渐隐 */}
      <AnimatePresence>
        {popup && (
          <motion.div
            key={popup.id}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: -30 }}
            exit={{ opacity: 0, y: -60 }}
            transition={{ duration: 1.5 }}
            className="absolute top-4 right-4 bg-accept text-cream px-3 py-1 rounded-full font-bold text-sm pointer-events-none"
          >
            +{popup.points} 🌿
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
