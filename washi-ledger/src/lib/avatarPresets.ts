/** 预设头像——设计来源：design-assets/icons/default-avatar/final/(Stitch出稿，用户R-XX
 * 确认版)，从12格图案合集(history/preset-avatars-v1-stitch.png)裁切成独立文件，跟
 * public/avatars/下的实际bundled资源一一对应。id是文件名(不含扩展名)，同时也是存进
 * localStorage的选中值。第一个(ink-stamp)是没手动选过头像时的默认值。 */
export interface AvatarPreset {
  id: string
  labelZh: string
  labelJa: string
  src: string
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'ink-stamp', labelZh: '朱红印章', labelJa: '朱印スタンプ', src: '/avatars/ink-stamp.png' },
  { id: 'zen-enso', labelZh: '禅意墨圈', labelJa: '禅の墨円', src: '/avatars/zen-enso.png' },
  { id: 'celadon-ripple', labelZh: '青瓷波纹', labelJa: '青磁の波紋', src: '/avatars/celadon-ripple.png' },
  { id: 'golden-dots', labelZh: '金泥圆点', labelJa: '金泥ドット', src: '/avatars/golden-dots.png' },
  { id: 'bamboo', labelZh: '竹影', labelJa: '竹影', src: '/avatars/bamboo.png' },
  { id: 'moon', labelZh: '月相', labelJa: '月相', src: '/avatars/moon.png' },
  { id: 'plum-blossom', labelZh: '梅花', labelJa: '梅の花', src: '/avatars/plum-blossom.png' },
  { id: 'crackle', labelZh: '开片纹', labelJa: '貫入紋', src: '/avatars/crackle.png' },
  { id: 'mountain', labelZh: '山水', labelJa: '山水', src: '/avatars/mountain.png' },
  { id: 'fan', labelZh: '团扇', labelJa: '団扇', src: '/avatars/fan.png' },
  { id: 'vermilion-dot', labelZh: '朱印', labelJa: '朱印', src: '/avatars/vermilion-dot.png' },
  { id: 'bamboo-segment', labelZh: '墨竹', labelJa: '墨竹', src: '/avatars/bamboo-segment.png' },
]

export const DEFAULT_AVATAR_ID = AVATAR_PRESETS[0].id

export function getAvatarPreset(id: string | null | undefined): AvatarPreset {
  return AVATAR_PRESETS.find((p) => p.id === id) ?? AVATAR_PRESETS[0]
}
