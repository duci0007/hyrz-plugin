import Store from '../model/store.js'

export class HyrzBind extends plugin {
  constructor () {
    super({
      name: '火影忍者:绑定',
      dsc: '绑定/解绑火影忍者手游小程序 cookie',
      event: 'message',
      priority: 100,
      rule: [
        {
          reg: '^#?火影绑定([\\s\\S]*)$|^#?火影登录\\s+\\S',
          fnc: 'bind',
          permission: 'all'
        },
        {
          reg: '^#?火影(解绑|登出)$',
          fnc: 'unbind',
          permission: 'all'
        },
        {
          reg: '^#?火影(绑定信息|信息)$',
          fnc: 'info',
          permission: 'all'
        }
      ]
    })
  }

  async bind () {
    const e = this.e
    const userId = e.user_id
    if (!userId) {
      await this.reply('❌ 无法获取用户身份')
      return false
    }
    const content = (this.e.msg || '').replace(/^#?火影(绑定|登录)/, '').trim()
    if (!content) {
      await this.reply(
        '【火影绑定】\n' +
        '方式一（推荐）：发送 #火影登录，长按识别机器人发的二维码\n' +
        '手机 QQ 授权确认后自动抓取绑定，无需抓包\n' +
        '\n方式二：手动粘贴抓包的 cookie 内容，例如：\n' +
        '#火影绑定 openid=XXXX; acctype=qc; appid=1104307008; access_token=XXXX\n' +
        '\n获取方法（二选一）：\n' +
        '【手机抓包】HttpCanary/Reqable 抓微信小程序「火影忍者」，找 ulinkact.game.qq.com 请求复制 cookie\n' +
        '【电脑抓包（推荐）】PC 微信打开火影小程序 + Reqable/Fiddler 抓包，过滤 ulinkact.game.qq.com 复制 cookie，无需手机装证书\n' +
        '\n⚠️ 绑定操作请私聊机器人发送，避免泄露',
        true
      )
      return false
    }

    const { openid, token } = Store.parseCookie(content)
    if (!token) {
      await this.reply('❌ 未从消息中识别到 access_token，请发送完整的 cookie 内容（抓包请求里的 cookie 字段）', true)
      return false
    }
    if (!openid) {
      await this.reply('⚠️ 未识别到 openid，已按仅 access_token 绑定；如查询失败请补发完整 cookie', true)
    }

    Store.set(userId, openid || '', token)
    await this.reply(
      `✅ 绑定成功！\nopenid: ${openid || '未提供'}\n使用 #火影战绩 查询`,
      true
    )
    return false
  }

  async unbind () {
    const userId = this.e.user_id
    if (!Store.get(userId)) {
      await this.reply('当前未绑定', true)
      return false
    }
    Store.del(userId)
    await this.reply('✅ 已解绑', true)
    return false
  }

  async info () {
    const bind = Store.get(this.e.user_id)
    if (!bind) {
      await this.reply('当前未绑定，使用 #火影绑定 + cookie 绑定', true)
      return false
    }
    await this.reply(
      `openid: ${bind.openid || '未提供'}\n绑定时间: ${bind.bindTime}`,
      true
    )
    return false
  }
}
