import React from "react";
import { HexclaveClientApp } from "@hexclave/js";
import OneUptimeLogo from "Common/UI/Images/logos/OneUptimeSVG/3-transparent.svg";
import { DASHBOARD_URL, IDENTITY_URL, env } from "Common/UI/Config";
import Route from "Common/Types/API/Route";
import URL from "Common/Types/API/URL";
import Navigation from "Common/UI/Utils/Navigation";
import UserUtil from "Common/UI/Utils/User";

const HEXCLAVE_API_ORIGIN: string = "https://apigcp.hexclave.com";
const ALLOWED_EMAIL_DOMAIN: string = "marfi.io";
const RESEND_SECONDS: number = 180;
const EXCHANGE_URL: URL = URL.fromURL(IDENTITY_URL).addRoute(
  new Route("/hexclave/exchange"),
);

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
      tokenStore: "cookie",
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

  const [email, setEmail] = React.useState<string>("");
  const [code, setCode] = React.useState<string>("");
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

  const sendCode: () => Promise<void> = async (): Promise<void> => {
    const address: string = email.trim();
    if (!isAllowedEmail(address)) {
      setMessage(`Only existing @${ALLOWED_EMAIL_DOMAIN} identities can sign in.`);
      return;
    }
    if (!app.current) {
      setMessage("Hexclave login is not configured.");
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
      setMessage("Hexclave login is not configured.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result: any = await app.current.signInWithMagicLink(code, {
        noRedirect: true,
      });
      if (result?.status === "error") {
        throw result.error || new Error("Code not accepted.");
      }
      const accessToken: string | null = await app.current.getAccessToken();
      if (!accessToken) {
        throw new Error("The provider did not issue an access token.");
      }
      const response: globalThis.Response = await fetch(EXCHANGE_URL.toString(), {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        throw new Error("Sign-in was not accepted.");
      }
      window.location.assign(DASHBOARD_URL.toString());
    } catch (_err) {
      setMessage("Sign-in was not accepted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img
          className="mx-auto h-12 w-auto"
          src={OneUptimeLogo}
          alt="MARFI Pulse"
        />
        <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">
          Sign in to MARFI Pulse
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          We will email you a one-time code.
        </p>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {step === "email" ? (
            <>
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                value={email}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  setEmail(event.target.value);
                }}
              />
              <button
                type="button"
                disabled={busy}
                className="mt-4 w-full rounded-md bg-indigo-600 px-3 py-2 text-white disabled:opacity-50"
                onClick={() => {
                  void sendCode();
                }}
              >
                Email me a code
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Enter the code we emailed to {email.trim()}. Do not change the
                capitalization.
              </p>
              <input
                type="text"
                autoComplete="one-time-code"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="mt-3 block w-full rounded-md border border-gray-300 px-3 py-2"
                value={code}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  setCode(event.target.value);
                }}
              />
              <button
                type="button"
                disabled={busy}
                className="mt-4 w-full rounded-md bg-indigo-600 px-3 py-2 text-white disabled:opacity-50"
                onClick={() => {
                  void verifyCode();
                }}
              >
                Continue
              </button>
              <button
                type="button"
                disabled={busy || resendRemaining > 0}
                className="mt-2 w-full text-sm text-indigo-600 disabled:text-gray-400"
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
          {message ? (
            <p className="mt-4 text-sm text-red-600">{message}</p>
          ) : (
            <></>
          )}
        </div>
      </div>
    </div>
  );
};

export default HexclaveLogin;
