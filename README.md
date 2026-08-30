# 无畏契约 · 团队阵容协作工具（VALORANT Team Comp Tool）

面向无畏契约（VALORANT）游戏社群的**自定义阵容分享 & 协作工具**。参考 VCT 各大赛区经典强势高胜率阵容，结合每位队员填报的英雄池，为**当前版本所有排位地图**生成适合团队的定制化阵容方案。

> 纯前端 + Supabase 云后端，可一键部署到 **GitHub Pages**；未配置云端时自动降级为**本地离线模式**，开箱即用。

---

## ✨ 功能一览

| 模块 | 说明 |
| --- | --- |
| 🗺️ **地图点位** | 当前排位地图池 7 张地图，展示**全景图 + 小地图**，并在小地图上标注职业比赛常用**道具投掷点位**（进攻/防守分色，悬停查看说明）。点开地图即可查看该图**已保存的团队阵容**。 |
| 🎭 **英雄图鉴** | 当前版本**全部 29 名英雄**，按四大位置（决斗者 / 先锋 / 控场者 / 哨卫）正确分类展示。 |
| 👥 **英雄池 + 首发/替补** | 每位成员选择擅长位置 + 勾选擅长英雄；成员分为**首发（≤5人）/ 替补**两组，一键互相切换，智能生成时优先用首发。 |
| ⚔️ **智能阵容生成 + 编辑** | 以 VCT 经典强势阵容为基准，结合团队英雄池自动分配 5 人阵容；支持**拖拽换人**、**逐位修改英雄与位置**、保存到对应地图、读取已保存方案。 |
| 🎯 **职业选手推荐** | 点击任意英雄，推荐使用该英雄的知名 **VCT 职业选手**（含赛区 / 战队）供学习参考。 |
| 🤖 **AI 分析 & 练习建议** | 接入 **DeepSeek**，对当前阵容给出优化建议、并推荐需要练习的英雄（密钥仅存本机，见下文安全说明）。 |
| 🔄 **地图池动态同步** | 一键从官方 **valorant-api** 同步英雄/地图元数据与素材，随版本轮换自动更新（含缓存与离线兜底）。 |
| 🤝 **多人实时协作** | 基于 Supabase Realtime，最多 5 人同时在线，改动实时同步。 |
| 📜 **编辑日志 & 版本控制** | 完整记录「谁、在何时、改了什么」；每次保存生成历史版本快照，支持**查看 & 一键回滚**。 |
| ⚡ **图片性能优化** | 缩略图用小图（地图缩略比全景小 30~90 倍）、懒加载、异步解码、CDN 预连接，大幅降低加载卡顿。 |
| 📱 **响应式设计** | 桌面 / 平板 / 手机自适应。 |

---

## 🧩 覆盖内容（当前版本）

- **英雄（29）**：
  - 决斗者（8）：捷风、雷兹、芮娜、不死鸟、夜露、霓虹、壹决、幻棱
  - 先锋（7）：猎枭、铁臂、斯凯、K/O、黑梦、盖可、钛狐
  - 控场者（7）：炼狱、蝰蛇、幽影、星礈、海神、暮蝶、**迷核（Miks）**
  - 哨卫（7）：奇乐、零、贤者、尚勃勒、钢锁、维斯、**禁灭（Veto）**
- **排位地图（7）**：亚海悬城、隐世修所、霓虹町、日落之城、幽邃地窟、莲华古城、**天枢云阙（Summit）**

> 地图池会随 Riot 官方轮换调整。若版本更新，改数据文件即可（见下方「更新数据」）。

---

## 📁 项目结构

```
valorant-comp-tool/
├── index.html              # 入口页面
├── css/
│   └── styles.css          # 全部样式（深色 VALORANT 主题，响应式）
├── js/
│   ├── config.js           # ★ Supabase 配置（填 URL / anonKey；留空=本地模式）
│   ├── data/
│   │   ├── agents.js       # 29 英雄数据（位置分类 + 素材 uuid）
│   │   ├── maps.js         # 7 排位地图 + 道具投掷点位 + 地图池声明(RANKED_POOL)
│   │   ├── pros.js         # VCT 职业选手 → 招牌英雄 映射
│   │   └── comps.js        # 各地图 VCT 经典强势阵容模板
│   ├── store.js            # 存储层（Supabase / localStorage 双后端）
│   ├── sync.js             # 与 valorant-api 的地图/英雄元数据同步
│   ├── generator.js        # 智能阵容生成算法（首发优先）
│   ├── ai.js               # DeepSeek AI 分析/练习（密钥仅存本机）
│   └── app.js              # 界面逻辑与交互
├── supabase/
│   └── schema.sql          # ★ Supabase 建表脚本（含 RLS + Realtime + 首发/替补字段）
├── docs/
│   └── 图片性能诊断.md      # 图片卡顿诊断与优化报告
└── README.md
```

