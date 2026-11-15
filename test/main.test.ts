import {getVersion, toVersionNumber} from '../src/utils'

test('get version', async () => {
  expect(getVersion('released v1.2.0')).toEqual('v1.2.0')
  expect(getVersion('released v1.2.0 sss')).toEqual('v1.2.0')
  expect(getVersion('released V1.2.0')).toEqual('V1.2.0')
  expect(getVersion('no version here')).toEqual('')
})

test('toVersionNumber strips the leading v and keeps prerelease', () => {
  expect(toVersionNumber('v1.2.3')).toEqual('1.2.3')
  expect(toVersionNumber('1.2.3')).toEqual('1.2.3')
  expect(toVersionNumber('V1.2.3')).toEqual('1.2.3')
  expect(toVersionNumber('  v1.2.3  ')).toEqual('1.2.3')
  expect(toVersionNumber('v1.2.3-beta.1')).toEqual('1.2.3-beta.1')
  expect(toVersionNumber('v1.2.3-rc.1+exp.sha')).toEqual('1.2.3-rc.1')
  expect(toVersionNumber('v1.2.3+build.5')).toEqual('1.2.3')
})

test('toVersionNumber fills partial versions instead of returning empty', () => {
  expect(toVersionNumber('v1.2')).toEqual('1.2.0')
  expect(toVersionNumber('v1')).toEqual('1.0.0')
  expect(toVersionNumber('V2')).toEqual('2.0.0')
})

test('toVersionNumber is empty only when nothing can be parsed', () => {
  expect(toVersionNumber('')).toEqual('')
  expect(toVersionNumber('   ')).toEqual('')
  expect(toVersionNumber('released')).toEqual('')
  expect(toVersionNumber('not-a-version')).toEqual('')
})
