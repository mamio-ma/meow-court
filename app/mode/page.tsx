'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { ModeSelector } from '@/components/ModeSelector';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/components/LanguageProvider';

// 模式选择屏（Screen 2）
// 单机：生成本地 case id 直接跳 /case/[id]
// 远程：调 /api/rooms 生成 6 位房间码，hostToken 存 localStorage，然后跳 /room/[code]
export default function ModePage() {
  const router = useRouter();
  const { t, language } = useLanguage();
  // 远程模式不可用时显示的猫猫风格模态框
  const [showRemoteError, setShowRemoteError] = useState(false);

  const handleSelect = async (mode: 'single' | 'remote') => {
    if (mode === 'single') {
      const id = nanoid(10);
      router.push(`/case/${id}?lang=${language}`);
      return;
    }

    // 远程模式——先建房再跳
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const { code, hostToken } = await res.json();
      // hostToken 存 localStorage，方便房主刷新后仍能识别自己
      localStorage.setItem(`room-token:${code}`, hostToken);
      router.push(`/room/${code}`);
    } catch {
      // 远程模式后端未配置时会 503——弹猫猫口吻模态框，引导用户回单机
      setShowRemoteError(true);
    }
  };

  return (
    <main className="min-h-screen p-6 flex flex-col items-center justify-center gap-8 relative">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      <ModeSelector onSelect={handleSelect} />

      {/* 远程不可用模态框——半透明 overlay + 中央卡片 */}
      {showRemoteError && (
        <div
          className="fixed inset-0 bg-cocoa/40 flex items-center justify-center z-50 p-6"
          onClick={() => setShowRemoteError(false)}
        >
          <div
            className="bg-cream rounded-2xl border-2 border-terra shadow-xl max-w-sm w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl text-center">🐾📞</div>
            <h3 className="text-xl font-extrabold text-cocoa text-center">
              {t.error.remote_unavailable_title}
            </h3>
            <p className="text-cinnamon text-center leading-relaxed">
              {t.error.remote_unavailable_body}
            </p>
            <button
              onClick={() => setShowRemoteError(false)}
              className="w-full py-3 rounded-full bg-gradient-to-br from-terra to-cinnamon text-cream font-bold hover:shadow-lg transition"
            >
              {t.error.got_it}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
