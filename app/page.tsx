'use client';

import { useRouter } from 'next/navigation';
import { JudgeCat } from '@/components/JudgeCat';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/components/LanguageProvider';

// Landing 屏（Screen 1）——猫猫大图 + tagline + 开始按钮 + 中英切换
// 点击“开始审判”跳转 /mode 进入模式选择（Screen 2）
export default function Home() {
  // 从 LanguageProvider 拿到翻译树；t.app.* 承载本页所有文案
  const { t } = useLanguage();
  // Next.js App Router 客户端导航——避免整页刷新
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6 relative">
      {/* 右上角语言切换，绝对定位不影响主轴布局 */}
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      {/* 猫猫大法官 hero——idle 状态（不做微动画），底部挂 CHIEF JUSTICE 徽章 */}
      <JudgeCat state="idle" size={240} showBadge />

      {/* 标题区：小标 · 主标 · tagline 三行叠置，视觉锚点在主标上 */}
      <div className="text-center space-y-2 mt-6">
        <div className="text-xs uppercase tracking-[0.3em] text-cinnamon">
          {t.app.subtitle}
        </div>
        <h1 className="text-4xl font-extrabold text-cocoa">
          {t.app.title}
        </h1>
        <p className="text-cinnamon italic">{t.app.tagline}</p>
      </div>

      {/* CTA：胶囊按钮 + rose→cinnamon 渐变，视觉上呼应色板主色 */}
      <button
        onClick={() => router.push('/mode')}
        className="px-10 py-4 rounded-full bg-gradient-to-br from-rose to-cinnamon text-cream font-bold text-lg shadow-lg hover:shadow-xl transition"
      >
        {t.app.start}
      </button>
    </main>
  );
}
