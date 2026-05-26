import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, PointerEvent, ReactNode } from 'react'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  FileText,
  History,
  Mic,
  Moon,
  NotebookPen,
  Plus,
  ReceiptText,
  Search,
  WalletCards,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import './App.css'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type PageKey = 'schedule' | 'ledger' | 'diary' | 'history'
type BillType = 'income' | 'expense'
type Mood = '平静' | '开心' | '疲惫' | '焦虑' | '充实'

type ScheduleItem = {
  id: string
  date: string
  title: string
  time: string
  reminder: string
  note: string
  done: boolean
}

type TodoItem = {
  id: string
  title: string
  done: boolean
}

type Bill = {
  id: string
  type: BillType
  amount: number
  time: string
  merchant: string
  category: string
  note: string
  status: 'pending' | 'confirmed'
  source: '通知' | '短信' | '截图' | '邮件' | '语音'
}

type DiaryEntry = {
  date: string
  mood: Mood
  content: string
}

const today = new Date().toISOString().slice(0, 10)

const pages: Array<{
  key: PageKey
  label: string
  icon: typeof CalendarDays
}> = [
  { key: 'schedule', label: '日程', icon: CalendarDays },
  { key: 'ledger', label: '记账', icon: WalletCards },
  { key: 'diary', label: '日记', icon: NotebookPen },
  { key: 'history', label: '历史', icon: History },
]

const initialSchedule: ScheduleItem[] = [
  {
    id: 's1',
    date: '2026-05-26',
    title: '整理本周任务',
    time: '08:40',
    reminder: '提前10分钟',
    note: '只保留今天必须完成的事情',
    done: false,
  },
  {
    id: 's2',
    date: '2026-05-26',
    title: '散步与晚餐',
    time: '18:30',
    reminder: '准时提醒',
    note: '顺路买水果',
    done: false,
  },
]

const initialTodos: TodoItem[] = [
  { id: 't1', title: '喝水 6 杯', done: true },
  { id: 't2', title: '记录三笔账单', done: false },
  { id: 't3', title: '睡前写日记', done: false },
]

const initialBills: Bill[] = [
  {
    id: 'b1',
    type: 'expense',
    amount: 18,
    time: '12:22',
    merchant: '兰州拉面',
    category: '餐饮',
    note: '午餐',
    status: 'pending',
    source: '语音',
  },
  {
    id: 'b2',
    type: 'income',
    amount: 260,
    time: '09:18',
    merchant: '兼职结算',
    category: '收入',
    note: '设计稿尾款',
    status: 'confirmed',
    source: '邮件',
  },
  {
    id: 'b3',
    type: 'expense',
    amount: 32.6,
    time: '20:05',
    merchant: '便利蜂',
    category: '日用',
    note: '自动识别自支付通知',
    status: 'confirmed',
    source: '通知',
  },
]

const historyMock = [
  {
    date: '2026-05-25',
    title: '周一',
    schedule: '完成论文资料整理、晚间运动',
    money: '+120 / -46.5 / 结余 73.5',
    diary: '状态稳定，晚上把第二天清单提前写好了。',
  },
  {
    date: '2026-05-24',
    title: '周日',
    schedule: '补觉、采购、整理房间',
    money: '+0 / -89 / 结余 -89',
    diary: '休息日支出偏高，情绪轻松。',
  },
]

const moneyText = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)

const uid = () => crypto.randomUUID()

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const formatShortDate = (date: Date) => `${date.getMonth() + 1}.${date.getDate()}`
const formatISODate = (date: Date) => date.toISOString().slice(0, 10)

function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = window.localStorage.getItem(key)
      return saved ? (JSON.parse(saved) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue] as const
}

