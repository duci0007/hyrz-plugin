import Api from '../model/api.js'
import Ninja from '../model/ninja.js'

/** 多候选待选择状态（user_id → {list, time}），10分钟过期 */
const pendingSelect = new Map()
const PENDING_TTL = 10 * 60 * 1000

function cleanPending () {
  const now = Date.now()
  for (const [k, v] of pendingSelect) {
    if (now - v.time > PENDING_TTL) pendingSelect.delete(k)
  }
}

export class HyrzNinja extends plugin {
  constructor () {
    super({
      name: '火影忍者:忍者查询',
      dsc: '查询忍者技能图鉴与个人使用数据',
      event: 'message',
      priority: 100,
      rule: [
        { reg: '^#?(火影忍者|忍者)(\\s*.*|\\s*.+)$', fnc: 'ninja', permission: 'all' },
        { reg: '^#?([\\u4e00-\\u9fa5A-Za-z0-9·]{1,12})(技能|图鉴)$', fnc: 'ninjaBySuffix', permission: 'all' }
      ]
    })
  }

  /** 后缀写法：#宇智波斑秽土转生技能 / #虎皮图鉴 */
  async ninjaBySuffix () {
    const e = this.e
    const name = (e.msg || '').replace(/^#?/, '').replace(/(技能|图鉴)$/, '').trim()
    if (!name) return false
    this.e.msg = `忍者 ${name}`
    return this.ninja()
  }

  async ninja () {
    const e = this.e
    // 提取关键词（去掉命令头，兼容尾部"技能/图鉴"后缀写法）
    let kw = (e.msg || '')
      .replace(/^#?(火影忍者|忍者)/, '')
      .replace(/(技能|图鉴)$/, '')
      .trim()

    cleanPending()

    // 优先级判断：纯数字 → 可能是候选序号
    if (/^\d+$/.test(kw)) {
      const p = pendingSelect.get(String(e.user_id))
      if (p) {
        const idx = Number(kw) - 1
        if (idx >= 0 && idx < p.list.length) {
          pendingSelect.delete(String(e.user_id))
          return this.renderNinja(p.list[idx].id)
        }
      }
      // 序号无效且无 pending，提示用法
      await this.reply('❓ 请输入忍者名称，如：#火影忍者 纲手', true)
      return false
    }

    if (!kw) {
      await this.reply(
        '【火影忍者·忍者查询】\n' +
        `收录 ${Ninja.size} 个忍者\n` +
        '用法：#火影忍者 <名称> 或 #<名称>技能 / #<名称>图鉴\n' +
        '示例：#火影忍者 纲手、#宇智波斑秽土转生技能、#虎皮图鉴（支持俗称）\n' +
        '重名时回复序号选择版本',
        true
      )
      return false
    }

    const list = Ninja.search(kw)
    if (!list.length) {
      await this.reply(`❌ 未找到"${kw}"，请检查名称（收录 ${Ninja.size} 个忍者，支持俗称）`, true)
      return false
    }

    if (list.length === 1) {
      return this.renderNinja(list[0].id)
    }

    // 多候选：记录待选状态
    pendingSelect.set(String(e.user_id), { list, time: Date.now() })
    const lines = [`找到 ${list.length} 个"${kw}"，请回复序号选择：`]
    list.forEach((n, i) => lines.push(`${i + 1}. ${n.name}`))
    lines.push('（10分钟内有效，也可直接发送完整名称）')
    await this.reply(lines.join('\n'), true)
    return false
  }

  async renderNinja (id) {
    const e = this.e
    if (!e.runtime) {
      await this.reply('❌ 未找到 runtime，请升级至最新版 Yunzai', true)
      return false
    }

    const data = await Api.getNinjaDetail(e.user_id, id)
    if (data.error) {
      await this.reply(`❌ ${data.error}`, true)
      return false
    }

    const tplData = {
      ...data,
      updateTime: new Date().toLocaleString('zh-CN'),
      quality: 90,
      saveId: e.user_id
    }

    try {
      await e.runtime.render('hyrz-plugin', 'ninja/index', tplData)
    } catch (err) {
      logger.error(`[火影插件]忍者详情渲染失败: ${err.message}`)
      await this.reply('❌ 图片渲染失败，使用文字模式输出：', true)
      await this.reply(this.textNinja(data), true)
    }
    return false
  }

  textNinja (d) {
    const lines = [
      `【${d.name}】${d.star}级 ${d.gender}`,
      d.tags.length ? `定位: ${d.tags.join('/')}` : '',
      d.highlight ? `攻略: ${d.highlight}` : '',
      '',
      `【技能】`
    ]
    const sec = (title, arr) => {
      if (!arr?.length) return
      lines.push(`◆ ${title}`)
      arr.forEach(s => lines.push(`${s.state ? `[${s.state}]` : ''}${s.name}: ${s.brief || s.desc.slice(0, 60)}`))
    }
    sec('普攻', d.skills.normal)
    sec('一技能', d.skills.skill1)
    sec('二技能', d.skills.skill2)
    sec('奥义', d.skills.ultimate)
    sec('特殊', d.skills.special)
    if (d.mine) {
      lines.push('', `【我的数据】${d.mine.possess ? '已拥有' : '未拥有'}`)
      if (d.mine.possess) {
        lines.push(`熟练度: ${d.mine.proficient} | 胜率: ${d.mine.winRate}%(${d.mine.winCnt}/${d.mine.fightCnt})`)
        lines.push(`获得时间: ${d.mine.getTime}`)
      }
    }
    return lines.filter(Boolean).join('\n')
  }
}
