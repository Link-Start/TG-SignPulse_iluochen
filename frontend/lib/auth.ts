const TOKEN_KEY = "tg-signer-token";
const MUST_CHANGE_PASSWORD_KEY = "tg-signer-must-change-password";

export const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
};

/** 登录时后端提示仍在使用默认密码，改密成功前一直提醒 */
export const getMustChangePassword = (): boolean => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUST_CHANGE_PASSWORD_KEY) === "1";
};

export const setMustChangePassword = (value: boolean) => {
  if (typeof window === "undefined") return;
  if (value) localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, "1");
  else localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
};

export const logout = () => {
  clearToken();
  if (typeof window !== "undefined") {
    // 强制刷新到登录页
    window.location.href = "/";
  }
};

