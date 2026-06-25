import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ShieldOff,
  TimerOff,
  UserCheck,
  WifiOff,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface RedeemCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCodeRedeemed?: (programId: string | null, programTitle: string) => void;
}

type RedeemState = "idle" | "loading" | "success" | "error";

type ErrorKind =
  | "not_found"
  | "already_redeemed"
  | "used_up"
  | "expired"
  | "network"
  | "generic";

interface ErrorInfo {
  message: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  canRetry: boolean;
}

const ERROR_MAP: Record<ErrorKind, ErrorInfo> = {
  not_found: {
    message: "Code not found",
    hint: "Double-check for typos — codes are case-insensitive. Make sure you're using the full code you were given.",
    icon: AlertCircle,
    canRetry: true,
  },
  already_redeemed: {
    message: "You've already redeemed this code",
    hint: "This code is already on your account. Head to your dashboard to continue — if your access expired, ask for a fresh code.",
    icon: UserCheck,
    canRetry: false,
  },
  used_up: {
    message: "Code fully used",
    hint: "This code has reached its maximum number of redemptions. Contact your instructor for another one.",
    icon: ShieldOff,
    canRetry: false,
  },
  expired: {
    message: "Code has expired",
    hint: "This code is past its validity date and can no longer be redeemed. Ask for a replacement code.",
    icon: TimerOff,
    canRetry: false,
  },
  network: {
    message: "Connection error",
    hint: "We couldn't reach the server. Check your internet connection and try again.",
    icon: WifiOff,
    canRetry: true,
  },
  generic: {
    message: "Something went wrong",
    hint: "An unexpected error occurred. Please try again in a moment.",
    icon: AlertCircle,
    canRetry: true,
  },
};

interface RedeemResult {
  ok: boolean;
  error?: string;
  scope?: "program" | "sessions";
  program_id?: string | null;
  session_titles?: string[];
  xp_reward?: number | null;
  access_expires_at?: string | null;
}

const ERROR_KINDS: ErrorKind[] = ["not_found", "already_redeemed", "used_up", "expired", "network", "generic"];
const toErrorKind = (code: string | undefined): ErrorKind =>
  (ERROR_KINDS.includes(code as ErrorKind) ? code : "generic") as ErrorKind;

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  const days = Math.max(0, Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  return `${days} day${days !== 1 ? "s" : ""} (until ${date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })})`;
}

