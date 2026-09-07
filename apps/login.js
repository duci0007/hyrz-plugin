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

    // 可选增强：配置了 webLoginBase 时附加网页登录链接（套腾讯文档中转防 QQ 风控屏蔽直链）
    let linkTip = ''
    const base = getBaseUrl()
    if (base) {
      const token = WebLogin.createToken(userId)
      const link = `${base}/hyrz/login/${token}`
      linkTip = '\n\n🌐 或打开链接登录（30 分钟内有效，勿外传）：\n' +
        `https://docs.qq.com/scenario/link.html?url=${encodeURIComponent(link)}`
    }

    await this.reply(
      '【火影扫码登录】\n' +
      '用手机 QQ 扫描下方二维码（长按图片 → 识别二维码），\n' +
      '在弹出的授权页点击确认，机器人自动抓取 cookie 并绑定' +
      linkTip,
      true
    )

    // 二维码直发聊天 + 后台轮询，无需域名/公网/端口
    WebLogin.startQqLogin(userId, async (type, data) => {
      try {
        if (type === 'qr') {
          fs.mkdirSync(QR_DIR, { recursive: true })
          const file = path.join(QR_DIR, `${userId}.png`)
          fs.writeFileSync(file, data)
          await e.reply(segment.image(file))
        } else if (type === 'ok') {
          await e.reply(
            '✅ 扫码登录成功，已自动绑定！\n' +
            `游戏昵称：${data.nickname || data.qqNick || '-'}\n` +
            `openid：${data.openid}\n` +
            '现在可以使用 #火影面板 #火影战绩 等命令了',
            true
          )
        } else if (type === 'error') {
          await e.reply(`❌ 登录失败：${data}\n请重新发送 #火影登录 再试`, true)
        } else if (type === 'refresh') {
          await e.reply('⏰ 二维码已过期，正在刷新，请扫描新码...', true)
        } else if (type === 'timeout') {
          await e.reply('⏰ 登录超时（约 30 分钟未完成），如需继续请重新发送 #火影登录', true)
        }
      } catch (err) {
        logger.error(`[火影网页登录] 消息发送失败: ${err.message}`)
      }
    })
    return false
  }
}
