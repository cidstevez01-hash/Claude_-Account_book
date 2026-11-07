import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppNavigate, viewTransitionLinkClick } from '../../hooks/useAppNavigate'
import { useAuth } from './useAuth'
import { supabase } from '../../lib/supabase'
import { useI18n } from '../../lib/i18n'
import { ThemeIcon } from '../../design-system/components/ThemeIcon'
import { RouteFade } from '../../design-system/components/RouteFade'

type Mode = 'signup' | 'verify'

/** 注册——独立整屏页面，照design-assets-v2/_14做布局，但去掉了设计稿里的"Full Name"
 * 字段——旧仓库index.html的真实注册逻辑(supabase.auth.signUp)只收email+password，
 * 没有存用户姓名这个字段，不能凭空加一个不落地的输入框。
 *
 * 真实逻辑照旧App搬：signUp后如果需要邮箱验证，进入验证码输入态(verifyOtp)，
 * 不是注册完直接算完成 */
export function SignUpPage() {
  const { t } = useI18n()
  const { isAnonymous } = useAuth()
  const navigate = useAppNavigate()
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [linkingAnonymous, setLinkingAnonymous] = useState(false)

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError(t('needEmailPasswordError'))
      return
    }
    if (password !== password2) {
      setError(t('passwordMismatchError'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

      // 把当前匿名用户升级为正式账号，保留同一个 Supabase userId，账目和规则仍归原用户。
      // Supabase 项目需要开启 Authentication 的 Manual Linking。
      if (sessionData.session?.user.is_anonymous) {
        const { data, error: updateError } = await supabase.auth.updateUser({ email: email.trim() })
        if (updateError) throw updateError
        setLinkingAnonymous(true)
        if (data.user.email_confirmed_at) {
          const { error: passwordError } = await supabase.auth.updateUser({ password })
          if (passwordError) throw passwordError
          navigate('/account')
          return
        }
        setMode('verify')
        return
      }

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
      setError(t('needVerifyCodeError'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: linkingAnonymous ? 'email_change' : 'signup',
      })
      if (verifyError) throw verifyError
      if (linkingAnonymous) {
        const { error: passwordError } = await supabase.auth.updateUser({ password })
        if (passwordError) throw passwordError
      }
      navigate('/account')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="app-shell fixed inset-0 mx-auto max-w-[480px] flex flex-col justify-center px-md bg-surface paper-grid-bg overflow-y-auto overflow-x-hidden overscroll-y-contain"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <RouteFade className="flex flex-col">
      {mode === 'verify' && (
        <button
          type="button"
          onClick={() => setMode('signup')}
          className="flex items-center gap-1 text-label-caps font-sans text-on-surface-variant mb-md self-start"
        >
          <ThemeIcon icon="arrow_back" effect="bare" size={18} className="text-[18px]" />
          {t('backLabel')}
        </button>
      )}

      <div className="flex flex-col items-center mb-lg">
        <h1 className="font-serif text-headline-lg text-primary">PigBang</h1>
        <p className="text-label-caps font-sans text-on-surface-variant mt-1">
          {mode === 'signup' ? t('signUpTagline') : t('verifyTagline')}
        </p>
      </div>

      {mode === 'signup' && isAnonymous && (
        <p className="text-body-sm text-on-surface-variant mb-md text-center">{t('guestAccountUpgradeHint')}</p>
      )}

      {mode === 'signup' ? (
        <form onSubmit={handleSignUp} className="bg-surface-container-lowest border-[1.5px] border-dashed border-outline-variant rounded-xl p-md flex flex-col gap-md">
          <div className="flex flex-col gap-1">
            <label className="text-label-caps font-sans text-on-surface-variant tracking-widest uppercase">{t('emailLabel')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="bg-transparent border-0 border-b-2 border-outline-variant focus:border-primary outline-none py-1 text-body-lg text-on-surface focus:ring-0"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-label-caps font-sans text-on-surface-variant tracking-widest uppercase">{t('passwordLabel')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="········"
              className="bg-transparent border-0 border-b-2 border-outline-variant focus:border-primary outline-none py-1 text-body-lg text-on-surface focus:ring-0"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-label-caps font-sans text-on-surface-variant tracking-widest uppercase">{t('confirmPasswordLabel')}</label>
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
            {loading ? t('signUpSubmitLoading') : t('signUpSubmitBtn')}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="bg-surface-container-lowest border-[1.5px] border-dashed border-outline-variant rounded-xl p-md flex flex-col gap-md">
          <p className="text-body-md text-on-surface-variant">
            {t('verifyEmailSentPrefix')} {email}
            {linkingAnonymous ? t('verifyGuestAccountSuffix') : t('verifyEmailSentSuffix')}
          </p>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('verifyCodePlaceholder')}
            className="bg-transparent border-0 border-b-2 border-outline-variant focus:border-primary outline-none py-1 text-body-lg text-on-surface focus:ring-0 tracking-widest text-center"
          />
          {error && <p className="text-body-md text-primary">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-[52px] bg-primary text-on-primary rounded-xl text-headline-md font-serif disabled:opacity-50"
          >
            {loading ? t('verifySubmitLoading') : t('verifySubmitBtn')}
          </button>
        </form>
      )}

      {mode === 'signup' && (
        <p className="text-center text-body-md text-on-surface-variant mt-md">
          {t('alreadyHaveAccountText')}{' '}
          <Link to="/signin" onClick={(e) => viewTransitionLinkClick(e, navigate, '/signin')} className="text-primary font-medium">
            {t('goToSignInLink')}
          </Link>
        </p>
      )}
      </RouteFade>
    </div>
  )
}
