// 临时色板测试页 —— 用来验证 Feline Court 9 色 token 是否正常工作
// Task 3 完成后，此页会被真正的猫猫法庭主页替换
//
// ⚠️ Tailwind 4 静态扫描类名，不能用 `bg-${c}` 动态拼接，所以这里写成字面量数组
const swatches = [
  { name: "cream", cls: "bg-cream" },
  { name: "peach", cls: "bg-peach" },
  { name: "honey", cls: "bg-honey" },
  { name: "sand", cls: "bg-sand" },
  { name: "rose", cls: "bg-rose" },
  { name: "terra", cls: "bg-terra" },
  { name: "cinnamon", cls: "bg-cinnamon" },
  { name: "cocoa", cls: "bg-cocoa" },
  { name: "accept", cls: "bg-accept" },
];

export default function Home() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-cocoa">🐱⚖️ 猫猫法庭</h1>
      <p className="mt-2 text-cinnamon">Feline Court 暖色调色板测试</p>
      <div className="flex flex-wrap gap-4 mt-6">
        {swatches.map((s) => (
          <div key={s.name} className="flex flex-col items-center gap-1">
            <div
              className={`w-20 h-20 rounded-lg border border-cocoa/10 shadow-sm ${s.cls}`}
              title={s.name}
            />
            <span className="text-xs text-cocoa font-semibold">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
