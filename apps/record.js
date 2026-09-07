import Api from '../model/api.js'

export class HyrzRecord extends plugin {
  constructor () {
    super({
      name: '火影忍者:战绩',
      dsc: '查询火影忍者手游个人面板与最近战绩',
      event: 'message',
      priority: 100,
      rule: [
        { reg: '^#?火影(面板|查询|信息)(.*)$', fnc: 'panel', permission: 'all' },
        { reg: '^#?火影忍者(面板|查询|信息)(.*)$', fnc: 'panel', permission: 'all' },
        { reg: '^#?火影(战绩|对局|比赛)(.*)$', fnc: 'record', permission: 'all' },
        { reg: '^#?火影忍者(战绩|对局|比赛)(.*)$', fnc: 'record', permission: 'all' }
      ]
    })
  }

  /** 个人面板：角色信息/六维/赛季/常用忍者/组织/资产 */
  async panel () {
    const e = this.e
    if (!e.runtime) {
      await this.reply('❌ 未找到 runtime，请升级至最新版 Yunzai', true)
      return false
    }

    const data = await Api.getCharacterInfo(e.user_id)
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
      await e.runtime.render('hyrz-plugin', 'record/index', tplData)
    } catch (err) {
      logger.error(`[火影插件]渲染失败: ${err.message}`)
      await this.reply('❌ 图片渲染失败，使用文字模式输出：', true)
      await this.reply(this.textPanel(data), true)
    }
    return false
  }

  /** 最近战绩：近期概览 + 最近比赛列表 */
  async record () {
    const e = this.e
    if (!e.runtime) {
      await this.reply('❌ 未找到 runtime，请升级至最新版 Yunzai', true)
      return false
    }

    const data = await Api.getCharacterInfo(e.user_id)
    if (data.error) {
      await this.reply(`❌ ${data.error}`, true)
      return false
    }

    const tplData = {
      ...data,
      recentLose: data.recentTotal - data.recentWins,
      updateTime: new Date().toLocaleString('zh-CN'),
      quality: 90,
      saveId: e.user_id
    }

    try {
      await e.runtime.render('hyrz-plugin', 'record/matches', tplData)
    } catch (err) {
      logger.error(`[火影插件]渲染失败: ${err.message}`)
      await this.reply('❌ 图片渲染失败，使用文字模式输出：', true)
      await this.reply(this.textRecord(data), true)
    }
    return false
  }

  textPanel (d) {
    const i = d.info
    const lines = [
      `【火影忍者·个人面板】`,
      `战力: ${i.fight} | 等级: ${i.level} | ${i.vip}`,
      `历史最高: ${i.historyHighest} | 总胜场: ${i.pvpTotalWin} | 最高连胜: ${i.pvpTopContinueWin}`,
      `常用忍者:`,
      ...d.myNinja.map(n => ` ${n.name} ${n.winRate}%(${n.winCnt}/${n.fightCnt})`),
      `展示忍者: ${i.showNinja ? i.showNinja.name : '未设置'}`
    ]
    if (d.group) lines.push(`组织: ${d.group.name}（战力${d.group.fc}）`)
    return lines.join('\n')
  }

  textRecord (d) {
    const lines = [
      `【火影忍者·最近战绩】`,
      `最近${d.recentTotal}场: 胜${d.recentWins} (胜率${d.recentWinRate}%)`
    ]
    d.matches.forEach(m => {
      const names = m.ninjas.map(n => n.name.replace(/\n/g, '')).filter(Boolean).join('/')
      lines.push(` ${m.result} ${m.type} ${names} ${m.time}`)
    })
    return lines.join('\n')
  }
}
