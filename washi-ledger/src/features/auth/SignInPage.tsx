import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

/** 登录——独立整屏页面，不套AppLayout(照HANDOFF确认过的决定：登录/注册是独立页面，
 * 不嵌在设置弹层里)。视觉照design-assets-v2/_1做。真实逻辑照旧仓库index.html的
 * cloudSigninForm提交处理：supabase.auth.signInWithPassword */
export function SignInPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('请输入邮箱和密码')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (signInError) throw signInError
      navigate('/account')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 mx-auto max-w-[480px] flex flex-col justify-center px-md bg-surface overflow-y-auto overscroll-y-contain"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex flex-col items-center mb-lg">
        <div className="w-16 h-16 rounded-full border-2 border-primary flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-3xl text-primary">menu_book</span>
        </div>
        <h1 className="font-serif text-headline-lg text-primary">Washi Ledger</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface-container-lowest border-[1.5px] border-dashed border-outline-variant rounded-xl p-md flex flex-col gap-md">
        <div className="flex flex-col gap-1">
          <label className="text-label-caps font-sans text-on-surface-variant tracking-widest uppercase">邮箱</label>
          <div className="flex items-center gap-2 border-b-2 border-outline-variant focus-within:border-primary py-1">
            <span className="material-symbols-outlined text-outline text-[18px]">mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="flex-1 bg-transparent border-none outline-none text-body-lg text-on-surface focus:ring-0"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-label-caps font-sans text-on-surface-variant tracking-widest uppercase">密码</label>
          <div className="flex items-center gap-2 border-b-2 border-outline-variant focus-within:border-primary py-1">
            <span className="material-symbols-outlined text-outline text-[18px]">lock</span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="········"
              className="flex-1 bg-transparent border-none outline-none text-body-lg text-on-surface focus:ring-0"
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-outline">
              <span className="material-symbols-outlined text-[18px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
        </div>

        {error && <p className="text-body-md text-primary">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-[52px] bg-primary text-on-primary rounded-xl text-headline-md font-serif disabled:opacity-50"
        >
          {loading ? '登录中…' : '登录'}
        </button>
      </form>

      <p className="text-center text-body-md text-on-surface-variant mt-md">
        还没有账号？{' '}
        <Link to="/register" className="text-primary font-medium">
          去注册
        </Link>
      </p>
    </div>
  )
}
