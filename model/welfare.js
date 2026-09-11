import Api from './api.js'

/**
 * 福利中心任务引擎（每日签到 + 积分任务自动完成）
 *
 * 任务体系（integralTaskList，index 为任务标识）：
 *  - sign           今日签到        AMS iFlowId=1083547
 *  - readArticle    浏览1个帖子     Ugc/articleDetail
 *  - like           点赞3次         User/doLike ×3（村口帖子）
 *  - dynamicArticle 访问村口         Ugc/dynamicArticle
 *  - guestInfo      访问他人主页     Index/taskDone 直接上报
 *  - goldHelper     查看金币助手     Index/taskDone 上报
 *  - scrollRecord   查看卷轴战绩     Index/taskDone 上报
 *  - actCalendar    查看活动日历     Index/taskDone 上报
 *  - wallpaper      查看壁纸站       Index/taskDone 上报
 *  - ninja          查看忍者站       Index/taskDone 上报
 *  - duel           决斗场胜1次     ❌ 游戏内完成
 *  - active         活跃度≥80       ❌ 游戏内完成
 *  - phone          绑定手机号       ❌ 一次性
 *
 * 流程：getTodayActInfo（查询状态）→ AMS签到 → 逐个完成可做任务 → taskLotteryNow 领奖 → 汇总
 * 状态判断：leftQual=0 已领奖（sign 的 curDone 服务端不更新，不能用于判断完成）
 * 注意：getTodayActInfo 不触发签到，签到需走 AMS iFlowId=1083547
 */

const sleep = ms => new Promise(r => setTimeout(r, ms))

/**
 * 领取任务奖励（带重试）
 * AMS 签到/任务完成后，ULINK 侧 curDone 状态同步有秒级延迟，
 * 立即领奖会报"请先完成任务后领取"，等待后重试即可
 */
async function claimReward (userId, idx) {
  let r
  for (let i = 0; i < 4; i++) {
    r = await Api.taskLotteryNow(userId, idx)
    if (r.iRet === 0) return r
    if (!/请先完成/.test(r.sMsg || '')) return r
    await sleep(2000)
  }
  return r
}

/** 可自动完成的任务定义（index → 执行函数） */
const AUTO_TASKS = {
  sign: async userId => {
    // 复刻小程序流程（抓包证实）：
    // 1083576 查询签到奖励（同时把 ULINK sign 任务标记 curDone=1）
    // → todaySceneReported → 1083547 正式签到 → todaySceneReported
    await Api.amsQuerySign(userId)
    await Api.todaySceneReported(userId)
    const r = await Api.amsSign(userId)
    // 已签过到（如当天重复执行）不视为失败，仍走领奖
    if (r.iRet !== 0 && !/已签|重复/.test(r.sMsg || '')) throw new Error(r.sMsg || '签到失败')
    await Api.todaySceneReported(userId)
  },
  readArticle: async userId => {
    const d = await Api.dynamicArticle(userId)
    const id = d?.list?.[0]?.articleInfo?.id || d?.[0]?.articleInfo?.id
    if (!id) throw new Error('未获取到帖子')
    await Api.articleDetail(userId, id)
  },
  like: async userId => {
    // 点赞 3 个不同帖子（like 任务 target=3）
    const d = await Api.dynamicArticle(userId)
    const list = d?.list || d || []
    const ids = list.map(x => x.articleInfo?.id).filter(Boolean).slice(0, 3)
    if (!ids.length) throw new Error('未获取到帖子')
    for (const id of ids) {
      const r = await Api.doLike(userId, id)
      if (r.iRet !== 0 && r.iRet !== 4300) throw new Error(r.sMsg || '点赞失败')
      await sleep(800)
    }
  },
  dynamicArticle: async userId => {
    await Api.taskDone(userId, 'dynamicArticle')
  },
  guestInfo: async userId => {
    await Api.taskDone(userId, 'guestInfo')
  },
  goldHelper: async userId => {
    await Api.taskDone(userId, 'goldHelper')
  },
  scrollRecord: async userId => {
    await Api.taskDone(userId, 'scrollRecord')
  },
  actCalendar: async userId => {
    await Api.taskDone(userId, 'actCalendar')
  },
  wallpaper: async userId => {
    await Api.taskDone(userId, 'wallpaper')
  },
  ninja: async userId => {
    await Api.taskDone(userId, 'ninja')
  }
}

