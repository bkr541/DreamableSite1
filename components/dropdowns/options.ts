import {
  Briefcase06Icon,
  Message01Icon,
  MoreHorizontalCircle01Icon,
  PaintBoardIcon,
  PencilRulerIcon,
  SourceCodeSquareIcon,
} from '@hugeicons/core-free-icons';
import { STATUS_DOT } from '@/components/RecordList';
import type { DropdownOption } from './shared';

/** Adds the app's status color dot to each status option (the empty "All" option gets none). */
export const statusOptions = (opts: { value: string; label: string }[]): DropdownOption[] =>
  opts.map((o) => ({ ...o, dot: o.value ? STATUS_DOT[o.value] : undefined }));

import { serviceIdOf } from '@/lib/services';

const SERVICE_ICONS: Record<string, DropdownOption['icon']> = {
  'web-development': SourceCodeSquareIcon,
  'brand-identity': PaintBoardIcon,
  'ui-ux-design': PencilRulerIcon,
  marketing: Message01Icon,
  consulting: Message01Icon,
  other: MoreHorizontalCircle01Icon,
};

/** Adds a service-type icon to each option (any spelling of a service gets its icon); unknown services fall back to a briefcase. */
export const serviceOptions = (opts: { value: string; label: string }[]): DropdownOption[] =>
  opts.map((o) => ({ ...o, icon: SERVICE_ICONS[serviceIdOf(o.value) ?? ''] ?? Briefcase06Icon }));