function App() {
  const [activePage, setActivePage] = useState<PageKey>('schedule')
  const [schedule, setSchedule] = useLocalStorageState('lifelog:schedule', initialSchedule)
  const [todos, setTodos] = useLocalStorageState('lifelog:todos', initialTodos)
  const [bills, setBills] = useLocalStorageState('lifelog:bills', initialBills)
  const [diary, setDiary] = useLocalStorageState<DiaryEntry>('lifelog:diary', {
    date: today,
    mood: '平静',
    content: '今天想记录些什么？',
  })
  const [voiceText, setVoiceText] = useState('今天吃饭花了18元')
  const [selectedDate, setSelectedDate] = useState(today)
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [cloudStatus, setCloudStatus] = useState(
    isSupabaseConfigured ? '云同步未登录' : '本地模式',
  )
  const [isCloudReady, setIsCloudReady] = useState(false)

  const pageIndex = pages.findIndex((page) => page.key === activePage)
  const confirmedBills = bills.filter((bill) => bill.status === 'confirmed')

  const dailyMoney = useMemo(() => {
    const income = confirmedBills
      .filter((bill) => bill.type === 'income')
      .reduce((sum, bill) => sum + bill.amount, 0)
    const expense = confirmedBills
      .filter((bill) => bill.type === 'expense')
      .reduce((sum, bill) => sum + bill.amount, 0)
    return { income, expense, balance: income - expense }
  }, [confirmedBills])

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const client = supabase
    if (!client || !user) return

    let cancelled = false

    const loadCloudData = async () => {
      setCloudStatus('正在加载云端数据')

      const [scheduleResult, todoResult, billResult, diaryResult] = await Promise.all([
        client.from('schedules').select('*').eq('user_id', user.id),
        client.from('todos').select('*').eq('user_id', user.id),
        client.from('bills').select('*').eq('user_id', user.id),
        client.from('diaries').select('*').eq('user_id', user.id).eq('date', today),
      ])

      if (cancelled) return

      const hasError =
        scheduleResult.error || todoResult.error || billResult.error || diaryResult.error
      if (hasError) {
        setCloudStatus('云同步读取失败')
        return
      }

      if (scheduleResult.data && scheduleResult.data.length > 0) {
        setSchedule(
          scheduleResult.data.map((item) => ({
            id: item.id,
            date: item.date,
            title: item.title,
            time: item.time,
            reminder: item.reminder,
            note: item.note,
            done: item.done,
          })),
        )
      }

      if (todoResult.data && todoResult.data.length > 0) {
        setTodos(
          todoResult.data.map((item) => ({
            id: item.id,
            title: item.title,
            done: item.done,
          })),
        )
      }

      if (billResult.data && billResult.data.length > 0) {
        setBills(
          billResult.data.map((item) => ({
            id: item.id,
            type: item.type as BillType,
            amount: Number(item.amount),
            time: item.time,
            merchant: item.merchant,
            category: item.category,
            note: item.note,
            status: item.status as Bill['status'],
            source: item.source as Bill['source'],
          })),
        )
      }

      if (diaryResult.data && diaryResult.data.length > 0) {
        const remoteDiary = diaryResult.data[0]
        setDiary({
          date: remoteDiary.date,
          mood: remoteDiary.mood as Mood,
          content: remoteDiary.content,
        })
      }

      setIsCloudReady(true)
      setCloudStatus('云同步已开启')
    }

    loadCloudData()

    return () => {
      cancelled = true
    }
  }, [setBills, setDiary, setSchedule, setTodos, user])

  useEffect(() => {
    const client = supabase
    if (!client || !user || !isCloudReady) return

    const syncTimer = window.setTimeout(async () => {
      setCloudStatus('正在同步')

      const scheduleRows = schedule.map((item) => ({ ...item, user_id: user.id }))
      const todoRows = todos.map((item) => ({ ...item, user_id: user.id }))
      const billRows = bills.map((item) => ({ ...item, user_id: user.id }))
      const diaryRow = { ...diary, user_id: user.id }

      const results = await Promise.all([
        scheduleRows.length > 0
          ? client.from('schedules').upsert(scheduleRows)
          : Promise.resolve({ error: null }),
        todoRows.length > 0
          ? client.from('todos').upsert(todoRows)
          : Promise.resolve({ error: null }),
        billRows.length > 0
          ? client.from('bills').upsert(billRows)
          : Promise.resolve({ error: null }),
        client.from('diaries').upsert(diaryRow),
      ])

      const hasError = results.some((result) => result.error)
      setCloudStatus(hasError ? '云同步失败' : '已保存到云端')
    }, 700)

    return () => window.clearTimeout(syncTimer)
  }, [bills, diary, isCloudReady, schedule, todos, user])

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !email.trim()) return

    setCloudStatus('正在发送登录邮件')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    })
    setCloudStatus(error ? '登录邮件发送失败' : '已发送登录邮件')
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
    setIsCloudReady(false)
    setCloudStatus('云同步未登录')
  }

  const parseVoiceBill = () => {
    const amountMatch = voiceText.match(/(\d+(?:\.\d+)?)\s*元?/)
    const amount = amountMatch ? Number(amountMatch[1]) : 0
    if (amount <= 0) return
    const isIncome = /收入|工资|到账|收款|赚/.test(voiceText)
    const category = /饭|餐|咖啡|奶茶/.test(voiceText)
      ? '餐饮'
      : /车|地铁|公交|打车/.test(voiceText)
        ? '交通'
        : isIncome
          ? '收入'
          : '其他'
    setBills((items) => [
      {
        id: uid(),
        type: isIncome ? 'income' : 'expense',
        amount,
        time: new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        merchant: category === '餐饮' ? '语音识别-餐饮' : '语音识别',
        category,
        note: voiceText,
        status: 'pending',
        source: '语音',
      },
      ...items,
    ])
    setActivePage('ledger')
  }

  const confirmBill = (id: string) => {
    setBills((items) =>
      items.map((bill) => (bill.id === id ? { ...bill, status: 'confirmed' } : bill)),
    )
  }

  const toggleSchedule = (id: string) => {
    setSchedule((items) =>
      items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    )
  }

  const toggleTodo = (id: string) => {
    setTodos((items) =>
      items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    )
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col bg-[#fbfcf8] text-[#18211f] shadow-2xl shadow-black/10 dark:bg-[#121812] dark:text-[#edf5ee]">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-[#fbfcf8]/90 px-5 pb-3 pt-5 backdrop-blur dark:border-white/10 dark:bg-[#121812]/92">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#69746a] dark:text-[#a9b6a7]">
              {today} · 生活记录
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">{pages[pageIndex].label}</h1>
          </div>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white text-[#334135] shadow-sm transition active:scale-95 dark:border-white/10 dark:bg-[#1d251d]"
            aria-label="切换深色模式由系统控制"
          >
            <Moon size={20} />
          </button>
        </div>
        <CloudSyncBar
          cloudStatus={cloudStatus}
          email={email}
          isConfigured={isSupabaseConfigured}
          setEmail={setEmail}
          signIn={signIn}
          signOut={signOut}
          user={user}
        />
      </header>

      <section className="flex-1 overflow-hidden">
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${pageIndex * 100}%)` }}
        >
          <PageShell>
            <SchedulePage
              schedule={schedule}
              todos={todos}
              addSchedule={(item) => setSchedule((items) => [...items, item])}
              toggleSchedule={toggleSchedule}
              toggleTodo={toggleTodo}
            />
          </PageShell>
          <PageShell>
            <LedgerPage
              bills={bills}
              voiceText={voiceText}
              setVoiceText={setVoiceText}
              parseVoiceBill={parseVoiceBill}
              confirmBill={confirmBill}
            />
          </PageShell>
          <PageShell>
            <DiaryPage diary={diary} setDiary={setDiary} schedule={schedule} todos={todos} money={dailyMoney} />
          </PageShell>
          <PageShell>
            <HistoryPage
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              schedule={schedule}
              todos={todos}
              bills={confirmedBills}
              diary={diary}
            />
          </PageShell>
        </div>
      </section>

      <footer className="sticky bottom-0 z-20 border-t border-black/5 bg-[#fbfcf8]/92 px-4 pb-4 pt-3 backdrop-blur dark:border-white/10 dark:bg-[#121812]/92">
        <BottomPager
          activePage={activePage}
          setActivePage={setActivePage}
        />
      </footer>
    </main>
  )
}

function PageShell({ children }: { children: ReactNode }) {
  return <section className="h-full w-full shrink-0 overflow-y-auto px-5 pb-8 pt-5">{children}</section>
}

function CloudSyncBar(props: {
  cloudStatus: string
  email: string
  isConfigured: boolean
  setEmail: (value: string) => void
  signIn: (event: FormEvent<HTMLFormElement>) => void
  signOut: () => void
  user: User | null
}) {
  if (!props.isConfigured) {
    return (
      <div className="mt-3 rounded-[8px] bg-[#f1ecff] px-3 py-2 text-xs font-medium text-[#6d28d9] dark:bg-[#271a3d] dark:text-[#ddd0ff]">
        本地模式 · 配置 Supabase 后可长期云同步
      </div>
    )
  }

  if (props.user) {
    return (
      <div className="mt-3 flex items-center justify-between gap-3 rounded-[8px] bg-[#f1ecff] px-3 py-2 text-xs font-medium text-[#5b21b6] dark:bg-[#271a3d] dark:text-[#ddd0ff]">
        <span className="truncate">{props.cloudStatus} · {props.user.email}</span>
        <button
          type="button"
          onClick={props.signOut}
          className="h-8 shrink-0 rounded-[8px] px-2 text-[#7c3aed] transition active:bg-white/70 dark:active:bg-white/10"
        >
          退出
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={props.signIn} className="mt-3 flex gap-2">
      <input
        type="email"
        value={props.email}
        onChange={(event) => props.setEmail(event.target.value)}
        placeholder="邮箱登录后云同步"
        className="h-10 min-w-0 flex-1 rounded-[8px] border border-[#ded7ef] bg-white px-3 text-sm outline-none focus:border-[#7c3aed] dark:border-white/10 dark:bg-[#101610]"
        aria-label="邮箱登录"
      />
      <button
        type="submit"
        className="h-10 shrink-0 rounded-[8px] bg-[#7c3aed] px-3 text-sm font-semibold text-white transition active:scale-[0.98]"
      >
        登录
      </button>
    </form>
  )
}

function BottomPager(props: {
  activePage: PageKey
  setActivePage: (page: PageKey) => void
}) {
  return (
    <div className="flex items-center">
      <div className="grid min-w-0 flex-1 grid-cols-4 rounded-full bg-[#eef3ec] p-1 dark:bg-[#1d251d]">
        {pages.map((page) => {
          const Icon = page.icon
          const selected = props.activePage === page.key
          return (
            <button
              key={page.key}
              type="button"
              onClick={() => props.setActivePage(page.key)}
              className={`flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-full px-1 text-sm font-medium transition ${
                selected
                  ? 'bg-[#7c3aed] text-white shadow-sm'
                  : 'text-[#667067] active:bg-white/70 dark:text-[#b5c0b3] dark:active:bg-white/10'
              }`}
              aria-current={selected ? 'page' : undefined}
            >
              <Icon size={17} className="shrink-0" />
              <span className="truncate">{page.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[8px] border border-black/6 bg-white p-4 shadow-sm shadow-black/5 dark:border-white/10 dark:bg-[#1a211a] ${className}`}>
      {children}
    </section>
  )
}

