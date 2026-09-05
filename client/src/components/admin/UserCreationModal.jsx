import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../../lib/api';

export default function UserCreationModal({ type, entityName, onClose }) {
  const isUserType = type === 'experts' || type === 'admins';
  const [formData, setFormData] = useState({
    roleType: type === 'admins' ? 'admins' : 'experts'
  });
  const [experts, setExperts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [generatedLink, setGeneratedLink] = useState(null);

  // Confirmation Modal state for Universal User Onboarding
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingInvite, setPendingInvite] = useState(null);
  const [dispatching, setDispatching] = useState(false);

  // Auto-suggest BRC state
  const [brcSearch, setBrcSearch] = useState('');
  const [showBrcSuggestions, setShowBrcSuggestions] = useState(false);
  const brcWrapperRef = useRef(null);

  const [brcs, setBrcs] = useState([]);
  const districts = Array.from(new Set(brcs.map(b => b.district).filter(Boolean))).sort();

  // Filter BRCs dynamically by the selected District for cascading dropdowns
  const availableBrcs = formData.district
    ? brcs.filter(b => (b.district || '').toUpperCase() === (formData.district || '').toUpperCase())
    : [];
  
  const availableLocations = Array.from(
    new Set(availableBrcs.map(b => b.location).filter(Boolean))
  ).sort();

  useEffect(() => {
    api.get('/brcs')
      .then(res => setBrcs(res.data))
      .catch(console.error);

    if (type === 'labs') {
      api.get('/admin/users/experts')
        .then(res => setExperts(res.data))
        .catch(console.error);
    }
  }, [type]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (brcWrapperRef.current && !brcWrapperRef.current.contains(event.target)) {
        setShowBrcSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExpertSelect = (expertId) => {
    const expert = experts.find(e => e.id === expertId);
    setFormData(prev => ({
      ...prev,
      expertId,
      district: expert?.district || prev.district
    }));
  };

  const handleDistrictChange = (e) => {
    const newDistrict = e.target.value;
    setFormData(prev => ({
      ...prev,
      district: newDistrict,
      location: '', // Reset location when district changes
      brcCode: ''
    }));
  };

  const handleLocationChange = (e) => {
    const loc = e.target.value;
    const matchedBrc = availableBrcs.find(b => b.location === loc);
    setFormData(prev => ({
      ...prev,
      location: loc,
      brcCode: matchedBrc?.code || prev.brcCode || '',
      // Auto-suggest hub name if none entered yet
      name: prev.name ? prev.name : (matchedBrc?.name || '')
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    // For Hubs, iLabs, Creative Corners
    if (type === 'labs' || type === 'ilabs' || type === 'creative_corners') {
      if (formData.password && formData.password !== formData.confirmPassword) {
        setFeedback({ type: 'error', text: 'Passwords do not match!' });
        return;
      }

      setLoading(true);
      try {
        await api.post(`/admin/users/${type}`, formData);
        setFeedback({ type: 'success', text: `${entityName} successfully registered!` });
        setTimeout(onClose, 1500);
      } catch (err) {
        const errorMsg = err.response?.data?.message || 'Registration failed. Try again.';
        setFeedback({ type: 'error', text: errorMsg });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Universal User Onboarding (Admin & Expert)
    if (isUserType) {
      if (!formData.name?.trim() || !formData.email?.trim()) {
        setFeedback({ type: 'error', text: 'Full Name and Email Address are required.' });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        setFeedback({ type: 'error', text: 'Please enter a valid email address.' });
        return;
      }

      setLoading(true);
      try {
        const targetRoleType = formData.roleType || type;
        // Step 1: Pre-generate unique role-specific registration link on backend without dispatching email
        const res = await api.post(`/admin/users/${targetRoleType}`, {
          name: formData.name.trim(),
          email: formData.email.trim(),
          sendEmail: false
        });

        setPendingInvite(res.data);
        // Intercept action and show confirmation notification modal: "Continue sending? Yes / No"
        setConfirmModalOpen(true);
      } catch (err) {
        const errorMsg = err.response?.data?.message || 'Failed to prepare invitation. Please check the email.';
        setFeedback({ type: 'error', text: errorMsg });
      } finally {
        setLoading(false);
      }
    }
  };

  // Confirmation Action: "No"
  const handleConfirmNo = () => {
    setConfirmModalOpen(false);
    setFeedback({
      type: 'info',
      text: 'Email dispatch cancelled. You can review or edit the details below.'
    });
  };

  // Confirmation Action: "Yes"
  const handleConfirmYes = async () => {
    if (!pendingInvite?.token) return;
    setDispatching(true);
    try {
      // Step 2: Trigger the email dispatch from backend via support@stream.net.in
      const res = await api.post('/admin/users/dispatch-invite', {
        token: pendingInvite.token
      });

      setConfirmModalOpen(false);
      setGeneratedLink(res.data.inviteLink || pendingInvite.inviteLink);
      setFeedback({
        type: 'success',
        text: res.data.message || 'Invitation email dispatched successfully via support@stream.net.in!'
      });
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Email dispatch failed, but registration link was preserved.';
      setConfirmModalOpen(false);
      setGeneratedLink(pendingInvite.inviteLink);
      setFeedback({ type: 'error', text: errorMsg });
    } finally {
      setDispatching(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose}></div>
      
      {/* Confirmation Notification Modal: "Continue sending? Yes / No" */}
      {confirmModalOpen && pendingInvite && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-2xl" onClick={handleConfirmNo}></div>
          <div className="relative bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up border border-outline/20 p-8 flex flex-col items-center text-center">
            
            <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-5 ring-8 ring-primary/5">
              <span className="material-symbols-outlined text-4xl">mark_email_read</span>
            </div>

            <h3 className="text-2xl font-black text-on-surface mb-2 tracking-tight">
              Confirm Email Dispatch
            </h3>
            
            <p className="text-secondary text-sm mb-6 leading-relaxed">
              The role-specific registration link has been generated. Ready to dispatch the welcome email via official support channels.
            </p>

            <div className="w-full bg-surface-container-low rounded-2xl p-5 border border-outline/15 text-left mb-6 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-secondary uppercase tracking-wider">Target User</span>
                <span className="font-extrabold text-on-surface">{pendingInvite.name}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-secondary uppercase tracking-wider">Email Address</span>
                <span className="font-semibold text-primary">{pendingInvite.email}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-secondary uppercase tracking-wider">Assigned Role</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary-container text-on-primary-container">
                  {pendingInvite.role === 'ADMIN' ? 'System Administrator' : 'STREAM Expert'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-outline/10 pt-2.5">
                <span className="font-bold text-secondary uppercase tracking-wider">Sent From</span>
                <span className="font-mono text-secondary font-bold">support@stream.net.in</span>
              </div>
            </div>

            {/* Crucial Confirmation Banner */}
            <div className="w-full bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-6">
              <p className="text-base font-black text-primary tracking-wide uppercase">
                Continue sending? Yes / No
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 w-full">
              <button
                type="button"
                id="btn-confirm-no"
                onClick={handleConfirmNo}
                disabled={dispatching}
                className="flex-1 py-3 px-6 rounded-xl border border-outline/30 text-secondary hover:text-on-surface hover:bg-surface-container font-bold transition-all disabled:opacity-50 text-sm tracking-wide"
              >
                No (Cancel)
              </button>
              <button
                type="button"
                id="btn-confirm-yes"
                onClick={handleConfirmYes}
                disabled={dispatching}
                className="flex-1 py-3 px-6 rounded-xl bg-primary text-on-primary font-bold shadow-lg shadow-primary/25 hover:opacity-95 transition-all disabled:opacity-50 text-sm tracking-wide flex items-center justify-center gap-2"
              >
                {dispatching ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">send</span>
                    <span>Yes (Send Email)</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      <div className="relative bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[85vh]">
        <div className="bg-primary px-8 py-6 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-2xl text-on-primary tracking-wide" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              {isUserType ? 'Universal User Onboarding' : `Register ${entityName}`}
            </h3>
            <p className="text-on-primary/80 text-sm">
              {isUserType 
                ? 'Invite a new System Administrator or STREAM Expert to join the platform.' 
                : 'Fill in the details below to create a new record.'}
            </p>
          </div>
          <button onClick={onClose} className="text-on-primary/80 hover:text-white transition-colors bg-white/10 p-2 rounded-full">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-grow">
          {feedback && (
            <div className={`mb-6 p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${
              feedback.type === 'error' ? 'bg-error/10 text-error' : feedback.type === 'info' ? 'bg-blue-50 text-blue-700' : 'bg-green-100 text-green-700'
            }`}>
              <span className="material-symbols-outlined text-lg">
                {feedback.type === 'error' ? 'error' : feedback.type === 'info' ? 'info' : 'check_circle'}
              </span>
              {feedback.text}
            </div>
          )}

          {generatedLink ? (
            <div className="flex flex-col items-center justify-center py-8 animate-fade-in-up text-center">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 ring-8 ring-green-50">
                <span className="material-symbols-outlined text-3xl">mark_email_read</span>
              </div>
              <h4 className="text-xl font-bold mb-2">Invitation Successfully Processed!</h4>
              <p className="text-secondary mb-6 text-sm max-w-md">
                The role-specific registration link has been generated. The recipient can use this form to complete their profile and set their password:
              </p>
              
              <div className="flex w-full bg-surface-container border border-outline/20 rounded-xl overflow-hidden mb-4">
                <input 
                  type="text" 
                  readOnly 
                  value={generatedLink} 
                  className="flex-1 bg-transparent px-4 py-3 outline-none text-sm font-mono font-medium text-on-surface truncate"
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(generatedLink);
                    setFeedback({ type: 'success', text: 'Copied link to clipboard!' });
                  }}
                  className="px-6 py-3 bg-primary/10 text-primary font-bold hover:bg-primary hover:text-white transition-colors border-l border-outline/20 flex items-center gap-2 shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  Copy Link
                </button>
              </div>

              <div className="text-xs text-secondary/80 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-green-600">verified</span>
                <span>Dispatched via official address <strong>support@stream.net.in</strong></span>
              </div>
            </div>
          ) : (
            <form id="create-form" onSubmit={handleSubmit} className="space-y-6">
              
              {/* COMMON: STREAM Hub, iLab, Creative Corner */}
              {(type === 'labs' || type === 'ilabs' || type === 'creative_corners') && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-secondary mb-1">
                      Name of {type === 'labs' ? 'STREAM Hub' : type === 'ilabs' ? 'iLab Corner' : 'Creative Corner'}
                    </label>
                    <input 
                      required 
                      name="name" 
                      value={formData.name || ''} 
                      onChange={handleChange} 
                      type="text" 
                      placeholder="e.g. GHSS VALIYAZHEECKAL"
                      className="w-full bg-surface-container border border-outline/20 rounded-xl px-4 py-3 focus:border-primary outline-none" 
                    />
                  </div>
                  
                  {type === 'labs' && (
                    <div className="mt-4">
                      <label className="block text-sm font-bold text-secondary mb-1">STREAM Expert in Charge</label>
                      <select 
                        required 
                        name="expertId" 
                        value={formData.expertId || ''} 
                        onChange={(e) => handleExpertSelect(e.target.value)} 
                        className="w-full bg-surface-container border border-outline/20 rounded-xl px-4 py-3 focus:border-primary outline-none"
                      >
                        <option value="">Select an Expert...</option>
                        {experts.map(ex => <option key={ex.id} value={ex.id}>{ex.name} ({ex.district})</option>)}
                      </select>
                    </div>
                  )}

                  {/* Cascading UI: District dropdown -> Location (BRC) dropdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-secondary mb-1">
                        District <span className="text-primary">*</span>
                      </label>
                      <select 
                        required 
                        name="district" 
                        id="select-hub-district"
                        value={formData.district || ''} 
                        onChange={handleDistrictChange} 
                        className="w-full bg-surface-container border border-outline/20 rounded-xl px-4 py-3 focus:border-primary outline-none"
                      >
                        <option value="">Select District</option>
                        {districts.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-secondary mb-1">
                        Location (BRC) <span className="text-primary">*</span>
                      </label>
                      <select 
                        required 
                        name="location" 
                        id="select-hub-location"
                        value={formData.location || ''} 
                        onChange={handleLocationChange} 
                        disabled={!formData.district}
                        className="w-full bg-surface-container border border-outline/20 rounded-xl px-4 py-3 focus:border-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">
                          {formData.district ? 'Select Location (BRC)...' : '← Select District First'}
                        </option>
                        {availableLocations.map(loc => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {formData.brcCode && (
                    <div className="bg-surface-container-low px-4 py-2 rounded-xl text-xs flex items-center gap-2 text-secondary">
                      <span className="material-symbols-outlined text-sm text-primary">location_on</span>
                      <span>Assigned BRC Code: <strong className="text-on-surface font-mono">{formData.brcCode}</strong></span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-outline/10">
                    <div>
                      <label className="block text-sm font-bold text-secondary mb-1">Password</label>
                      <input required name="password" onChange={handleChange} type="password" className="w-full bg-surface-container border border-outline/20 rounded-xl px-4 py-3 focus:border-primary outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-secondary mb-1">Confirm Password</label>
                      <input required name="confirmPassword" onChange={handleChange} type="password" className="w-full bg-surface-container border border-outline/20 rounded-xl px-4 py-3 focus:border-primary outline-none" />
                    </div>
                  </div>
                </>
              )}

              {/* UNIVERSAL ONBOARDING: STREAM EXPERT / SYSTEM ADMIN */}
              {isUserType && (
                <>
                  {/* Unified Role Selector */}
                  <div>
                    <label className="block text-sm font-bold text-secondary mb-1">Onboarding Role</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, roleType: 'experts' }))}
                        className={`py-3 px-4 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                          formData.roleType === 'experts'
                            ? 'bg-primary text-on-primary border-primary shadow-md'
                            : 'bg-surface-container-low border-outline/20 text-secondary hover:bg-surface-container'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg">school</span>
                        STREAM Expert
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, roleType: 'admins' }))}
                        className={`py-3 px-4 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                          formData.roleType === 'admins'
                            ? 'bg-primary text-on-primary border-primary shadow-md'
                            : 'bg-surface-container-low border-outline/20 text-secondary hover:bg-surface-container'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
                        System Administrator
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-secondary mb-1">
                        Full Name <span className="text-primary">*</span>
                      </label>
                      <input 
                        required 
                        name="name" 
                        id="input-user-name"
                        value={formData.name || ''} 
                        onChange={handleChange} 
                        type="text" 
                        placeholder="e.g. Dr. Harikrishnan" 
                        className="w-full bg-surface-container border border-outline/20 rounded-xl px-4 py-3 focus:border-primary outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-secondary mb-1">
                        Email Address <span className="text-primary">*</span>
                      </label>
                      <input 
                        required 
                        name="email" 
                        id="input-user-email"
                        value={formData.email || ''} 
                        onChange={handleChange} 
                        type="email" 
                        placeholder="e.g. user@stream.net.in" 
                        className="w-full bg-surface-container border border-outline/20 rounded-xl px-4 py-3 focus:border-primary outline-none" 
                      />
                    </div>
                  </div>
                  
                  <div className="bg-primary-container/20 p-5 rounded-2xl flex items-start gap-3 mt-4 border border-primary/20">
                    <span className="material-symbols-outlined text-primary mt-0.5 text-xl">verified_user</span>
                    <div className="text-xs text-secondary leading-relaxed">
                      <strong className="text-on-surface block font-bold mb-1">Unified Two-Step Verification Flow</strong>
                      When you submit, a unique role-specific registration link will be generated. You will be prompted with a confirmation modal (<strong>Continue sending? Yes / No</strong>) before the invitation email is dispatched via <span className="font-mono text-primary font-bold">support@stream.net.in</span>.
                    </div>
                  </div>

                </>
              )}

            </form>
          )}
        </div>

        <div className="bg-surface-container-low px-8 py-5 flex justify-end gap-4 shrink-0 border-t border-outline/10">
          <button 
            type="button"
            onClick={onClose} 
            className="px-6 py-2.5 rounded-xl text-secondary hover:bg-surface-container transition-colors font-bold text-sm"
          >
            {generatedLink ? 'Done' : 'Cancel'}
          </button>
          {!generatedLink && (
            <button 
              form="create-form" 
              type="submit" 
              id="btn-register-submit"
              disabled={loading} 
              className="px-8 py-2.5 rounded-xl bg-primary text-on-primary font-bold shadow-md hover:opacity-90 transition-all disabled:opacity-50 text-sm flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  <span>Generating Link...</span>
                </>
              ) : isUserType ? (
                <>
                  <span className="material-symbols-outlined text-sm">forward_to_inbox</span>
                  <span>Invite User</span>
                </>
              ) : (
                'Register'
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
