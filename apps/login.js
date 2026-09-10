import fs from 'node:fs'
import path from 'node:path'
import WebLogin from '../model/weblogin.js'
import { getBaseUrl } from '../model/config.js'

const QR_DIR = path.resolve('temp/hyrz_login')

export class HyrzLogin extends plugin {
  constructor () {
    super({
      name: '火影忍者:扫码登录',
      dsc: '发送 QQ 扫码登录二维码，自动抓取 cookie 并绑定',
      event: 'message',
      priority: 100,
      rule: [
        {
          reg: '^#?火影(网页|扫码)?登录$',
          fnc: 'webLogin',
          permission: 'all'
        }
      ]
    })
  }

  async webLogin () {
    const e = this.e
    const userId = e.user_id
    if (!userId) {
      await this.reply('❌ 无法获取用户身份')
      return false
    }

    await this.reply(
      '【火影扫码登录】\n' +
      '请用手机 QQ 扫描下方二维码，确认授权后自动完成绑定 ✨',
      true
    )

    // 二维码直发聊天 + 后台轮询；同一次命令只创建一张二维码
    WebLogin.startQqLogin(userId, async (type, data) => {
      try {
        if (type === 'qr') {
          fs.mkdirSync(QR_DIR, { recursive: true })
          const file = path.join(QR_DIR, `${userId}.png`)
          fs.writeFileSync(file, data)
          await e.reply(segment.image(file))

          // 网页入口只查看当前聊天端已创建的同一张二维码，不会另建会话
          const base = getBaseUrl()
          const sid = WebLogin.getQqLoginSession(userId)
          if (base && sid) {
            const token = WebLogin.createToken(userId, sid)
            const link = `${base}/hyrz/login/${token}`
            await e.reply(
              '🌐 也可打开链接查看本次二维码（约 5 分钟有效，勿外传）：\n' +
              `https://docs.qq.com/scenario/link.html?url=${encodeURIComponent(link)}`,
              true
            )
          }
        } else if (type === 'ok') {
          await e.reply(
            '✅ 扫码登录成功，已自动绑定！\n' +
            `游戏昵称：${data.nickname || data.qqNick || '-'}\n` +
            (data.role ? `默认角色：${data.role}\n` : '') +
            '现在可以使用 #火影面板 #火影战绩 等命令了',
            true
          )
        } else if (type === 'error') {
          await e.reply(`❌ 登录失败：${data}\n请重新发送 #火影登录 再试`, true)
        } else if (type === 'timeout') {
          await e.reply('⏰ 本次二维码已过期，登录未完成。请重新发送 #火影登录 获取新的二维码。', true)
        }
      } catch (err) {
        logger.error(`[火影网页登录] 消息发送失败: ${err.message}`)
      }
    })
    return false
  }
}
