'use client';

import { useLanguage } from './LanguageProvider';

// 组件属性：宿主页面通过 onSelect 回调接收用户选择的模式
type Props = {
  onSelect: (mode: 'single' | 'remote') => void;
};

// 模式选择器——两个大按钮，单机/远程
// 单机模式：两人共用一台设备轮流输入
// 远程模式：两人各自在自己的设备上参与
export function ModeSelector({ onSelect }: Props) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {/* 标题——引导用户选择使用场景 */}
      <h2 className="text-2xl font-bold text-cinnamon text-center">
        {t.mode.title}
      </h2>

      {/* 单机模式按钮——terra 边框以示区分 */}
      <button
        onClick={() => onSelect('single')}
        className="w-full bg-cream border-2 border-terra rounded-2xl p-6 text-left hover:shadow-lg transition"
      >
        <div className="text-xl font-bold text-cocoa mb-1">📱 {t.mode.single}</div>
        <div className="text-sm text-cinnamon">{t.mode.single_desc}</div>
      </button>

      {/* 远程模式按钮——rose 边框，暗示两端协作的柔和氛围 */}
      <button
        onClick={() => onSelect('remote')}
        className="w-full bg-cream border-2 border-rose rounded-2xl p-6 text-left hover:shadow-lg transition"
      >
        <div className="text-xl font-bold text-cocoa mb-1">📱↔️📱 {t.mode.remote}</div>
        <div className="text-sm text-cinnamon">{t.mode.remote_desc}</div>
      </button>
    </div>
  );
}
