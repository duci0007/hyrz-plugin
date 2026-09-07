import https from 'node:https'
import crypto from 'node:crypto'
import Store from './store.js'

/**
 * 网页扫码登录（QQ 互联 → 火影活动 CK 自动抓取绑定）
 *
 * 链路: ptlogin2 扫码(appid=716027609/daid=383, pt_3rd_aid=101491592)
 *   → check_sig 跳转 → graph.qq.com/oauth2.0/authorize → code
 *   → ams.game.qq.com/ams/userLoginSvr?a=qcCodeToOpenId → openid + access_token
 *   → ULINK User/userinfo 验证 → 写入绑定
 */

const PT_APPID = '716027609'
const DAID = '383'
const QC_APPID = '101491592'
const JS_VER = '26090116'
const REDIRECT_URI = 'https://milo.qq.com/comm-htdocs/login/qc_redirect.html'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/* ========== 按域分组的 CookieJar ========== */
class CookieJar {
  constructor () { this.domains = new Map() }

  set (domain, name, value) {
    if (!this.domains.has(domain)) this.domains.set(domain, new Map())
    this.domains.get(domain).set(name, value)
  }

  header (host) {
    const parts = []
    // 按域名长度降序（更具体的域优先），与浏览器行为一致。
    // 关键修复：check_sig 会同时 set p_skey@qq.com 与 p_skey@graph.qq.com，
    // 若 qq.com 的排前面，authorize 取到 ptlogin2 的 p_skey 会误判"未登录"
    const matched = [...this.domains.entries()]
      .filter(([dom]) => host === dom || host.endsWith('.' + dom))
      .sort((a, b) => b[0].length - a[0].length)
    for (const [, map] of matched) {
      for (const [k, v] of map) parts.push(`${k}=${v}`)
    }
    return parts.join('; ')
  }
}

/* ========== https 请求封装（带 cookie jar） ========== */
function request (url, { method = 'GET', headers = {}, body = null, jar } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const cookie = jar ? jar.header(u.hostname) : ''
    const r = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: {
        'User-Agent': UA,
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers
      }
    }, res => {
      if (jar) {
        for (const sc of (res.headers['set-cookie'] || [])) {
          const m = sc.match(/^([^=;]+)=([^;]*)/)
          if (!m) continue
          const dm = sc.match(/domain=([^;]+)/i)
          jar.set((dm ? dm[1] : u.hostname).replace(/^\./, '').toLowerCase(), m[1].trim(), m[2])
        }
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
    })
    r.on('error', reject)
    r.setTimeout(20000, () => r.destroy(new Error('timeout')))
    if (body) r.write(body)
    r.end()
  })
}

/** ptqrtoken 哈希（ptlogin2 官方算法） */
function hash33 (s) {
  let e = 0
  for (let i = 0; i < s.length; i++) {
    e += (e << 5) + s.charCodeAt(i)
    e = e & 2147483647
  }
  return e
}

/* ========== 登录令牌（命令 → 链接） ========== */
const loginTokens = new Map() // token -> { userId, expire }
const TOKEN_TTL = 30 * 60 * 1000

function createToken (userId) {
  const token = crypto.randomBytes(12).toString('hex')
  loginTokens.set(token, { userId, expire: Date.now() + TOKEN_TTL })
  return token
}

function checkToken (token) {
  const t = loginTokens.get(token)
  if (!t) return null
  if (Date.now() > t.expire) {
    loginTokens.delete(token)
    return null
  }
  return t.userId
}

/* ========== 扫码会话 ========== */
const sessions = new Map() // sid -> session
const SESSION_TTL = 5 * 60 * 1000

