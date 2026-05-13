import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/Logo";
import { MailCheck, ArrowLeft } from "lucide-react";

export const VerifyEmail = () => {
  return (
    <div className="min-h-screen bg-gradient-hero circuit-pattern flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <Link 
          to="/" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to home
        </Link>

        <div className="bg-card rounded-2xl shadow-xl p-8 border border-border text-center">
          <Logo size="lg" className="justify-center mb-6" />
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <MailCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Check your email</h1>
          <p className="text-muted-foreground mb-6">
            We've sent a confirmation link to your email address.
            Click the link to verify your account, then come back and sign in.
          </p>
          <div className="space-y-3">
            <Button variant="hero" className="w-full" asChild>
              <Link to="/login">Go to Sign In</Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              Didn't receive an email? Check your spam folder or{" "}
              <a href="/register" className="text-primary hover:underline">try again</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
