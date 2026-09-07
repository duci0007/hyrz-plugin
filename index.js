import fs from 'node:fs'

// 挂载网页扫码登录路由
try {
  const { default: initWebLoginServer } = await import('./server/weblogin.js')
  initWebLoginServer()
} catch (err) {
  logger.error(`[火影插件]网页登录服务加载失败：${err.message}`)
}

let apps = {}

const files = fs.readdirSync('./plugins/hyrz-plugin/apps').filter(file => file.endsWith('.js'))

let ret = []
files.forEach((file) => {
  ret.push(import(`./apps/${file}`))
})

ret = await Promise.allSettled(ret)

for (let i = 0; i < files.length; i++) {
  let name = files[i].replace('.js', '')
  if (ret[i].status !== 'fulfilled') {
    logger.error(`[火影插件]载入插件错误：${name}`)
    logger.error(ret[i].reason)
    continue
  }
  apps[name] = ret[i].value[Object.keys(ret[i].value)[0]]
}

export { apps }

logger.mark('--------- 火影忍者插件 hyrz-plugin 加载完成 ---------')
