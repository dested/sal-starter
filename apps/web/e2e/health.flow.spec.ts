import { expect, test } from './flow'
import { FLOW_COMMIT } from './server'

test('health/commit · /healthz reports the commit the server was deployed as', async ({
  request,
}) => {
  // Check: the body holds `"commit":"<DRYDOCK_COMMIT>"`, the text Drydock's Live check looks for.
  const res = await request.get('/healthz')
  expect(res.status()).toBe(200)
  expect(await res.text()).toContain(`"commit":"${FLOW_COMMIT}"`)
})
