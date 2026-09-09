import WebLogin from '../model/weblogin.js'

/**
 * 火影网页扫码登录服务（挂载于 Yunzai express）
 * 路由: /hyrz/login/:token           登录页
 *       /hyrz/login/:token/qr       本次二维码图片
 *       /hyrz/login/:token/status   本次会话状态
 */

const PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>火影忍者 · 扫码登录</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(160deg, #1a1408 0%, #2b1d0d 55%, #3a2510 100%);
    font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; color: #f0e6d2; padding: 24px;
  }
  .card {
    width: 100%; max-width: 380px; background: rgba(20, 15, 8, .88);
    border: 1px solid #6b4f21; border-radius: 16px; padding: 28px 24px;
    box-shadow: 0 12px 48px rgba(0,0,0,.55), inset 0 0 24px rgba(107, 79, 33, .12);
    text-align: center;
  }
  .title { font-size: 21px; font-weight: 700; letter-spacing: 2px; color: #ffcf70; margin-bottom: 4px; }
  .sub { font-size: 12px; color: #a8925f; margin-bottom: 20px; }
  .qrbox {
    position: relative; width: 232px; height: 232px; margin: 0 auto 16px;
    background: #fff; border-radius: 12px; padding: 10px; overflow: hidden;
  }
  .qrbox img { width: 100%; height: 100%; display: block; }
  .mask {
    position: absolute; inset: 0; background: rgba(15,12,8,.86); border-radius: 12px;
    display: none; align-items: center; justify-content: center; flex-direction: column; gap: 10px;
  }
  .mask.show { display: flex; }
  .mask .big { font-size: 44px; line-height: 1; }
  .mask .txt { font-size: 13px; color: #d9c896; padding: 0 16px; word-break: break-all; }
  .status { min-height: 22px; font-size: 14px; color: #e8d9ae; margin-bottom: 6px; }
  .status.warn { color: #ffb84d; }
  .status.err { color: #ff7a6b; }
  .tip { font-size: 11.5px; color: #8a7546; line-height: 1.7; }
  .ok-info { text-align: left; margin-top: 16px; display: none; }
  .ok-info .row {
    display: flex; justify-content: space-between; gap: 10px; padding: 8px 10px;
    background: rgba(107,79,33,.14); border-radius: 8px; margin-bottom: 8px;
    font-size: 12px; word-break: break-all;
  }
  .ok-info .row b { color: #ffcf70; flex-shrink: 0; }
  .spinner {
    width: 26px; height: 26px; margin: 0 auto 10px; border-radius: 50%;
    border: 3px solid rgba(200,135,31,.25); border-top-color: #c8871f;
    animation: spin .8s linear infinite; display: none;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="card">
  <div class="title">火影忍者 · 扫码登录</div>
  <div class="sub">扫码后自动抓取游戏 Cookie 并绑定</div>
  <div class="spinner" id="spin"></div>
  <div class="qrbox">
    <img id="qr" alt="二维码加载中...">
    <div class="mask" id="mask">
      <div class="big" id="mBig"></div>
      <div class="txt" id="mTxt"></div>
    </div>
  </div>
  <div class="status" id="status">正在获取二维码...</div>
  <div class="ok-info" id="okInfo">
    <div class="row"><b>游戏昵称</b><span id="iNick"></span></div>
    <div class="row"><b>openid</b><span id="iOpenid"></span></div>
  </div>
  <div class="tip">请使用<strong>手机 QQ</strong> 扫码（登录的是游戏对应的 QQ 号）<br>扫码即视为同意将登录态用于机器人查询</div>
</div>
<script>
const TOKEN = location.pathname.split('/')[3] || '';
let timer = null, stopped = false;

const $ = id => document.getElementById(id);

function loadSession() {
  stopped = false;
  $('spin').style.display = 'block';
  $('mask').classList.remove('show');
  $('okInfo').style.display = 'none';
  $('status').textContent = '正在加载本次二维码...';
  $('status').className = 'status';
  $('qr').src = '/hyrz/login/' + TOKEN + '/qr?t=' + Date.now();
  $('status').textContent = '请用手机 QQ 扫码';
  startPoll();
}

function startPoll() {
  stopPoll();
  timer = setInterval(poll, 2000);
}

function stopPoll() {
  if (timer) { clearInterval(timer); timer = null; }
}

async function poll() {
  if (stopped) return;
  try {
    const r = await fetch('/hyrz/login/' + TOKEN + '/status', { cache: 'no-store' });
    const j = await r.json();
    if (j.state === 'waiting') return;
    if (j.state === 'scanned') {
      $('spin').style.display = 'block';
      $('status').textContent = j.msg || '已扫码，等待确认...';
      $('status').className = 'status warn';
      return;
    }
    if (j.state === 'expired' || j.state === 'gone') {
      stopPoll();
      $('spin').style.display = 'none';
      $('status').textContent = '本次二维码已过期，请重新发送 #火影登录 获取新码';
      $('status').className = 'status warn';
      showMask('⌛', '二维码已过期，请重新发送 #火影登录');
      return;
    }
    if (j.state === 'error') {
      stopPoll();
      $('spin').style.display = 'none';
      showError(j.msg || '登录失败');
      return;
    }
    if (j.state === 'ok') {
      stopPoll(); stopped = true;
      $('spin').style.display = 'none';
      showMask('✅', '登录成功，已自动绑定');
      $('status').innerHTML = '绑定成功！可以直接关闭此页';
      $('status').className = 'status';
      $('iNick').textContent = j.nickname || j.qqNick || '-';
      $('iOpenid').textContent = j.openid || '-';
      $('okInfo').style.display = 'block';
      return;
    }
  } catch (e) { /* 网络波动，下轮重试 */ }
}

function showMask(big, txt) {
  $('mBig').textContent = big;
  $('mTxt').textContent = txt;
  $('mask').classList.add('show');
}

function showError(msg) {
  showMask('❌', msg);
  $('status').textContent = msg;
  $('status').className = 'status err';
}

loadSession();
</script>
</body>
</html>`

/** 注册 express 路由（在 Yunzai 启动后调用） */
function initWebLoginServer () {
  const app = global.Bot?.express
  if (!app) {
    logger.error('[火影网页登录] 未找到 Bot.express，路由注册失败')
    return
  }

  app.use('/hyrz/login', async (req, res) => {
    try {
      // /hyrz/login/:token[/qr|/status]
      const parts = req.path.split('/').filter(Boolean)
      const token = parts[0]
      const action = parts[1] || ''

      if (!token || !/^[0-9a-f]{24}$/.test(token)) {
        return res.status(400).send('无效的登录链接')
      }
      const login = WebLogin.checkToken(token)
      if (!login) {
        return res.status(410).type('html').send('<body style="text-align:center;padding-top:40vh;background:#14100a;color:#d9c896;font-family:sans-serif">登录链接已过期，请重新发送 #火影登录 获取新链接</body>')
      }
      const { userId, sid } = login

      if (!action) {
        return res.type('html').send(PAGE_HTML)
      }

      if (action === 'qr') {
        const png = WebLogin.getQr(sid)
        if (!png) return res.status(404).send('二维码已过期，请重新发送 #火影登录')
        res.type('image/png')
        return res.send(png)
      }

      if (action === 'status') {
        const r = await WebLogin.pollSession(sid)
        const { access_token, ...safeResult } = r
        return res.json(safeResult)
      }

      return res.status(404).send('not found')
    } catch (err) {
      logger.error(`[火影网页登录] 请求处理失败: ${err.message}`)
      if (req.path.split('/').filter(Boolean)[1] === '' || !req.path.split('/').filter(Boolean)[1]) {
        return res.status(500).send('服务异常，请稍后重试')
      }
      return res.json({ code: 1, state: 'error', msg: `服务异常: ${err.message}` })
    }
  })

  logger.mark('[火影网页登录] 路由已挂载: /hyrz/login/:token')
}

export default initWebLoginServer
