'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, type Language, type TranslationTree } from '@/lib/i18n';

// Context 载荷：当前语言、切换函数、当前语言对应的翻译树
type Ctx = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationTree;
};

const LanguageContext = createContext<Ctx | null>(null);

// 本地存储 key——记住用户的语言偏好，跨会话保持
const STORAGE_KEY = 'feline-court-lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  // 默认中文——本组件的主要用户群是中文情侣
  const [language, setLanguageState] = useState<Language>('zh');

  // 首次挂载时从 localStorage 恢复偏好；放在 effect 里避免 SSR 与 CSR 首屏不一致
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved === 'zh' || saved === 'en') setLanguageState(saved);
  }, []);

  // 切换语言时同步写回 localStorage
  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
}

// 消费者 hook——在 Provider 外调用会抛错，帮助尽早发现遗漏包裹
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
