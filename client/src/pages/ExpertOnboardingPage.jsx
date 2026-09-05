import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function ExpertOnboardingPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [expertDetails, setExpertDetails] = useState(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    phone: '',
    address: '',
    username: '',
    password: '',
    confirmPassword: '',
    whatsappJoined: false
  });

  useEffect(() => {
    api.get(`/admin/onboard/${token}`)
      .then(res => {
        setExpertDetails(res.data);
      })
      .catch(err => {
        setError('This invitation link is invalid or has already been used.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const isExpert = expertDetails?.role !== 'ADMIN';
    if (isExpert && !formData.whatsappJoined) {
      setError('You must confirm that you have joined the WhatsApp group.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/admin/onboard/${token}`, formData);
      setSuccess(true);
      setTimeout(() => navigate('/portal'), 3000);
    } catch (err) {
      setError('Failed to complete onboarding. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error && !expertDetails) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl max-w-md w-full shadow-lg text-center">
          <span className="material-symbols-outlined text-6xl text-error mb-4">error</span>
          <h2 className="text-2xl font-bold mb-2">Invalid Invite</h2>
          <p className="text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  const roleTitle = expertDetails?.role === 'ADMIN' ? 'System Administrator' : 'STREAM Expert';

  if (success) {
    return (
      <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center p-4">
        <div className="bg-white p-12 rounded-3xl max-w-lg w-full shadow-2xl text-center animate-fade-in-up">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-5xl text-green-600">check_circle</span>
          </div>
          <h2 className="text-4xl tracking-wide text-on-surface mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            Welcome Aboard!
          </h2>
          <p className="text-secondary font-medium">Your {roleTitle} account is now fully activated. Redirecting you to the login portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfbf7] py-12 px-4 flex items-center justify-center relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-primary/5 rounded-full blur-[100px] pointer-events-none transform translate-x-1/3 -translate-y-1/3"></div>
      
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-xl overflow-hidden relative z-10 animate-fade-in-up">
        
        <div className="bg-primary px-8 py-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIj48L3JlY3Q+CjxwYXRoIGQ9Ik0wIDBMOCA4Wk04IDBMMCA4WiIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjEiPjwvcGF0aD4KPC9zdmc+')] mix-blend-overlay"></div>
          <h1 className="text-4xl text-on-primary tracking-widest relative z-10" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            {expertDetails?.role === 'ADMIN' ? 'Administrator Onboarding' : 'Expert Onboarding'}
          </h1>
          <p className="text-primary-container relative z-10 mt-2 font-medium">
            Complete your profile to activate your {roleTitle} account
          </p>
        </div>

        <div className="p-8 md:p-12">
          <div className="bg-surface-container-low rounded-2xl p-6 mb-8 border border-outline/10 text-center">
            <div className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary mb-2">
              {roleTitle}
            </div>
            <p className="text-2xl font-bold text-on-surface">{expertDetails.name}</p>
            <p className="text-primary font-medium">{expertDetails.email}</p>
            {expertDetails.username && (
              <p className="text-secondary text-sm mt-1 font-bold">Username: {expertDetails.username}</p>
            )}
          </div>

          {error && (
            <div className="mb-8 p-4 rounded-xl bg-error/10 text-error text-sm font-bold flex items-center gap-2">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-secondary mb-1">Phone Number</label>
                <input required name="phone" onChange={handleChange} type="tel" className="w-full bg-surface-container border border-outline/20 rounded-xl px-4 py-3 focus:border-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-secondary mb-1">Username</label>
                <input required name="username" onChange={handleChange} type="text" className="w-full bg-surface-container border border-outline/20 rounded-xl px-4 py-3 focus:border-primary outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-secondary mb-1">Residential Address</label>
              <textarea required name="address" onChange={handleChange} className="w-full bg-surface-container border border-outline/20 rounded-xl px-4 py-3 focus:border-primary outline-none resize-none h-24" />
            </div>

            <div>
              <label className="block text-sm font-bold text-secondary mb-1">Profile Photo</label>
              <input type="file" accept="image/*" className="w-full bg-surface-container border border-outline/20 rounded-xl px-4 py-2 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-outline/10">
              <div>
                <label className="block text-sm font-bold text-secondary mb-1">Set Password</label>
                <input required name="password" onChange={handleChange} type="password" minLength={6} className="w-full bg-surface-container border border-outline/20 rounded-xl px-4 py-3 focus:border-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-secondary mb-1">Confirm Password</label>
                <input required name="confirmPassword" onChange={handleChange} type="password" minLength={6} className="w-full bg-surface-container border border-outline/20 rounded-xl px-4 py-3 focus:border-primary outline-none" />
              </div>
            </div>

            {/* WhatsApp Integration - Expert only */}
            {expertDetails?.role !== 'ADMIN' && (
              <div className="mt-8 bg-green-50 border border-green-200 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-10 h-10 shrink-0" />
                  <div>
                    <h4 className="font-bold text-green-900 mb-1">Official Communications Group</h4>
                    <p className="text-sm text-green-800 mb-4">You must join the official STREAM Experts WhatsApp group to receive announcements and updates.</p>
                    
                    <a href="https://chat.whatsapp.com/example_invite_link" target="_blank" rel="noopener noreferrer" className="inline-block bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-full transition-colors text-sm mb-6 shadow-md">
                      Join WhatsApp Group
                    </a>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          name="whatsappJoined" 
                          onChange={handleChange}
                          className="peer appearance-none w-5 h-5 border-2 border-green-600 rounded checked:bg-green-600 checked:border-green-600 transition-all cursor-pointer"
                        />
                        <span className="material-symbols-outlined text-white absolute text-sm opacity-0 peer-checked:opacity-100 pointer-events-none">done</span>
                      </div>
                      <span className="text-sm font-bold text-green-900 group-hover:text-green-700 transition-colors">
                        Yes, I have successfully joined the WhatsApp group.
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <button type="submit" disabled={submitting} className="w-full mt-8 py-4 bg-primary text-on-primary font-bold rounded-xl shadow-lg hover:shadow-primary/30 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none text-lg tracking-wide uppercase">
              {submitting ? 'Activating Account...' : 'Activate My Account'}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
