const path = require('node:path')
const nativeModule = require(path.join(__dirname, 'vibe-haptic-native.node'))

module.exports = {
  isSupported: nativeModule.isSupported,
  actuate: nativeModule.actuate,
  actuateWithDeviceId: nativeModule.actuateWithDeviceId,
  listDevices: nativeModule.listDevices,
  click: nativeModule.click,
  weakClick: nativeModule.weakClick,
  strongClick: nativeModule.strongClick,
}
