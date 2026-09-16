"use client";

import { useEffect, useState } from "react";
import LoginForm from "../components/login-form";
import { getToken } from "../lib/auth";

export default function Home() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 已登录直接进入首页，未登录才显示登录表单
    if (getToken()) {
      window.location.replace("/dashboard");
      return;
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  return <LoginForm />;
}
