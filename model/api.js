import https from 'node:https'
import zlib from 'node:zlib'
import Store from './store.js'
import Ninja from './ninja.js'

const HOST = 'ulinkact.game.qq.com'
const BASE_PATH = '/app/7335/1824be56cbeb29e7/index.php'
const COMMON_QUERY = 'iActId=8265&sAppId=ULINK-AKKJ-784060&game=hyrz&eas_url=http%3A%2F%2Fwechatmini.qq.com%2Fhyrz%2Fwxc47b57c32a7fe64b%2Fpages%2Fscroll%2Fscroll%2F&e_code=0'

/** AMS 福利中心（活动576370）: x8m8.ams.game.qq.com/ams/ame/amesvr */
const AMS_WELFARE_HOST = 'x8m8.ams.game.qq.com'
const AMS_WELFARE_ACTIVITY_ID = '576370'
const AMS_WELFARE_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  charset: 'utf-8',
  Referer: 'https://servicewechat.com/wxc47b57c32a7fe64b/228/page-frame.html',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/150.0.7871.189 Mobile Safari/537.36 MicroMessenger/8.0.77.3160 MiniProgramEnv/android'
}

/** AMS 福利中心签到/查询（x8m8.ams.game.qq.com） */
function amsPost (flowId, cookie) {
  const body = `iActivityId=${AMS_WELFARE_ACTIVITY_ID}&iFlowId=${flowId}&sOpenid=&openId=&g_tk=1842395457`
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: AMS_WELFARE_HOST,
      path: `/ams/ame/amesvr?ameVersion=0.3&sServiceType=hyrz&iActivityId=${AMS_WELFARE_ACTIVITY_ID}&game=hyrz&eas_url=http%3A%2F%2Fwechatmini.qq.com%2Fhyrz%2Fwxc47b57c32a7fe64b%2Fpages%2Fwelfaresite%2Fwelfaresite%2F&e_code=0`,
      method: 'POST',
      headers: { ...AMS_WELFARE_HEADERS, Cookie: cookie }
    }, res => {
      let d = ''
      res.on('data', c => { d += c })
      res.on('end', () => {
        try {
          resolve(JSON.parse(d))
        } catch (e) {
          reject(new Error(`AMS响应解析失败(${res.statusCode}): ${d.slice(0, 120)}`))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(new Error('请求超时')) })
    req.write(body)
    req.end()
  })
}
const AMS_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/150.0.7871.189 Mobile Safari/537.36',
  Referer: 'https://hyrz.qq.com/',
  Origin: 'https://hyrz.qq.com'
}

const HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  charset: 'utf-8',
  Referer: 'https://servicewechat.com/wxc47b57c32a7fe64b/228/page-frame.html',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/150.0.7871.189 Mobile Safari/537.36 MicroMessenger/8.0.77.3160 MiniProgramEnv/android'
}

function post (route, body, cookie) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: HOST,
      path: `${BASE_PATH}?route=${route}&${COMMON_QUERY}`,
      method: 'POST',
      headers: { ...HEADERS, Cookie: cookie }
    }, res => {
      let d = ''
      res.on('data', c => { d += c })
      res.on('end', () => {
        try {
          resolve(JSON.parse(d))
        } catch (e) {
          reject(new Error(`响应解析失败(${res.statusCode}): ${d.slice(0, 120)}`))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(new Error('请求超时')) })
    req.write(body)
    req.end()
  })
}

/** GET 官方静态 JSON（gzip + JSONP），返回解析后的对象 */
function getStaticJson (url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`静态数据请求失败(${res.statusCode})`))
          return
        }
        let buf = Buffer.concat(chunks)
        let text
        try {
          text = zlib.gunzipSync(buf).toString('utf8')
        } catch {
          text = buf.toString('utf8')
        }
        try {
          // JSONP: getNinjaData({...});
          const m = text.match(/^\s*[a-zA-Z_$][\w$]*\(([\s\S]*)\)\s*;?\s*$/)
          resolve(JSON.parse(m ? m[1] : text))
        } catch (e) {
          reject(new Error('静态数据解析失败'))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(new Error('请求超时')) })
  })
}

/** AMS ide 图表请求（金币助手），返回 JSON */
function amsIde (chartId, token, extra, cookie) {
  const body = `iChartId=${chartId}&iSubChartId=${chartId}&sIdeToken=${token}&e_code=0&g_code=0${extra || ''}`
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: AMS_HOST,
      path: '/ide/',
      method: 'POST',
      headers: { ...AMS_HEADERS, Cookie: cookie }
    }, res => {
      let d = ''
      res.on('data', c => { d += c })
      res.on('end', () => {
        try {
          resolve(JSON.parse(d))
        } catch (e) {
          reject(new Error(`AMS 响应解析失败(${res.statusCode}): ${d.slice(0, 120)}`))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(new Error('请求超时')) })
    req.write(body)
    req.end()
  })
}

/** result 字段: 0=失败 2/3=胜利 (推断) */
function parseResult (r) {
  return String(r) === '0' ? '败' : '胜'
}

