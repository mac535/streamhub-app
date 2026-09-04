import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

/**
 * Route guard component.
 * Redirects unauthenticated users to portal page.
 * Optionally restricts access to specific roles.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 bg-primary-container rounded-xl flex items-center justify-center animate-pulse">
            <span
              className="material-symbols-outlined text-on-primary-container text-2xl"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 700, 'GRAD' 0, 'opsz' 24" }}
            >
              hub
            </span>
          </div>
          <p className="text-sm font-bold uppercase tracking-widest text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Force password reset redirect
  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // Check role-based access
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center animate-fade-in-up">
        <div className="w-20 h-20 bg-error-container/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-error text-4xl">lock</span>
        </div>
        <h2
          className="text-2xl font-bold text-on-surface mb-3"
          style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
        >
          Access Restricted
        </h2>
        <p className="text-secondary mb-6">
          You don't have permission to access this page. Contact an administrator if you believe this is an error.
        </p>
        <Navigate to="/dashboard" replace />
      </div>
    );
  }

  return children;
}
