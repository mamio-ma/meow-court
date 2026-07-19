'use client';

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
  const { language } = useLanguage();

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
    } catch (err) {
      // 远程模式后端未配置时会 503——用 alert 简单提示（正式版可换 toast）
      alert(`远程模式暂不可用：${(err as Error).message}`);
    }
  };

  return (
    <main className="min-h-screen p-6 flex flex-col items-center justify-center gap-8 relative">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      <ModeSelector onSelect={handleSelect} />
    </main>
  );
}
