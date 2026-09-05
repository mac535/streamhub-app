import { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import api from '../lib/api';

const PORTALS = [
  { role: 'ADMIN', label: 'Admin', icon: 'admin_panel_settings', defaultEmail: '', defaultPassword: '' },
  { role: 'EXPERT', label: 'STREAM Expert', icon: 'school', defaultEmail: '', defaultPassword: '' },
  { role: 'STREAM_LAB', label: 'STREAM Hub', icon: 'biotech', defaultEmail: '', defaultPassword: '', isHub: true },
  { role: 'ILAB', label: 'iLab Corner', icon: 'computer', defaultEmail: '', defaultPassword: '' },
  { role: 'CREATIVE_CORNER', label: 'Creative Corner', icon: 'auto_awesome', defaultEmail: '', defaultPassword: '', isCreativeCorner: true },
];

export default function PortalPage() {
  const navigate = useNavigate();
  const { login, logout, isAuthenticated } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPortal, setSelectedPortal] = useState(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const portalGridRef = useRef(null);

  // Forgot password state
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(null);
  const [rememberMe, setRememberMe] = useState(false);

  // Automatically logout if arriving at the portal page while authenticated
  useEffect(() => {
    if (isAuthenticated) {
      logout();
    }
  }, [isAuthenticated, logout]);

  const openLoginModal = (portal) => {
    setSelectedPortal(portal);
    const savedId = localStorage.getItem(`stream_login_${portal.role}_id`);
    const savedPwd = localStorage.getItem(`stream_login_${portal.role}_pwd`);
    
    if (savedId && savedPwd) {
      setIdentifier(savedId);
      setPassword(savedPwd);
      setRememberMe(true);
    } else {
      if (portal.isHub || portal.isCreativeCorner) {
        const storageKey = portal.isHub ? 'stream_hub_code' : 'stream_cc_code';
        const savedCode = localStorage.getItem(storageKey) || '';
        setIdentifier(savedCode);
        setPassword('');
      } else {
        setIdentifier(portal.defaultEmail || '');
        setPassword(portal.defaultPassword || '');
      }
      setRememberMe(false);
    }
    setError('');
    setIsModalOpen(true);
  };

  const closeLoginModal = () => {
    setIsModalOpen(false);
    setError('');
    setIsForgotPassword(false);
    setForgotEmail('');
    setForgotSuccess(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    setIsLoading(true);
    try {
      const userData = await login(identifier, password);
      
      // Enforce portal-role restriction on login
      if (selectedPortal && userData.role !== selectedPortal.role) {
        logout();
        setError(`Access Denied: This credentials belong to a ${userData.role} account, which does not have access to the ${selectedPortal.label} portal.`);
        return;
      }

      if (rememberMe) {
        localStorage.setItem(`stream_login_${selectedPortal.role}_id`, identifier);
        localStorage.setItem(`stream_login_${selectedPortal.role}_pwd`, password);
      } else {
        localStorage.removeItem(`stream_login_${selectedPortal.role}_id`);
        localStorage.removeItem(`stream_login_${selectedPortal.role}_pwd`);
      }

      // Save code for auto-fill on next login
      if (selectedPortal?.isHub) {
        localStorage.setItem('stream_hub_code', identifier);
      }
      if (selectedPortal?.isCreativeCorner) {
        localStorage.setItem('stream_cc_code', identifier);
      }

      // If user must change password on first login, redirect to change-password page
      if (userData.mustChangePassword) {
        navigate('/change-password');
        return;
      }

      // Route to role-specific dashboard
      const destination = userData.role === 'EXPERT' ? '/expert' 
        : userData.role === 'ADMIN' ? '/admin' 
        : userData.role === 'STREAM_LAB' ? '/hub' 
        : userData.role === 'CREATIVE_CORNER' ? '/cc'
        : '/dashboard';
      navigate(destination);
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setForgotSuccess(null);
    if (!forgotEmail.trim()) {
      setError('Please enter your email.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: forgotEmail });
      const data = res.data?.data || {};
      if (data.emailSent === false && data.link) {
        setForgotSuccess(`Email disabled. Manual reset link: ${data.link}`);
      } else {
        setForgotSuccess('Password reset link has been sent to your email.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process password reset request.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#fdfbf7]">
      {/* Background Layer */}
      <div
        className="fixed inset-0 pointer-events-none -z-10 bg-no-repeat bg-cover bg-center"
        style={{
          backgroundImage: "url('/background-pattern.png')",
        }}
      />

      {/* Main Page Content */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-500 ${
          isModalOpen ? 'blur-[10px] scale-[0.98]' : ''
        }`}
      >
        <Header
          transparent
          onSignInClick={() => portalGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        />

        <main className="flex-grow pt-24 pb-12 px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto flex flex-col items-center justify-center w-full">
          {/* Hero Section */}
          <section className="text-center mb-8 md:mb-12 animate-fade-in-up">
            <h1
              className="text-3xl md:text-4xl lg:text-5xl mb-4 text-on-surface tracking-tight font-black"
              style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}
            >
              Sign in to your portal
            </h1>
            <p className="text-base md:text-lg text-secondary max-w-2xl mx-auto font-normal leading-relaxed">
              Select your role to access the STREAM Ecosystem
            </p>
          </section>

          {/* Portal Grid */}
          <div ref={portalGridRef} className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6 mb-8 md:mb-12" id="portal-selector">
            {PORTALS.map((portal, index) => (
              <button
                key={portal.role}
                className="login-card group rounded-2xl p-6 md:p-8 lg:p-6 xl:p-8 flex flex-col items-center text-center animate-fade-in-up"
                style={{ animationDelay: `${index * 0.08}s` }}
                onClick={() => openLoginModal(portal)}
                id={`portal-${portal.role.toLowerCase()}`}
              >
                <div className="icon-container w-12 h-12 md:w-14 md:h-14 bg-surface-container-low flex items-center justify-center rounded-2xl mb-4 md:mb-6 transition-all duration-300">
                  <span
                    className="material-symbols-outlined text-4xl md:text-5xl text-on-surface font-bold"
                    style={{ fontVariationSettings: "'FILL' 0, 'wght' 700, 'GRAD' 0, 'opsz' 48" }}
                  >
                    {portal.icon}
                  </span>
                </div>
                <h3 className="text-lg md:text-xl xl:text-2xl font-black text-on-surface">{portal.label}</h3>
              </button>
            ))}
          </div>
        </main>

        <Footer />
      </div>

      {/* Login Modal */}
      <Modal isOpen={isModalOpen} onClose={closeLoginModal}>
        <div className="flex justify-between items-start mb-8">
          <h2 className="text-2xl font-black text-on-surface uppercase tracking-tight font-display">
            {isForgotPassword ? 'Reset Password' : `${selectedPortal?.label} Login`}
          </h2>
          <button
            className="w-8 h-8 flex items-center justify-center hover:bg-surface-container rounded-full transition-all"
            onClick={closeLoginModal}
          >
            <span className="material-symbols-outlined text-xl text-on-surface/60">close</span>
          </button>
        </div>

        {isForgotPassword ? (
          <div className="animate-fade-in">
            {forgotSuccess ? (
              <div className="bg-success-container/30 border border-success/20 rounded-xl p-6 text-center">
                <span className="material-symbols-outlined text-4xl text-success mb-2">check_circle</span>
                <p className="text-on-surface font-medium mb-4">{forgotSuccess}</p>
                <Button onClick={closeLoginModal} className="w-full">Close</Button>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleForgotPassword}>
                <p className="text-on-surface/70 text-sm mb-4">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                <Input
                  id="forgot-email"
                  label="Email Address"
                  type="email"
                  icon="mail"
                  placeholder="Enter your email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  autoFocus
                />
                {error && (
                  <div className="bg-error-container/30 border border-error/20 rounded-xl px-4 py-3 animate-fade-in">
                    <p className="text-error text-sm font-medium flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">error</span>
                      {error}
                    </p>
                  </div>
                )}
                {forgotSuccess && (
                  <div className="bg-green-100 border border-green-200 rounded-xl px-4 py-3 animate-fade-in">
                    <p className="text-green-800 text-sm font-medium flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">check_circle</span>
                      {forgotSuccess}
                    </p>
                  </div>
                )}
                <div className="flex flex-col gap-3 mt-4">
                  <Button type="submit" loading={isLoading}>
                    Send Reset Link
                  </Button>
                  <button
                    type="button"
                    className="btn-ghost underline"
                    onClick={() => { setIsForgotPassword(false); setError(''); }}
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleLogin}>
            <Input
              id="login-identifier"
              label={(selectedPortal?.isHub || selectedPortal?.isCreativeCorner) ? 'School Code' : 'Username / Email'}
              type="text"
              icon={(selectedPortal?.isHub || selectedPortal?.isCreativeCorner) ? 'tag' : 'alternate_email'}
              placeholder={(selectedPortal?.isHub) ? 'Enter your BRC Hub Code' : selectedPortal?.isCreativeCorner ? 'Enter your UDISE+CC Code' : 'Enter your unique ID'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoFocus
            />

            <Input
              id="login-password"
              label="Password"
              type="password"
              icon="lock_open"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                id="remember-me"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-primary bg-surface-container border-on-surface/20 rounded focus:ring-primary focus:ring-2 cursor-pointer"
              />
              <label htmlFor="remember-me" className="text-sm text-secondary font-medium cursor-pointer select-none">
                Remember me
              </label>
            </div>

            {error && (
              <div className="bg-error-container/30 border border-error/20 rounded-xl px-4 py-3 animate-fade-in">
                <p className="text-error text-sm font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  {error}
                </p>
              </div>
            )}



            <div className="flex flex-col gap-3 mt-4">
              <Button type="submit" loading={isLoading}>
                Sign In
                <span className="material-symbols-outlined text-xl">east</span>
              </Button>
              <button
                type="button"
                className="btn-ghost underline"
                onClick={closeLoginModal}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {!isForgotPassword && (
          <div className="mt-8 pt-6 border-t border-black/[0.03] flex justify-center">
            <button
              onClick={() => { setIsForgotPassword(true); setError(''); }}
              className="text-xs font-bold uppercase tracking-widest text-secondary/50 hover:text-primary transition-colors hover:underline"
            >
              Forgot Password?
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