function SectionTitle({ icon: Icon, title, action }: { icon: typeof CalendarDays; title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-[#7c3aed] dark:text-[#c4b5fd]" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {action}
    </div>
  )
}

function SchedulePage(props: {
  schedule: ScheduleItem[]
  todos: TodoItem[]
  addSchedule: (item: ScheduleItem) => void
  toggleSchedule: (id: string) => void
  toggleTodo: (id: string) => void
}) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekSwipeStart, setWeekSwipeStart] = useState<number | null>(null)
  const [addingDay, setAddingDay] = useState<{
    day: string
    date: string
    isoDate: string
  } | null>(null)
  const [form, setForm] = useState({
    title: '',
    time: '21:00',
    reminder: '提前10分钟',
    note: '',
  })
  const baseSunday = new Date('2026-05-24T00:00:00')
  const visibleSunday = addDays(baseSunday, weekOffset * 7)
  const visibleSaturday = addDays(visibleSunday, 6)
  const visibleYear = visibleSunday.getFullYear()
  const changeWeek = (step: number) => setWeekOffset((current) => current + step)
  const handleWeekPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (weekSwipeStart === null) return
    const deltaX = event.clientX - weekSwipeStart
    setWeekSwipeStart(null)
    if (Math.abs(deltaX) < 56) return
    changeWeek(deltaX < 0 ? 1 : -1)
  }

  const addSchedule = (item: Omit<ScheduleItem, 'id' | 'done'>) => {
    props.addSchedule({
      ...item,
      id: uid(),
      done: false,
    })
  }
  const submitSchedule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!addingDay || !form.title.trim()) return
    addSchedule({
      date: addingDay.isoDate,
      title: form.title.trim(),
      time: form.time,
      reminder: form.reminder,
      note: form.note.trim() || '无备注',
    })
    setForm({ title: '', time: '21:00', reminder: '提前10分钟', note: '' })
    setAddingDay(null)
  }

  const weekDays = [
    '周日',
    '周一',
    '周二',
    '周三',
    '周四',
    '周五',
    '周六',
  ].map((day, index) => {
    const targetDate = addDays(visibleSunday, index)
    const isoDate = formatISODate(targetDate)
    const isCurrentWeek = weekOffset === 0
    const relation = isCurrentWeek && index === 2 ? 'today' : ''
    const relativeDate =
      isCurrentWeek && index === 1
        ? '昨天'
        : isCurrentWeek && index === 2
          ? '今天'
          : isCurrentWeek && index === 3
            ? '明天'
            : formatShortDate(targetDate)

    return {
      day,
      date: relativeDate,
      isoDate,
      relation,
      items: props.schedule.filter((item) => item.date === isoDate),
      todos: relation === 'today' ? props.todos : ([] as TodoItem[]),
    }
  })

  return (
    <div
      className="space-y-5"
      onPointerDown={(event) => setWeekSwipeStart(event.clientX)}
      onPointerUp={handleWeekPointerUp}
    >
      <div className="flex items-center justify-center gap-4 px-1 py-1">
        <button
          type="button"
          onClick={() => changeWeek(-1)}
          className="grid h-10 w-10 place-items-center rounded-full text-[#514f57] transition active:bg-black/5 dark:text-[#d8d0e8] dark:active:bg-white/10"
          aria-label="上一周"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-[22px] font-semibold tracking-normal text-[#25212c] dark:text-[#f3efff]">
          {visibleYear}年&nbsp;&nbsp;{formatShortDate(visibleSunday)}-{formatShortDate(visibleSaturday)}
        </h2>
        <button
          type="button"
          onClick={() => changeWeek(1)}
          className="grid h-10 w-10 place-items-center rounded-full text-[#514f57] transition active:bg-black/5 dark:text-[#d8d0e8] dark:active:bg-white/10"
          aria-label="下一周"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {weekDays.map((day) => (
          <WeekDayCard
            key={day.day}
            day={day.day}
            date={day.date}
            isoDate={day.isoDate}
            isToday={day.relation === 'today'}
            schedule={day.items}
            todos={day.todos}
            openAdd={() => setAddingDay({ day: day.day, date: day.date, isoDate: day.isoDate })}
            toggleSchedule={props.toggleSchedule}
            toggleTodo={props.toggleTodo}
          />
        ))}
      </div>

      {addingDay && (
        <div
          className="fixed inset-0 z-[9999] flex items-end bg-black/45 px-4 pb-4"
          role="dialog"
          aria-modal="true"
          aria-label={`添加${addingDay.day}日程`}
          onClick={() => setAddingDay(null)}
        >
          <form
            onSubmit={submitSchedule}
            className="mx-auto w-full max-w-[398px] rounded-[18px] bg-white p-4 shadow-2xl dark:bg-[#1b1723]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-[#9a96a3] dark:text-[#aaa2b9]">{addingDay.date}</p>
                <h3 className="text-lg font-semibold text-[#25212c] dark:text-[#f3efff]">添加日程</h3>
              </div>
              <button
                type="button"
                onClick={() => setAddingDay(null)}
                className="h-10 rounded-[8px] px-3 text-sm font-medium text-[#7c3aed] transition active:bg-[#efe7ff] dark:active:bg-white/10"
              >
                取消
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="日程标题"
                className="h-12 w-full rounded-[8px] border border-black/10 bg-white px-3 text-base outline-none focus:border-[#7c3aed] dark:border-white/10 dark:bg-[#101610]"
                aria-label="日程标题"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="time"
                  value={form.time}
                  onChange={(event) => setForm({ ...form, time: event.target.value })}
                  className="h-12 rounded-[8px] border border-black/10 bg-white px-3 text-base outline-none focus:border-[#7c3aed] dark:border-white/10 dark:bg-[#101610]"
                  aria-label="日程时间"
                />
                <select
                  value={form.reminder}
                  onChange={(event) => setForm({ ...form, reminder: event.target.value })}
                  className="h-12 rounded-[8px] border border-black/10 bg-white px-3 text-base outline-none focus:border-[#7c3aed] dark:border-white/10 dark:bg-[#101610]"
                  aria-label="提醒时间"
                >
                  <option>不提醒</option>
                  <option>准时提醒</option>
                  <option>提前10分钟</option>
                  <option>提前30分钟</option>
                </select>
              </div>
              <input
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
                placeholder="备注"
                className="h-12 w-full rounded-[8px] border border-black/10 bg-white px-3 text-base outline-none focus:border-[#7c3aed] dark:border-white/10 dark:bg-[#101610]"
                aria-label="日程备注"
              />
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[#7c3aed] text-base font-semibold text-white transition active:scale-[0.98]"
              >
                <Plus size={19} /> 保存日程
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}

function WeekDayCard(props: {
  day: string
  date: string
  isoDate: string
  isToday: boolean
  schedule: ScheduleItem[]
  todos: TodoItem[]
  openAdd: () => void
  toggleSchedule: (id: string) => void
  toggleTodo: (id: string) => void
}) {
  const hasContent = props.schedule.length > 0 || props.todos.length > 0

  return (
    <section
      className="relative min-h-[172px] cursor-pointer rounded-[18px] bg-white p-4 shadow-[0_10px_28px_rgba(72,51,105,0.08)] transition active:scale-[0.99] dark:bg-[#1b1723] dark:shadow-none"
      onClick={props.openAdd}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <h3 className={`text-lg font-semibold ${props.isToday ? 'text-[#7c3aed]' : 'text-[#25212c] dark:text-[#f3efff]'}`}>
              {props.day}
            </h3>
            <span className="text-base text-[#9a96a3] dark:text-[#aaa2b9]">{props.date}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            props.openAdd()
          }}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#7c3aed] text-white shadow-sm shadow-[#7c3aed]/25 transition active:scale-95"
          aria-label={`添加${props.day}日程`}
        >
          <Plus size={23} strokeWidth={3} />
        </button>
      </div>

      {hasContent ? (
        <div className="mt-7 space-y-3">
          {props.schedule.slice(0, 2).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                props.toggleSchedule(item.id)
              }}
              className="flex w-full items-center gap-3 rounded-[8px] text-left text-[#8c8892] transition active:scale-[0.99] dark:text-[#b9b0c7]"
            >
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${item.done ? 'bg-[#7c3aed] text-white' : 'bg-[#d5d2dc] text-white dark:bg-[#3a3347]'}`}>
                <Check size={17} />
              </span>
              <span className="min-w-0">
                <span className={`block truncate text-base ${item.done ? 'line-through' : ''}`}>{item.title}</span>
                <span className="mt-0.5 flex items-center gap-1 text-[11px] text-[#a19ca8]">
                  <Clock3 size={12} /> {item.time}
                </span>
              </span>
            </button>
          ))}
          {props.todos.slice(0, 2).map((todo) => (
            <button
              key={todo.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                props.toggleTodo(todo.id)
              }}
              className="flex w-full items-center gap-3 rounded-[8px] text-left text-[#8c8892] transition active:scale-[0.99] dark:text-[#b9b0c7]"
            >
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${todo.done ? 'bg-[#7c3aed] text-white' : 'bg-[#d5d2dc] text-white dark:bg-[#3a3347]'}`}>
                <Check size={17} />
              </span>
              <span className={`truncate text-base ${todo.done ? 'line-through' : ''}`}>{todo.title}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-xl text-[#aaa6af] dark:text-[#8f879b]">
          无日程
        </div>
      )}

    </section>
  )
}

function LedgerPage(props: {
  bills: Bill[]
  voiceText: string
  setVoiceText: (value: string) => void
  parseVoiceBill: () => void
  confirmBill: (id: string) => void
}) {
  const pending = props.bills.filter((bill) => bill.status === 'pending')
  const confirmed = props.bills.filter((bill) => bill.status === 'confirmed')
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={Mic} title="语音记账" />
        <textarea
          value={props.voiceText}
          onChange={(event) => props.setVoiceText(event.target.value)}
          rows={3}
          className="w-full resize-none rounded-[8px] border border-black/10 bg-[#f8faf5] p-3 text-sm outline-none focus:border-[#7c3aed] dark:border-white/10 dark:bg-[#121812]"
          aria-label="语音记账文字"
        />
        <button type="button" onClick={props.parseVoiceBill} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#7c3aed] text-sm font-semibold text-white transition active:scale-[0.98]">
          <Search size={18} /> 识别并加入待确认
        </button>
      </Card>

      <Card>
        <SectionTitle icon={ReceiptText} title="待确认账单" />
        <BillList bills={pending} onConfirm={props.confirmBill} />
      </Card>

      <Card>
        <SectionTitle icon={CreditCard} title="已保存账单" />
        <BillList bills={confirmed} />
      </Card>
    </div>
  )
}

