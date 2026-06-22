'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Layers,
  Building2,
  Users,
  LayoutGrid,
  CalendarClock,
  Monitor,
  ScrollText,
  Volume2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTr } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth-store';
// Static import → Next resolves the URL with basePath (/admin) baked in,
// so the logo loads both in dev (no basePath) and prod (/admin).
import logo from '@/public/nmpi-logo.png';

const items = [
  { href: '/dashboard',  uz: 'Boshqaruv paneli', kaa: 'Basqarıw paneli', Icon: LayoutDashboard },
  { href: '/services',   uz: 'Xizmatlar',        kaa: 'Xızmetler',       Icon: FileText },
  { href: '/categories', uz: 'Kategoriyalar',    kaa: 'Kategoriyalar',   Icon: Layers },
  { href: '/counters',   uz: 'Oynalar',          kaa: 'Áyneler',         Icon: Building2 },
  { href: '/operators',  uz: 'Operatorlar',      kaa: 'Operatorlar',     Icon: Users },
  // Managing halls (create/delete) is a chief-only concern; a hall_admin only
  // works within their own hall via the catalog/counters pages.
  { href: '/halls',      uz: 'Zallar',           kaa: 'Zallar',          Icon: LayoutGrid, chiefOnly: true },
  { href: '/schedule',   uz: 'Jadval',           kaa: 'Keste',           Icon: CalendarClock },
  { href: '/settings',   uz: 'Tablo',            kaa: 'Tablo',           Icon: Monitor, chiefOnly: true },
  { href: '/voice',      uz: 'Ovoz',             kaa: 'Dawıs',           Icon: Volume2, chiefOnly: true },
  { href: '/audit',      uz: 'Audit',            kaa: 'Audit',           Icon: ScrollText, chiefOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const tr = useTr();
  const role = useAuthStore((s) => s.role);
  const isChief = role === 'admin' || role === 'chief_admin';
  const visible = items.filter((it) => !it.chiefOnly || isChief);

  return (
    <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-hair bg-cream/80">
      <div className="flex items-center gap-3 border-b border-hair px-6 py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo.src}
          alt="NMPI"
          className="h-10 w-10 shrink-0 rounded-full bg-white object-contain p-0.5 ring-1 ring-hair"
        />
        <div className="leading-tight">
          <div className="eyebrow text-coral">NMPI</div>
          <div className="mt-1 text-sm font-medium">Admin Panel</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5">
        {visible.map(({ href, uz, kaa, Icon }) => {
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
