import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.resolve('./plugins/hyrz-plugin/data')
const BIND_DIR = path.join(DATA_DIR, 'bindings') // 每个绑定的 QQ 一个文件：bindings/{qq}.json
const LEGACY_FILE = path.join(DATA_DIR, 'bindings.json') // 旧版合并存储，启动时自动迁移

/** 单个绑定文件路径 */
function bindFile (userId) {
  return path.join(BIND_DIR, `${String(userId)}.json`)
}

/** 旧版 bindings.json → bindings/{qq}.json 一次性迁移 */
function migrateLegacy () {
  if (!fs.existsSync(LEGACY_FILE)) return
  try {
    const data = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8'))
    fs.mkdirSync(BIND_DIR, { recursive: true })
    for (const [qq, bind] of Object.entries(data)) {
      const file = bindFile(qq)
      if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(bind, null, 2))
    }
    fs.renameSync(LEGACY_FILE, `${LEGACY_FILE}.bak`) // 迁移完成改名保留，防重复执行
    global.logger?.mark?.(`[火影插件]绑定数据已迁移至 bindings/ 目录（${Object.keys(data).length} 条，旧文件备份为 bindings.json.bak）`)
  } catch (err) {
    global.logger?.error?.(`[火影插件]绑定数据迁移失败: ${err.message}`)
  }
}
migrateLegacy()

/**
 * 从用户消息中提取 cookie 字段
 * 支持格式：
 *  - openid=xxx; acctype=qc; appid=1104307008; access_token=xxx
 *  - openid=xxx access_token=xxx（换行/空格分隔）
 *  - 直接粘贴 access_token 的值（32位hex）
 */
function parseCookie (text) {
  const openid = text.match(/openid=([0-9A-Fa-f]+)/)?.[1]
  let token = text.match(/access_token=([0-9A-Fa-f]+)/)?.[1]
  if (!openid && !token) {
    const m = text.trim().match(/^([0-9A-Fa-f]{32})$/)
    if (m) token = m[1]
  }
  return { openid, token }
}

const Store = {
  /** 获取绑定信息（读 bindings/{qq}.json） */
  get (userId) {
    try {
      return JSON.parse(fs.readFileSync(bindFile(userId), 'utf8'))
    } catch {
      return null
    }
  },

  /** 绑定/更新（写入 bindings/{qq}.json，保留 welfarePush 等扩展字段；新凭据未提供 refresh_token 时清空旧值） */
  set (userId, openid, token, appid, refresh_token) {
    const old = this.get(userId) || {}
    fs.mkdirSync(BIND_DIR, { recursive: true })
    fs.writeFileSync(bindFile(userId), JSON.stringify({
      ...old,
      openid,
      access_token: token,
      appid: appid || old.appid || '1104307008',
      refresh_token: refresh_token || '',
      bindTime: new Date().toLocaleString('zh-CN')
    }, null, 2))
  },

  /** 设置/取消每日福利推送开关（写入绑定文件的 welfarePush 字段） */
  setWelfarePush (userId, on) {
    const bind = this.get(userId)
    if (!bind) return false
    bind.welfarePush = !!on
    fs.mkdirSync(BIND_DIR, { recursive: true })
    fs.writeFileSync(bindFile(userId), JSON.stringify(bind, null, 2))
    return true
  },

  /** 写入角色信息（partition/roleId/角色名/等级），由角色列表同步产生 */
  setRole (userId, { partition, roleId, roleName, roleLevel }) {
    const bind = this.get(userId)
    if (!bind) return false
    fs.mkdirSync(BIND_DIR, { recursive: true })
    fs.writeFileSync(bindFile(userId), JSON.stringify({
      ...bind,
      partition: String(partition || bind.partition || ''),
      roleId: String(roleId ?? bind.roleId ?? ''),
      roleName: roleName || bind.roleName || '',
      roleLevel: roleLevel ?? bind.roleLevel ?? '',
      roleSyncTime: new Date().toLocaleString('zh-CN')
    }, null, 2))
    return true
  },

  /** 列出所有开启福利推送的用户 QQ */
  listWelfarePush () {
    try {
      return fs.readdirSync(BIND_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace(/.json$/, ''))
        .filter(qq => {
          try {
            return JSON.parse(fs.readFileSync(path.join(BIND_DIR, f), 'utf8')).welfarePush
          } catch { return false }
        })
    } catch {
      return []
    }
  },

  /** 列出所有已绑定用户 QQ */
  listAll () {
    try {
      return fs.readdirSync(BIND_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace(/.json$/, ''))
    } catch {
      return []
    }
  },

  /** 解绑（删除 bindings/{qq}.json） */
  del (userId) {
    try {
      fs.unlinkSync(bindFile(userId))
    } catch { }
  },

  /**
   * 解析查询目标（只读查询命令用）
   * 消息里 @ 了已绑定的人 → 查其数据；@ 了未绑定的人 → notBound 提示；否则查自己
   */
  resolveTarget (e) {
    const sender = String(e?.user_id || '')
    const at = e?.at || (Array.isArray(e?.message) ? e.message.find(m => m.type === 'at')?.qq : null)
    const atId = String(at || '')
    if (atId && atId !== sender) {
      if (this.get(atId)) return { userId: atId, isAt: true }
      return { userId: sender, isAt: true, notBound: atId }
    }
    return { userId: sender, isAt: false }
  },

  parseCookie,

  /** 生成完整 Cookie 字符串 */
  buildCookie (bind) {
    return `openid=${bind.openid}; acctype=qc; appid=${bind.appid || '1104307008'}; access_token=${bind.access_token}`
  }
}

export default Store
