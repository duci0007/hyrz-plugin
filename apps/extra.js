import Api from '../model/api.js'

export class HyrzExtra extends plugin {
  constructor () {
    super({
      name: '火影忍者:活动资讯',
      dsc: '查询进行中活动、官方壁纸与最新资讯',
      event: 'message',
      priority: 100,
      rule: [
        { reg: '^#?火影活动$', fnc: 'act', permission: 'all' },
        { reg: '^#?火影壁纸列表$', fnc: 'wallpaperList', permission: 'all' },
        { reg: '^#?火影壁纸\\s*(\\d*)$', fnc: 'wallpaper', permission: 'all' },
        { reg: '^#?火影资讯$', fnc: 'news', permission: 'all' }
      ]
    })
  }

  /** #火影活动 — 进行中活动日历 */
  async act () {
    const e = this.e
    if (!e.runtime) {
      await this.reply('❌ 未找到 runtime，请升级至最新版 Yunzai', true)
      return false
    }

    const data = await Api.getActList(e.user_id)
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
      await e.runtime.render('hyrz-plugin', 'act/index', tplData)
    } catch (err) {
      logger.error(`[火影插件]渲染失败: ${err.message}`)
      await this.reply('❌ 图片渲染失败，使用文字模式输出：', true)
      await this.reply(this.textAct(data), true)
    }
    return false
  }

  /** #火影壁纸 — 直接发送官方高清壁纸（默认最新一张，可指定序号） */
  async wallpaper () {
    const e = this.e
    const num = Number((e.msg || '').match(/^#?火影壁纸\s*(\d*)$/)?.[1] || 0)

    const data = await Api.getWallpaperList(e.user_id, 1)
    if (data.error) {
      await this.reply(`❌ ${data.error}`, true)
      return false
    }
    if (!data.list.length) {
      await this.reply('❌ 暂无壁纸数据', true)
      return false
    }

    // 无序号 → 发最新一张；有序号 → 发第 n 张（1 起）
    const idx = num > 0 ? num - 1 : 0
    if (idx >= data.list.length) {
      await this.reply(`❌ 序号超出范围（当前共 ${data.list.length} 张），发送 #火影壁纸列表 查看全部`, true)
      return false
    }

    const w = data.list[idx]
    await this.reply(`「${w.title}」${w.desc ? ' · ' + w.desc : ''}（${idx + 1}/${data.list.length}，发送 #火影壁纸2~${data.list.length} 换一张）`, true)
    await this.reply(segment.image(w.img))
    return false
  }

  /** #火影壁纸列表 — 壁纸预览网格 */
  async wallpaperList () {
    const e = this.e
    if (!e.runtime) {
      await this.reply('❌ 未找到 runtime，请升级至最新版 Yunzai', true)
      return false
    }

    const data = await Api.getWallpaperList(e.user_id, 1)
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
      await e.runtime.render('hyrz-plugin', 'act/wallpaper', tplData)
    } catch (err) {
      logger.error(`[火影插件]渲染失败: ${err.message}`)
      await this.reply('❌ 图片渲染失败，使用文字模式输出：', true)
      const lines = ['【火影忍者·官方壁纸】']
      data.list.forEach((w, i) => lines.push(`${i + 1}. ${w.title} ${w.desc ? '(' + w.desc + ')' : ''} [${w.tag}]`))
      await this.reply(lines.join('\n'), true)
    }
    return false
  }

  /** #火影资讯 — 最新推荐资讯列表 */
  async news () {
    const e = this.e
    if (!e.runtime) {
      await this.reply('❌ 未找到 runtime，请升级至最新版 Yunzai', true)
      return false
    }

    const data = await Api.getArticleList(e.user_id, 1)
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
      await e.runtime.render('hyrz-plugin', 'act/news', tplData)
    } catch (err) {
      logger.error(`[火影插件]渲染失败: ${err.message}`)
      await this.reply('❌ 图片渲染失败，使用文字模式输出：', true)
      await this.reply(this.textNews(data), true)
    }
    return false
  }

  textAct (d) {
    const lines = ['【火影忍者·进行中活动】']
    d.list.forEach(a => {
      const left = a.notStarted ? '未开始' : a.leftDays >= 0 ? `剩${a.leftDays}天` : '已结束'
      lines.push(`${a.name}（${a.start} ~ ${a.end}，${left}）`)
      if (a.desc) lines.push(`  ${a.desc}`)
    })
    return lines.join('\n')
  }

  textNews (d) {
    const fmt = n => (n >= 1e4 ? (n / 1e4).toFixed(1) + '万' : String(n))
    const lines = ['【火影忍者·最新资讯】']
    d.list.forEach(a => {
      lines.push(`【${a.category}】${a.title}`)
      lines.push(`  ${a.author} · ${a.time} · 👍${fmt(a.likes)} 💬${fmt(a.comments)}`)
    })
    return lines.join('\n')
  }
}
