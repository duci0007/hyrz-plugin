export class HyrzHelp extends plugin {
  constructor () {
    super({
      name: '火影忍者:帮助',
      dsc: '火影忍者插件帮助',
      event: 'message',
      priority: 50,
      rule: [
        { reg: '^#?火影(帮助|菜单|help|说明)$', fnc: 'help', permission: 'all' }
      ]
    })
  }

  /** 命令分组（封印之书 · 命令卷轴） */
  static HELP_GROUPS = [
    {
      num: '壹',
      name: '登录绑定',
      items: [
        { icon: '📱', cmd: '#火影登录', desc: 'QQ 扫码登录，自动抓取 cookie 绑定', tag: '推荐', tagClass: 'rec' },
        { icon: '📋', cmd: '#火影绑定 + cookie', desc: '手动绑定小程序 cookie', tag: '私聊', tagClass: 'pvt' }
      ]
    },
    {
      num: '贰',
      name: '个人数据',
      items: [
        { icon: '👤', cmd: '#火影面板', desc: '个人面板：战力 / 六维 / 赛季 / 常用忍者 / 组织 / 资产' },
        { icon: '⚔️', cmd: '#火影战绩', desc: '最近战绩：近期概览 / 最近比赛列表' },
        { icon: '💰', cmd: '#火影金币', desc: '金币助手：钱包余额 / 本周产出 / 月度统计 / 流水明细' }
      ]
    },
    {
      num: '叁',
      name: '图鉴资讯',
      items: [
        { icon: '🗡️', cmd: '#火影忍者 + 名称', desc: '忍者图鉴：技能 / 推荐携带 / 个人数据，支持俗称' },
        { icon: '📅', cmd: '#火影活动', desc: '活动日历：甘特图时间轴，快结束的红色高亮' },
        { icon: '🖼️', cmd: '#火影壁纸 [序号]', desc: '官方高清壁纸，默认最新；#火影壁纸列表 查看全部' },
        { icon: '📰', cmd: '#火影资讯', desc: '最新资讯：新忍爆料 / 公告 / 赛事动态' }
      ]
    },
    {
      num: '肆',
      name: '账号管理',
      items: [
        { icon: '✂️', cmd: '#火影解绑', desc: '解绑当前 cookie' },
        { icon: '📖', cmd: '#火影帮助', desc: '显示本帮助' }
      ]
    }
  ]

  async help () {
    const e = this.e
    const groups = HyrzHelp.HELP_GROUPS
    const totalCmd = groups.reduce((n, g) => n + g.items.length, 0)

    if (e.runtime) {
      try {
        await e.runtime.render('hyrz-plugin', 'help/index', {
          groups,
          totalCmd,
          updateTime: new Date().toLocaleString('zh-CN'),
          quality: 90,
          saveId: e.user_id
        })
        return false
      } catch (err) {
        logger.error(`[火影插件]帮助图渲染失败: ${err.message}`)
      }
    }

    // 文字兜底
    let msg = '【火影忍者插件】\n'
    for (const g of groups) {
      msg += `\n◇ ${g.name}\n`
      for (const it of g.items) msg += `  ${it.cmd} — ${it.desc}\n`
    }
    await this.reply(msg, true)
    return false
  }
}
