import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireInstructor?: boolean;
}

export const ProtectedRoute = ({ 
  children, 
  requireAdmin = false,
  requireInstructor = false 
}: ProtectedRouteProps) => {
  const { user, isLoading, isAdmin, isInstructor, accountStatus } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Membership gate: a signed-in but not-yet-activated account is held in the
  // redeem "lobby" until it enters a valid access key. Staff bypass the gate.
  if (
    accountStatus === "pending" &&
    !isAdmin &&
    !isInstructor &&
    location.pathname !== "/redeem"
  ) {
    return <Navigate to="/redeem" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireInstructor && !isAdmin && !isInstructor) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
