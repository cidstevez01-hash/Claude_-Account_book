const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { configure } = require('../scripts/configure-receipt-ios.cjs');
const { execFileSync } = require('node:child_process');
test('首次安装Pods前调整两个原生目标，重复执行且保留更高系统版本', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pigbang-ios-receipt-'));
  t.after(() => {
    const resolved = path.resolve(directory), parent = path.resolve(os.tmpdir());
    assert.equal(path.dirname(resolved), parent);
    assert(path.basename(resolved).startsWith('pigbang-ios-receipt-'));
    fs.rmSync(resolved, { recursive: true });
  });
  fs.mkdirSync(path.join(directory, 'App.xcodeproj'));
  fs.writeFileSync(path.join(directory, 'Podfile'), "platform :ios, '14.0'\n");
  fs.writeFileSync(path.join(directory, 'App.xcodeproj/project.pbxproj'), 'IPHONEOS_DEPLOYMENT_TARGET = 14.0;\nIPHONEOS_DEPLOYMENT_TARGET = 16.0;');
  configure(directory); configure(directory);
  assert.match(fs.readFileSync(path.join(directory, 'Podfile'), 'utf8'), /'15.5'/);
  const project = fs.readFileSync(path.join(directory, 'App.xcodeproj/project.pbxproj'), 'utf8');
  assert.match(project, /= 15.5;/); assert.match(project, /= 16.0;/);
});
test('当前 Capacitor 真正的 iOS 模板可在首次 pod install 前配置', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pigbang-ios-receipt-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert(path.basename(directory).startsWith('pigbang-ios-receipt-'));
    fs.rmSync(directory, { recursive: true });
  });
  const appRoot = path.resolve(__dirname, '..');
  const template = path.join(appRoot, 'node_modules/@capacitor/cli/assets/ios-pods-template.tar.gz');
  execFileSync('tar', ['-xf', template, '-C', directory], { windowsHide: true });
  const nativeRoot = path.join(directory, 'App');
  configure(nativeRoot);
  assert.match(fs.readFileSync(path.join(nativeRoot, 'Podfile'), 'utf8'), /platform :ios, '15\.5'/);
  const project = fs.readFileSync(path.join(nativeRoot, 'App.xcodeproj/project.pbxproj'), 'utf8');
  const targets = [...project.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+);/g)].map(match => Number(match[1]));
  assert(targets.length >= 2);
  assert(targets.every(value => value >= 15.5));
  const cli = fs.readFileSync(path.join(appRoot, 'node_modules/@capacitor/cli/dist/tasks/sync.js'), 'utf8');
  assert(cli.indexOf("'capacitor:sync:before'") < cli.indexOf('(0, update_1.update)'));
  const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['capacitor:sync:before'], 'node scripts/configure-receipt-ios.cjs');
});
