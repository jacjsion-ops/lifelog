# 每日生活记录 App 设计说明

## 需求分析

这个 App 的核心目标是把一天里的三类事实放到同一个手机端工作流里：要做什么、花了多少钱、记录了什么。首页命名为“日程”，不做课程表和复盘模块，重点保留日程、今日清单、今日收支、待确认账单、写日记入口。

## 功能结构

- 日程：首页显示当天安排，支持新增日程、完成状态切换、提醒字段、备注字段；下方整合今日清单。
- 记账：展示待确认账单和已保存账单；自动识别结果必须先进入待确认；支持语音文本识别示例。
- 日记：每天一篇，支持文字、心情选择，并自动关联当天日程完成数、清单完成数、收入、支出、结余。
- 历史：按日期查看某一天的日程、清单、账单、日记。

## 页面布局

- 顶部：日期、当前页面标题、系统深色模式提示按钮。
- 页面切换：日程 / 记账 / 日记 / 历史 四段式导航，支持左右滑动切换，也支持按钮点击。
- 日程页：收支三项统计卡片、待确认账单入口、写日记入口、当天安排卡片、今日清单卡片。
- 记账页：语音记账输入区、待确认账单列表、已保存账单列表。
- 日记页：心情选择、日记输入框、自动关联今日摘要。
- 历史页：日期选择器、当天聚合记录；示例历史数据作为后续接口占位。

## 数据库结构

建议后端使用 SQLite 起步，后续可迁移 PostgreSQL。核心表如下：

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  title TEXT NOT NULL,
  start_time TIME NOT NULL,
  reminder_minutes INTEGER,
  note TEXT,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE todos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  occurred_at DATETIME NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  merchant TEXT,
  category TEXT NOT NULL,
  note TEXT,
  source TEXT NOT NULL CHECK (source IN ('notification', 'sms', 'screenshot', 'email', 'voice', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'rejected')),
  raw_text TEXT,
  confidence NUMERIC(4, 3),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE diaries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  mood TEXT,
  content TEXT NOT NULL,
  schedule_snapshot_json TEXT,
  todo_snapshot_json TEXT,
  finance_snapshot_json TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, date)
);
```

## 权限说明

- 通知读取：用于识别微信、支付宝、银行 App 推送中的支付和到账信息。只读取白名单 App 的通知文本，不保存无关通知。
- 短信读取：用于识别银行卡消费、到账、验证码以外的账单短信。验证码短信必须过滤，不进入账单解析。
- 相册/截图读取：用于用户主动选择账单截图后 OCR 识别，不后台扫描全部相册。
- 邮件读取：用于用户授权后读取账单邮件，可限定发件人或标签范围。
- 麦克风/语音识别：用于语音记账，语音转文本后再进入解析流程。
- 本地存储/云同步：保存日程、清单、账单、日记；敏感数据需要加密存储，云端接口使用 HTTPS。

## 自动记账识别逻辑

1. 数据接入：通知、短信、截图 OCR、邮件、语音文本统一转换为 `raw_text`。
2. 初筛过滤：排除验证码、广告、物流、营销、非金额文本；只保留包含金额、交易动词、到账/支出词的文本。
3. 字段提取：使用规则和模型组合提取金额、时间、商家、收支类型、分类、备注、来源。
4. 分类判断：餐饮、交通、购物、日用、住房、医疗、学习、娱乐、收入、其他；低置信度归为“其他”。
5. 去重合并：同一金额、时间近似、商家近似、来源相关的记录合并，避免通知和短信重复入账。
6. 风险控制：所有识别结果默认 `pending`，必须用户确认后改为 `confirmed`。
7. 纠错学习：用户修改商家或分类后记录偏好，下次同类商家优先使用用户选择。

## 接口建议

- `GET /api/day?date=YYYY-MM-DD`：获取某日聚合数据。
- `POST /api/schedules`：新增日程。
- `PATCH /api/schedules/{id}`：更新完成状态、时间、提醒、备注。
- `POST /api/todos`：新增清单。
- `PATCH /api/todos/{id}`：更新清单状态。
- `POST /api/bills/recognize`：提交原始文本或 OCR 文本，返回待确认账单。
- `PATCH /api/bills/{id}/confirm`：确认账单。
- `POST /api/diaries`：创建或更新当天日记。
- `GET /api/history?from=YYYY-MM-DD&to=YYYY-MM-DD`：历史查询。
