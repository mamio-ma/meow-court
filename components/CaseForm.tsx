'use client';

import { useState } from 'react';
import { useLanguage } from './LanguageProvider';
import type { PartyStatement } from '@/lib/schema';

type Props = {
  side: 'left' | 'right';                // 决定标签+边框色（甲方玫瑰、乙方陶土）
  initialValue?: Partial<PartyStatement>;
  onChange: (val: PartyStatement) => void;
  onSubmit?: () => void;                  // 有 onSubmit 时才渲染提交按钮
  disabled?: boolean;
};

// 单侧陈述表单——三字段：名字 / 发生了什么 / 生气理由
// 甲方用玫瑰边、乙方用陶土边，方便一眼分辨
export function CaseForm({ side, initialValue, onChange, onSubmit, disabled }: Props) {
  const { t } = useLanguage();
  const [name, setName] = useState(initialValue?.name ?? '');
  const [narrative, setNarrative] = useState(initialValue?.narrative ?? '');
  const [grievance, setGrievance] = useState(initialValue?.grievance ?? '');

  const isLeft = side === 'left';
  const accent = isLeft ? 'text-rose' : 'text-terra';
  const border = isLeft ? 'border-rose/40' : 'border-terra/40';
  const sideLabel = isLeft ? '📝 甲方 · Plaintiff' : '📝 乙方 · Defendant';

  // 任何字段变化都向上抛完整 PartyStatement
  const update = (patch: Partial<PartyStatement>) => {
    const next = { name, narrative, grievance, ...patch };
    setName(next.name);
    setNarrative(next.narrative);
    setGrievance(next.grievance);
    onChange(next);
  };

  return (
    <div className={`rounded-2xl bg-cream p-6 border-2 ${border} shadow-md relative`}>
      <div className={`text-xs font-bold uppercase tracking-wider ${accent} mb-2`}>
        {sideLabel}
      </div>

      <label className="block text-xs uppercase tracking-wide text-cinnamon mt-3 mb-1">
        {t.input.your_name}
      </label>
      <input
        className="w-full rounded-xl bg-white border-2 border-sand px-4 py-2 text-cocoa outline-none focus:border-terra"
        value={name}
        onChange={(e) => update({ name: e.target.value })}
        disabled={disabled}
      />

      <label className="block text-xs uppercase tracking-wide text-cinnamon mt-3 mb-1">
        {t.input.what_happened}
      </label>
      <textarea
        className="w-full rounded-xl bg-white border-2 border-sand px-4 py-2 text-cocoa outline-none focus:border-terra min-h-[80px]"
        value={narrative}
        onChange={(e) => update({ narrative: e.target.value })}
        disabled={disabled}
      />

      <label className="block text-xs uppercase tracking-wide text-cinnamon mt-3 mb-1">
        {t.input.why_angry}
      </label>
      <textarea
        className="w-full rounded-xl bg-white border-2 border-sand px-4 py-2 text-cocoa outline-none focus:border-terra min-h-[60px]"
        value={grievance}
        onChange={(e) => update({ grievance: e.target.value })}
        disabled={disabled}
      />

      {onSubmit && (
        <button
          onClick={onSubmit}
          disabled={disabled || !name || !narrative || !grievance}
          className="w-full mt-4 py-3 rounded-full bg-gradient-to-br from-terra to-cinnamon text-cream font-bold disabled:opacity-50 hover:shadow-lg transition"
        >
          {t.input.submit}
        </button>
      )}
    </div>
  );
}
