'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from './LanguageProvider';

type Props = {
  side: 'left' | 'right';
  role: 'appellant' | 'respondent';   // 上诉方 or 反驳方
  responseWindowSeconds?: number;      // 反驳方倒计时
  onSubmit: (supplement: string) => void;
  onSkip?: () => void;                 // 倒计时到 0 触发
};

// 上诉/反驳表单——上诉方无倒计时，反驳方有 responseWindowSeconds 秒
export function AppealForm({ side, role, responseWindowSeconds, onSubmit, onSkip }: Props) {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [remaining, setRemaining] = useState(responseWindowSeconds ?? 0);

  // 反驳方倒计时——每秒-1，到 0 自动 onSkip
  useEffect(() => {
    if (role !== 'respondent' || !responseWindowSeconds) return;
    const tick = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(tick);
          onSkip?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [role, responseWindowSeconds, onSkip]);

  const accent = side === 'left' ? 'border-rose' : 'border-terra';

  return (
    <div className={`rounded-2xl bg-rose/10 p-6 border-2 ${accent} space-y-3`}>
      <div className="inline-block bg-rose text-cream px-3 py-1 rounded-md text-xs font-bold -rotate-2">
        📌 {role === 'appellant' ? t.appeal.title : t.appeal.waiting_response}
      </div>
      <div className="text-xs uppercase tracking-wide text-cinnamon">
        {t.appeal.your_supplement}
      </div>
      <textarea
        className="w-full rounded-xl bg-white border-2 border-rose/30 px-4 py-3 text-cocoa outline-none focus:border-rose min-h-[100px]"
        placeholder={t.appeal.placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      {role === 'respondent' && remaining > 0 && (
        <div className="text-xs text-rose font-bold">
          ⏱️ {t.appeal.waiting_response} · {remaining}{t.appeal.seconds}
        </div>
      )}

      <button
        onClick={() => onSubmit(text)}
        disabled={!text.trim()}
        className="w-full py-2 rounded-full bg-rose text-cream font-bold disabled:opacity-50"
      >
        {t.appeal.submit}
      </button>
    </div>
  );
}
