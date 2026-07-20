# 部署到 Vercel · 手动步骤清单

## 前置

- 本地已有完整代码（分支 `feat/mvp-implementation`）
- 你的 GitHub 账号
- 你的 Vercel 账号（免费额度够）
- Bedrock token 已知（见 `.env.local`）

## 步骤

### 1. 推到 GitHub

```bash
cd /Users/mingyongm/ai-mediation-judge

# 先切回 main，把 feat 分支合并进来（fast-forward）
git checkout main
git merge feat/mvp-implementation --ff-only

# 在 GitHub 创建一个新的 empty repo，比如 feline-court
# 然后：
git remote add origin git@github.com:<你的用户名>/feline-court.git
git push -u origin main
```

（如果你希望走 PR flow 而非直推 main，跳过 merge，直接 `git push -u origin feat/mvp-implementation` 然后在 GitHub 上开 PR。）

### 2. Vercel 连接 repo

1. https://vercel.com/new
2. Import 该 GitHub repo
3. Framework Preset 会自动检测为 **Next.js**——保留默认
4. 不用改 build command / output dir

### 3. 配环境变量

在 Vercel 的 **Environment Variables** 表单里加：

| Key | Value |
|---|---|
| `AWS_BEARER_TOKEN_BEDROCK` | `ABSK...`（从 `.env.local` 拷贝） |
| `AWS_REGION` | `us-east-1` |
| `BEDROCK_MODEL_ID` | `us.anthropic.claude-sonnet-4-6` |

**Environment**: 选 `Production` + `Preview`（Development 保持本地 .env.local）。

### 4. Upstash Redis（远程模式才需要）

如果你想开启远程双人房间模式：

1. Vercel Project → Storage → Marketplace → 找 **Upstash**
2. Add Integration → 授权 → 创建一个新 Redis DB（免费 tier 够）
3. Vercel 会自动注入 `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` 到环境变量

如果暂时不加，单机模式仍完全可用，远程房间会返回 503。

### 5. Deploy

点 **Deploy**。第一次约 2-3 分钟。完成后 Vercel 会给一个类似 `feline-court.vercel.app` 的 URL。

### 6. 冒烟验证

打开 URL，走一遍：

- Landing 页应看到猫猫大图 + "开始审判"
- 点击 → Mode → 单机
- 双方填内容 → 提交 → 应该在 5-10 秒内看到判决书流式出现
- 接受判决 → 勾 checklist → 撒花

如果判决卡住或报错：
- Vercel Logs 里搜 "bedrock" 看具体错误
- 常见问题：token 拼错、region 错、model ID 忘了 `us.` 前缀

## 后续

- 绑自定义域名：Vercel Project → Domains
- 换更省钱的 model：`BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0`（Haiku 速度快、成本约 Sonnet 的 1/10）
- 加 preview 分支自动部署：Vercel 默认开启，push 到非 main 分支会自动出预览 URL