function BillList({ bills, onConfirm }: { bills: Bill[]; onConfirm?: (id: string) => void }) {
  if (bills.length === 0) {
    return <p className="rounded-[8px] bg-[#f8faf5] p-4 text-sm text-[#657064] dark:bg-[#121812] dark:text-[#b5c0b3]">暂无记录</p>
  }

  return (
    <div className="space-y-2">
      {bills.map((bill) => (
        <div key={bill.id} className="rounded-[8px] border border-black/5 bg-[#f8faf5] p-3 dark:border-white/8 dark:bg-[#121812]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{bill.merchant}</p>
              <p className="mt-1 text-xs text-[#667067] dark:text-[#b5c0b3]">
                {bill.time} · {bill.category} · {bill.source}
              </p>
              <p className="mt-2 text-sm text-[#4f5c51] dark:text-[#c3cdbc]">{bill.note}</p>
            </div>
            <p className={`shrink-0 text-base font-bold ${bill.type === 'income' ? 'text-[#1d6b38]' : 'text-[#a64232]'}`}>
              {bill.type === 'income' ? '+' : '-'}
              {moneyText(bill.amount)}
            </p>
          </div>
          {onConfirm && (
            <button type="button" onClick={() => onConfirm(bill.id)} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-[#7c3aed] text-sm font-semibold text-white transition active:scale-[0.98]">
              <Check size={17} /> 确认保存
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function DiaryPage(props: {
  diary: DiaryEntry
  setDiary: (entry: DiaryEntry) => void
  schedule: ScheduleItem[]
  todos: TodoItem[]
  money: { income: number; expense: number; balance: number }
}) {
  const doneSchedule = props.schedule.filter((item) => item.done).length
  const doneTodos = props.todos.filter((item) => item.done).length

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={NotebookPen} title="今日一篇日记" />
        <div className="grid grid-cols-5 gap-2">
          {(['平静', '开心', '疲惫', '焦虑', '充实'] as Mood[]).map((mood) => (
            <button
              key={mood}
              type="button"
              onClick={() => props.setDiary({ ...props.diary, mood })}
              className={`h-10 rounded-[8px] text-sm font-medium transition active:scale-95 ${
                props.diary.mood === mood
                  ? 'bg-[#7c3aed] text-white'
                  : 'bg-[#eef3ec] text-[#566258] dark:bg-[#121812] dark:text-[#c3cdbc]'
              }`}
            >
              {mood}
            </button>
          ))}
        </div>
        <textarea
          value={props.diary.content}
          onChange={(event) => props.setDiary({ ...props.diary, content: event.target.value })}
          rows={9}
          className="mt-3 w-full resize-none rounded-[8px] border border-black/10 bg-[#f8faf5] p-3 text-sm leading-6 outline-none focus:border-[#7c3aed] dark:border-white/10 dark:bg-[#121812]"
          aria-label="日记内容"
        />
      </Card>

      <Card>
        <SectionTitle icon={FileText} title="自动关联今日" />
        <div className="grid gap-2 text-sm">
          <p className="rounded-[8px] bg-[#f8faf5] p-3 dark:bg-[#121812]">日程完成：{doneSchedule}/{props.schedule.length}</p>
          <p className="rounded-[8px] bg-[#f8faf5] p-3 dark:bg-[#121812]">清单完成：{doneTodos}/{props.todos.length}</p>
          <p className="rounded-[8px] bg-[#f8faf5] p-3 dark:bg-[#121812]">
            收支：收入 {moneyText(props.money.income)}，支出 {moneyText(props.money.expense)}，结余 {moneyText(props.money.balance)}
          </p>
        </div>
      </Card>
    </div>
  )
}

function HistoryPage(props: {
  selectedDate: string
  setSelectedDate: (value: string) => void
  schedule: ScheduleItem[]
  todos: TodoItem[]
  bills: Bill[]
  diary: DiaryEntry
}) {
  const isToday = props.selectedDate === today
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={History} title="按日期查看" />
        <input
          type="date"
          value={props.selectedDate}
          onChange={(event) => props.setSelectedDate(event.target.value)}
          className="h-11 w-full rounded-[8px] border border-black/10 bg-[#f8faf5] px-3 text-sm outline-none focus:border-[#7c3aed] dark:border-white/10 dark:bg-[#121812]"
          aria-label="选择日期"
        />
      </Card>

      {isToday ? (
        <Card>
          <SectionTitle icon={CalendarDays} title="今天记录" />
          <div className="space-y-3 text-sm">
            <p className="rounded-[8px] bg-[#f8faf5] p-3 dark:bg-[#121812]">日程：{props.schedule.map((item) => item.title).join('、')}</p>
            <p className="rounded-[8px] bg-[#f8faf5] p-3 dark:bg-[#121812]">清单：{props.todos.map((item) => `${item.done ? '已完成' : '未完成'} ${item.title}`).join('；')}</p>
            <p className="rounded-[8px] bg-[#f8faf5] p-3 dark:bg-[#121812]">账单：{props.bills.map((bill) => `${bill.merchant} ${moneyText(bill.amount)}`).join('；')}</p>
            <p className="rounded-[8px] bg-[#f8faf5] p-3 dark:bg-[#121812]">日记：{props.diary.mood}，{props.diary.content}</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {historyMock.map((item) => (
            <Card key={item.date}>
              <p className="text-sm font-semibold">{item.date} · {item.title}</p>
              <div className="mt-3 space-y-2 text-sm text-[#4f5c51] dark:text-[#c3cdbc]">
                <p>日程：{item.schedule}</p>
                <p>账单：{item.money}</p>
                <p>日记：{item.diary}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default App