/** fightType: 1=排位赛 0=忍术对决(休闲对战) 其他=未分类模式 */
function parseFightType (t) {
  const s = String(t)
  if (s === '1') return '排位赛'
  if (s === '0') return '忍术对决'
  return '其他'
}

/** 按模式统计近期对局: [{key,name,total,wins,winRate}]（仅保留有场次的模式，按场次降序） */
function buildModeStats (matches) {
  const order = [
    { key: 'rank', name: '排位赛', type: '1' },
    { key: 'duel', name: '忍术对决', type: '0' }
  ]
  const stats = order.map(o => {
    const list = matches.filter(m => m.fightType === o.type)
    const wins = list.filter(m => m.win).length
    return {
      key: o.key,
      name: o.name,
      total: list.length,
      wins,
      winRate: list.length ? Math.round(wins / list.length * 100) : 0
    }
  })
  const other = matches.filter(m => m.fightType !== '0' && m.fightType !== '1')
  if (other.length) {
    const wins = other.filter(m => m.win).length
    stats.push({ key: 'other', name: '其他', total: other.length, wins, winRate: Math.round(wins / other.length * 100) })
  }
  return stats.filter(s => s.total > 0).sort((a, b) => b.total - a.total)
}

/** 解析段位赛（排位赛）赛季记录（cmd=matchRecord 返回的 sourceInfo） */
function parseRankRecord (mr, seasons) {
  if (!mr || !Object.keys(mr).length) return null
  const mrTotal = Number(mr.totalMatch) || 0
  const mrWin = Number(mr.totalWinMatch) || 0
  const curSeason = (seasons || []).find(s => String(s.matchId) === String(mr.matchId))
  return {
    matchId: mr.matchId,
    season: curSeason?.adName || '',
    total: mrTotal,
    win: mrWin,
    fail: Number(mr.failMatch) || 0,
    tie: Number(mr.tieMatch) || 0,
    winRate: mrTotal ? Math.round(mrWin / mrTotal * 100) : 0,
    highest: mr.highestMatch,
    title: mr.matchTitle?.[0] || '',
    titleDesc: mr.matchTitle?.[1] || '',
    beforeNinja: (mr.beforeNinja || []).map(n => ({
      name: Ninja.getLineName(n.ninja),
      avatar: Ninja.getAvatar(n.ninja),
      total: n.total,
      win: n.win,
      winRate: n.total ? Math.round(n.win / n.total * 100) : 0,
      proficientPct: Math.min(100, Math.round((n.proficientCnt || 0) / 280))
    }))
  }
}

/** 大数字格式化: 9380524 → 938.1万 */
function fmtNum (n) {
  n = Number(n) || 0
  if (n >= 1e8) return (n / 1e8).toFixed(2).replace(/\.?0+$/, '') + '亿'
  if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, '') + '万'
  return String(n)
}

/** 六维属性雷达图（对数比例，预计算 SVG 坐标） */
const RADAR_ATTRS = [
  { key: 'hp', label: '生命' },
  { key: 'attack', label: '攻击' },
  { key: 'defence', label: '防御' },
  { key: 'criticalHit', label: '暴击' },
  { key: 'criticalDefence', label: '暴抗' },
  { key: 'magicAvoid', label: '闪避' }
]

function buildRadar (pw) {
  const CX = 120, CY = 130, R = 84
  const pt = (i, ratio) => {
    const ang = -Math.PI / 2 + (i * Math.PI) / 3
    const rr = R * ratio
    return `${(CX + rr * Math.cos(ang)).toFixed(1)},${(CY + rr * Math.sin(ang)).toFixed(1)}`
  }
  const axes = RADAR_ATTRS.map((a, i) => {
    const ang = -Math.PI / 2 + (i * Math.PI) / 3
    const cos = Math.cos(ang)
    return {
      label: a.label,
      x2: (CX + R * cos).toFixed(1),
      y2: (CY + R * Math.sin(ang)).toFixed(1),
      tx: (CX + (R + 24) * cos).toFixed(1),
      ty: (CY + (R + 24) * Math.sin(ang) + 4).toFixed(1),
      anchor: Math.abs(cos) < 0.3 ? 'middle' : (cos > 0 ? 'start' : 'end')
    }
  })
  // 对数归一化: log10(v) ∈ [4(1万), 6.5(约316万)] → 半径比例 [0.12, 1]
  const vals = RADAR_ATTRS.map(a => Number(pw[a.key]) || 0)
  const ratios = vals.map(v => {
    if (v <= 0) return 0.12
    const x = (Math.log10(v) - 4) / 2.5
    return Math.max(0.12, Math.min(1, 0.12 + 0.88 * x))
  })
  return {
    axes,
    grid33: RADAR_ATTRS.map((_, i) => pt(i, 0.33)).join(' '),
    grid66: RADAR_ATTRS.map((_, i) => pt(i, 0.66)).join(' '),
    grid100: RADAR_ATTRS.map((_, i) => pt(i, 1)).join(' '),
    radar: RADAR_ATTRS.map((_, i) => pt(i, ratios[i])).join(' '),
    items: RADAR_ATTRS.map((a, i) => ({
      label: a.label,
      value: vals[i],
      fmt: fmtNum(vals[i])
    }))
  }
}

