# AltStore 安装与更新教程（PigBang iOS 测试版）

免费 Apple ID 签名的 App 没法走 App Store，只能靠 AltStore 这类工具在自己手机上"现场签名"安装。签名默认 7 天过期，AltStore 的作用就是帮你按时自动续期、以及以后收新版时不用再手动折腾。

## 一、准备工作

- 一台电脑（Windows / Mac 都行）
- 一个 Apple ID（免费的就行，不需要付费开发者账号）
- iPhone 和电脑连同一个 WiFi（装机、以后自动续签都靠这个连接）

## 二、电脑上装 AltServer

1. 去 [faq.altstore.io](https://faq.altstore.io) 找到对应系统（Windows/Mac）的 AltServer 安装包下载
2. Windows 用户额外需要装 iTunes（或 iCloud）里的驱动组件，Mac 不用额外装
3. 装完打开 AltServer，它会常驻在菜单栏/系统托盘，不需要一直点开界面，开着就行

## 三、iPhone 上装 AltStore

1. iPhone 连上电脑同一个 WiFi
2. 点菜单栏/托盘的 AltServer 图标 → "Install AltStore" → 选你的 iPhone
3. 输入 Apple ID 和密码（如果这个 Apple ID 开了双重验证，用**App 专用密码**，不是登录密码本身；专用密码在 appleid.apple.com 的账户安全里生成）
4. 装完后 iPhone 桌面会出现 AltStore 图标
5. 首次打开可能提示"未受信任的开发者"：去 设置 → 通用 → VPN与设备管理，找到对应的 Apple ID，点"信任"
6. iOS 16 及以上还需要开一次"开发者模式"：设置 → 隐私与安全性 → 开发者模式，打开后手机会要求重启，重启后还会弹一次确认，再重启一次才算真正开启

以上这几步跟直接用 AltStore 装账本 App 是同一套，如果之前已经装过 AltStore 本体，这一节可以跳过，直接看下一节。

## 四、添加"PigBang"的更新源

这是新加的功能，加一次以后就不用每次手动下载 ipa 了。

1. 打开 AltStore，切到底部"浏览 / Browse"标签
2. 找信息源相关的入口（一般是左上角图标或者"信息源 / Sources"设置），选择"添加信息源 / Add Source"
3. 粘贴这个地址：

   ```
   https://github.com/cidstevez01-hash/Claude_-Account_book/releases/download/ios-latest/altstore-source.json
   ```

4. 添加成功后，"浏览"列表里会出现"PigBang"，点进去可以直接装

> 目前这个地址还没正式发布内容——我们这一批新改动（竖屏锁定、版本号、状态栏效果）还在测试分支验证阶段，等你确认没问题、合并发布后这个地址才会真正生效，到时候我会告诉你可以加了。

## 五、以后怎么更新

- 每次我们出新版并正式发布后，AltStore 里"我的应用 / My Apps"这个 PigBang 条目会自动显示"更新 / Update"
- 点更新前确保：AltServer 在电脑上开着、手机和电脑连同一个 WiFi
- 免费签名 7 天会过期，只要 AltServer 定期开着连一下手机，AltStore 会在后台自动帮你重新签名续期，不需要额外手动操作

## 六、常见问题

- **卡在"Prefetching Anisette"很久**：这是苹果账号认证用的公共中转服务，人多的时候会拥堵，多等一会或换个时间段再试
- **提示密码错误（-22406 等）**：确认账号有没有开双重验证，开了就必须用 App 专用密码，不是登录密码
- **看不到"Team ID"**：免费 Apple ID 首次签名时苹果会自动分配一个"Personal Team"，不需要你自己去开发者后台创建，正常走完登录流程就会自动出现
- **7 天后 App 打不开、提示已过期**：说明期间 AltServer 没能定期跑一次自动续签，重新打开电脑上的 AltServer、手机连同一 WiFi，AltStore 里手动点一下续签/更新即可
