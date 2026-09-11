import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

const CONFIG_DIR = path.resolve('./plugins/hyrz-plugin/config')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml')

const DEFAULT_CONFIG = {
  // 网页登录链接前缀（#火影登录 生成链接用），如 http://263522.xyz:2536
  webLoginBase: '',
  // 每日福利定时任务执行时间（cron 表达式，默认每天 08:30）
  welfareTime: '0 30 8 * * ?',
  // 每日自动签到时间（cron 表达式，默认每天 05:00）
  autoSignTime: '0 0 5 * * ?',
  // 每日自动签到范围: off=关闭 self=仅机器人主人 all=所有已绑定用户
  autoSign: 'self'
}

function load () {
  try {
    const txt = fs.readFileSync(CONFIG_FILE, 'utf8')
    return { ...DEFAULT_CONFIG, ...YAML.parse(txt) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

/** 读取网页登录链接前缀；未配置时回退 Yunzai server.yaml 的外网地址 */
function getBaseUrl () {
  const cfg = load()
  if (cfg.webLoginBase) return cfg.webLoginBase.replace(/\/$/, '')
  try {
    const txt = fs.readFileSync(path.resolve('./config/config/server.yaml'), 'utf8')
    const m = txt.match(/^url:\s*(\S+)/m)
    const url = m ? m[1] : ''
    if (url && !/localhost|127\.0\.0\.1/.test(url)) return url.replace(/\/$/, '')
  } catch { /* ignore */ }
  return ''
}

/** 首次运行生成默认配置；已有配置缺新字段时自动补全 */
function ensureConfig () {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
      fs.writeFileSync(CONFIG_FILE, YAML.stringify(DEFAULT_CONFIG))
      return
    }
    const cur = YAML.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) || {}
    if (Object.keys(DEFAULT_CONFIG).some(k => cur[k] === undefined)) {
      fs.writeFileSync(CONFIG_FILE, YAML.stringify({ ...DEFAULT_CONFIG, ...cur }))
    }
  } catch { /* ignore */ }
}

ensureConfig()

const Config = { load, getBaseUrl }
export default Config
export { getBaseUrl }
