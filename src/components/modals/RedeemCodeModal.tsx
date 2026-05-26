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
  Link2Off,
  WifiOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useXP } from "@/hooks/use-xp";

interface RedeemCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCodeRedeemed?: (programId: string, programTitle: string) => void;
}

type RedeemState = "idle" | "loading" | "success" | "error";

type ErrorKind =
  | "not_found"
  | "already_used"
  | "expired"
  | "already_has_access"
  | "no_program"
  | "network"
  | "generic";

interface ErrorInfo {
  kind: ErrorKind;
  message: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  canRetry: boolean;
}

const ERROR_MAP: Record<ErrorKind, Omit<ErrorInfo, "kind">> = {
  not_found: {
    message: "Code not found",
    hint: "Double-check for typos — codes are case-insensitive. Make sure you're using the full code from your kit.",
    icon: AlertCircle,
    canRetry: true,
  },
  already_used: {
    message: "Code already redeemed",
    hint: "This single-use code was already used by another account. Contact support if you believe this is a mistake.",
    icon: ShieldOff,
    canRetry: false,
  },
  expired: {
    message: "Code has expired",
    hint: "This code is past its validity date. Contact support to get a replacement code.",
    icon: TimerOff,
    canRetry: false,
  },
  already_has_access: {
    message: "You already have access",
    hint: "Your account already has full access to this program. Head to your dashboard to continue learning.",
    icon: UserCheck,
    canRetry: false,
  },
  no_program: {
    message: "Code not linked to a program",
    hint: "This code exists but isn't connected to any program yet. Please contact support.",
    icon: Link2Off,
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

export const RedeemCodeModal = ({
  isOpen,
  onClose,
  onCodeRedeemed,
}: RedeemCodeModalProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { awardXP } = useXP();
  const [code, setCode] = useState("");
  const [state, setState] = useState<RedeemState>("idle");
  const [errorKind, setErrorKind] = useState<ErrorKind>("generic");
  const [redeemedProgramId, setRedeemedProgramId] = useState<string | null>(null);
  const [redeemedProgramTitle, setRedeemedProgramTitle] = useState("");

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
      toast({
        title: "Not logged in",
        description: "Please log in before redeeming a code.",
        variant: "destructive",
      });
      return;
    }

    setState("loading");

    try {
      const normalizedCode = code.toUpperCase().trim();

      // 1. Look up the code
      const { data: unlockCode, error: findError } = await supabase
        .from("unlock_codes")
        .select("id, program_id, kit_id, xp_reward, is_used, expires_at")
        .eq("code", normalizedCode)
        .maybeSingle();

      if (findError) {
        console.error("DB error looking up code:", findError);
        toast({ title: "Network error", description: "Failed to look up code. Please try again.", variant: "destructive" });
        setError("network");
        return;
      }

      if (!unlockCode) {
        setError("not_found");
        return;
      }

      if (unlockCode.is_used) {
        setError("already_used");
        return;
      }

      if (unlockCode.expires_at && new Date(unlockCode.expires_at) < new Date()) {
        setError("expired");
        return;
      }

      // 2. Resolve program from code or kit
      let programId = unlockCode.program_id;
      let programTitle = "";

      if (programId) {
        const { data: prog } = await supabase
          .from("programs")
          .select("id, title")
          .eq("id", programId)
          .maybeSingle();
        programTitle = prog?.title || "Program";
      } else if (unlockCode.kit_id) {
        const { data: prog } = await supabase
          .from("programs")
          .select("id, title")
          .eq("kit_id", unlockCode.kit_id)
          .limit(1)
          .maybeSingle();
        if (!prog) {
          setError("no_program");
          return;
        }
        programId = prog.id;
        programTitle = prog.title;
      } else {
        setError("no_program");
        return;
      }

      // 3. Check existing access
      const { data: existingAccess } = await supabase
        .from("user_program_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("program_id", programId)
        .maybeSingle();

      if (existingAccess) {
        setError("already_has_access");
        return;
      }

      // 4. Mark code as used
      const { error: updateError } = await supabase
        .from("unlock_codes")
        .update({
          is_used: true,
          redeemed_by: user.id,
          redeemed_at: new Date().toISOString(),
        })
        .eq("id", unlockCode.id);

      if (updateError) {
        console.error("Failed to mark code used:", updateError);
        toast({ title: "Network error", description: "Failed to redeem code. Please try again.", variant: "destructive" });
        setError("network");
        return;
      }

      // 5a. Award XP if code has xp_reward
      if (unlockCode.xp_reward) {
        await awardXP(user.id, unlockCode.xp_reward, `Redeemed code: ${normalizedCode}`, "redeem_code", unlockCode.id);
      }

      // 5b. Grant program access (if linked to a program)
      if (programId) {
        const { error: accessError } = await supabase
          .from("user_program_access")
          .insert({
            user_id: user.id,
            program_id: programId,
            unlock_code_id: unlockCode.id,
          });

        if (accessError) {
          console.error("Failed to grant access:", accessError);
          toast({ title: "Network error", description: "Failed to grant program access. Please try again.", variant: "destructive" });
          setError("network");
          return;
        }
      }

      setRedeemedProgramId(programId);
      setRedeemedProgramTitle(programTitle || (unlockCode.xp_reward ? `+${unlockCode.xp_reward} XP` : ""));
      setState("success");

      // Notify parent so it can refresh state without full reload
      onCodeRedeemed?.(programId, programTitle);

      toast({
        title: "🎉 Code Redeemed!",
        description: `You now have full access to "${programTitle}".`,
      });
    } catch (error) {
      console.error("Unexpected redemption error:", error);
      toast({ title: "Unexpected error", description: "Something went wrong. Please try again.", variant: "destructive" });
      setError("generic");
    }
  };

  const handleStartLearning = () => {
    if (redeemedProgramId) {
      handleClose();
      navigate(`/programs/${redeemedProgramId}`);
    }
  };

  const handleClose = () => {
    setCode("");
    setState("idle");
    setErrorKind("generic");
    setRedeemedProgramId(null);
    setRedeemedProgramTitle("");
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {/* ── Success State ── */}
        {state === "success" ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <DialogTitle className="mb-2 text-xl">
              {redeemedProgramId ? "Program Unlocked!" : "XP Awarded!"}
            </DialogTitle>
            <DialogDescription className="mb-2">
              {redeemedProgramId ? (
                <>You now have full access to{" "}
                  <span className="font-semibold text-foreground">{redeemedProgramTitle}</span>.
                </>
              ) : (
                <span className="font-semibold text-foreground text-lg">{redeemedProgramTitle}</span>
              )}
            </DialogDescription>
            <p className="text-xs text-muted-foreground mb-6">
              {redeemedProgramId ? "All sessions are now unlocked and ready for you." : "The XP has been added to your account."}
            </p>
            {redeemedProgramId ? (
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
            {errorKind === "already_has_access" && redeemedProgramId ? (
              <Button
                variant="hero"
                className="w-full"
                onClick={() => {
                  handleClose();
                  navigate(`/programs/${redeemedProgramId}`);
                }}
              >
                Go to Program
              </Button>
            ) : (
              <Button variant="outline" className="w-full" onClick={handleClose}>
                Close
              </Button>
            )}
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
                Enter the single-use code that came with your hardware kit to unlock
                all sessions.
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

                {/* Inline error feedback */}
                {state === "error" && (
                  <div className="flex items-start gap-2 rounded-lg bg-destructive/8 border border-destructive/20 p-3">
                    <ErrorIcon className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-destructive">
                        {errorInfo.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {errorInfo.hint}
                      </p>
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
                Each code can only be used once and binds to your account permanently.
                Make sure you're logged into the correct account.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RedeemCodeModal;
