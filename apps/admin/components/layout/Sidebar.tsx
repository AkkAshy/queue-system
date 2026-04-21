'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Layers,
  Building2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/dashboard',  label: 'Обзор',      Icon: LayoutDashboard },
  { href: '/services',   label: 'Услуги',     Icon: FileText },
  { href: '/categories', label: 'Категории',  Icon: Layers },
  { href: '/counters',   label: 'Окна',       Icon: Building2 },
  { href: '/operators',  label: 'Операторы',  Icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-ink-700 bg-ink-900/80">
      <div className="flex items-center gap-3 border-b border-ink-700 px-6 py-6">
        <div className="grid h-10 w-10 place-items-center rounded-full border border-brass-500/60 font-serif text-sm font-semibold text-brass-500">
          NP
        </div>
        <div className="leading-tight">
          <div className="eyebrow text-brass-500">NDPI</div>
          <div className="mt-1 text-sm font-medium">Admin Panel</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-150',
                active
                  ? 'bg-ink-700/60 text-paper-100'
                  : 'text-ink-300 hover:bg-ink-700/30 hover:text-paper-100',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 transition-colors',
                  active ? 'text-brass-400' : 'text-ink-400 group-hover:text-brass-500',
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-ink-700 px-6 py-5 text-xs text-ink-400">
        v0.1 · phase 3
      </div>
    </aside>
  );
}
