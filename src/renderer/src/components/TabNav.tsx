import React from 'react';

export type TabId = 'general' | 'hotkeys' | 'keys';

interface TabNavProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'hotkeys', label: 'Hotkeys' },
  { id: 'keys', label: 'API Keys' }
];

export function TabNav({ activeTab, onChange }: TabNavProps): JSX.Element {
  return (
    <div className="tab-nav" role="tablist" aria-label="Settings sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          className={`tab-nav__button ${activeTab === tab.id ? 'is-active' : ''}`}
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
