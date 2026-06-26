import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/Logo";
import { Eye, EyeOff, ArrowLeft, Mail, Lock, User, CheckCircle2, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const benefits = [
  "Membership is by invitation — your access key unlocks the platform",
  "Step-by-step hardware tutorials",
  "AI-powered code explanations",
  "Virtual simulations before real deployment"
];

export const Register = () => {
  const [accessKey, setAccessKey] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accessKey.trim()) {
      toast({
        title: "Access key required",
        description: "Enter the access key you were given to create an account.",
        variant: "destructive"
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive"
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    // Invite-only: accounts are created server-side and only with a valid key.
    const { data, error } = await supabase.functions.invoke("register-with-key", {
      body: { code: accessKey.trim(), email, password, full_name: name },
    });

    const fnError = error?.message || (data as { error?: string })?.error;

    if (fnError || !(data as { ok?: boolean })?.ok) {
      toast({
        title: "Registration Failed",
        description: fnError || "Could not create your account. Check your access key and try again.",
        variant: "destructive"
      });
      setIsLoading(false);
      return;
    }

    // Account created + activated server-side; sign in straight away.
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      toast({
        title: "Account created",
        description: "Your account is ready — please sign in.",
      });
      navigate("/login");
    } else {
      toast({ title: "Welcome!", description: "Your account is active." });
      navigate("/dashboard");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-hero circuit-pattern flex">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex flex-1 bg-gradient-dark items-center justify-center p-12">
        <div className="max-w-md">
          <Logo size="lg" className="mb-8 brightness-0 invert" />
          <h2 className="text-3xl font-bold mb-6 text-background">
            Start Building with Confidence
          </h2>
          <ul className="space-y-4">
            {benefits.map((benefit, index) => (
              <li key={index} className="flex items-start gap-3 text-background/80">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link 
            to="/" 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to home
          </Link>

          <div className="bg-card rounded-2xl shadow-xl p-8 border border-border">
            <div className="text-center mb-8 lg:hidden">
              <Logo size="lg" className="justify-center mb-6" />
            </div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold mb-2">Create your account</h1>
              <p className="text-muted-foreground">Enter the access key you were given to join</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="accessKey">Access key</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="accessKey"
                    type="text"
                    placeholder="Enter your access key"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                    className="pl-10 h-12 font-mono tracking-wide"
                    autoCapitalize="characters"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Don't have a key? Ask your administrator — accounts are by invitation only.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 h-12"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-12"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <p className="mt-6 text-xs text-center text-muted-foreground">
              By creating an account, you agree to our{" "}
              <a href="#" className="text-primary hover:underline">Terms of Service</a>
              {" "}and{" "}
              <a href="#" className="text-primary hover:underline">Privacy Policy</a>
            </p>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
