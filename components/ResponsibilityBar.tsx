'use client';

type Props = {
  left: number;      // 0-100
  right: number;     // 0-100 (left + right === 100)
  leftName: string;
  rightName: string;
};

// 责任比例条——两色渐变对半分，甲方玫瑰、乙方陶土
export function ResponsibilityBar({ left, right, leftName, rightName }: Props) {
  return (
    <div className="flex h-8 rounded-full overflow-hidden border-2 border-cocoa/10 bg-cream">
      <div
        className="bg-gradient-to-br from-rose to-rose/80 text-cream flex items-center justify-center text-xs font-bold px-2"
        style={{ width: `${left}%` }}
      >
        {leftName} {left}%
      </div>
      <div
        className="bg-gradient-to-br from-terra to-terra/80 text-cream flex items-center justify-center text-xs font-bold px-2"
        style={{ width: `${right}%` }}
      >
        {rightName} {right}%
      </div>
    </div>
  );
}
