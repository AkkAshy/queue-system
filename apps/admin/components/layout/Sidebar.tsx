'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Layers,
  Building2,
  Users,
  CalendarClock,
  Monitor,
  ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTr } from '@/lib/i18n';

const items = [
  { href: '/dashboard',  uz: 'Boshqaruv paneli', kaa: 'Basqarıw paneli', Icon: LayoutDashboard },
  { href: '/services',   uz: 'Xizmatlar',        kaa: 'Xızmetler',       Icon: FileText },
  { href: '/categories', uz: 'Kategoriyalar',    kaa: 'Kategoriyalar',   Icon: Layers },
  { href: '/counters',   uz: 'Oynalar',          kaa: 'Áyneler',         Icon: Building2 },
  { href: '/operators',  uz: 'Operatorlar',      kaa: 'Operatorlar',     Icon: Users },
  { href: '/schedule',   uz: 'Jadval',           kaa: 'Keste',           Icon: CalendarClock },
  { href: '/settings',   uz: 'Tablo',            kaa: 'Tablo',           Icon: Monitor },
  { href: '/audit',      uz: 'Audit',            kaa: 'Audit',           Icon: ScrollText },
];

export function Sidebar() {
  const pathname = usePathname();
  const tr = useTr();

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-hair bg-cream/80">
      <div className="flex items-center gap-3 border-b border-hair px-6 py-6">
        <div className="grid h-10 w-10 place-items-center rounded-full border border-coral/60 font-serif text-sm font-semibold text-coral">
          NP
        </div>
        <div className="leading-tight">
          <div className="eyebrow text-coral">NDPI</div>
          <div className="mt-1 text-sm font-medium">Admin Panel</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5">
        {items.map(({ href, uz, kaa, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-150',
                active
                  ? 'bg-hair/60 text-coal'
                  : 'text-coal-2 hover:bg-hair/30 hover:text-coal',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 transition-colors',
                  active ? 'text-coral-600' : 'text-coal-3 group-hover:text-coral',
                )}
              />
              {tr(uz, kaa)}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-hair px-6 py-5 text-xs text-coal-3">
        v0.1 · phase 3
      </div>
    </aside>
  );
}
