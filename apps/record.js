import Api from '../model/api.js'
import Store from '../model/store.js'

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

  /** 个人面板：角色信息/六维/赛季/常用忍者/组织/资产；支持 @某人 查其面板 */
  async panel () {
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

    const data = await Api.getCharacterInfo(t.userId)
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
      await e.runtime.render('hyrz-plugin', 'record/index', tplData)
    } catch (err) {
      logger.error(`[火影插件]渲染失败: ${err.message}`)
      await this.reply('❌ 图片渲染失败，使用文字模式输出：', true)
      await this.reply(this.textPanel(data), true)
    }
    return false
  }

  /** 最近战绩：模式分组概览（排位赛 / 忍术对决）+ 最近比赛列表；支持 @某人；#火影战绩 <赛季> 查历史赛季排位 */
  async record () {
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

    const data = await Api.getCharacterInfo(t.userId)
    if (data.error) {
      await this.reply(`❌ ${data.error}`, true)
      return false
    }

    // #火影战绩 <赛季名/序号> → 查询历史赛季排位赛记录
    const arg = (e.msg || '').replace(/^#?火影(战绩|对局|比赛)/, '').trim()
    let seasonRecord = null
    if (arg && data.seasonList?.length) {
      const s = data.seasonList.find(x => x.name.includes(arg)) ||
        data.seasonList[Number(arg) - 1]
      if (!s) {
        const names = data.seasonList.map((x, i) => `${i + 1}.${x.name}`).join(' ')
        await this.reply(`❌ 未找到赛季「${arg}」\n可选：${names}`, true)
        return false
      }
      const r = await Api.getSeasonRecord(t.userId, s.matchId)
      if (r.error) {
        await this.reply(`❌ ${r.error}`, true)
        return false
      }
      seasonRecord = { ...r.record, name: s.name }
    }

    const tplData = {
      ...data,
      seasonRecord,
      queryName: t.isAt ? Store.get(t.userId)?.roleName : '',
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
    if (d.modes?.length) {
      lines.push('─ 模式统计 ─')
      d.modes.forEach(m => lines.push(` ${m.name}: ${m.total}场 胜${m.wins} (胜率${m.winRate}%)`))
    }
    if (d.rankMatches) {
      lines.push(`─ ${d.rankMatches.season || '本赛季'}排位 ─`)
      lines.push(` ${d.rankMatches.total}场 胜${d.rankMatches.win} 负${d.rankMatches.fail} 平${d.rankMatches.tie} (胜率${d.rankMatches.winRate}%) 最高分${d.rankMatches.highest}`)
    }
    d.matches.forEach(m => {
      const names = m.ninjas.map(n => n.name.replace(/\n/g, '')).filter(Boolean).join('/')
      lines.push(` ${m.result} ${m.type} ${names} ${m.time}`)
    })
    return lines.join('\n')
  }
}
