import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import api from '../lib/api';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from the current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword });
      if (updateUser) {
        updateUser({ mustChangePassword: false });
      }
      // Navigate to dashboard after successful password change
      const destination = user?.role === 'EXPERT' ? '/expert' 
        : user?.role === 'ADMIN' ? '/admin' 
        : user?.role === 'STREAM_LAB' ? '/hub' 
        : user?.role === 'CREATIVE_CORNER' ? '/cc'
        : '/dashboard';
      navigate(destination, { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to change password. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="fixed inset-0 bg-[#fdfbf7] flex items-center justify-center p-4 z-50">
      {/* Background pattern */}
      <div
        className="fixed inset-0 pointer-events-none -z-10 bg-no-repeat bg-cover bg-center opacity-50"
        style={{ backgroundImage: "url('/background-pattern.png')" }}
      />

      <div className="w-full max-w-md animate-fade-in-up">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-black/[0.04] p-8 md:p-10">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center">
              <span
                className="material-symbols-outlined text-4xl text-amber-600"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 600, 'GRAD' 0, 'opsz' 48" }}
              >
                lock_reset
              </span>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1
              className="text-2xl md:text-3xl font-black text-on-surface tracking-tight mb-2"
              style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
            >
              Change Your Password
            </h1>
            <p className="text-secondary text-sm leading-relaxed">
              For security, you need to set a new password before continuing.
            </p>
            {user?.name && (
              <p className="text-xs text-secondary/70 mt-2 font-medium">
                Logged in as <span className="text-on-surface font-bold">{user.name}</span>
              </p>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-bold text-secondary mb-2 uppercase tracking-wider">
                Current Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary/50 text-xl">
                  lock
                </span>
                <input
                  id="current-password"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-surface-container-low border border-outline/20 rounded-xl pl-12 pr-12 py-4 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-secondary/50 text-xl">
                    {showCurrent ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-secondary mb-2 uppercase tracking-wider">
                New Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary/50 text-xl">
                  lock_open
                </span>
                <input
                  id="new-password"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  className="w-full bg-surface-container-low border border-outline/20 rounded-xl pl-12 pr-12 py-4 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-secondary/50 text-xl">
                    {showNew ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-bold text-secondary mb-2 uppercase tracking-wider">
                Confirm New Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-secondary/50 text-xl">
                  check_circle
                </span>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full bg-surface-container-low border border-outline/20 rounded-xl pl-12 pr-12 py-4 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                />
                {confirmPassword && newPassword === confirmPassword && (
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-green-500 text-xl">
                    check
                  </span>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-error-container/30 border border-error/20 rounded-xl px-4 py-3 animate-fade-in">
                <p className="text-error text-sm font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  {error}
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-xl bg-on-surface text-surface font-bold text-base shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">refresh</span>
                  Updating...
                </>
              ) : (
                <>
                  Set New Password
                  <span className="material-symbols-outlined text-lg">east</span>
                </>
              )}
            </button>

            {/* Logout option */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-bold uppercase tracking-widest text-secondary/50 hover:text-error transition-colors hover:underline"
              >
                Sign Out Instead
              </button>
            </div>
          </form>
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-secondary/40 mt-6 font-medium">
          STREAM Ecosystem • Creative Corner
        </p>
      </div>
    </div>
  );
}