export const RedeemCodeModal = ({
  isOpen,
  onClose,
  onCodeRedeemed,
}: RedeemCodeModalProps) => {
  const navigate = useNavigate();
  const { user, refreshAccountStatus } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [state, setState] = useState<RedeemState>("idle");
  const [errorKind, setErrorKind] = useState<ErrorKind>("generic");
  const [result, setResult] = useState<RedeemResult | null>(null);

  const setError = (kind: ErrorKind) => {
    setErrorKind(kind);
    setState("error");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      setError("not_found");
      return;
    }
    if (!user) {
      toast({ title: "Not logged in", description: "Please log in before redeeming a code.", variant: "destructive" });
      return;
    }

    setState("loading");

    try {
      const normalizedCode = code.toUpperCase().trim();

      // One atomic server-side call: validates, grants scoped/expiring access,
      // awards XP, counts the use — all race-free.
      const { data, error } = await supabase.rpc("redeem_unlock_code", { p_code: normalizedCode });

      if (error) {
        console.error("redeem_unlock_code error:", error);
        setError("network");
        return;
      }

      const res = data as RedeemResult;

      if (!res?.ok) {
        setError(toErrorKind(res?.error));
        return;
      }

      setResult(res);
      setState("success");
      // Redeeming activates a pending account — refresh status so the
      // membership gate lets the user out of the lobby immediately.
      await refreshAccountStatus();
      onCodeRedeemed?.(res.program_id ?? null, "");

      toast({ title: "🎉 Code Redeemed!", description: "Your access has been unlocked." });
    } catch (err) {
      console.error("Unexpected redemption error:", err);
      setError("generic");
    }
  };

  const handleStartLearning = () => {
    const programId = result?.program_id;
    handleClose();
    if (programId) navigate(`/programs/${programId}`);
  };

  const handleClose = () => {
    setCode("");
    setState("idle");
    setErrorKind("generic");
    setResult(null);
    onClose();
  };

  const handleRetry = () => {
    setState("idle");
    setErrorKind("generic");
  };

  const formatCode = (value: string) =>
    value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);

  const errorInfo = ERROR_MAP[errorKind];
  const ErrorIcon = errorInfo?.icon ?? AlertCircle;

  const moduleCount = result?.session_titles?.length ?? 0;
  const isSessionScope = result?.scope === "sessions";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {/* ── Success State ── */}
        {state === "success" && result ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <DialogTitle className="mb-2 text-xl">
              {isSessionScope ? "Modules Unlocked!" : result.program_id ? "Program Unlocked!" : "Code Redeemed!"}
            </DialogTitle>
            <DialogDescription className="mb-3">
              {isSessionScope
                ? `You now have access to ${moduleCount} module${moduleCount !== 1 ? "s" : ""}.`
                : result.program_id
                  ? "You now have full access to this program."
                  : "Your reward has been applied."}
            </DialogDescription>

            {/* Module list */}
            {isSessionScope && moduleCount > 0 && (
              <ul className="text-left text-sm bg-muted/50 rounded-lg p-3 mb-3 space-y-1 max-h-40 overflow-y-auto">
                {result.session_titles!.map((title, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                    <span>{title}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* XP reward */}
            {result.xp_reward ? (
              <p className="text-sm font-medium text-yellow-600 mb-2">+{result.xp_reward} XP added</p>
            ) : null}

            {/* Access expiry */}
            {result.access_expires_at ? (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-6">
                <Clock className="h-3.5 w-3.5" />
                <span>Access expires in {formatExpiry(result.access_expires_at)}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mb-6">This access does not expire.</p>
            )}

            {result.program_id ? (
              <Button variant="hero" onClick={handleStartLearning} className="w-full">
                Start Learning →
              </Button>
            ) : (
              <Button variant="hero" onClick={handleClose} className="w-full">
                Done
              </Button>
            )}
          </div>
        ) : state === "error" && !errorInfo.canRetry ? (
          /* ── Non-retryable Error State ── */
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <ErrorIcon className="h-8 w-8 text-destructive" />
            </div>
            <DialogTitle className="mb-2 text-xl">{errorInfo.message}</DialogTitle>
            <DialogDescription className="mb-6 text-sm leading-relaxed">
              {errorInfo.hint}
            </DialogDescription>
            <Button variant="outline" className="w-full" onClick={handleClose}>
              Close
            </Button>
          </div>
        ) : (
          /* ── Idle / Loading / Retryable Error State ── */
          <>
            <DialogHeader>
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
                <Key className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-center">Redeem Unlock Code</DialogTitle>
              <DialogDescription className="text-center">
                Enter the code you were given to unlock your modules.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="unlock-code">Unlock Code</Label>
                <Input
                  id="unlock-code"
                  type="text"
                  placeholder="e.g., MAMUZA-XXXX-XXXX-XXXX-XXXX"
                  value={code}
                  onChange={(e) => {
                    setCode(formatCode(e.target.value));
                    if (state === "error") handleRetry();
                  }}
                  className={`h-12 text-center font-mono text-lg tracking-wider ${
                    state === "error" ? "border-destructive focus-visible:ring-destructive" : ""
                  }`}
                  disabled={state === "loading"}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={32}
                />

                {state === "error" && (
                  <div className="flex items-start gap-2 rounded-lg bg-destructive/8 border border-destructive/20 p-3">
                    <ErrorIcon className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-destructive">{errorInfo.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{errorInfo.hint}</p>
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                variant="hero"
                className="w-full"
                disabled={state === "loading" || !code.trim()}
              >
                {state === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : state === "error" && errorInfo.canRetry ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </>
                ) : (
                  "Redeem Code"
                )}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-center text-muted-foreground">
                Make sure you're logged into the correct account. Access may be time-limited
                depending on your code.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RedeemCodeModal;