---

## 🚀 快速开始

### 方式 A：本地离线模式（零配置，最快）

直接用浏览器打开 `index.html` 即可使用。数据存于浏览器 `localStorage`：
- ✅ 可查看地图点位、英雄图鉴、职业选手推荐
- ✅ 可填英雄池、生成阵容、看编辑日志与历史版本
- ⚠️ 数据仅存于本机，**不支持**多人实时协作

> 提示：部分浏览器用 `file://` 直接打开会限制脚本，建议用本地静态服务器：
> ```bash
> cd valorant-comp-tool
> python3 -m http.server 8777
> # 浏览器访问 http://localhost:8777
> ```

### 方式 B：云端协作模式（推荐，支持多人）

开启后最多 5 人可同时在线协作，数据云端持久化。

**1. 创建 Supabase 项目（免费）**
- 打开 [supabase.com](https://supabase.com) → 注册 → New Project

**2. 建表**
- 进入项目 → 左侧 **SQL Editor** → New query
- 把 [`supabase/schema.sql`](supabase/schema.sql) 全部内容粘贴进去 → **Run**

**3. 拿到连接信息**
- 项目 → **Project Settings → API**
- 复制 **Project URL** 和 **anon public** key

**4. 填入配置**
- 编辑 [`js/config.js`](js/config.js)：
  ```js
  window.VCT.SUPABASE_CONFIG = {
    url: 'https://你的项目.supabase.co',
    anonKey: '你的 anon public key'
  };
  ```

**5. 打开页面**
- 顶部徽标显示「☁ 云端协作已连接」即成功。把网址发给队友，大家共用同一个团队房间。

> `anon public` key 属于可公开的前端密钥，可以安全提交到仓库；数据访问由 SQL 中的 RLS 策略控制（默认对匿名开放读写，便于社群直接用；如需更严格权限可自行收紧策略）。

---

## 🌐 部署到 GitHub Pages

1. 新建 GitHub 仓库，把本项目全部文件推上去：
   ```bash
   git init
   git add .
   git commit -m "init: VALORANT team comp tool"
   git branch -M main
   git remote add origin https://github.com/你的用户名/你的仓库.git
   git push -u origin main
   ```
2. 仓库 → **Settings → Pages** → Source 选 `Deploy from a branch` → 分支选 `main`、目录选 `/ (root)` → Save
3. 稍等片刻，访问 `https://你的用户名.github.io/你的仓库/` 即可。

> GitHub Pages 只托管静态文件（跑不了后端），因此「多人实时协作」依赖 Supabase（方式 B）。这套架构正是为此设计：**静态前端 + Supabase 云后端**，完美适配 Pages。

---

## 🧠 智能阵容生成逻辑

生成器以「该地图的 VCT 经典模板」为 5 个目标英雄槽，再按优先级为队员匹配：

1. **精确匹配**：有队员正好会该英雄 → 直接分配（最佳）。
2. **同位置替补**：没人会该英雄，但有队员擅长该位置 → 用其会的同位置英雄替补。
3. **建议补位**：仍无法满足 → 标记为待补位，并提示需要有人练习该位置。

- 优先把「稀缺英雄」分给唯一会的人，避免冲突。
- 每位队员最多占一个首发槽，其余进入替补/轮换名单。
- 生成后可**拖拽卡片**手动交换成员，再保存。

> 这是启发式推荐，作为参考基准，非唯一解。

---

## 🤖 AI 分析（DeepSeek）配置与安全

在「⚔️ 阵容生成」页可对当前阵容做 **AI 优化分析** 与 **练习建议**，由 DeepSeek 提供。

**如何填写密钥（在哪里填）：**
1. 到 [platform.deepseek.com](https://platform.deepseek.com) → **API Keys** 创建一个密钥。
2. 回到本工具，点右上角 **「⚙️ 设置」** → 在「DeepSeek API 密钥」框粘贴 → 保存。
3. 之后点 **「🤖 AI 分析阵容」/「🎯 练习建议」** 即可。

**密钥安全（重要）：**
- 密钥**只保存在你本机浏览器的 `localStorage`**（键名 `vct_deepseek_key`）。
- **绝不**写入代码、**不**提交 Git 仓库、**不**上传 Supabase、**不**写入编辑日志（日志只记“做了AI分析”这一动作，不含密钥、不含请求原文）。
- 仅在本机内存里拼到 `Authorization` 头，直接发往官方 `api.deepseek.com`。
- 设置里可随时**清除密钥**。因为是纯前端直连，密钥停留在使用者本机，不经过任何中转服务器。

**稳定性 / 限流：** 单次请求 30s 超时；两次调用最小间隔 3s；请求进行中禁止重复发起；对 401/429/5xx/超时都有中文友好提示。

> DeepSeek 兼容 OpenAI Chat Completions 协议且允许浏览器跨域(CORS)直连，因此无需自建后端。

---

## 🔄 地图池动态更新 & API 同步机制

地图池每赛季轮换，本工具用**分层**设计保证“既能自动更新、又不丢失手工点位”：

- **声明式地图池**：`maps.js` 顶部的 `RANKED_POOL`（英文名数组）和 `POOL_VERSION` 决定“哪些图在池内”。**赛季轮换时改这一个数组即可。**
- **一键同步元数据**：地图页「🔄 从官方 API 同步」会拉取 valorant-api 的英雄/地图列表，**自动新增**新英雄、把池内新图加入（占位）、并更新所有素材直链。结果缓存 24h，离线时用缓存兜底，同步失败则继续用内置数据。

**关于「API 是否会自动更新地图点位」——结论：**
- ✅ valorant-api **会**随版本更新：英雄/地图列表、名称、素材图、地图 `callouts`（区域名）与坐标映射。
- ❌ 但 API **不提供**“职业道具投掷点位 / lineup”这类数据——没有该字段。
- 因此本工具的 **`lineups`（点位）属于项目自维护数据**（`maps.js` 手工标注），由 API 同步**只新增空点位的新图占位、绝不覆盖已有点位**。新图的点位需在 `maps.js` 里补充。

---

## 🔄 更新数据（版本轮换 / 新英雄 / 新地图）

优先用页面上的「🔄 从官方 API 同步」自动更新元数据；需要精修时改 `js/data/` 下的纯数据文件：

- **地图池轮换**：改 [`maps.js`](js/data/maps.js) 顶部的 `RANKED_POOL` 与 `POOL_VERSION`；点位 `lineups` 在同文件维护（`x/y` 为小地图 0~100 百分比坐标）。
- **新增英雄**：可由 API 同步自动补入；如需中文名/微调，在 [`agents.js`](js/data/agents.js) 的 `agents` 数组加/改项。
- **新增经典阵容 / 选手**：编辑 [`comps.js`](js/data/comps.js) 与 [`pros.js`](js/data/pros.js)。

---

## ⚡ 性能优化说明

针对“图片加载卡顿”做了诊断与优化（详见 [`docs/图片性能诊断.md`](docs/图片性能诊断.md)）：
- 地图卡片/下拉用 `listViewIcon` 缩略图（约 60KB），仅详情页大 Banner 用全景 `splash`（原本卡片直接下 2~5MB 全景图 → 地图页加载量降 98%+）。
- 英雄网格用 `displayIcon` 而非 628KB 立绘；全站图片 `loading="lazy"` + `decoding="async"`。
- `<head>` 预连接（preconnect）图片/脚本 CDN；图片失败有占位兜底。

---

## 🛠️ 技术栈

- **纯前端**：原生 HTML / CSS / JavaScript（无构建、无框架依赖）
- **云后端**：[Supabase](https://supabase.com)（PostgreSQL + Realtime + RLS）
- **游戏素材**：[valorant-api.com](https://valorant-api.com) 社区接口（英雄头像/立绘、地图全景图/小地图）

## 📄 数据来源与免责声明

- 英雄、地图、素材数据来自 [valorant-api.com](https://valorant-api.com)（社区维护，非官方）。
- 职业选手 → 英雄映射为社区公认的招牌英雄整理，仅供学习参考。
- 道具投掷点位为示意标注（基于小地图相对位置），用于团队沟通，非像素级精确落点。
- 本项目为粉丝向非商业工具，与 Riot Games 无关。VALORANT 及相关素材版权归 Riot Games 所有。

---

## 📸 界面预览

> 部署后可把实际截图放到这里：
>
> - 地图点位页：`docs/screenshot-maps.png`
> - 英雄图鉴页：`docs/screenshot-agents.png`
> - 阵容生成页：`docs/screenshot-comp.png`

---

Made with ❤️ for the VALORANT community.
