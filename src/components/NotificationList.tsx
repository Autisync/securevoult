'use client';

import { Bell, CalendarClock, ScanSearch } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AppNote } from '@/hooks/useNotifications';
import { useNotifications } from '@/hooks/useNotifications';

const ICON: Record<string, { icon: React.ElementType; cls: string }> = {
  breach: { icon: ScanSearch, cls: 'bg-red-500/12 text-red-300' },
  expiry: { icon: CalendarClock, cls: 'bg-amber-500/12 text-amber-300' },
};

/** The list of notifications; used in the app's bell menu and the extension. */
export function NotificationList({ items, onOpen, onMarkAll, dense = false }: {
  items: AppNote[]; onOpen: (n: AppNote) => void; onMarkAll?: () => void; dense?: boolean;
}) {
  if (!items.length) {
    return (
      <div className="px-6 py-12 text-center">
        <Bell className="w-7 h-7 mx-auto text-muted-foreground/50" />
        <p className="mt-3 font-medium">You&apos;re all caught up</p>
        <p className="text-sm text-muted-foreground mt-1">Breach alerts and expiry reminders show here.</p>
      </div>
    );
  }
  return (
    <div>
      {onMarkAll && items.some((n) => !n.read) && (
        <div className="flex justify-end px-3 pt-2">
          <button onClick={onMarkAll} className="text-xs font-medium text-primary hover:underline">Mark all as read</button>
        </div>
      )}
      <ul className="py-1">
        {items.map((n) => {
          const { icon: Icon, cls } = ICON[n.kind] ?? { icon: Bell, cls: 'bg-secondary text-muted-foreground' };
          return (
            <li key={n.id}>
              <button onClick={() => onOpen(n)} className={`w-full flex items-start gap-3 text-left hover:bg-secondary/60 transition-colors ${dense ? 'px-3 py-2.5' : 'px-4 py-3'}`}>
                <span className={`relative w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cls}`}>
                  <Icon className="w-[18px] h-[18px]" />
                  {!n.read && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-card" aria-label="Unread" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm leading-snug ${n.read ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>{n.title}</span>
                  {n.body && <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</span>}
                  <span className="block text-[11px] text-muted-foreground/70 mt-1">{formatDistanceToNow(new Date(n.at), { addSuffix: true })}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The bell button with its count, opening the list. */
export function NotificationBell({ onOpenItem }: { onOpenItem: (n: AppNote) => void }) {
  const { items, unread, markRead } = useNotifications();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative h-10 w-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">{unread > 99 ? '99+' : unread}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0 max-h-[70vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-border/60 font-semibold">Notifications</div>
        <NotificationList items={items} onMarkAll={() => void markRead()} onOpen={(n) => { void markRead([n.id]); onOpenItem(n); }} />
      </PopoverContent>
    </Popover>
  );
}
