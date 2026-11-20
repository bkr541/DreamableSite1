'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import InboxPanel from '@/components/InboxPanel';
import { HugeiconsIcon } from '@hugeicons/react';
import { PencilEdit02Icon } from '@hugeicons/core-free-icons';
import TemplatesPanel, { type ComposeStart, type HubClient } from '@/components/TemplatesPanel';

export type HubTab = 'inbox' | 'templates';

const TABS: { id: HubTab; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'templates', label: 'Templates' },
];

/** Message Hub: everything about email in one place: read the inbox, and send emails from templates. */
export default function MessageHub({ initialTab, clients, baseUrl }: { initialTab: HubTab; clients: HubClient[]; baseUrl: string }) {
  const [tab, setTab] = useState<HubTab>(initialTab);
  // Set by "New email" and by Reply: opens the Blank Message composer. The counter remounts the panel so a second request
  // starts fresh even when the Templates tab is already showing.
  const [compose, setCompose] = useState<{ start: ComposeStart; n: number } | null>(null);
  const openCompose = (start: ComposeStart = {}) => { setCompose((c) => ({ start, n: (c?.n ?? 0) + 1 })); setTab('templates'); };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[#E2E4EA]">
      <div role="tablist" aria-label="Message Hub" className="flex gap-6">
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
      <button
        type="button"
        onClick={() => openCompose()}
        className="mb-2 inline-flex h-9 items-center gap-2 rounded-full bg-[#1a2030] px-5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <HugeiconsIcon icon={PencilEdit02Icon} size={16} color="currentColor" strokeWidth={1.75} />
        New email
      </button>
      </div>
      <div role="tabpanel" id={`hub-panel-${tab}`} aria-labelledby={`hub-tab-${tab}`}>
        {tab === 'inbox' ? <InboxPanel onReply={openCompose} /> : <TemplatesPanel key={compose?.n ?? 0} clients={clients} baseUrl={baseUrl} start={compose?.start ?? null} />}
      </div>
    </div>
  );
}
