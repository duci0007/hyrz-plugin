// 模拟插件查询流程（从 D:\Yunzai 根目录运行）
import Api from '../model/api.js'
import Store from '../model/store.js'

console.log('=== 查询前绑定文件 ===')
console.log(JSON.stringify(Store.get(uid), null, 2))

const uid = process.argv[2] || 'stdin'
const r = await Api.getCharacterInfo(uid)
if (r.error) {
  console.log('查询失败:', r.error)
} else {
  console.log('=== 查询成功 ===')
  console.log('等级:', r.info.level, '| 战力:', r.info.fight, '| 注册时间:', r.info.registerTime)
  console.log('忍者数:', r.ninjaNumber, '| 近期对局:', r.recentTotal, '场 胜率', r.recentWinRate + '%')
  console.log('常用忍者前3:', r.myNinja.slice(0, 3).map(n => `${n.name}(${n.fightCnt}场)`).join(' / '))
  console.log('资产:', JSON.stringify(r.assets))
  console.log('段位赛:', r.rankMatches ? `${r.rankMatches.total}场 胜率${r.rankMatches.winRate}%` : '无')
}

console.log('\n=== 查询后绑定文件 ===')
console.log(JSON.stringify(Store.get(uid), null, 2))

// 再验证空河（stdin）不受影响
const r2 = await Api.getCharacterInfo(process.argv[2] || 'stdin')
console.log('\n=== stdin 回归测试 ===')
console.log(r2.error ? ('失败: ' + r2.error) : `等级: ${r2.info.level} | 战力: ${r2.info.fight} | 对局: ${r2.recentTotal}场`)
console.log('stdin 绑定文件:', JSON.stringify(Store.get('stdin')))
