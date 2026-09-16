"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GithubLogo, WarningCircle } from "@phosphor-icons/react";
import { login } from "../lib/api";
import { setMustChangePassword, setToken } from "../lib/auth";
import { useLanguage } from "../context/LanguageContext";
import { ThemeLanguageToggle } from "./ThemeLanguageToggle";
import { BrandMark } from "./ui/brand";
import { Spinner } from "./ui/controls";

export default function LoginForm() {
  const router = useRouter();
  const { t } = useLanguage();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg(t("login_fields_required"));
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await login({ username: username.trim(), password, totp_code: totp || undefined });
      setToken(res.access_token);
      setMustChangePassword(Boolean(res.must_change_password));
      router.push(res.must_change_password ? "/dashboard/settings" : "/dashboard");
    } catch (err: any) {
      const msg = String(err?.message || "").toLowerCase();
      if (msg.includes("totp")) {
        setErrorMsg(t("totp_error"));
      } else if (msg.includes("invalid") || msg.includes("credentials") || msg.includes("password")) {
        setErrorMsg(t("user_or_pass_error"));
      } else {
        setErrorMsg(t("login_failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header data-tone="neutral" className="field pt-safe">
        <div className="page-body flex flex-col items-center pb-[72px] pt-14 text-center lg:pb-24 lg:pt-24">
          <BrandMark size={60} className="rounded-[18px]" />
          <h1 className="mt-4 text-[30px] font-bold leading-9 tracking-[-0.02em]">TG SignPulse</h1>
          <p className="on-field-2 mt-1 text-[15px]">{t("login_tagline")}</p>
          {/* 放大的品牌脉冲线：纯装饰，不用状态条，状态条只承载真实数据 */}
          <svg aria-hidden viewBox="0 0 360 40" fill="none" className="login-wave mt-6 h-10 w-full max-w-[360px]">
            <defs>
              <linearGradient id="login-wave-fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="360" y2="0">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.5" stopColor="#fff" stopOpacity="0.95" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 20H161l8.8-13 14.4 26 9.6-16.9 5.2 3.9H360"
              pathLength={1}
              stroke="url(#login-wave-fade)"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </header>

      <main className="page-body relative z-[1] -mt-10 flex-1 pb-8">
        <div className="mx-auto w-full max-w-[400px]">
          <form onSubmit={handleSubmit} noValidate>
            <div className="group-list shadow-lift">
              <div className="list-row field-row">
                <label htmlFor="login-username" className="sr-only">
                  {t("username")}
                </label>
                <input
                  id="login-username"
                  name="username"
                  className="field-input text-left"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("username")}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <div className="list-row field-row">
                <label htmlFor="login-password" className="sr-only">
                  {t("password")}
                </label>
                <input
                  id="login-password"
                  type="password"
                  name="password"
                  className="field-input text-left"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("password")}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="group-list mt-3">
              <div className="list-row field-row">
                <label htmlFor="login-totp" className="text-body">
                  {t("totp_short")}
                </label>
                <input
                  id="login-totp"
                  name="totp"
                  className="field-input num tracking-[0.2em] placeholder:tracking-normal"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder={t("totp_if_enabled")}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                />
              </div>
            </div>

            <div className="min-h-[44px] px-4 pt-2.5" aria-live="polite">
              {errorMsg ? (
                <p role="alert" className="flex items-start gap-1.5 text-footnote text-danger">
                  <WarningCircle size={16} weight="fill" className="mt-px flex-none" aria-hidden />
                  {errorMsg}
                </p>
              ) : null}
            </div>

            <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}>
              {loading ? <Spinner className="text-white" /> : null}
              {loading ? t("login_loading") : t("login")}
            </button>
          </form>
        </div>
      </main>

      <footer className="flex items-center justify-center gap-4 pb-safe pt-2">
        <div className="flex items-center gap-2 pb-4">
          <ThemeLanguageToggle />
          <a
            href="https://github.com/loochenx/TG-SignPulse"
            target="_blank"
            rel="noreferrer"
            className="icon-btn text-label-2"
            aria-label={t("github_repo")}
            title={t("github_repo")}
          >
            <GithubLogo size={19} weight="bold" aria-hidden />
          </a>
        </div>
      </footer>
    </div>
  );
}
