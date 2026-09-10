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
          reg: '^#?火影绑定',
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

  /** #火影绑定 → 引导扫码登录（已移除 cookie 手动绑定） */
  async bind () {
    await this.reply(
      '【火影绑定】\n' +
      '请发送 #火影登录，用手机 QQ 扫码即可完成绑定，\n' +
      '无需抓包，全自动获取登录态 ✨',
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
      await this.reply('当前未绑定，发送 #火影登录 扫码绑定', true)
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
      await this.reply('当前未绑定，发送 #火影登录 扫码绑定', true)
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
