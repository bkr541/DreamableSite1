'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import InboxPanel from '@/components/InboxPanel';
import TemplatesPanel, { type HubClient } from '@/components/TemplatesPanel';

export type HubTab = 'inbox' | 'templates';

const TABS: { id: HubTab; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'templates', label: 'Templates' },
];

/** Message Hub: everything about email in one place: read the inbox, and send emails from templates. */
export default function MessageHub({ initialTab, clients, baseUrl }: { initialTab: HubTab; clients: HubClient[]; baseUrl: string }) {
  const [tab, setTab] = useState<HubTab>(initialTab);
  return (
    <div>
      <div role="tablist" aria-label="Message Hub" className="mb-6 flex gap-6 border-b border-[#E2E4EA]">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              id={`hub-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`hub-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`relative py-3 text-sm font-medium transition-colors ${active ? 'text-[#1a2030]' : 'text-[#999] hover:text-[#555]'}`}
            >
              {t.label}
              {active && (
                <motion.span layoutId="hub-tab-underline" className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-[#3DD9C8] via-[#7BB5F5] to-[#B87AF5]" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`hub-panel-${tab}`} aria-labelledby={`hub-tab-${tab}`}>
        {tab === 'inbox' ? <InboxPanel /> : <TemplatesPanel clients={clients} baseUrl={baseUrl} />}
      </div>
    </div>
  );
}
