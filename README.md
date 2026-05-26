# LifeLog

每日生活记录 App，包含日程、今日清单、自动记账待确认、语音记账、日记、历史查看。默认本地可用，配置 Supabase 后支持账号登录和云端长期同步。

## 安装命令

```bash
npm install
```

## 启动命令

```bash
npm run dev
```

## 构建命令

```bash
npm run build
```

## 环境变量

本地模式不需要环境变量。长期云同步需要复制 `.env.example` 为 `.env.local` 并填写 Supabase 配置：

```bash
VITE_SUPABASE_URL=https://你的项目编号.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=你的 Supabase publishable anon key
```

## 使用说明

- 底部点击“日程 / 记账 / 日记 / 历史”切换页面。
- 日程页左右滑动切换周。
- 日程页点击日期卡片或右上角加号可新增日程。
- 记账页输入“今天吃饭花了18元”这类文本，点击识别后进入待确认账单。
- 待确认账单点击“确认保存”后才进入已保存账单，并参与今日收入、支出、结余统计。
- 日记页可选择心情并写入当天日记，自动展示当天关联摘要。
- 配置 Supabase 后，顶部输入邮箱登录，数据会自动保存到云端。

## 长期使用配置

1. 新建 Supabase 项目。
2. 在 Supabase SQL Editor 运行 `supabase-schema.sql`。
3. 在 Supabase Authentication 中开启 Email 登录。
4. 本地创建 `.env.local`，填入 `.env.example` 中的两个变量。
5. 运行 `npm run build` 确认可构建。
6. 部署到 Vercel，并在 Vercel Project Settings 里添加同样的环境变量。
7. 手机打开 Vercel HTTPS 地址，添加到主屏幕。

## 部署方案

- Vercel：已提供 `vercel.json`，构建命令 `npm run build`，输出目录 `dist`。
- Docker：后续可添加 Nginx 静态部署镜像；当前本地开发优先使用 Vite。
