'use client';

import { motion } from 'framer-motion';
import type { Verdict } from '@/lib/schema';
import { useLanguage } from './LanguageProvider';
import { ResponsibilityBar } from './ResponsibilityBar';
import { CrimeCard } from './CrimeCard';

type Props = {
  verdict: Partial<Verdict>;         // 流式生成时字段可能不全
  leftName: string;
  rightName: string;
  onAccept?: () => void;
  onAppeal?: () => void;
  isFinal?: boolean;                 // 二审终局——隐藏上诉按钮
  acceptedByMe?: boolean;
  acceptedByOpponent?: boolean;
};

// 判决书主组件——每个 section 到齐一个 fade in 一个
export function VerdictCard({
  verdict, leftName, rightName, onAccept, onAppeal,
  isFinal = false, acceptedByMe = false, acceptedByOpponent = false,
}: Props) {
  const { t } = useLanguage();

  return (
    <div className="rounded-2xl bg-gradient-to-br from-honey to-sand p-6 border-2 border-terra shadow-lg space-y-4">
      <div className="flex items-center gap-2">
        <span className="inline-block bg-cinnamon text-cream px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
          {isFinal ? t.verdict.final_title : t.verdict.title}
        </span>
      </div>

      {/* 责任比例——先出，最直观 */}
      {verdict.responsibility && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs uppercase tracking-widest text-cinnamon font-bold mb-2">
            {t.verdict.responsibility}
          </div>
          <ResponsibilityBar
            left={verdict.responsibility.left}
            right={verdict.responsibility.right}
            leftName={leftName}
            rightName={rightName}
          />
        </motion.section>
      )}

      {/* 核心矛盾 */}
      {verdict.core_conflict && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs uppercase tracking-widest text-cinnamon font-bold mb-2">
            {t.verdict.core_conflict}
          </div>
          <p className="text-cocoa">{verdict.core_conflict}</p>
        </motion.section>
      )}

      {/* 罪名列表——按 side 匹配对应的名字 */}
      {verdict.crimes && verdict.crimes.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs uppercase tracking-widest text-cinnamon font-bold mb-2">
            {t.verdict.declaration}
          </div>
          <div className="space-y-2">
            {verdict.crimes.map((c, i) => (
              <CrimeCard
                key={i}
                crime={c}
                partyName={c.side === 'left' ? leftName : rightName}
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* 猫猫结尾一句 */}
      {verdict.cat_closing_line && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="italic text-center text-cinnamon"
        >
          {verdict.cat_closing_line}
        </motion.p>
      )}

      {/* 接受/上诉按钮——只有 checklist 就绪且传了 handler 才显示 */}
      {verdict.reconciliation_checklist && (onAccept || onAppeal) && (
        <div className="flex gap-3 pt-2">
          {onAccept && (
            <button
              onClick={onAccept}
              disabled={acceptedByMe}
              className="flex-1 py-3 rounded-full bg-accept text-cream font-bold disabled:opacity-60 hover:shadow-md transition"
            >
              {acceptedByMe && acceptedByOpponent
                ? '✓✓'
                : acceptedByMe
                ? t.verdict.waiting_opponent_decision
                : isFinal
                ? t.verdict.accept_only
                : t.verdict.accept}
            </button>
          )}
          {onAppeal && !isFinal && (
            <button
              onClick={onAppeal}
              className="flex-1 py-3 rounded-full bg-rose text-cream font-bold hover:shadow-md transition"
            >
              {t.verdict.appeal}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
