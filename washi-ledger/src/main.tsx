import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// iOS Safari/WKWebView不会给:active伪类应用样式，除非页面上真的挂了一个touch事件
// 监听——旧仓库index.html第7294行就是这么处理的，这里照搬同一个空listener，不然
// 全App所有active:xxx的点击反馈类(头部按钮/编辑复制删除等)在真机上都是摆设，只有
// 桌面浏览器devtools模拟点击能看到
document.addEventListener('touchstart', () => {}, { passive: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
