import {getVersion} from './utils'

test('get version', async () => {
  expect(getVersion('released v1.2.0')).toEqual('v1.2.0')
  expect(getVersion('released v1.2.0 sss')).toEqual('v1.2.0')
})
