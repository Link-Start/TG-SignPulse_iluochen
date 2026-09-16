"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 任务列表已合并到首页，旧地址保留跳转 */
export default function SignTasksRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/dashboard${window.location.search}`);
  }, [router]);

  return null;
}
