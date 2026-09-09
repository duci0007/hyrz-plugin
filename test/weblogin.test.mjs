import assert from 'node:assert/strict'
import test from 'node:test'
import { runSingleQqLogin } from '../model/weblogin.js'

test('single login sends one QR then times out without refresh', async () => {
  const events = []
  const state = { stop: false, sid: '' }
  let createCount = 0
  let now = 0
  let deleted = ''

  const result = await runSingleQqLogin({
    userId: '10001',
    state,
    send: async (type, data) => events.push([type, data]),
    createSessionFn: async () => ({ sid: `sid-${++createCount}` }),
    getQrFn: sid => Buffer.from(sid),
    pollSessionFn: async () => ({ state: 'waiting' }),
    sleepFn: async () => { now += 5 * 60 * 1000 },
    now: () => now,
    deleteSessionFn: sid => { deleted = sid }
  })

  assert.equal(createCount, 1)
  assert.deepEqual(events.map(([type]) => type), ['qr', 'timeout'])
  assert.equal(events.some(([type]) => type === 'refresh'), false)
  assert.equal(deleted, 'sid-1')
  assert.deepEqual(result, { sid: 'sid-1', state: 'expired' })
})

test('successful login completes without a timeout notification', async () => {
  const events = []
  const state = { stop: false, sid: '' }

  const result = await runSingleQqLogin({
    userId: '10002',
    state,
    send: async (type, data) => events.push([type, data]),
    createSessionFn: async () => ({ sid: 'sid-ok' }),
    getQrFn: () => Buffer.from('qr'),
    pollSessionFn: async () => ({ state: 'ok', nickname: '测试玩家' }),
    sleepFn: async () => {},
    deleteSessionFn: () => assert.fail('successful session must not be deleted')
  })

  assert.deepEqual(events.map(([type]) => type), ['qr', 'ok'])
  assert.deepEqual(result, { sid: 'sid-ok', state: 'ok', nickname: '测试玩家' })
})
