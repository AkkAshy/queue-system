'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useTr } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type SortDir = 'asc' | 'desc';

export interface ColumnDef<T> {
  /** Уникальный ключ колонки (связывает заголовок, ячейку фильтра и состояние). */
  key: string;
  /** Значение для СОРТИРОВКИ. Нет accessor → заголовок не кликабелен. */
  accessor?: (row: T) => string | number | null | undefined;
  /** Тип контрола в строке фильтров под шапкой. Нет — ячейка фильтра пустая. */
  filter?: 'text' | 'select';
  /** Значение для ФИЛЬТРА (по умолчанию = accessor). Полезно когда сортируем
   *  по одному (timestamp), а фильтруем по другому (отформатированная дата). */
  filterValue?: (row: T) => string | number | null | undefined;
  /** Опции для select-фильтра. value сравнивается с filterValue/accessor как строка. */
  options?: { value: string; label: string }[];
}

export interface TableControls<T> {
  /** Отфильтрованные + отсортированные строки — рендерить вместо исходного массива. */
  view: T[];
  sort: { key: string; dir: SortDir } | null;
  toggleSort: (key: string) => void;
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  /** true, если активен хоть один фильтр или сортировка. */
  active: boolean;
  columns: ColumnDef<T>[];
  colMap: Record<string, ColumnDef<T>>;
}

function filterGetter<T>(col: ColumnDef<T>) {
  return col.filterValue ?? col.accessor;
}

/**
 * Лёгкий слой фильтрации/сортировки поверх обычной <table>.
 * Не диктует разметку — страница сама рендерит ячейки, а хук лишь
 * готовит view и хранит состояние. Заголовки оборачиваются в <Th>,
 * под thead добавляется <FilterRow>.
 */
export function useTableControls<T>(rows: T[], columns: ColumnDef<T>[]): TableControls<T> {
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const colMap = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.key, c])) as Record<string, ColumnDef<T>>,
    [columns],
  );

  const view = useMemo(() => {
    let out = rows;

    for (const [key, raw] of Object.entries(filters)) {
      const val = raw.trim().toLowerCase();
      if (!val) continue;
      const col = colMap[key];
      const get = col && filterGetter(col);
      if (!get) continue;
      out = out.filter((r) => {
        const cell = (get(r) ?? '').toString().toLowerCase();
        return col.filter === 'select' ? cell === val : cell.includes(val);
      });
    }

    if (sort) {
      const col = colMap[sort.key];
      if (col?.accessor) {
        const get = col.accessor;
        out = out.slice().sort((a, b) => {
          const av = get(a);
          const bv = get(b);
          let cmp: number;
          if (typeof av === 'number' && typeof bv === 'number') {
            cmp = av - bv;
          } else {
            cmp = (av ?? '')
              .toString()
              .localeCompare((bv ?? '').toString(), undefined, { numeric: true });
          }
          return sort.dir === 'asc' ? cmp : -cmp;
        });
      }
    }

    return out;
  }, [rows, filters, sort, colMap]);

  function toggleSort(key: string) {
    // asc → desc → выкл
    setSort((prev) =>
      !prev || prev.key !== key
        ? { key, dir: 'asc' }
        : prev.dir === 'asc'
          ? { key, dir: 'desc' }
          : null,
    );
  }

  function setFilter(key: string, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  const active = !!sort || Object.values(filters).some((v) => v.trim() !== '');

  return { view, sort, toggleSort, filters, setFilter, active, columns, colMap };
}

/**
 * Сортируемый заголовок. Если у колонки нет accessor — обычный <th>.
 * Наследует uppercase/tracking из .admin-table th.
 */
export function Th<T>({
  ctl,
  col,
  children,
  className,
}: {
  ctl: TableControls<T>;
  col: string;
  children?: ReactNode;
  className?: string;
}) {
  const def = ctl.colMap[col];
  const sortable = !!def?.accessor;
  const active = ctl.sort?.key === col;
  const dir = active ? ctl.sort?.dir : undefined;

  if (!sortable) return <th className={className}>{children}</th>;

  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => ctl.toggleSort(col)}
        className="group -mx-1 inline-flex items-center gap-1 rounded px-1 uppercase tracking-[0.06em] transition-colors hover:text-coal"
      >
        {children}
        {dir === 'asc' ? (
          <ArrowUp className="h-3 w-3 text-coral" />
        ) : dir === 'desc' ? (
          <ArrowDown className="h-3 w-3 text-coral" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 text-coal-3/40 transition-colors group-hover:text-coal-3" />
        )}
      </button>
    </th>
  );
}

/**
 * Строка фильтров под заголовками. Рендерит по ячейке на каждую колонку
 * (в том же порядке), чтобы выровняться с шапкой. Текст → input, категории → select.
 */
export function FilterRow<T>({
  ctl,
  className,
  cellClassName,
}: {
  ctl: TableControls<T>;
  className?: string;
  /** Доп. классы для каждой ячейки фильтра — например px под нестандартную таблицу. */
  cellClassName?: string;
}) {
  const tr = useTr();

  return (
    <tr className={cn('filter-row', className)}>
      {ctl.columns.map((col) => (
        <th
          key={col.key}
          className={cn('!pb-2 !pt-0 !font-normal !normal-case !tracking-normal', cellClassName)}
        >
          {col.filter === 'text' && (
            <input
              type="text"
              value={ctl.filters[col.key] ?? ''}
              onChange={(e) => ctl.setFilter(col.key, e.target.value)}
              placeholder={tr('Qidirish…', 'Izlew…')}
              className="w-full rounded-md border border-hair-2 bg-card px-2 py-1 text-xs font-normal text-coal placeholder:text-coal-3/60 focus:border-coral focus:outline-none"
            />
          )}
          {col.filter === 'select' && (
            <select
              value={ctl.filters[col.key] ?? ''}
              onChange={(e) => ctl.setFilter(col.key, e.target.value)}
              className="w-full rounded-md border border-hair-2 bg-card px-2 py-1 text-xs font-normal text-coal focus:border-coral focus:outline-none"
            >
              <option value="">{tr('Barchasi', 'Barlıǵı')}</option>
              {(col.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </th>
      ))}
    </tr>
  );
}
