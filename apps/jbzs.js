import Api from '../model/api.js'
import Store from '../model/store.js'

export class HyrzJbzs extends plugin {
  constructor () {
    super({
      name: '火影忍者:金币助手',
      dsc: '查询钱包余额、金币产出进度与流水明细',
      event: 'message',
      priority: 100,
      rule: [
        { reg: '^#?火影(金币|钱包|流水)$', fnc: 'jbzs', permission: 'all' },
        { reg: '^#?火影(金币|钱包|流水)助手$', fnc: 'jbzs', permission: 'all' }
      ]
    })
  }

  async jbzs () {
    const e = this.e
    if (!e.runtime) {
      await this.reply('❌ 未找到 runtime，请升级至最新版 Yunzai', true)
      return false
    }

    const t = Store.resolveTarget(e)
    if (t.notBound) {
      await this.reply('❌ @ 的目标还没有绑定，请让 TA 发送 #火影登录', true)
      return false
    }

    const data = await Api.getJbzsData(t.userId)
    if (data.error) {
      await this.reply(`❌ ${data.error}`, true)
      return false
    }

    const tplData = {
      ...data,
      queryName: t.isAt ? Store.get(t.userId)?.roleName : '',
      updateTime: new Date().toLocaleString('zh-CN'),
      quality: 90,
      saveId: e.user_id
    }

    try {
      await e.runtime.render('hyrz-plugin', 'jbzs/index', tplData)
    } catch (err) {
      logger.error(`[火影插件]渲染失败: ${err.message}`)
      await this.reply('❌ 图片渲染失败，使用文字模式输出：', true)
      await this.reply(this.textJbzs(data), true)
    }
    return false
  }

  textJbzs (d) {
    const fmt = n => (n >= 1e8 ? (n / 1e8).toFixed(2) + '亿' : n >= 1e4 ? (n / 1e4).toFixed(1) + '万' : String(n))
    const lines = [
      '【火影忍者·金币助手】',
      `钱包: 铜币 ${fmt(d.wallet.copper)} | 金币 ${fmt(d.wallet.coin)} | 点券 ${fmt(d.wallet.ticket)}`,
      d.week.range ? `本周(${d.week.range})已获金币: ${d.weekTotalJb}` : `本周已获金币: ${d.weekTotalJb}`
    ]
    d.week.tasks.forEach(t => lines.push(` ${t.title}: ${t.takeNum}次 ${t.takeJb}金币${t.sub ? ' (' + t.sub + ')' : ''}`))
    if (d.months.length) {
      lines.push('月度统计:')
      d.months.forEach(m => lines.push(` ${m.month}: 固定${m.fixed} + 额外${m.extra} = ${m.total}`))
    }
    if (d.details.length) {
      lines.push('金币流水(最近):')
      d.details.slice(0, 8).forEach(x => lines.push(` ${x.date} ${x.desc} ${x.value > 0 ? '+' : ''}${x.value} (余${fmt(x.after)})`))
    }
    return lines.join('\n')
  }
}
