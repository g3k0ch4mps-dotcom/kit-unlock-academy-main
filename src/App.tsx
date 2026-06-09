import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AIChat } from "@/components/ai/AIChat";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Programs = lazy(() => import("./pages/Programs"));
const ProgramView = lazy(() => import("./pages/ProgramView"));
const SessionView = lazy(() => import("./pages/SessionView"));
const Profile = lazy(() => import("./pages/Profile"));
const Admin = lazy(() => import("./pages/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TestView = lazy(() => import("./pages/TestView"));
const Store = lazy(() => import("./pages/Store"));
const Redeem = lazy(() => import("./pages/Redeem"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const AdminSetup = lazy(() => import("./pages/AdminSetup"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AIChat />
        <BrowserRouter>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-background"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/programs" element={
                <ProtectedRoute>
                  <Programs />
                </ProtectedRoute>
              } />
              <Route path="/programs/:id" element={
                <ProtectedRoute>
                  <ProgramView />
                </ProtectedRoute>
              } />
              <Route path="/programs/:programId/session/:sessionId" element={
                <ProtectedRoute>
                  <SessionView />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="/kits" element={
                <ProtectedRoute>
                  <Programs />
                </ProtectedRoute>
              } />
              <Route path="/store" element={
                <ProtectedRoute>
                  <Store />
                </ProtectedRoute>
              } />
              <Route path="/redeem" element={
                <ProtectedRoute>
                  <Redeem />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute requireInstructor>
                  <Admin />
                </ProtectedRoute>
              } />
               <Route path="/test/:testId" element={
                 <ProtectedRoute>
                   <TestView />
                 </ProtectedRoute>
               } />
              {/* Admin setup — not behind ProtectedRoute so Google OAuth redirect works */}
              <Route path="/admin-setup" element={<AdminSetup />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
