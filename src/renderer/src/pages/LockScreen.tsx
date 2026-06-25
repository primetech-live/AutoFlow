/// <reference types="vite/client" />
import React, { useState } from "react";

declare global {
  interface Window {
    autoflow: any;
  }
}
import { WarningIcon } from "../components/Icons";
import appIcon from "../../assets/icon-1.png";
import darkBg from "../../assets/dark_bg.png";
import lightBg from "../../assets/light_bg.png";
import { PasswordInput } from "../components/PasswordInput";
import { useTheme } from "../contexts/ThemeContext";

interface LockScreenProps {
  onUnlockSuccess: () => void;
  onResetRequest?: () => void;
}

const LockIconSvg = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const ShieldIconSvg = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const LockScreen: React.FC<LockScreenProps> = ({
  onUnlockSuccess,
  onResetRequest,
}) => {
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      setError("Please enter a valid 6-digit OTP token.");
      setLoading(false);
      return;
    }
    try {
      const success = await window.autoflow.unlockVault(password, otp);
      if (success) {
        onUnlockSuccess();
      } else {
        setError("Invalid master password or OTP token.");
      }
    } catch (err: any) {
      setError(err.message || "Verification failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Theme-aware tokens ── */
  const cardBg = isDark
    ? "rgba(10, 14, 30, 0.82)"
    : "rgba(255, 255, 255, 0.82)";
  const cardBorder = isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.3)";
  const txtMain = isDark ? "#f0f4ff" : "#0f172a";
  const txtSub = isDark ? "#94a3b8" : "#475569";
  const txtMuted = isDark ? "#64748b" : "#94a3b8";
  const divider = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const inputBg = isDark ? "rgba(0, 0, 0, 0.2)" : "rgba(255,255,255,0.7)";
  const inputBorder = isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.3)";

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* ── Full-screen background image ── */}
      <img
        src={isDark ? darkBg : lightBg}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          zIndex: 0,
          display: "block",
        }}
      />

      {/* ── Floating glassmorphic card — right side ── */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          right: "6%",
          transform: "translateY(-50%)",
          width: "min(460px, 88%)",
          zIndex: 2,
          background: cardBg,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: `1px solid ${cardBorder}`,
          borderRadius: "24px",
          padding: "32px 40px",
          boxSizing: "border-box",
          boxShadow: isDark
            ? "0 32px 80px rgba(0,0,0,0.75), inset 0 0 0 1px rgba(59,130,246,0.15), 0 0 40px rgba(59,130,246,0.1)"
            : "0 24px 64px rgba(0,0,0,0.14), inset 0 0 0 1px rgba(59,130,246,0.3), 0 0 40px rgba(59,130,246,0.1)",
        }}
      >
        {/* Brand header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <img
            src={appIcon}
            alt="AutoFlow"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              boxShadow: isDark
                ? "0 0 20px rgba(59,130,246,0.45), 0 8px 16px rgba(0,0,0,0.6)"
                : "0 4px 16px rgba(59,130,246,0.22)",
            }}
          />
          <div>
            <div
              style={{
                fontSize: "20px",
                fontWeight: 900,
                color: txtMain,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              AutoFlow
            </div>
            <div
              style={{
                fontSize: "12px",
                color: txtMuted,
                fontWeight: 600,
                marginTop: "2px",
              }}
            >
              vNext Platform
            </div>
          </div>
        </div>

        {/* Welcome heading */}
        <h2
          style={{
            fontSize: "32px",
            fontWeight: 800,
            color: txtMain,
            margin: "0 0 6px",
            letterSpacing: "-0.03em",
          }}
        >
          Welcome Back
        </h2>
        <p
          style={{
            fontSize: "14.5px",
            color: txtSub,
            margin: "0 0 20px",
            lineHeight: "1.5",
          }}
        >
          Unlock the platform by entering your master password and 2FA authentication token.
        </p>

        {/* Error banner */}
        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#ef4444",
              padding: "12px 16px",
              borderRadius: "12px",
              fontSize: "14px",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <WarningIcon size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Master Password */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 600,
                color: txtSub,
                marginBottom: "10px",
              }}
            >
              Master Password
            </label>
            <div
              style={{
                background: inputBg,
                border: `1px solid ${inputBorder}`,
                borderRadius: "10px",
                overflow: "hidden",
                height: "50px",
                display: "flex",
                alignItems: "center",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(6,182,212,0.6)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(6,182,212,0.15)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = inputBorder;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ width: "100%", padding: "0 14px" }}>
                  <PasswordInput
                    className=""
                    required
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: "100%",
                      height: "48px",
                      background: "transparent",
                      border: "none",
                      boxShadow: "none",
                      outline: "none",
                      color: txtMain,
                      fontSize: "15px",
                      fontFamily: "inherit",
                    }}
                  />
              </div>
            </div>
          </div>

          {/* OTP */}
          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 600,
                color: txtSub,
                marginBottom: "10px",
              }}
            >
              Authenticator OTP Token
            </label>
            <input
              type="text"
              required
              maxLength={6}
              pattern="\d{6}"
              placeholder="1 2 3 4 5 6"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              onFocus={(e) => {
                e.target.style.borderColor = "rgba(6,182,212,0.6)";
                e.target.style.boxShadow = "0 0 0 3px rgba(6,182,212,0.15)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = inputBorder;
                e.target.style.boxShadow = "none";
              }}
              style={{
                width: "100%",
                height: "50px",
                padding: "0 16px",
                background: inputBg,
                border: `1px solid ${inputBorder}`,
                borderRadius: "10px",
                letterSpacing: "0.45em",
                textAlign: "center",
                fontSize: "20px",
                fontWeight: 700,
                color: txtMain,
                boxSizing: "border-box",
                outline: "none",
                fontFamily: "inherit",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              }}
            />
          </div>

          {/* Unlock button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              height: "50px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              background: loading
                ? "rgba(59,130,246,0.5)"
                : "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
              color: "#ffffff",
              border: "none",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              boxShadow: loading ? "none" : "0 8px 32px rgba(6,182,212,0.4)",
              transition: "opacity 0.2s ease, box-shadow 0.2s ease",
              letterSpacing: "0.02em",
              marginBottom: "12px",
            }}
          >
            <LockIconSvg />
            {loading ? "Verifying..." : "Unlock Platform"}
          </button>

          {/* Forgot password */}
          {onResetRequest && (
            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onResetRequest?.();
                }}
                style={{
                  fontSize: "13px",
                  color: txtMuted,
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Forgot password? Reset everything
              </a>
            </div>
          )}
        </form>

        {/* Footer */}
        <div
          style={{
            borderTop: `1px solid ${divider}`,
            paddingTop: "16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: txtMuted,
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          <ShieldIconSvg />
          AutoFlow automatically locks after 15 minutes of inactivity.
        </div>
      </div>
    </div>
  );
};
