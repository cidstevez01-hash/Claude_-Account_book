// Runs before Capacitor's first pod install, including `cap add ios`.
const fs = require('node:fs');
const path = require('node:path');
const minimum = '15.5';
const atLeastMinimum = value => {
  const [major, minor = 0] = value.split('.').map(Number);
  return major > 15 || (major === 15 && minor >= 5) ? value : minimum;
};
function configure(root) {
  const targets = [
    ['Podfile', /platform\s*:ios,\s*['"]([\d.]+)['"]/g, value => `platform :ios, '${value}'`],
    ['App.xcodeproj/project.pbxproj', /IPHONEOS_DEPLOYMENT_TARGET\s*=\s*([\d.]+);/g, value => `IPHONEOS_DEPLOYMENT_TARGET = ${value};`],
  ];
  for (const [file, pattern, replacement] of targets) {
    const location = path.join(root, file);
    const input = fs.readFileSync(location, 'utf8');
    let matches = 0;
    const output = input.replace(pattern, (_, value) => { matches++; return replacement(atLeastMinimum(value)); });
    if (!matches) throw Error(`iOS deployment target missing: ${file}`);
    if (input !== output) fs.writeFileSync(location, output);
  }
}
module.exports = { configure };
if (require.main === module && process.env.CAPACITOR_PLATFORM_NAME === 'ios') {
  configure(path.resolve(__dirname, '../ios/App'));
  console.log('Receipt ML Kit: iOS deployment target configured (minimum 15.5).');
}
