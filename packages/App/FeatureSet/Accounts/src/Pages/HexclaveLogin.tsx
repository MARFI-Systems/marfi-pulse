import React from "react";
import { HexclaveClientApp } from "@hexclave/js";
import { DASHBOARD_URL, env } from "Common/UI/Config";
import Navigation from "Common/UI/Utils/Navigation";
import UserUtil from "Common/UI/Utils/User";
import marfiLogo from "../Images/marfi-logo.png";
import syneFont from "../Fonts/syne-500-700-latin.woff2";
import monoFont from "../Fonts/dm-mono-500-latin.woff2";

const HEXCLAVE_API_ORIGIN: string = "https://apigcp.hexclave.com";
const ALLOWED_EMAIL_DOMAIN: string = "marfi.io";
const RESEND_SECONDS: number = 180;
const EXCHANGE_PATH: string = "/api/identity/hexclave/exchange";

const isAllowedEmail: (address: string) => boolean = (
  address: string,
): boolean => {
  const at: number = address.lastIndexOf("@");
  return at > 0 && address.slice(at + 1).toLowerCase() === ALLOWED_EMAIL_DOMAIN;
};

const formatCountdown: (seconds: number) => string = (
  seconds: number,
): string => {
  const minutes: number = Math.floor(seconds / 60);
  const remainder: number = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const HexclaveLogin: () => JSX.Element = () => {
  if (UserUtil.isLoggedIn()) {
    Navigation.navigate(DASHBOARD_URL);
  }

  const projectId: string = env("HEXCLAVE_PROJECT_ID");
  const publishableClientKey: string = env("HEXCLAVE_PUBLISHABLE_CLIENT_KEY");
  const signInPath: string = "/accounts/login";
  const callbackUrl: string = `${window.location.origin}${signInPath}`;

  const app: React.MutableRefObject<HexclaveClientApp | null> = React.useRef(
    null,
  );
  if (!app.current && projectId && publishableClientKey) {
    app.current = new HexclaveClientApp({
      baseUrl: HEXCLAVE_API_ORIGIN,
      projectId,
      publishableClientKey,
      tokenStore: "memory",
      analytics: {
        enabled: false,
      },
      urls: {
        signIn: signInPath,
        afterSignIn: signInPath,
        magicLinkCallback: signInPath,
        mfa: signInPath,
        error: signInPath,
      },
    });
  }

  const emailInput: React.RefObject<HTMLInputElement> = React.useRef(
    null,
  );
  const [email, setEmail] = React.useState<string>("");
  const [code, setCode] = React.useState<string>("");
  const [otpNonce, setOtpNonce] = React.useState<string>("");
  const [step, setStep] = React.useState<"email" | "code">("email");
  const [message, setMessage] = React.useState<string>("");
  const [busy, setBusy] = React.useState<boolean>(false);
  const [resendRemaining, setResendRemaining] = React.useState<number>(0);

  React.useEffect(() => {
    if (resendRemaining <= 0) {
      return;
    }
    const timer: number = window.setInterval(() => {
      setResendRemaining((value: number) => Math.max(0, value - 1));
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [resendRemaining]);

  const readEmail: () => string = (): string => {
    const fromInput: string = (emailInput.current?.value || "").trim();
    if (fromInput && fromInput !== email.trim()) {
      setEmail(fromInput);
    }
    return fromInput || email.trim();
  };

  const sendCode: () => Promise<void> = async (): Promise<void> => {
    const address: string = readEmail();
    if (!address) {
      setMessage("Enter your email.");
      return;
    }
    if (!isAllowedEmail(address)) {
      setMessage(`Only existing @${ALLOWED_EMAIL_DOMAIN} identities can sign in.`);
      return;
    }
    if (!app.current) {
      setMessage("Sign-in is not configured.");
      return;
    }
    setBusy(true);
    setMessage("Sending code...");
    try {
      const result: any = await app.current.sendMagicLinkEmail(address, {
        callbackUrl,
      });
      if (result?.status === "error") {
        throw result.error || new Error("Could not send a code.");
      }
      const nonce: string =
        (result && result.data && result.data.nonce) || "";
      setOtpNonce(nonce);
      setCode("");
      setStep("code");
      setMessage("");
      setResendRemaining(RESEND_SECONDS);
    } catch (_err) {
      setMessage("Could not send a code. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode: () => Promise<void> = async (): Promise<void> => {
    if (!app.current) {
      setMessage("Sign-in is not configured.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const otp: string = code.trim();
      const fullCode: string = otpNonce ? otp + otpNonce : otp;
      const result: any = await app.current.signInWithMagicLink(fullCode, {
        noRedirect: true,
      });
      if (result?.status === "error") {
        setMessage("That code was not accepted. Request a new one.");
        return;
      }
      const accessToken: string | null = await app.current.getAccessToken();
      if (!accessToken) {
        setMessage("Sign-in was not accepted.");
        return;
      }
      const response: globalThis.Response = await fetch(EXCHANGE_PATH, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessToken }),
      });
      if (!response.ok) {
        setMessage("Sign-in was not accepted.");
        return;
      }
      window.location.assign(DASHBOARD_URL.toString());
    } catch (_err) {
      setMessage("Sign-in was not accepted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="marfi-auth-page">
      <style>{`
        @font-face {
          font-family: 'MARFI Auth Syne';
          font-style: normal;
          font-weight: 500 700;
          font-display: swap;
          src: url(${JSON.stringify(syneFont)}) format('woff2');
        }
        @font-face {
          font-family: 'MARFI Auth Mono';
          font-style: normal;
          font-weight: 500;
          font-display: swap;
          src: url(${JSON.stringify(monoFont)}) format('woff2');
        }
        .marfi-auth-page {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          min-height: 100svh;
          padding: 0 clamp(24px, 5vw, 84px);
          color: #f2eee7;
          background: radial-gradient(ellipse at 15% 45%, #141823 0, transparent 56%), #08090d;
          color-scheme: dark;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .marfi-auth-page *, .marfi-auth-page *::before, .marfi-auth-page *::after { box-sizing: border-box; }
        .marfi-auth-page a:focus-visible, .marfi-auth-page button:focus-visible { outline: 2px solid #99e7df; outline-offset: 5px; }
        .marfi-auth-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          height: 88px;
          flex-shrink: 0;
          border-bottom: 1px solid rgba(255, 255, 255, .14);
        }
        .marfi-auth-brand { display: inline-flex; align-items: center; gap: 12px; color: #f2eee7; font: 700 17px 'MARFI Auth Syne', sans-serif; letter-spacing: .18em; text-decoration: none; }
        .marfi-auth-brand img { width: 36px; height: 36px; }
        .marfi-auth-back { color: #999ba5; font: 500 10px 'MARFI Auth Mono', monospace; letter-spacing: .07em; text-transform: uppercase; text-decoration: none; }
        .marfi-auth-back:hover { color: #f2eee7; }
        .marfi-auth-main { display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 8vw; flex: 1; padding: 64px 0; }
        .marfi-auth-lockup { font: 500 clamp(64px, 8.2vw, 132px)/.94 'MARFI Auth Syne', sans-serif; letter-spacing: -.055em; }
        .marfi-auth-lockup span { display: block; }
        .marfi-auth-lockup span:last-child { color: #ff5362; }
        .marfi-auth-card { width: 100%; max-width: 460px; justify-self: end; padding: clamp(24px, 3vw, 42px); border: 1px solid rgba(255, 255, 255, .14); background: #101219; }
        .marfi-auth-card h1 { margin: 0 0 12px; color: #f2eee7; text-align: left; font: 500 32px/1.15 'MARFI Auth Syne', sans-serif; letter-spacing: -.035em; }
        .marfi-auth-card p.lede { margin: 0 0 28px; color: #b9bac1; font-size: 14px; }
        .marfi-auth-card label { display: block; color: #b9bac1; font: 500 10px/1.5 'MARFI Auth Mono', monospace; letter-spacing: .07em; padding: 10px 0; text-transform: uppercase; }
        .marfi-auth-card input {
          width: 100%;
          height: 48px;
          border: 1px solid rgba(255, 255, 255, .2);
          border-radius: 0;
          padding: 12px 14px;
          color: #f2eee7;
          background: #08090d;
          font-size: 15px;
        }
        .marfi-auth-card input:focus { border-color: #ff5362; outline: 1px solid #ff5362; outline-offset: 2px; }
        .marfi-auth-card button.primary {
          width: 100%;
          min-height: 48px;
          margin-top: 16px;
          border: 1px solid #de3c4b;
          border-radius: 0;
          color: #08090d;
          background: #de3c4b;
          font: 500 11px 'MARFI Auth Mono', monospace;
          letter-spacing: .07em;
          text-transform: uppercase;
          cursor: pointer;
        }
        .marfi-auth-card button.primary:hover { color: #ff5362; background: transparent; border-color: #ff5362; }
        .marfi-auth-card button.primary:disabled { opacity: .6; cursor: not-allowed; }
        .marfi-auth-card button.linkish {
          width: 100%;
          margin-top: 12px;
          border: 0;
          background: transparent;
          color: #b9bac1;
          font-size: 12px;
          text-underline-offset: 3px;
          cursor: pointer;
        }
        .marfi-auth-card button.linkish:hover { color: #f2eee7; text-decoration: underline; }
        .marfi-auth-card button.linkish:disabled { color: #666; cursor: not-allowed; text-decoration: none; }
        .marfi-auth-card .error { margin-top: 16px; color: #ff5362; font-size: 13px; }
        .marfi-auth-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 18px 30px; padding: 22px 0; border-top: 1px solid rgba(255, 255, 255, .14); color: #999ba5; font: 500 10px/1.7 'MARFI Auth Mono', monospace; }
        .marfi-auth-footer nav { display: flex; gap: 24px; }
        .marfi-auth-footer a { color: #b9bac1; text-decoration: underline; text-underline-offset: 3px; }
        .marfi-auth-footer a:hover { color: #f2eee7; }
        .marfi-auth-attribution { margin-left: auto; }
        @media (max-width: 760px) {
          .marfi-auth-header { height: 76px; }
          .marfi-auth-main { grid-template-columns: 1fr; gap: 36px; padding: 40px 0; }
          .marfi-auth-lockup { font-size: clamp(48px, 13vw, 76px); }
          .marfi-auth-lockup span { display: inline; }
          .marfi-auth-card { max-width: none; }
          .marfi-auth-footer { font-size: 9px; }
        }
      `}</style>
      <header className="marfi-auth-header">
        <a className="marfi-auth-brand" href="https://marfi.ai" aria-label="MARFI home">
          <img src={marfiLogo} alt="" width="36" height="36" />
          <span>MARFI</span>
        </a>
        <a className="marfi-auth-back" href="https://marfi.ai">
          Back to MARFI
        </a>
      </header>
      <main className="marfi-auth-main">
        <div className="marfi-auth-lockup" aria-hidden="true">
          <span>MARFI</span>
          <span>Pulse</span>
        </div>
        <section className="marfi-auth-card" aria-label="Account sign-in">
          <h1>Sign in</h1>
          <p className="lede">We will email you a one-time code. No password.</p>
          {step === "email" ? (
            <>
              <form
                onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  void sendCode();
                }}
              >
                <label htmlFor="marfi-pulse-email">Email</label>
                <input
                  id="marfi-pulse-email"
                  ref={emailInput}
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setEmail(event.target.value);
                  }}
                />
                <button type="submit" className="primary" disabled={busy}>
                  Email me a code
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="lede">
                Enter the code we emailed to {email.trim()}. Do not change the
                capitalization.
              </p>
              <label htmlFor="marfi-pulse-code">Code</label>
              <input
                id="marfi-pulse-code"
                type="text"
                autoComplete="one-time-code"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={code}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  setCode(event.target.value);
                }}
              />
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() => {
                  void verifyCode();
                }}
              >
                Continue
              </button>
              <button
                type="button"
                className="linkish"
                disabled={busy || resendRemaining > 0}
                onClick={() => {
                  void sendCode();
                }}
              >
                {resendRemaining > 0
                  ? `Send a new code in ${formatCountdown(resendRemaining)}`
                  : "Send a new code"}
              </button>
            </>
          )}
          {message ? <p className="error">{message}</p> : <></>}
        </section>
      </main>
      <footer className="marfi-auth-footer">
        <nav aria-label="Legal and security">
          <a href="https://marfi.ai/legal/privacy/" target="_blank" rel="noopener">
            Privacy
          </a>
          <a href="https://marfi.ai/legal/terms/" target="_blank" rel="noopener">
            Terms
          </a>
          <a href="https://trust.marfi.io/monitoring" target="_blank" rel="noopener">
            Security
          </a>
        </nav>
        <span className="marfi-auth-attribution">
          <a href="https://oneuptime.com" target="_blank" rel="noopener">
            OneUptime
          </a>
        </span>
      </footer>
    </div>
  );
};

export default HexclaveLogin;