/** 生成 QQ 扫码登录会话，返回 { sid, qrPng } */
async function createSession (userId) {
  const jar = new CookieJar()
  const state = 'hyrz' + Date.now()
  const sUrl = `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${QC_APPID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}&scope=get_user_info&display=pc`
  const xloginUrl = `https://xui.ptlogin2.qq.com/cgi-bin/xlogin?appid=${PT_APPID}&daid=${DAID}&style=33&login_text=%E7%99%BB%E5%BD%95&hide_title_bar=1&hide_border=1&target=self&s_url=${encodeURIComponent(sUrl)}&pt_3rd_aid=${QC_APPID}&pt_no_auth=1`
  await request(xloginUrl, { jar })

  const qrUrl = `https://ssl.ptlogin2.qq.com/ptqrshow?appid=${PT_APPID}&daid=${DAID}&e=2&l=M&s=3&d=72&v=4&t=${Math.random()}&u1=${encodeURIComponent(sUrl)}&pt_3rd_aid=${QC_APPID}`
  const qr = await request(qrUrl, { headers: { Referer: xloginUrl }, jar })
  // PNG 魔数校验
  if (qr.status !== 200 || qr.body.length < 100 || qr.body[0] !== 0x89 || qr.body[1] !== 0x50) {
    throw new Error(`二维码获取失败(${qr.status}/${qr.body.length})`)
  }

  let qrsig = null
  for (const map of jar.domains.values()) {
    if (map.has('qrsig')) qrsig = map.get('qrsig')
  }
  if (!qrsig) throw new Error('qrsig 获取失败')
  let loginSig = null
  for (const map of jar.domains.values()) {
    if (map.has('pt_login_sig')) loginSig = map.get('pt_login_sig')
  }

  const sid = crypto.randomBytes(16).toString('hex')
  sessions.set(sid, { sid, userId, jar, qrsig, loginSig, xloginUrl, sUrl, createTime: Date.now(), status: 'waiting', result: null, errorMsg: '', qrPng: qr.body })
  return { sid }
}

/** 获取会话二维码 PNG */
function getQr (sid) {
  const s = sessions.get(sid)
  return s ? s.qrPng : null
}

/** 轮询一次扫码状态；扫码成功则走完整链路完成抓取绑定 */
async function pollSession (sid) {
  const s = sessions.get(sid)
  if (!s) return { code: -1, state: 'gone', msg: '会话不存在或已过期，请刷新页面' }
  if (s.status === 'ok') return { code: 0, state: 'ok', ...s.result }
  if (s.status === 'error') return { code: 1, state: 'error', msg: s.errorMsg }
  if (s.status === 'busy') return { code: 3, state: 'scanned', msg: '正在获取登录态...' }
  if (Date.now() - s.createTime > SESSION_TTL) {
    sessions.delete(sid)
    return { code: 2, state: 'expired', msg: '二维码已过期，正在刷新...' }
  }

  // 完整参数复刻浏览器 getSubmitUrl('ptqrlogin')，缺 login_sig 等会返回 code 7 参数错误
  const pollUrl = `https://ssl.ptlogin2.qq.com/ptqrlogin?u1=${encodeURIComponent(s.sUrl)}&ptqrtoken=${hash33(s.qrsig)}` +
    `&ptredirect=self&h=1&t=1&g=1&from_ui=1&ptlang=2052&action=0-0-${Date.now()}` +
    `&js_ver=${JS_VER}&js_type=1&login_sig=${encodeURIComponent(s.loginSig || '')}&pt_uistyle=40` +
    `&aid=${PT_APPID}&daid=${DAID}&pt_3rd_aid=${QC_APPID}`
  let p
  try {
    p = await request(pollUrl, { headers: { Referer: s.xloginUrl }, jar: s.jar })
  } catch {
    return { code: 3, state: 'waiting', msg: '' }
  }
  const txt = p.body.toString('utf8')
  const m = txt.match(/ptuiCB\('(\d+)','\d*','([^']*)','(\d+)','([^']*)'(?:,'([^']*)')?/)
  if (!m) {
    logger.error(`[火影网页登录] ptqrlogin 响应异常: ${txt.slice(0, 120)}`)
    return { code: 3, state: 'waiting', msg: '' }
  }

  // 未知状态码（如 7=参数错误）不再静默，记录日志便于排查
  if (!['0', '65', '66', '67'].includes(m[1])) {
    logger.error(`[火影网页登录] ptqrlogin 未知状态码 ${m[1]}: ${m[4]}`)
  }
  if (m[1] === '0') {
    s.status = 'busy'
    s.qqNick = m[5] || m[4]
    try {
      s.result = await finishLogin(s, m[2])
      s.status = 'ok'
      return { code: 0, state: 'ok', ...s.result }
    } catch (err) {
      s.status = 'error'
      s.errorMsg = err.message
      logger.error(`[火影网页登录] 链路失败: ${err.message}`)
      return { code: 1, state: 'error', msg: err.message }
    }
  }
  if (m[1] === '65') {
    sessions.delete(sid)
    return { code: 2, state: 'expired', msg: '二维码已过期，正在刷新...' }
  }
  if (m[1] === '67') return { code: 3, state: 'scanned', msg: '已扫码，请在手机上确认登录' }
  return { code: 3, state: 'waiting', msg: '' }
}

/** g_tk（QQ 互联 CSRF token，5381 哈希 p_skey）—— 复刻 qlogin_v2.js Q.getToken */
function gtk (str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) hash += (hash << 5) + str.charCodeAt(i)
  return hash & 0x7fffffff
}

