import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, ArrowRight, KeyRound, Loader2, Mail, ShieldCheck, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/dashboard") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message.replace(/^ConvexError:\s*/i, "");
  }
  return fallback;
}

function BrandMark() {
  return (
    <span className="flex h-11 w-10 shrink-0 items-center justify-center border border-[#D5B46A]/65 bg-[#101B16] font-display text-[23px] leading-none text-[#D5B46A]">
      N
    </span>
  );
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(searchParams.get("returnTo"), redirectAfterAuth);
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") ?? "").trim();
      await signIn("email-otp", formData);
      setStep({ email });
    } catch (submitError) {
      setError(authErrorMessage(submitError, "Failed to send the verification code. Try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signIn("email-otp", new FormData(event.currentTarget));
      navigate(redirect, { replace: true });
    } catch (submitError) {
      setError(
        authErrorMessage(submitError, "The verification code could not be confirmed. Try again."),
      );
      setOtp("");
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect, { replace: true });
    } catch (guestError) {
      setError(
        authErrorMessage(guestError, "Guest sign-in is unavailable right now. Please try again."),
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#0B1511] px-4 py-6 text-[#F1EAD8] sm:px-6 sm:py-8">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(85%_70%_at_50%_0%,rgba(213,180,106,0.14),transparent_60%),radial-gradient(70%_60%_at_85%_100%,rgba(37,99,235,0.08),transparent_62%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,#D5B46A66,transparent)]"
        aria-hidden="true"
      />

      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between">
        <Link
          to="/"
          className="group flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A]"
          aria-label="NAVODAYA: THE CAMPUS LIFE — home"
        >
          <BrandMark />
          <span className="leading-none">
            <span className="block font-display text-[17px] tracking-[0.12em] text-[#F1EAD8]">
              NAVODAYA
            </span>
            <span className="mt-1.5 block font-ui text-[7.5px] uppercase tracking-[0.3em] text-[#B4BBA9]">
              The Campus Life
            </span>
          </span>
        </Link>
        <span className="flex items-center gap-2 font-ui text-[8px] uppercase tracking-[0.22em] text-[#B4BBA9]">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7FAE84] opacity-50 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7FAE84]" />
          </span>
          Campus System Online
        </span>
      </header>

      <main className="relative flex flex-1 items-center justify-center py-10 sm:py-12">
        <div className="w-full max-w-[430px]">
          <div className="border border-[#F1EAD8]/12 bg-[#14231B]/95 p-6 shadow-[0_40px_100px_-50px_rgba(0,0,0,0.95)] sm:p-8">
            {authLoading ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                <Loader2
                  aria-hidden="true"
                  className="h-6 w-6 animate-spin text-[#D5B46A]"
                />
                <p className="mt-5 font-ui text-[9px] uppercase tracking-[0.26em] text-[#D5B46A]">
                  Restoring your session
                </p>
                <p className="mt-2 font-display text-2xl leading-tight text-[#F1EAD8]">
                  Welcome back to campus.
                </p>
              </div>
            ) : step === "signIn" ? (
              <>
                <div className="flex size-11 items-center justify-center rounded-full border border-[#D5B46A]/35 bg-[#D5B46A]/8 text-[#D5B46A]">
                  <KeyRound aria-hidden="true" className="h-5 w-5" />
                </div>
                <p className="mt-5 font-ui text-[9px] uppercase tracking-[0.28em] text-[#D5B46A]">
                  Campus account
                </p>
                <h1 className="mt-2 font-display text-[clamp(2rem,7vw,2.7rem)] leading-[1.02] text-[#F1EAD8]">
                  Sign in. Find your house.
                </h1>
                <p className="mt-3 font-ui text-[12px] leading-6 text-[#B4BBA9]">
                  Enter your email for a one-time code. Your house and saved progress stay tied to
                  the existing NAVODAYA player profile.
                </p>

                <form onSubmit={handleEmailSubmit} className="mt-6">
                  <label htmlFor="email" className="sr-only">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B4BBA9]/60"
                    />
                    <Input
                      id="email"
                      name="email"
                      placeholder="name@example.com"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      className="h-12 rounded-none border-[#F1EAD8]/16 bg-[#0B1511]/55 pl-10 font-ui text-[13px] text-[#F1EAD8] placeholder:text-[#B4BBA9]/35 focus-visible:border-[#D5B46A]/65 focus-visible:ring-[#D5B46A]/25"
                      disabled={isLoading}
                      required
                    />
                  </div>

                  {error && (
                    <p
                      role="alert"
                      className="mt-3 border border-[#E1A18F]/25 bg-[#E1A18F]/6 px-3 py-2.5 font-ui text-[11px] leading-5 text-[#E9B9AA]"
                    >
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2.5 border border-[#D5B46A] bg-[#D5B46A] px-5 font-ui text-[9px] font-semibold uppercase tracking-[0.24em] text-[#0B1511] transition-colors hover:border-[#E7CD94] hover:bg-[#E7CD94] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F1EAD8] disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                        Sending code
                      </>
                    ) : (
                      <>
                        Continue with email
                        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </form>

                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-[#F1EAD8]/10" />
                  <span className="font-ui text-[8px] uppercase tracking-[0.22em] text-[#B4BBA9]/50">
                    Or
                  </span>
                  <span className="h-px flex-1 bg-[#F1EAD8]/10" />
                </div>

                <button
                  type="button"
                  onClick={() => void handleGuestLogin()}
                  disabled={isLoading}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-[#F1EAD8]/16 px-5 font-ui text-[9px] uppercase tracking-[0.2em] text-[#F1EAD8] transition-colors hover:border-[#D5B46A]/55 hover:bg-[#D5B46A]/6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A] disabled:opacity-50"
                >
                  <UserX aria-hidden="true" className="h-3.5 w-3.5" />
                  Continue as Guest
                </button>

                <p className="mt-5 flex items-start gap-2 font-ui text-[9px] leading-5 text-[#B4BBA9]/55">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D5B46A]/70" />
                  No passwords or tokens are stored in this browser. Sign-in uses the existing
                  NAVODAYA authentication provider.
                </p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setStep("signIn");
                    setError(null);
                    setOtp("");
                  }}
                  className="inline-flex items-center gap-2 font-ui text-[9px] uppercase tracking-[0.2em] text-[#B4BBA9] transition-colors hover:text-[#F1EAD8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A]"
                >
                  <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                  Use a different email
                </button>

                <div className="mt-5 flex size-11 items-center justify-center rounded-full border border-[#D5B46A]/35 bg-[#D5B46A]/8 text-[#D5B46A]">
                  <Mail aria-hidden="true" className="h-5 w-5" />
                </div>
                <p className="mt-5 font-ui text-[9px] uppercase tracking-[0.28em] text-[#D5B46A]">
                  Check your inbox
                </p>
                <h1 className="mt-2 font-display text-[clamp(2rem,7vw,2.7rem)] leading-[1.02] text-[#F1EAD8]">
                  Enter your code.
                </h1>
                <p className="mt-3 break-words font-ui text-[12px] leading-6 text-[#B4BBA9]">
                  We sent a six-digit code to{" "}
                  <span className="text-[#F1EAD8]">{step.email}</span>.
                </p>

                <form onSubmit={handleOtpSubmit} className="mt-6">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />
                  <fieldset disabled={isLoading}>
                    <legend className="sr-only">Six-digit verification code</legend>
                    <div className="flex justify-center">
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        disabled={isLoading}
                        aria-label="Six-digit verification code"
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && otp.length === 6 && !isLoading) {
                            event.currentTarget.closest("form")?.requestSubmit();
                          }
                        }}
                      >
                        <InputOTPGroup className="gap-1.5">
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot
                              key={index}
                              index={index}
                              className="h-12 w-11 rounded-none border-[#F1EAD8]/16 bg-[#0B1511]/55 font-display text-xl text-[#F1EAD8] first:rounded-none last:rounded-none"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </fieldset>

                  {error && (
                    <p
                      role="alert"
                      className="mt-3 border border-[#E1A18F]/25 bg-[#E1A18F]/6 px-3 py-2.5 text-center font-ui text-[11px] leading-5 text-[#E9B9AA]"
                    >
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || otp.length !== 6}
                    className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2.5 border border-[#D5B46A] bg-[#D5B46A] px-5 font-ui text-[9px] font-semibold uppercase tracking-[0.24em] text-[#0B1511] transition-colors hover:border-[#E7CD94] hover:bg-[#E7CD94] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F1EAD8] disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                        Verifying code
                      </>
                    ) : (
                      <>
                        Verify and enter campus
                        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </form>

                <p className="mt-5 font-ui text-[9px] leading-5 text-[#B4BBA9]/55">
                  The code expires automatically. Nothing is saved to this browser beyond the
                  existing authenticated session.
                </p>
              </>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 px-1">
            <Link
              to="/"
              className="inline-flex items-center gap-2 font-ui text-[9px] uppercase tracking-[0.2em] text-[#B4BBA9] transition-colors hover:text-[#F1EAD8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D5B46A]"
            >
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
              Back to campus
            </Link>
            <span className="font-ui text-[8px] uppercase tracking-[0.18em] text-[#B4BBA9]/40">
              Existing account · Existing progress
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
