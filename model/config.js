import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

const CONFIG_DIR = path.resolve('./plugins/hyrz-plugin/config')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.yaml')

const DEFAULT_CONFIG = {
  // 网页登录链接前缀（#火影登录 生成链接用），如 http://263522.xyz:2536
  webLoginBase: ''
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

/** 首次运行生成默认配置 */
function ensureConfig () {
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
    fs.writeFileSync(CONFIG_FILE, YAML.stringify(DEFAULT_CONFIG))
  }
}

ensureConfig()

const Config = { load, getBaseUrl }
export default Config
export { getBaseUrl }
