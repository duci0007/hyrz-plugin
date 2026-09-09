import Store from '../model/store.js'
import Api from '../model/api.js'

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
        },
        {
          reg: '^#?火影区服(\\s*\\d+)?$',
          fnc: 'role',
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
    const role = bind.partition ? `\n角色: ${bind.roleName || '未知'}（${bind.partition}区 ${bind.roleLevel || '?'}级）` : '\n角色: 未同步（查询时自动同步）'
    await this.reply(
      `openid: ${bind.openid || '未提供'}\n绑定时间: ${bind.bindTime}${role}`,
      true
    )
    return false
  }

  /** #火影区服：查看角色列表；#火影区服 序号：切换角色 */
  async role () {
    const userId = this.e.user_id
    const bind = Store.get(userId)
    if (!bind) {
      await this.reply('当前未绑定，先发送 #火影登录 或 #火影绑定 + cookie', true)
      return false
    }

    const roles = await Api.getRoleList(bind)
    if (!roles.length) {
      await this.reply('❌ 未查询到角色列表，登录态可能已失效，请重新 #火影登录', true)
      return false
    }

    const m = this.e.msg.match(/#?火影区服\s*(\d+)?/)
    if (m && m[1]) {
      const pick = roles[Number(m[1]) - 1]
      if (!pick) {
        await this.reply(`❌ 序号 ${m[1]} 无效，请先发送 #火影区服 查看列表`, true)
        return false
      }
      const roleName = decodeURIComponent(pick.CharacName || '')
      Store.setRole(userId, { partition: pick.Partition, roleId: pick.Gid, roleName, roleLevel: pick.Level })
      await this.reply(`✅ 已切换角色：${roleName}（${pick.Partition}区 ${pick.Level}级）`, true)
      return false
    }

    const list = roles.map((r, i) => {
      const name = decodeURIComponent(r.CharacName || '')
      const cur = String(r.Partition) === String(bind.partition) ? ' ✅当前' : ''
      return `${i + 1}. ${name}（${r.Partition}区 ${r.Level}级）${cur}`
    })
    await this.reply(
      '【角色列表】\n' + list.join('\n') +
      '\n\n发送 #火影区服 序号 切换查询角色\n（新绑定用户已自动选择等级最高的角色）',
      true
    )
    return false
  }
}