const Welfare = {
  /**
   * 执行全部每日任务（签到 + 浏览 + 点赞 + 领奖）
   * 返回 { tasks: [{name, point, status, msg}], got, actIntegral, icoIntegral }
   */
  async runDaily (userId) {
    // 1. 查询任务状态（getTodayActInfo 仅查询，不触发签到）
    const d = await Api.getTodayActInfo(userId)
    if (d.error) return { error: d.error }

    const all = d.integralTaskList || []
    const results = []
    let got = 0

    for (const t of all) {
      const idx = t.index
      const auto = AUTO_TASKS[idx]

      // 已领奖（leftQual=0；sign 的 curDone 不更新，不能用作完成判断）
      if (Number(t.leftQual) === 0) {
        results.push({ name: t.name, point: t.pointNum, status: 'done', msg: '已完成' })
        continue
      }

      // 游戏内任务/不可自动做
      if (!auto) {
        if (Number(t.curDone) >= Number(t.target)) {
          // 完成但未领奖（游戏内任务做完的情况）→ 直接领
          const r = await claimReward(userId, idx)
          if (r.iRet === 0) {
            got += t.pointNum
            results.push({ name: t.name, point: t.pointNum, status: 'done', msg: '已领奖' })
          } else {
            results.push({ name: t.name, point: t.pointNum, status: 'fail', msg: r.sMsg || '领奖失败' })
          }
          await sleep(400)
        } else {
          results.push({
            name: t.name,
            point: t.pointNum,
            status: 'skip',
            msg: `${t.curDone}/${t.target} 需游戏内完成`
          })
        }
        continue
      }

      // 2. 执行任务动作（sign 走 AMS 签到）
      try {
        await auto(userId)
        await sleep(600)
      } catch (err) {
        results.push({ name: t.name, point: t.pointNum, status: 'fail', msg: err.message })
        continue
      }

      // 3. 领奖（状态同步有延迟，自动重试）
      const r = await claimReward(userId, idx)
      if (r.iRet === 0) {
        got += t.pointNum
        results.push({ name: t.name, point: t.pointNum, status: 'done', msg: `+${t.pointNum}分` })
      } else {
        results.push({ name: t.name, point: t.pointNum, status: 'fail', msg: r.sMsg || '领奖失败' })
      }
      await sleep(400)
    }

    // 4. 复查最终积分
    let actIntegral = null
    let icoIntegral = null
    let drawStatus = null
    try {
      const d2 = await Api.getTodayActInfo(userId)
      if (!d2.error) {
        actIntegral = d2.actIntegral
        icoIntegral = d2.icoIntegral
        drawStatus = d2.drawLotteryStatus
      }
    } catch { /* ignore */ }

    return { tasks: results, got, actIntegral, icoIntegral, drawStatus }
  },

  /** 仅查询任务状态（不执行） */
  async queryDaily (userId) {
    const d = await Api.getTodayActInfo(userId)
    if (d.error) return d
    const list = (d.integralTaskList || []).map(t => ({
      name: t.name,
      point: t.pointNum,
      cur: t.curDone,
      target: t.target,
      done: Number(t.curDone) >= Number(t.target),
      claimed: Number(t.leftQual) === 0,
      auto: !!AUTO_TASKS[t.index]
    }))
    return {
      tasks: list,
      actIntegral: d.actIntegral,
      icoIntegral: d.icoIntegral,
      drawStatus: d.drawLotteryStatus
    }
  },

  /** 文字版结果 */
  formatResult (r) {
    if (r.error) return `❌ ${r.error}`
    const lines = ['【火影忍者·每日福利】']
    r.tasks.forEach(t => {
      const icon = t.status === 'done' ? '✅' : t.status === 'fail' ? '❌' : '⏭'
      lines.push(`${icon} ${t.name}（${t.point}分）: ${t.msg}`)
    })
    lines.push(`本次获得: ${r.got} 分`)
    if (r.actIntegral !== null && r.actIntegral !== undefined) lines.push(`当前活动积分: ${r.actIntegral} / ${r.icoIntegral ?? 200}`)
    return lines.join('\n')
  }
}

export default Welfare
