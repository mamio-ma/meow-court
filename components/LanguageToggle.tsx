'use client';

import { useLanguage } from './LanguageProvider';

// 顶部右上角的中英切换开关——一个 pill 按钮，click 切换
// 视觉风格：奶油底 + 沙色描边 + 肉桂色文字，贴合猫猫法庭暖色主题
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <button
      onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
      className="px-3 py-1 rounded-full border-2 border-sand bg-cream text-cinnamon text-xs font-bold hover:bg-honey transition"
      aria-label="Toggle language"
    >
      {language === 'zh' ? '中 / EN' : 'EN / 中'}
    </button>
  );
}
