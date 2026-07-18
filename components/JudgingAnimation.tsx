'use client';

import { motion } from 'framer-motion';
import { JudgeCat } from './JudgeCat';
import { useLanguage } from './LanguageProvider';

type Props = {
  variant?: 'first' | 'appeal'; // 一审 vs 二审——影响头像 state + 文案
};

// 审判动画屏——猫猫摇头 + 法槌来回敲 + 呼吸点提示
// 一审：judging 状态（左右摇）；二审：reviewing 状态（上下浮）
export function JudgingAnimation({ variant = 'first' }: Props) {
  const { t } = useLanguage();
  const label = variant === 'first' ? t.animation.thinking : t.animation.second_thinking;
  const catState = variant === 'first' ? 'judging' : 'reviewing';

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16">
      <div className="flex items-end gap-3">
        <JudgeCat state={catState} size={200} />
        {/* 法槌——只在一审动画时晃动，二审时静止（猫在翻卷宗） */}
        {variant === 'first' && (
          <motion.div
            className="text-6xl origin-bottom-right"
            animate={{ rotate: [-20, 25, -20] }}
            transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            🔨
          </motion.div>
        )}
        {variant === 'appeal' && <div className="text-6xl">📜</div>}
      </div>

      {/* 三点呼吸提示 */}
      <div className="flex items-center gap-2 text-cinnamon font-semibold">
        <span>{label}</span>
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-2 h-2 rounded-full bg-terra"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </span>
      </div>

      <p className="text-xs text-cinnamon/70">{t.animation.generating}</p>
    </div>
  );
}
