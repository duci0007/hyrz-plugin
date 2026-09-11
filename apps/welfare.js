import Welfare from '../model/welfare.js'
import Store from '../model/store.js'
import Config from '../model/config.js'
import cfg from '../../../lib/config/config.js'

/**
 * 每日福利：签到 + 积分任务自动完成
 * 命令：
 *   #火影签到          立即执行全部任务（浏览/点赞/领奖）
 *   #火影任务          查看今日任务状态（不执行）
 *   #火影签到推送开启    开启定时推送（每天自动完成并私发结果）
 *   #火影签到推送关闭    关闭定时推送
 * 定时：
 *   - welfareTime（默认每天 08:30）：对开启推送的用户自动执行并私聊推送
 *   - autoSignTime（默认每天 05:00）：每日自动签到，范围由 autoSign 配置
 *     （off=关闭 self=仅机器人主人 all=所有已绑定用户），结果私发
 */
export class HyrzWelfare extends plugin {
  constructor () {
    super({
      name: '火影忍者:每日福利',
      dsc: '每日签到与积分任务自动完成',
      event: 'message',
      priority: 100,
      rule: [
        { reg: '^#?火影签到$', fnc: 'sign', permission: 'all' },
        { reg: '^#?火影任务$', fnc: 'query', permission: 'all' },
        { reg: '^#?火影(签到推送|福利推送)(开启|打开|启用)$', fnc: 'pushOn', permission: 'all' },
        { reg: '^#?火影(签到推送|福利推送)(关闭|停止|禁用)$', fnc: 'pushOff', permission: 'all' }
      ]
    })
    this.task = [
      {
        cron: Config.load().welfareTime,
        name: '[hyrz-plugin] 每日福利任务',
        fnc: () => this.dailyTask()
      },
      {
        cron: Config.load().autoSignTime,
        name: '[hyrz-plugin] 每日自动签到',
        fnc: () => this.autoSignTask()
      }
    ]
  }

  /** 手动执行 */
  async sign () {
    const e = this.e
    if (!Store.get(e.user_id)) {
      await this.reply('❌ 未绑定，请先发送 #火影登录 扫码绑定', true)
      return false
    }
    await this.reply('⏳ 正在完成每日任务（浏览/点赞/领奖），请稍候...', true)
    const r = await Welfare.runDaily(e.user_id)
    if (r.error) {
      await this.reply(`❌ ${r.error}`, true)
      return false
    }
    await this.render(e, r, 'run')
    return false
  }

  /** 查询任务状态 */
  async query () {
    const e = this.e
    if (!Store.get(e.user_id)) {
      await this.reply('❌ 未绑定，请先发送 #火影登录 扫码绑定', true)
      return false
    }
    const r = await Welfare.queryDaily(e.user_id)
    if (r.error) {
      await this.reply(`❌ ${r.error}`, true)
      return false
    }
    await this.render(e, r, 'query')
    return false
  }

  /** 开启定时推送 */
  async pushOn () {
    if (!Store.get(this.e.user_id)) {
      await this.reply('❌ 未绑定，请先发送 #火影登录 扫码绑定', true)
      return false
    }
    Store.setWelfarePush(this.e.user_id, true)
    await this.reply(`✅ 每日福利推送已开启（每天 ${this.taskCronDesc()} 自动完成并私发结果）`, true)
    return false
  }

  /** 关闭定时推送 */
  async pushOff () {
    Store.setWelfarePush(this.e.user_id, false)
    await this.reply('✅ 每日福利推送已关闭', true)
    return false
  }

  /** 定时任务：遍历开启推送的用户执行并私发结果 */
  async dailyTask () {
    const users = Store.listWelfarePush()
    if (!users.length) return
    logger.mark(`[火影插件]每日福利定时任务：${users.length} 个用户`)
    for (const qq of users) {
      try {
        const r = await Welfare.runDaily(qq)
        if (r.error) {
          logger.error(`[火影插件]每日福利(${qq})失败: ${r.error}`)
          continue
        }
        await this.pushUser(qq, r)
      } catch (err) {
        logger.error(`[火影插件]每日福利(${qq})异常: ${err.message}`)
      }
      await new Promise(res => setTimeout(res, 3000))
    }
  }

