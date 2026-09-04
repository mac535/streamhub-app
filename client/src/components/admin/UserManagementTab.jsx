import React, { useState } from 'react';
import UserCreationModal from './UserCreationModal';
import UserRemovalModal from './UserRemovalModal';
import UserManageModal from './UserManageModal';

const ENTITY_TYPES = [
  { id: 'admins', label: 'System Admin', icon: 'admin_panel_settings' },
  { id: 'experts', label: 'STREAM Expert', icon: 'school' },
  { id: 'labs', label: 'STREAM Hub', icon: 'science' },
  { id: 'ilabs', label: 'iLab Corner', icon: 'computer' },
  { id: 'creative_corners', label: 'Creative Corner', icon: 'palette' }
];

export default function UserManagementTab() {
  const [subTab, setSubTab] = useState('ADD'); // 'ADD', 'MANAGE', 'REMOVE'
  const [activeModal, setActiveModal] = useState(null); // 'labs', 'experts', etc.

  const user = JSON.parse(localStorage.getItem('stream_user') || '{}');
  const isMainAdmin = user.email === 'support@stream.net.in' || user.email === 'admin@stream.edu' || user.isMainAdmin;

  const visibleEntities = ENTITY_TYPES.filter(entity => 
    entity.id === 'admins' ? isMainAdmin : true
  );

  return (
    <div className="p-4 md:p-8 md:px-12 space-y-8 w-full animate-fade-in-up">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-outline/20 pb-4 gap-6">
        <div>
          <p className="text-secondary text-sm mt-1">Register new entities or manage existing accounts.</p>
        </div>
        <div className="flex bg-surface-container-low rounded-xl p-1 shadow-sm shrink-0">
          <button
            onClick={() => setSubTab('ADD')}
            className={`px-8 py-2.5 rounded-lg font-bold transition-all text-sm tracking-wider uppercase ${
              subTab === 'ADD' ? 'bg-primary text-on-primary shadow-md' : 'text-secondary hover:bg-surface-container'
            }`}
          >
            Add New
          </button>
          <button
            onClick={() => setSubTab('MANAGE')}
            className={`px-8 py-2.5 rounded-lg font-bold transition-all text-sm tracking-wider uppercase ${
              subTab === 'MANAGE' ? 'bg-blue-600 text-white shadow-md' : 'text-secondary hover:bg-surface-container'
            }`}
          >
            Manage
          </button>
          <button
            onClick={() => setSubTab('REMOVE')}
            className={`px-8 py-2.5 rounded-lg font-bold transition-all text-sm tracking-wider uppercase ${
              subTab === 'REMOVE' ? 'bg-error text-white shadow-md' : 'text-secondary hover:bg-surface-container'
            }`}
          >
            Remove
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
        {visibleEntities.map(entity => (
          <button
            key={entity.id}
            onClick={() => setActiveModal(entity.id)}
            className={`flex flex-col items-center justify-center p-8 rounded-2xl border transition-all expert-brutalist-hover text-center gap-4 group ${
              subTab === 'ADD' 
                ? 'bg-primary-container/10 border-primary/20 hover:border-primary text-primary' 
                : subTab === 'MANAGE'
                ? 'bg-blue-50 border-blue-200 hover:border-blue-500 text-blue-700'
                : 'bg-error/5 border-error/20 hover:border-error text-error'
            }`}
          >
            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${
              subTab === 'ADD' ? 'bg-primary-container/30' : subTab === 'MANAGE' ? 'bg-blue-100' : 'bg-error/10'
            }`}>
              <span className="material-symbols-outlined text-4xl">{entity.icon}</span>
            </div>
            <div className="flex flex-col items-center justify-center">
              <span className="font-black text-xl uppercase tracking-wide">
                {entity.label}
              </span>
            </div>
          </button>
        ))}
      </div>

      {activeModal && subTab === 'ADD' && (
        <UserCreationModal
          type={activeModal}
          entityName={ENTITY_TYPES.find(e => e.id === activeModal)?.label}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal && subTab === 'MANAGE' && (
        <UserManageModal
          type={activeModal}
          entityName={ENTITY_TYPES.find(e => e.id === activeModal)?.label}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal && subTab === 'REMOVE' && (
        <UserRemovalModal
          type={activeModal}
          entityName={ENTITY_TYPES.find(e => e.id === activeModal)?.label}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
