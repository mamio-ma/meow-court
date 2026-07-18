// 临时色板测试页 —— 用来验证 Feline Court 9 色 token 是否正常工作
// Task 23 完成后，此页会被真正的猫猫法庭 Landing 页替换
//
// ⚠️ Tailwind 4 静态扫描类名，不能用 `bg-${c}` 动态拼接，所以这里写成字面量数组
import Image from "next/image";

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
    <div className="p-8 max-w-3xl mx-auto">
      {/* 猫猫头像预览——用金框裱起来做视觉锚点 */}
      <div className="flex flex-col items-center gap-4">
        <div
          className="rounded-2xl p-2 shadow-lg"
          style={{
            background: "linear-gradient(135deg, #e8a583 0%, #c88a6a 100%)",
          }}
        >
          <Image
            src="/judge-cat.png"
            alt="Chief Justice Whiskers"
            width={240}
            height={240}
            className="rounded-xl object-cover"
            priority
          />
        </div>
        <span className="rounded-full bg-rose text-cream px-4 py-1 text-xs font-bold border-2 border-cream shadow-md -mt-6">
          CHIEF JUSTICE 🐾
        </span>

        <div className="text-center mt-4">
          <div className="text-xs uppercase tracking-[0.3em] text-cinnamon">
            Feline Court · Est. 2026
          </div>
          <h1 className="text-4xl font-extrabold text-cocoa mt-1">
            🐱⚖️ 猫猫大法官
          </h1>
          <p className="mt-2 italic text-cinnamon">
            本喵今日为您调解 ✧（临时色板 · Landing 待 Task 23 完成）
          </p>
        </div>
      </div>

      {/* 色板 */}
      <div className="flex flex-wrap gap-4 mt-10 justify-center">
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