function loginStateHint (message) {
  return `${message}（登录态可能已失效，请重新发送 #火影登录；不会自动重试操作）`
}

const Api = {
  /** 查询角色战绩信息（角色由绑定文件里的 partition 决定，缺失时自动同步角色列表） */
  async getCharacterInfo (userId) {
    let bind = Store.get(userId)
    if (!bind) return { error: '未绑定，请先发送 #火影登录 扫码绑定' }

    // 绑定后从未同步过角色 → 先拉角色列表写入 partition
    if (!bind.partition) {
      await Api.syncUserRole(userId)
      bind = Store.get(userId) || bind
    }

    const body = `area=2&platId=1&partition=${bind.partition || 2175}&roleId=${bind.roleId || 1}&cmd=&matchId=&iActId=8265&sAppId=ULINK-AKKJ-784060&g_tk=0`
    let res = await post('CharacterInfo/getCharacterInfo', body, Store.buildCookie(bind))
    if (res.iRet !== 0) {
      return { error: loginStateHint(`接口返回错误: ${res.sMsg || res.iRet}`) }
    }

    // 角色未同步到活动系统（cardRole missing data）→ 重新同步后重试一次
    if (res.jData?.cardRole?.code !== 0) {
      const ok = await Api.syncUserRole(userId)
      if (ok) {
        const retry = await post('CharacterInfo/getCharacterInfo', `area=2&platId=1&partition=${Store.get(userId).partition}&roleId=${Store.get(userId).roleId || 1}&cmd=&matchId=&iActId=8265&sAppId=ULINK-AKKJ-784060&g_tk=0`, Store.buildCookie(Store.get(userId)))
        if (retry.iRet === 0 && retry.jData?.cardRole?.code === 0) res = retry
      }
    }

    const d = res.jData
    const info = d.cardRole?.sourceInfo || {}
    const myNinja = (d.myNinja?.sourceInfo?.list || []).map(n => ({
      id: n.ninjaId,
      name: Ninja.getName(n.ninjaId),
      avatar: Ninja.getAvatar(n.ninjaId),
      fightCnt: n.fightCnt,
      winCnt: n.winCnt,
      winRate: n.fightCnt ? Math.round(n.winCnt / n.fightCnt * 100) : 0,
      proficientCnt: n.proficientCnt,
      // 熟练度上限 28000，转为百分比（0~100）
      proficientPct: Math.min(100, Math.round((n.proficientCnt || 0) / 280))
    }))
    const matches = (d.recentMatch?.sourceInfo || []).slice(0, 10).map(m => ({
      time: m.eventTime,
      ninjas: [m.ninJia1, m.ninJia2, m.ninJia3].map(id => ({
        id,
        // 称号括号处换行（配合模板 CSS pre-line）
        name: Ninja.getLineName(id),
        avatar: Ninja.getAvatar(id)
      })),
      result: parseResult(m.result),
      win: String(m.result) !== '0',
      type: parseFightType(m.fightType),
      fightType: String(m.fightType)
    }))
    // 胜率统计（基于全部近期比赛）+ 按模式分组（排位赛 / 忍术对决）
    const allMatches = d.recentMatch?.sourceInfo || []
    const total = allMatches.length
    const wins = allMatches.filter(m => String(m.result) !== '0').length
    const modes = buildModeStats(allMatches.map(m => ({
      fightType: String(m.fightType),
      win: String(m.result) !== '0'
    })))

    // 六维属性 + 战力排名
    const pw = d.myPower?.sourceInfo || {}
    const zoneRank = Number(pw.fightZoneRank) || 0
    const worldRank = Number(pw.fightWorldRank) || 0
    const power = {
      ...buildRadar(pw),
      zoneRank: zoneRank > 0 ? zoneRank : 0,
      worldRank: worldRank > 0 ? worldRank : 0
    }

    // 组织信息
    const gp = d.myGroupPower?.sourceInfo || {}
    const group = gp.guildName ? {
      name: gp.guildName,
      fc: fmtNum(gp.guildFc),
      memberNum: gp.guildMemberNum,
      zoneRank: Number(gp.guildFcZoneRank) || 0,
      battleZoneRank: Number(gp.guildFcBattleZoneRank) || 0
    } : null

    // 资产汇总
    const as = d.assetSum?.sourceInfo || {}
    const assets = Object.keys(as).length ? {
      copper: fmtNum(as.copperCount),
      coin: fmtNum(as.coinCount),
      ticket: as.ticketCount,
      physical: as.physicalCount,
      seniorRecruit: as.seniorRecruitCount,
      limitedRecruit: as.limitedRecruitCount,
      ninja: as.ninjaNum,
      monster: as.monsterNum,
      secretScroll: as.secretScrollNum,
      avatar: as.avatarNum
    } : null

    // 赛季段位赛记录（当前赛季）+ 历史赛季列表
    const mr = d.matchRecord?.sourceInfo || {}
    const seasons = d.matchRecord?.dependSource?.data || []
    const rankMatches = parseRankRecord(mr, seasons)
    const seasonList = seasons.map(s => ({ matchId: s.matchId, name: s.adName }))

    return {
      info: {
        fight: info.fight,
        level: info.level,
        vip: info.vip,
        registerTime: info.registerTime,
        historyHighest: info.historyHighest,
        sumNumber: info.sumNumber,
        pvpTotalWin: info.pvpTotalWin,
        pvpTopContinueWin: info.pvpTopContinueWin,
        pvpTotalFlawless: info.pvpTotalFlawless,
        avatarNum: info.avatarNum,
        isOnline: info.isOnline,
        showNinja: info.showNinja
          ? {
              id: info.showNinja,
              name: Ninja.getName(info.showNinja),
              avatar: Ninja.getAvatar(info.showNinja),
              art: Ninja.getArt(info.showNinja)
            }
          : null
      },
      ninjaNumber: d.myNinja?.sourceInfo?.ninjaNumber,
      myNinja,
      matches,
      modes,
      recentWinRate: total ? Math.round(wins / total * 100) : 0,
      recentWins: wins,
      recentTotal: total,
      power,
      group,
      assets,
      rankMatches,
      seasonList
    }
  },

  /**
   * 查询指定历史赛季的排位赛（段位赛）记录
   * @param {string} userId
   * @param {string} matchId 赛季 ID（来自 getCharacterInfo 返回的 seasonList）
   */
  async getSeasonRecord (userId, matchId) {
    let bind = Store.get(userId)
    if (!bind) return { error: '未绑定，请先发送 #火影登录 扫码绑定' }
    if (!bind.partition) {
      await Api.syncUserRole(userId)
      bind = Store.get(userId) || bind
    }
    const r = await post('CharacterInfo/getCharacterInfo',
      `area=2&platId=1&partition=${bind.partition || 2175}&roleId=${bind.roleId || 1}&cmd=matchRecord&matchId=${matchId}&iActId=8265&sAppId=ULINK-AKKJ-784060&g_tk=0`,
      Store.buildCookie(bind))
    if (r.iRet !== 0) return { error: loginStateHint(`赛季查询失败: ${r.sMsg || r.iRet}`) }
    const mr = r.jData?.matchRecord?.sourceInfo
    if (!mr || !Object.keys(mr).length) return { error: '未找到该赛季的记录' }
    const record = parseRankRecord(mr, [])
    return { record }
  },

  /**
   * 查询单个忍者详情（技能数据 + 个人使用数据）
   * @param {string} userId - 用于查个人数据（可空，空则跳过个人数据）
   * @param {string} ninjaId - 5位游戏ID
   */
  async getNinjaDetail (userId, ninjaId) {
    const id = String(ninjaId).slice(0, 5)

    // 1. 官方静态技能数据
    const j = await getStaticJson(`https://hyrz.qq.com/act/a20240723fashion/ninja-data/prod/${id}.json`)
    const z = j.zhanshi?.rzzs || {}
    if (!z.rzwyID) return { error: '未找到该忍者的数据' }

    // 解析技能槽位（每类最多5个，取有名称的）
    const parseSkills = (obj, prefix) => {
      const list = []
      for (let i = 1; i <= 5; i++) {
        const mc = obj[`${prefix}${i}mc`]
        if (!mc) continue
        list.push({
          name: mc,
          desc: obj[`${prefix}${i}ms`] || '',
          brief: obj[`${prefix}${i}jnsm`] || '',
          icon: (obj[`${prefix}${i}jnicon`] || '').replace(/^\/\//, 'https://'),
          state: obj[`${prefix}${i}ztm`] || ''
        })
      }
      return list
    }
    const jnzs = j.jnzs || {}
    const skills = {
      normal: parseSkills(jnzs.pg || {}, 'pg'),
      skill1: parseSkills(jnzs.yjn || {}, 'yjn'),
      skill2: parseSkills(jnzs.ejn || {}, 'ejn'),
      ultimate: parseSkills(jnzs.ay || {}, 'ay'),
      special: [...parseSkills(jnzs.tsjz || {}, 'tsjz'), ...parseSkills(jnzs.bcjz || {}, 'bcjz')]
    }

    // 推荐秘卷/通灵
    const tj = j.tjtlmj || {}
    const parseArr = (o, keys) => keys.map(k => o[k]).filter(Boolean)
    const secret = [
      tj.tjmj1 && { name: tj.tjmj1.tjmjmc1, desc: tj.tjmj1.tjmjms1, icon: (tj.tjmj1.tjmjtx1 || '').replace(/^\/\//, 'https://') },
      tj.tjmj2 && { name: tj.tjmj2.tjmjmc2, desc: tj.tjmj2.tjmjms2, icon: (tj.tjmj2.tjmjtx2 || '').replace(/^\/\//, 'https://') }
    ].filter(Boolean)
    const summon = [
      tj.tjtls1 && { name: tj.tjtls1.tjtlsmc1, icon: (tj.tjtls1.tjtlsicon1 || '').replace(/^\/\//, 'https://') },
      tj.tjtls2 && { name: tj.tjtls2.tjtlsmc2, icon: (tj.tjtls2.tjtlsicon2 || '').replace(/^\/\//, 'https://') }
    ].filter(Boolean)

    // 2. 个人使用数据（需绑定）
    let mine = null
    const bind = userId ? Store.get(userId) : null
    if (bind) {
      const r = await post('NinjaStation/getNinjaInfo', `ninjaId=${id}&iActId=8265&sAppId=ULINK-AKKJ-784060&g_tk=0`, Store.buildCookie(bind))
      if (r.iRet === 0 && r.jData?.ninjaInfo) {
        const ni = r.jData.ninjaInfo
        mine = {
          possess: r.jData.possess === 1,
          point: ni.point,
          getTime: ni.getTime,
          proficient: Number(ni.proficient) || 0,
          // 熟练度上限 28000
          proficientPct: Math.min(100, Math.round((Number(ni.proficient) || 0) / 280)),
          winCnt: ni.winCnt,
          fightCnt: ni.fightCnt,
          winRate: ni.customWinRate != null ? Math.round(ni.customWinRate) : (Number(ni.fightCnt) ? Math.round(ni.winCnt / ni.fightCnt * 100) : 0)
        }
      }
    }

    return {
      id: z.rzwyID,
      name: Ninja.getName(z.rzwyID) || z.rzzmc,
      baseName: z.rzzmc,
      star: z.rzzxd,
      tags: (z.rzdwbq || '').split(',').filter(Boolean),
      gender: j.rzkz?.qt?.rzxb || '',
      highlight: z.rzyjhgl || '',
      releaseTime: z.rzsxsj,
      avatar: Ninja.getAvatar(z.rzwyID),
      art: Ninja.getArt(z.rzwyID),
      arts: parseArr(z, ['bslhcc1', 'bslhcc2', 'bslhcc3', 'bslhcc4']).map(u => u.replace(/^\/\//, 'https://')),
      skills,
      secret,
      summon,
      mine
    }
  },

  /**
   * 查询金币助手数据（钱包余额 + 本周任务 + 月度统计 + 金币明细）
   * 数据源: 官方「金币助手」活动页 AMS 接口（hyrz.qq.com/cp/a20231214jbzs）
   */
  async getJbzsData (userId) {
    const bind = Store.get(userId)
    if (!bind) return { error: '未绑定，请先发送 #火影登录 扫码绑定' }
    const cookie = Store.buildCookie(bind)

    // 1. 主态初始化（chart 252291）
    const init = await amsIde(252291, 'KMSGvn', '', cookie)
    if (init.iRet !== 0 || !init.jData) {
      return { error: loginStateHint(`金币助手接口返回错误: ${init.sMsg || init.iRet}`) }
    }
    const d = init.jData

    // 钱包余额 money_data: "3|91000 x|91018 x|91001 x|"
    const wallet = { copper: 0, coin: 0, ticket: 0 }
    for (const seg of String(d.money_data || '').split('|')) {
      const item = seg.trim().split(' ')
      if (item[0] === '91000') wallet.coin = Number(item[1]) || 0
      else if (item[0] === '91018') wallet.ticket = Number(item[1]) || 0
      else if (item[0] === '91001') wallet.copper = Number(item[1]) || 0
    }
    wallet.copperFmt = fmtNum(wallet.copper)
    wallet.coinFmt = fmtNum(wallet.coin)
    wallet.ticketFmt = fmtNum(wallet.ticket)

    // 本周任务（needJbToolData.jb_week_data）
    const wd = d.week_data || {}
    const week = {
      range: wd.monday && wd.sunday ? `${wd.monday.slice(5)} ~ ${wd.sunday.slice(5)}` : '',
      tasks: [],
      monthTasks: []
    }
    const tool = wd.needJbToolData || {}
    for (const t of tool.jb_week_data || []) {
      week.tasks.push({
        title: t.title1 === '公众号签到' ? '情报社签到' : t.title1,
        sub: t.title2 || '',
        takeNum: Number(t.all_take_num) || 0,
        takeJb: Number(t.all_take_jb) || 0,
        desc: t.desc_str || '',
        showType: t.show_type
      })
    }
    for (const t of tool.jb_month_data || []) {
      week.monthTasks.push({
        title: t.title1,
        sub: t.title2 || '',
        takeNum: Number(t.all_take_num) || 0,
        takeJb: Number(t.all_take_jb) || 0,
        desc: t.desc_str || ''
      })
    }
    const weekTotalJb = week.tasks.reduce((s, t) => s + t.takeJb, 0)

    // 月度统计（当月/上月实时 + 历史月份）
    const num = v => Number(v) || 0
    const rm = num(d.rm_token_jb?.['1283027']?.data?.result)
    const add = num(d.add_token_jb?.['1283027']?.data?.result)
    const nowFixed = num(d.nowMonthJbData?.['1281009']?.data?.result)
    // 总收益需修正跨月时间偏移（与官方页面一致）
    const nowTotal = num(d.nowMonthJbData?.['1281029']?.data?.result) - rm + add
    const lastFixed = num(d.lastMonthJbData?.['1281009']?.data?.result)
    const lastTotal = num(d.lastMonthJbData?.['1281029']?.data?.result) + rm
    const gdMap = {}
    for (const m of d.monthsJbGdData || []) gdMap[String(m.params?.imonth || '').replace('-', '')] = num(m.data?.result)
    const tkMap = {}
    for (const m of d.monthsJbTokenData || []) tkMap[String(m.params?.imonth || '').replace('-', '')] = num(m.data?.result)
    const yearMonths = d.yearMonths || []
    const fmtMonth = ym => {
      const s = String(ym)
      return s.length === 6 ? `${s.slice(0, 4)}-${s.slice(4)}` : s
    }
    const months = []
    if (yearMonths[0]) months.push({ month: yearMonths[0], monthFmt: fmtMonth(yearMonths[0]), fixed: nowFixed, total: nowTotal, extra: nowTotal - nowFixed })
    if (yearMonths[1]) months.push({ month: yearMonths[1], monthFmt: fmtMonth(yearMonths[1]), fixed: lastFixed, total: lastTotal, extra: lastTotal - lastFixed })
    for (const ym of yearMonths.slice(2)) {
      const k = String(ym).replace('-', '')
      months.push({ month: ym, monthFmt: fmtMonth(k), fixed: gdMap[k] || 0, total: tkMap[k] || 0, extra: (tkMap[k] || 0) - (gdMap[k] || 0) })
    }

    // 2. 金币明细第一页（chart 253559, type=1 金币）
    let details = []
    try {
      const ym = (yearMonths[0] || new Date().toISOString().slice(0, 7)).replace('-', '')
      const r = await amsIde(253559, 'DVyFcT', `&yearMonth=${ym}&mode=1&type=1&page=1`, cookie)
      if (r.iRet === 0 && r.jData?.data) {
        details = (r.jData.data || []).slice(0, 12).map(x => ({
          tag: decodeURIComponent(x.tag || ''),
          title: decodeURIComponent(x.title || ''),
          desc: decodeURIComponent(x.desc || ''),
          value: Number(x.value) || 0,
          after: Number(x.afterCount) || 0,
          afterFmt: fmtNum(Number(x.afterCount) || 0),
          date: String(x.date || '').slice(5)
        }))
      }
    } catch (e) {
      logger.warn(`[火影插件]金币明细查询失败: ${e.message}`)
    }

    return {
      wallet,
      week,
      weekTotalJb,
      months,
      details
    }
  },

  /**
   * 查询进行中的活动列表（活动日历）
   * 数据源: ActCalendar/getActListInfo（小程序活动日历页）
   */
  async getActList (userId) {
    const bind = Store.get(userId)
    if (!bind) return { error: '未绑定，请先发送 #火影登录 扫码绑定' }
    const cookie = Store.buildCookie(bind)

    const r = await post('ActCalendar/getActListInfo', 'iActId=8265&sAppId=ULINK-AKKJ-784060&g_tk=0', cookie)
    if (r.iRet !== 0) return { error: `活动查询失败: ${r.sMsg || r.iRet}` }

    const now = new Date()
    const nowTs = now.getTime()
    const list = (r.jData?.list || []).map(x => {
      const ad = x.adInfo || {}
      const cfg = ad.config || {}
      return {
        name: cfg.eventName || ad.name || '',
        desc: cfg.simpleDesc || '',
        fullDesc: cfg.fullDesc || '',
        pic: ad.pic || '',
        start: (ad.start_time || '').slice(0, 16),
        end: (ad.end_time || '').slice(0, 16),
        startTs: new Date(ad.start_time?.replace(/-/g, '/')).getTime() || 0,
        endTs: new Date(ad.end_time?.replace(/-/g, '/')).getTime() || 0
      }
    })

    // ===== 日历窗口（-7天 ~ +5天，共13天）=====
    const winStart = new Date(now)
    winStart.setDate(now.getDate() - 7)
    winStart.setHours(0, 0, 0, 0)
    const winStartTs = winStart.getTime()
    const winEnd = new Date(winStart)
    winEnd.setDate(winStart.getDate() + 12)
    winEnd.setHours(23, 59, 59, 999)
    const totalRange = winEnd.getTime() - winStartTs

    // 日期头（按月分组，含今日标记）
    const WEEK = ['日', '一', '二', '三', '四', '五', '六']
    const dateList = []
    let curMonth = -1
    for (let i = 0; i < 13; i++) {
      const d = new Date(winStart)
      d.setDate(winStart.getDate() + i)
      const m = d.getMonth() + 1
      if (m !== curMonth) {
        curMonth = m
        dateList.push({ month: m, dates: [] })
      }
      dateList[dateList.length - 1].dates.push({
        d: d.getDate(),
        weekName: WEEK[d.getDay()],
        isToday: d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
      })
    }

    // 只保留与窗口有交集的活动，计算甘特条位置与标签
    const fmtMD = ts => {
      const d = new Date(ts)
      return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const calList = list.filter(it => it.endTs >= winStartTs && it.startTs <= winEnd.getTime())
    for (const it of calList) {
      const s = Math.max(it.startTs, winStartTs)
      const e = Math.min(it.endTs, winEnd.getTime())
      it.left = (s - winStartTs) / totalRange * 100
      it.width = (e - s) / totalRange * 100
      it.leftDays = Math.ceil((it.endTs - nowTs) / 86400000)
      it.notStarted = it.startTs > nowTs
      if (it.notStarted) {
        const toStart = Math.ceil((it.startTs - nowTs) / 86400000)
        it.label = `${fmtMD(it.startTs)} 开始 · ${toStart}天后`
      } else if (it.endTs - nowTs > 365 * 86400000) {
        it.label = '长期活动'
      } else {
        it.label = `${fmtMD(it.endTs)} 结束 · 剩${it.leftDays}天`
      }
    }
    calList.sort((a, b) => a.endTs - b.endTs)

    return {
      list: calList,
      dateList,
      nowLeft: (nowTs - winStartTs) / totalRange * 100,
      nowTime: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    }
  },

  /**
   * 查询官方壁纸列表（wallpaper/getWallPaperList）
   * tag: 0=官方壁纸 1=招募海报 2=活动海报
   * 返回按权重(≈时间)降序的列表
   */
  async getWallpaperList (userId, page = 1) {
    const bind = Store.get(userId)
    if (!bind) return { error: '未绑定，请先发送 #火影登录 扫码绑定' }
    const cookie = Store.buildCookie(bind)

    const r = await post('wallpaper/getWallPaperList',
      `page=${page}&pageSize=25&tag=&search=&iActId=8265&sAppId=ULINK-AKKJ-784060&g_tk=0`, cookie)
    if (r.iRet !== 0) return { error: `壁纸查询失败: ${r.sMsg || r.iRet}` }

    const TAGS = { 0: '官方壁纸', 1: '招募海报', 2: '活动海报' }
    const list = (r.jData?.data || []).map(x => ({
      id: x.id,
      title: x.title || '',
      desc: x.desc || '',
      tag: TAGS[Number(x.tag)] || '壁纸',
      img: x.img || '',
      icon: x.icon || '',
      width: Number(x.width) || 0,
      height: Number(x.height) || 0,
      time: (x.ctime || '').slice(0, 10)
    }))

    return { total: r.jData?.rows || list.length, page, list }
  },

  /**
   * 查询资讯文章列表（Ugc/articleList，小程序首页动态）
   * 返回推荐文章: 标题/作者/点赞/评论/时间
   */
  async getArticleList (userId, page = 1) {
    const bind = Store.get(userId)
    if (!bind) return { error: '未绑定，请先发送 #火影登录 扫码绑定' }
    const cookie = Store.buildCookie(bind)

    const r = await post('Ugc/articleList',
      `page=${page}&pageSize=10&markList=${encodeURIComponent('推荐')}&format=1,2,3,4,5&iActId=8265&sAppId=ULINK-AKKJ-784060&g_tk=0`, cookie)
    if (r.iRet !== 0) return { error: `资讯查询失败: ${r.sMsg || r.iRet}` }

    const list = (r.jData || []).map(x => {
      const a = x.articleInfo || {}
      const u = x.userInfo || {}
      return {
        title: a.title || '',
        summary: (a.summary || '').slice(0, 60),
        category: (a.category_list || [])[0] || '资讯',
        author: u.nickname || '',
        authorAvatar: u.avatar || '',
        pics: a.pic_list || [],
        video: (a.video_list || [])[0] || '',
        likes: a.likeNum || 0,
        comments: a.commentNum || 0,
        time: (a.post_time || '').slice(5, 16),
        official: (u.wearBadge || []).some(b => b.name === '官方')
      }
    })

    return { page, list }
  },

  /* ========== 福利中心（每日签到 + 积分任务） ========== */

  /**
   * AMS 角色列表（活动576370 iFlowId=1143943）
   * 返回该账号全部游戏角色：[{ Partition, Gid(roleId), CharacName(URL编码), Level, LastLoginTime, ... }]
   * 首次调用会把角色同步进活动系统，之后 ULINK 的 CharacterInfo 才能按 partition 查到数据
   */
  async getRoleList (bind) {
    try {
      const body = 'iActivityId=576370&iFlowId=1143943&sOpenid=&openId=&sArea=2&g_tk=1842395457'
      const r = await amsPost(body, Store.buildCookie(bind))
      return r?.modRet?.jData?.recentRoleList || []
    } catch {
      return []
    }
  },

  /**
   * 同步角色：拉取角色列表并默认选中等级最高的角色写入绑定文件
   * @returns 同步到的角色对象；无角色/失败返回 null
   */
  async syncUserRole (userId) {
    const bind = Store.get(userId)
    if (!bind) return null
    const roles = await Api.getRoleList(bind)
    if (!roles.length) return null
    const pick = [...roles].sort((a, b) =>
      (Number(b.Level) || 0) - (Number(a.Level) || 0) ||
      (Number(b.LastLoginTime) || 0) - (Number(a.LastLoginTime) || 0)
    )[0]
    const roleName = decodeURIComponent(pick.CharacName || '')
    Store.setRole(userId, { partition: pick.Partition, roleId: pick.Gid, roleName, roleLevel: pick.Level })
    global.logger?.mark?.(`[火影插件]用户${userId}角色已同步: ${roleName}（${pick.Partition}区 ${pick.Level}级）`)
    return { partition: pick.Partition, roleId: pick.Gid, roleName, roleLevel: pick.Level }
  },

  /** 查询今日任务状态（getTodayActInfo 仅查询，不触发签到；签到需走 amsSign） */
  async getTodayActInfo (userId) {
    const bind = Store.get(userId)
    if (!bind) return { error: '未绑定，请先发送 #火影登录 扫码绑定' }
    const body = `area=2&platId=1&partition=${bind.partition || 2175}&roleId=${bind.roleId || 1}&iActId=8265&sAppId=ULINK-AKKJ-784060&g_tk=0`
    const res = await post('Welfare/getTodayActInfo', body, Store.buildCookie(bind))
    if (res.iRet !== 0) return { error: loginStateHint(`任务查询失败: ${res.sMsg || res.iRet}`) }
    return res.jData
  },

  /** 任务完成上报（guestInfo 等"查看类"任务靠这个直接上报） */
  async taskDone (userId, index) {
    const bind = Store.get(userId)
    if (!bind) return { error: '未绑定' }
    const body = `index=${index}&iActId=8265&sAppId=ULINK-AKKJ-784060&g_tk=0`
    return await post('Index/taskDone', body, Store.buildCookie(bind))
  },

  /** 领取任务奖励（返回 jData=获得积分数）；必须带角色参数，否则报 1285 未查询到角色信息 */
  async taskLotteryNow (userId, index) {
    const bind = Store.get(userId)
    if (!bind) return { error: '未绑定' }
    const body = `index=${index}&area=2&platId=1&partition=${bind.partition || 2175}&roleId=${bind.roleId || 1}&iActId=8265&sAppId=ULINK-AKKJ-784060&g_tk=0`
    return await post('Index/taskLotteryNow', body, Store.buildCookie(bind))
  },

  /** 浏览帖子（readArticle 任务） */
  async articleDetail (userId, contentId) {
    const bind = Store.get(userId)
    if (!bind) return { error: '未绑定' }
    const body = `contentId=${contentId}&qOrderBy=order&iActId=8265&sAppId=ULINK-AKKJ-784060&g_tk=0`
    return await post('Ugc/articleDetail', body, Store.buildCookie(bind))
  },

  /** 点赞（like 任务，op=1 点赞） */
  async doLike (userId, contentId) {
    const bind = Store.get(userId)
    if (!bind) return { error: '未绑定' }
    const body = `contentId=${contentId}&op=1&contentType=ugc_article&iActId=8265&sAppId=ULINK-AKKJ-784060&g_tk=0`
    return await post('User/doLike', body, Store.buildCookie(bind))
  },

  /** 村口动态列表（dynamicArticle 任务 + 提供点赞用的 contentId） */
  async dynamicArticle (userId, page = 1) {
    const bind = Store.get(userId)
    if (!bind) return { error: '未绑定' }
    const body = `page=${page}&pageSize=10&iActId=8265&sAppId=ULINK-AKKJ-784060&g_tk=0`
    const r = await post('Ugc/dynamicArticle', body, Store.buildCookie(bind))
    if (r.iRet !== 0) return { error: `村口查询失败: ${r.sMsg || r.iRet}` }
    return r.jData
  },

  /* ========== AMS 福利中心签到（x8m8.ams.game.qq.com） ========== */

  /**
   * 执行每日签到（AMS 活动576370）
   * iFlowId=1083547: 签到
   * iFlowId=1083576: 查询签到奖励
   * @returns {{iRet:number, sMsg:string, gifts?:Array}} iRet=0 表示签到成功
   */
  async amsSign (userId) {
    const bind = Store.get(userId)
    if (!bind) return { iRet: -1, sMsg: '未绑定' }
    const r = await amsPost(1083547, Store.buildCookie(bind))
    if (r?.flowRet?.iRet !== '0') return { iRet: -1, sMsg: r?.flowRet?.sMsg || '签到失败' }
    const modRet = r?.modRet?.jData
    return { iRet: 0, sMsg: '签到成功', gifts: modRet?.gift_list?.sPackageName || '' }
  },

  /**
   * 场景上报（UserSub/todaySceneReported）
   * 签到/任务完成后调用，上报用户活跃场景
   */
  async todaySceneReported (userId) {
    const bind = Store.get(userId)
    if (!bind) return { iRet: -1, sMsg: '未绑定' }
    const body = 'templateIds=OX8Wfsi-BFHscHy0NoWVl1Vkf08Pia4Wn97F3-KiXRw%3A1&scene=fl_auto&type=1&iActId=8265&sAppId=ULINK-AKKJ-784060&g_tk=0'
    return await post('UserSub/todaySceneReported', body, Store.buildCookie(bind))
  }
}

export default Api
