'use client';

import { useActionState, useRef, useState } from 'react';
import { SubmitButton } from '@/components/app/SubmitButton';
import { fieldClass, labelClass } from '@/components/app/ui';
import { sendMagicLink, signInWithPassword, type LoginState } from '@/app/auth/actions';

const DEMO_ACCOUNTS = [
  { role: 'Owner / admin', email: 'owner@luckydiesel.demo' },
  { role: 'Technician', email: 'jake@luckydiesel.demo' },
  { role: 'Customer', email: 'cody@luckydiesel.demo' },
] as const;

const DEMO_PASSWORD = 'DieselDemo2026!';

export function LoginForm({ next, isDemo }: { next: string; isDemo: boolean }) {
  const [mode, setMode] = useState<'password' | 'link'>('password');
  const [passwordState, passwordAction] = useActionState<LoginState, FormData>(signInWithPassword, {});
  const [linkState, linkAction] = useActionState<LoginState, FormData>(sendMagicLink, {});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const state = mode === 'password' ? passwordState : linkState;

  function signInAsDemo(email: string) {
    setMode('password');
    requestAnimationFrame(() => {
      if (emailRef.current) emailRef.current.value = email;
      if (passwordRef.current) passwordRef.current.value = DEMO_PASSWORD;
      formRef.current?.requestSubmit();
    });
  }

  return (
    <div className="mt-8">
      <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-2 gap-1 rounded-sm border border-line bg-carbon-2 p-1">
        {(['password', 'link'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={mode === option}
            onClick={() => setMode(option)}
            className={`h-9 rounded-sm text-sm font-semibold transition-colors ${mode === option ? 'bg-gunmetal text-chalk' : 'text-steel hover:text-chalk'}`}
          >
            {option === 'password' ? 'Password' : 'Email me a link'}
          </button>
        ))}
      </div>

      <form ref={formRef} action={mode === 'password' ? passwordAction : linkAction} className="mt-6 grid gap-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="email" className={labelClass}>Email</label>
          <input ref={emailRef} id="email" name="email" type="email" autoComplete="email" required className={fieldClass} />
        </div>
        {mode === 'password' && (
          <div>
            <label htmlFor="password" className={labelClass}>Password</label>
            <input ref={passwordRef} id="password" name="password" type="password" autoComplete="current-password" required className={fieldClass} />
          </div>
        )}
        {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        {state.notice && <p role="status" className="text-sm text-clover">{state.notice}</p>}
        <SubmitButton pendingLabel={mode === 'password' ? 'Signing in…' : 'Sending…'} className="h-12 text-lg">
          {mode === 'password' ? 'Log in' : 'Send sign-in link'}
        </SubmitButton>
      </form>

      {isDemo && (
        <div className="mt-10 rounded-md border border-violet/40 bg-violet/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">Demo accounts</p>
          <div className="mt-3 grid gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => signInAsDemo(account.email)}
                className="flex items-center justify-between rounded-sm border border-line bg-carbon px-3 py-2.5 text-left text-sm hover:border-clover"
              >
                <span className="font-semibold">{account.role}</span>
                <span className="text-steel">{account.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
