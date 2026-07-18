'use client';

import Image from 'next/image';
import { motion, type Variants } from 'framer-motion';

// 猫猫头像的几种状态：
//   idle       —— 静态，Landing / 空闲屏
//   judging    —— 一审动画：左右轻摇（准备落槌）
//   reviewing  —— 二审动画：上下微浮（重新审阅卷宗）
type CatState = 'idle' | 'judging' | 'reviewing';

type Props = {
  state?: CatState;
  size?: number;      // 头像直径 (px)
  showBadge?: boolean; // 底部是否显示 "CHIEF JUSTICE 🐾" 徽章
};

// 通用猫猫组件——所有屏都用它，通过 state 切换微动画
export function JudgeCat({ state = 'idle', size = 240, showBadge = false }: Props) {
  // 不同 state 用不同 framer-motion 变体
  const variants: Variants = {
    idle: { rotate: 0, y: 0 },
    judging: {
      rotate: [-3, 3, -3],
      transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
    },
    reviewing: {
      y: [0, -4, 0],
      transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
    },
  };

  return (
    <div className="relative inline-block">
      <motion.div
        animate={state}
        variants={variants}
        className="rounded-2xl overflow-hidden p-2"
        style={{
          // 金色渐变框——法官气质
          background: 'linear-gradient(135deg, #e8a583 0%, #c88a6a 100%)',
          boxShadow: '0 8px 20px rgba(139, 90, 71, 0.25)',
          width: size + 16,
          height: size + 16,
        }}
      >
        <Image
          src="/judge-cat.png"
          alt="Chief Justice Whiskers"
          width={size}
          height={size}
          className="rounded-xl object-cover"
          priority
        />
      </motion.div>
      {showBadge && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-rose text-cream text-xs font-bold border-2 border-cream shadow-md whitespace-nowrap">
          CHIEF JUSTICE 🐾
        </div>
      )}
    </div>
  );
}
