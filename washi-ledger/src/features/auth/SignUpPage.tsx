import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type Mode = 'signup' | 'verify'

/** 注册——独立整屏页面，照design-assets-v2/_14做布局，但去掉了设计稿里的"Full Name"
 * 字段——旧仓库index.html的真实注册逻辑(supabase.auth.signUp)只收email+password，
 * 没有存用户姓名这个字段，不能凭空加一个不落地的输入框。
 *
 * 真实逻辑照旧App搬：signUp后如果需要邮箱验证，进入验证码输入态(verifyOtp)，
 * 不是注册完直接算完成 */
export function SignUpPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('请输入邮箱和密码')
      return
    }
    if (password !== password2) {
      setError('两次密码不一致')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password })
      if (signUpError) throw signUpError
      if (data.session) {
        // 有些Supabase项目关掉了邮箱验证，注册直接就是已登录态，不需要走验证码这一步
        navigate('/account')
        return
      }
      setMode('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) {
      setError('请输入验证码')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'signup',
      })
      if (verifyError) throw verifyError
      navigate('/account')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-[480px] mx-auto min-h-screen flex flex-col justify-center px-md bg-surface">
      {mode === 'verify' && (
        <button
          type="button"
          onClick={() => setMode('signup')}
          className="flex items-center gap-1 text-label-caps font-sans text-on-surface-variant mb-md self-start"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          返回
        </button>
      )}

      <div className="flex flex-col items-center mb-lg">
        <h1 className="font-serif text-headline-lg text-primary">Washi Ledger</h1>
        <p className="text-label-caps font-sans text-on-surface-variant mt-1">
          {mode === 'signup' ? '开始记录你的生活' : '查收邮箱里的验证码'}
        </p>
      </div>

      {mode === 'signup' ? (
        <form onSubmit={handleSignUp} className="bg-surface-container-lowest border-[1.5px] border-dashed border-outline-variant rounded-xl p-md flex flex-col gap-md">
          <div className="flex flex-col gap-1">
            <label className="text-label-caps font-sans text-on-surface-variant tracking-widest uppercase">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="bg-transparent border-0 border-b-2 border-outline-variant focus:border-primary outline-none py-1 text-body-lg text-on-surface focus:ring-0"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-label-caps font-sans text-on-surface-variant tracking-widest uppercase">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="········"
              className="bg-transparent border-0 border-b-2 border-outline-variant focus:border-primary outline-none py-1 text-body-lg text-on-surface focus:ring-0"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-label-caps font-sans text-on-surface-variant tracking-widest uppercase">确认密码</label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="········"
              className="bg-transparent border-0 border-b-2 border-outline-variant focus:border-primary outline-none py-1 text-body-lg text-on-surface focus:ring-0"
            />
          </div>

          {error && <p className="text-body-md text-primary">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[52px] bg-primary text-on-primary rounded-xl text-headline-md font-serif disabled:opacity-50"
          >
            {loading ? '注册中…' : '创建账本'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="bg-surface-container-lowest border-[1.5px] border-dashed border-outline-variant rounded-xl p-md flex flex-col gap-md">
          <p className="text-body-md text-on-surface-variant">验证邮件已发送到 {email}，请输入验证码完成注册</p>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="验证码"
            className="bg-transparent border-0 border-b-2 border-outline-variant focus:border-primary outline-none py-1 text-body-lg text-on-surface focus:ring-0 tracking-widest text-center"
          />
          {error && <p className="text-body-md text-primary">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-[52px] bg-primary text-on-primary rounded-xl text-headline-md font-serif disabled:opacity-50"
          >
            {loading ? '验证中…' : '验证并完成注册'}
          </button>
        </form>
      )}

      {mode === 'signup' && (
        <p className="text-center text-body-md text-on-surface-variant mt-md">
          已经有账号？{' '}
          <Link to="/signin" className="text-primary font-medium">
            去登录
          </Link>
        </p>
      )}
    </div>
  )
}