  /**
   * 每日自动签到（config.yaml）
   * autoSignTime: cron 时间，默认每天 05:00
   * autoSign: off=关闭 / self=仅机器人主人 / all=所有已绑定用户
   */
  async autoSignTask () {
    const conf = Config.load()
    const scope = String(conf.autoSign || 'off').toLowerCase()
    if (scope === 'off') return

    let users = []
    if (scope === 'all') {
      users = Store.listAll()
    } else if (scope === 'self') {
      // 机器人主人（config/other.yaml 的 masterQQ）
      const masters = cfg.masterQQ || []
      users = (Array.isArray(masters) ? masters : [masters]).map(String)
    }
    users = [...new Set(users)].filter(qq => Store.get(qq))
    if (!users.length) {
      logger.mark('[火影插件]每日自动签到：范围内无可执行用户，跳过')
      return
    }
    logger.mark(`[火影插件]每日自动签到(${scope})：${users.length} 个用户 [${users.join(', ')}]`)

    let okCnt = 0
    for (const qq of users) {
      try {
        const r = await Welfare.runDaily(qq)
        if (r.error) {
          logger.error(`[火影插件]自动签到(${qq})失败: ${r.error}`)
          continue
        }
        okCnt++
        await this.pushUser(qq, r)
      } catch (err) {
        logger.error(`[火影插件]自动签到(${qq})异常: ${err.message}`)
      }
      await new Promise(res => setTimeout(res, 3000))
    }
    logger.mark(`[火影插件]每日自动签到完成：${okCnt}/${users.length} 成功`)
  }

  /** 定时任务推送给指定用户（渲染后私发） */
  async pushUser (qq, r) {
    try {
      const friend = Bot.pickFriend(qq)
      if (!friend) return
      const img = await this.renderImage(qq, r, 'run')
      // screenshot 返回 segment.image(...)，可直接发送
      await friend.sendMsg(img || Welfare.formatResult(r))
    } catch (err) {
      logger.error(`[火影插件]福利推送(${qq})发送失败: ${err.message}`)
    }
  }

  /** 渲染（命令回复用） */
  async render (e, r, mode) {
    const tplData = this.buildTplData(r, mode, e.user_id)
    if (!e.runtime) {
      await this.reply(Welfare.formatResult(r), true)
      return
    }
    try {
      await e.runtime.render('hyrz-plugin', 'welfare/index', tplData)
    } catch (err) {
      logger.error(`[火影插件]福利页渲染失败: ${err.message}`)
      await this.reply(Welfare.formatResult(r), true)
    }
  }

  /** 渲染成图片 segment（定时推送用，失败返回 null） */
  async renderImage (userId, r, mode) {
    try {
      const puppeteer = (await import('../../../lib/puppeteer/puppeteer.js')).default
      const _path = process.cwd().replace(/\\/g, '/')
      const tplData = this.buildTplData(r, mode, userId)
      const img = await puppeteer.screenshot('hyrz-plugin/welfare', {
        ...tplData,
        tplFile: './plugins/hyrz-plugin/resources/welfare/index.html',
        _res_path: `${_path}/plugins/hyrz-plugin/resources`
      })
      return img || null
    } catch (err) {
      logger.error(`[火影插件]福利页截图失败: ${err.message}`)
      return null
    }
  }

  /** 组装模板数据 */
  buildTplData (r, mode, userId) {
    const doneCnt = (r.tasks || []).filter(t => t.status === 'done' || t.claimed).length
    const skipCnt = (r.tasks || []).filter(t => t.status === 'skip' || (!t.auto && !t.done)).length
    return {
      ...r,
      mode,
      doneCnt,
      skipCnt,
      updateTime: new Date().toLocaleString('zh-CN'),
      quality: 90,
      saveId: userId
    }
  }

  /** cron 可读描述（用于推送开启回复） */
  taskCronDesc () {
    const cron = Config.load().welfareTime
    const parts = cron.split(/\s+/)
    // 6 段（含秒）: sec min hour day month week
    if (parts.length >= 3 && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2])) {
      return `${parts[2].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
    }
    return cron
  }
}