/** ui 参数（UUID v4 大写）—— 复刻 qlogin_v2.js getUuid */
function genUuid () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  }).toUpperCase()
}

/**
 * check_sig 拿登录态 → POST authorize 换 OAuth code
 *
 * 浏览器真实链路（qlogin_v2.js 逆向确认）：
 *   check_sig（302，响应头写入 graph 登录态 cookie）→ login_jump 页 postMessage 通知壳页
 *   → 壳页 Q.agree() 以表单 POST 提交 authorize（from_ptlogin=1 + g_tk + openapi=#）
 *   → 响应 302 Location / JSON callback 携带 redirect_uri?code=XXX
 * 注意：GET authorize 即使带登录态也会被弹回 show?which=Login 登录壳页，必须走 POST
 */
async function fetchCode (s, sigUrl) {
  // 1. GET check_sig：把 graph 登录态 cookie（p_skey/pt_oauth_token 等）写入 jar
  let r
  try {
    r = await request(sigUrl, { jar: s.jar })
  } catch (err) {
    throw new Error(`登录跳转失败: ${err.message}`)
  }
  const scInfo = (r.headers['set-cookie'] || []).map(c => {
    const dm = c.match(/domain=([^;]+)/i)
    const nm = c.match(/^([^=;]+)/)
    return nm ? `${nm[1]}@${dm ? dm[1] : 'host'}` : '?'
  }).join(', ')
  logger.mark(`[火影网页登录] check_sig ${r.status} | set: ${scInfo}`)

  // 2. 取 graph 域 p_skey 计算 g_tk（浏览器 document.cookie 首个 p_skey = graph 域）
  const pSkey = s.jar.domains.get('graph.qq.com')?.get('p_skey')
  if (!pSkey) throw new Error('graph 登录态缺失（check_sig 未写入 p_skey）')

  // 3. POST authorize（复刻浏览器 Q.agree() 的表单提交）
  // ui：浏览器在 show 页生成并写入 graph.qq.com 域 cookie，表单值与 cookie 保持一致
  let ui = s.jar.domains.get('graph.qq.com')?.get('ui')
  if (!ui) {
    ui = genUuid()
    s.jar.set('graph.qq.com', 'ui', ui)
  }
  const su = new URL(s.sUrl)
  const q = su.searchParams
  const form = new URLSearchParams({
    response_type: q.get('response_type') || 'code',
    client_id: q.get('client_id') || QC_APPID,
    redirect_uri: q.get('redirect_uri') || REDIRECT_URI,
    scope: q.get('scope') || 'get_user_info',
    state: q.get('state') || '',
    switch: '',
    from_ptlogin: '1',
    src: '1',
    update_auth: '0',
    openapi: '#',
    g_tk: String(gtk(pSkey)),
    auth_time: String(Date.now()),
    ui
  })
  const showUrl = `https://graph.qq.com/oauth2.0/show?which=Login&display=pc&${q.toString()}`
  let res
  try {
    res = await request('https://graph.qq.com/oauth2.0/authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: showUrl,
        Origin: 'https://graph.qq.com'
      },
      body: form.toString(),
      jar: s.jar
    })
  } catch (err) {
    throw new Error(`authorize 提交失败: ${err.message}`)
  }
  logger.mark(`[火影网页登录] POST authorize ${res.status}${res.headers.location ? ` → ${res.headers.location.slice(0, 110)}` : ''}`)

  // 4. 提取 code：优先 302 Location，其次响应体（JSON callback / 跳转脚本）
  if (res.headers.location) {
    const loc = res.headers.location
    const cm = loc.match(/[?&]code=([^&]+)/)
    if (cm) return cm[1]
    // 302 到中转页 → 跟一跳再找
    const r2 = await request(new URL(loc, 'https://graph.qq.com/oauth2.0/authorize').href, { jar: s.jar })
    const loc2 = r2.headers.location || ''
    const cm2 = loc2.match(/[?&]code=([^&]+)/)
    if (cm2) return cm2[1]
    const m2 = r2.body.toString('utf8').match(/[?&]code=([^&"'\\]+)/)
    if (m2) return m2[1]
  }
  const body = res.body.toString('utf8')
  // JSON 形态: {"ret":0,"callback":"...code=XXX"}（JSONP 回调包裹也兼容）
  const jm = body.match(/"callback"\s*:\s*"[^"]*[?&]code=([^&"\\]+)/) || body.match(/[?&]code=([^&"'\\]+)/)
  if (jm) return jm[1]
  throw new Error(`authorize 响应未包含 code(${res.status}): ${body.slice(0, 120)}`)
}

/** code → openid + access_token（QQ 互联） */
async function codeToOpenId (s, code) {
  const uls = await request(
    `https://ams.game.qq.com/ams/userLoginSvr?a=qcCodeToOpenId&qc_code=${code}&appid=${QC_APPID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&callback=cb&_=${Date.now()}`,
    { headers: { Referer: 'https://hyrz.qq.com/' }, jar: s.jar }
  )
  const txt = uls.body.toString('utf8')
  let data
  try {
    data = JSON.parse(txt)
  } catch {
    // JSONP 形态: cb({...}) 或 try{cb({...})}catch(e){}
    // 注意不能用 indexOf('{')~lastIndexOf('}')：try{ 的 { 在最前面，会切出非法 JSON
    const m = txt.match(/cb\((\{[\s\S]*\})\)/) || txt.match(/\((\{[\s\S]*\})\)/)
    if (m) {
      try { data = JSON.parse(m[1]) } catch { }
    }
  }
  if (!data) throw new Error(`qcCodeToOpenId 解析失败: ${txt.slice(0, 100)}`)
  if (parseInt(data.iRet) !== 0 || !data.openid || !data.access_token) {
    throw new Error(`登录态获取失败(${data.iRet}): ${data.sMsg || ''}`)
  }
  return data
}

/** 用 ULINK 活动接口验证登录态，返回用户信息 */
async function verifyUlink (openid, access_token) {
  const cookie = `openid=${openid}; acctype=qc; appid=${QC_APPID}; access_token=${access_token}`
  const qs = `route=User/userinfo&iActId=8265&sAppId=ULINK-AKKJ-784060&game=hyrz&eas_url=${encodeURIComponent('http://wechatmini.qq.com/hyrz/wxc47b57c32a7fe64b/pages/scroll/scroll/')}&e_code=0`
  const body = 'area=2&platId=1&partition=2175&roleId=1&cmd=&matchId=&iActId=8265&sAppId=ULINK-AKKJ-784060&g_tk=0'
  const r = await request(`https://ulinkact.game.qq.com/app/7335/1824be56cbeb29e7/index.php?${qs}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      charset: 'utf-8',
      Referer: 'https://servicewechat.com/wxc47b57c32a7fe64b/228/page-frame.html',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/150.0.7871.189 Mobile Safari/537.36',
      Cookie: cookie
    },
    body
  })
  let j
  try {
    j = JSON.parse(r.body.toString('utf8'))
  } catch {
    throw new Error(`ULINK 验证响应异常: ${r.body.toString('utf8').slice(0, 100)}`)
  }
  if (j.iRet !== 0) throw new Error(`ULINK 登录态验证失败(${j.iRet}): ${j.sMsg || ''}`)
  return { nickname: j.jData?.nickname || '', avatar: j.jData?.avatar || '' }
}

/** 扫码成功后的完整链路: code → openid/token → 验证 → 绑定 */
async function finishLogin (s, sigUrl) {
  const code = await fetchCode(s, sigUrl)
  const data = await codeToOpenId(s, code)
  const { openid, access_token, refresh_token } = data

  const verify = await verifyUlink(openid, access_token)

  Store.set(s.userId, openid, access_token, QC_APPID, refresh_token)

  logger.mark(`[火影网页登录] 用户${s.userId}扫码绑定成功 openid=${openid}`)
  return {
    openid,
    access_token,
    nickname: verify.nickname,
    avatar: verify.avatar,
    qqNick: s.qqNick || ''
  }
}

/* ========== QQ 直发二维码登录（零配置模式） ========== */
const qqLogins = new Map() // userId -> { stop }
const QQ_LOGIN_MAX_ROUNDS = 6 // 二维码最多刷新次数（约 30 分钟）

const sleep = ms => new Promise(r => setTimeout(r, ms))

/**
 * 启动 QQ 扫码登录：二维码图片直接发到聊天，无需网页/域名/公网
 * 用户长按识别 → 手机 QQ 授权确认 → 后台轮询拿到登录态 → 自动绑定
 * @param userId 用户 QQ
 * @param send 回调 (type, data) => Promise
 *   type: 'qr'(data=PNG Buffer) | 'ok'(data=结果) | 'error'(data=错误信息) | 'refresh'(刷新提示) | 'timeout'
 */
async function startQqLogin (userId, send) {
  // 同一用户重复发命令 → 停止旧轮询，保证唯一会话
  stopQqLogin(userId)
  const state = { stop: false }
  qqLogins.set(userId, state)

  try {
    for (let round = 1; round <= QQ_LOGIN_MAX_ROUNDS && !state.stop; round++) {
      const { sid } = await createSession(userId)
      if (state.stop) return
      await send('qr', getQr(sid))
      if (state.stop) return

      const t0 = Date.now()
      while (!state.stop && Date.now() - t0 < SESSION_TTL) {
        await sleep(2000)
        if (state.stop) return
        let r
        try {
          r = await pollSession(sid)
        } catch {
          continue // 网络波动，下轮重试
        }
        if (r.state === 'ok') return await send('ok', r)
        if (r.state === 'error') return await send('error', r.msg)
        if (r.state === 'expired' || r.state === 'gone') break // 过期 → 刷新二维码
        // waiting / scanned → 继续轮询
      }
      if (state.stop) return
      // 二维码过期且还有刷新次数 → 提示并发新码
      if (round < QQ_LOGIN_MAX_ROUNDS) {
        await send('refresh', null)
      }
    }
    if (!state.stop) await send('timeout', null)
  } finally {
    if (qqLogins.get(userId) === state) qqLogins.delete(userId)
  }
}

/** 停止某用户进行中的 QQ 扫码登录轮询 */
function stopQqLogin (userId) {
  const s = qqLogins.get(userId)
  if (s) {
    s.stop = true
    qqLogins.delete(userId)
  }
}

/* ========== 过期清理 ========== */
setInterval(() => {
  const now = Date.now()
  for (const [k, t] of loginTokens) if (now > t.expire) loginTokens.delete(k)
  for (const [k, s] of sessions) if (now - s.createTime > SESSION_TTL) sessions.delete(k)
}, 10 * 60 * 1000).unref()

const WebLogin = { createToken, checkToken, createSession, pollSession, getQr, startQqLogin, stopQqLogin, finishLogin }
export default WebLogin
export { CookieJar, request, finishLogin, hash33, UA, PT_APPID, DAID, QC_APPID, JS_VER, REDIRECT_URI }
