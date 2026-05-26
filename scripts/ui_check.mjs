import { chromium, expect } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:5173'

await page.goto(baseUrl, { waitUntil: 'networkidle' })
await expect(page.getByRole('heading', { name: '日程', exact: true })).toBeVisible()
await page.getByRole('button', { name: '添加周日日程' }).click()
await expect(page.getByRole('dialog', { name: '添加周日日程' })).toBeVisible()
await page.getByRole('button', { name: '取消' }).click()
await expect(page.getByRole('dialog', { name: '添加周日日程' })).toBeHidden()

await page.getByRole('button', { name: '记账', exact: true }).click()
await expect(page.getByText('待确认账单').first()).toBeVisible()

await page.getByRole('button', { name: '日记', exact: true }).click()
await expect(page.getByText('今日一篇日记')).toBeVisible()

await page.getByRole('button', { name: '历史', exact: true }).click()
await expect(page.getByText('按日期查看')).toBeVisible()

const hasHorizontalOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth,
)

if (hasHorizontalOverflow) {
  throw new Error('页面存在横向溢出')
}

await browser.close()
