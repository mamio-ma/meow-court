'use client';

import { isFelony, type Verdict } from '@/lib/schema';
import { useLanguage } from './LanguageProvider';

type Props = {
  crime: Verdict['crimes'][number];
  partyName: string;
};

// 罪名卡片——重罪玫瑰红边框，轻罪陶土色边框
export function CrimeCard({ crime, partyName }: Props) {
  const { t } = useLanguage();
  const felony = isFelony(crime.severity);
  const label = felony ? t.verdict.felony : t.verdict.misdemeanor;

  return (
    <div
      className={`rounded-lg p-3 border-l-4 ${
        felony ? 'bg-rose/15 border-rose' : 'bg-terra/15 border-terra'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-bold text-cocoa">
          {partyName} · <em className="not-italic text-cinnamon">「{crime.charge}」</em>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            felony ? 'bg-rose text-cream' : 'bg-terra text-cream'
          }`}
        >
          {label}
        </span>
      </div>
      <p className="text-sm text-cocoa/85 mt-1">{crime.reasoning}</p>
    </div>
  );
}
