'use client';

import { Plus, ChevronDown } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ITEM_TYPES } from '@/lib/item-types';
import type { VaultItemType } from '@/types/vault';

/** The big "Create item" button: pick what to add (password, note, card, contact info, document…). */
export function CreateItemMenu({ onCreate, compact = false }: { onCreate: (type: VaultItemType) => void; compact?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors ${compact ? 'h-10 px-3 text-sm' : 'h-11 px-4 text-[15px]'}`}
        >
          <Plus className="w-5 h-5" />
          <span className={compact ? 'hidden sm:inline' : ''}>Create item</span>
          <ChevronDown className="w-4 h-4 opacity-70 hidden sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-1.5">
        {ITEM_TYPES.map(({ type, label, hint, icon: Icon, color }) => (
          <DropdownMenuItem key={type} onClick={() => onCreate(type)} className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg cursor-pointer">
            <span className={`w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 ${color}`}><Icon className="w-[18px] h-[18px]" /></span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{label}</span>
              <span className="block text-xs text-muted-foreground truncate">{hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
