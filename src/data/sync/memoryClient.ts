import type { SyncClient, SyncQuery, SyncResult } from '@/src/data/sync/types';

type Row = Record<string, unknown>;

export type MemoryOp = {
  table: string;
  kind: 'select' | 'insert' | 'upsert' | 'update' | 'delete';
};

type Filter = { kind: 'eq' | 'in'; column: string; value: unknown };

/** In-memory stand-in for the query chain the sync repo uses. */
export function createMemorySyncClient(): SyncClient & {
  ops: MemoryOp[];
  rows(table: string): Row[];
} {
  const tables = new Map<string, Row[]>();
  const ops: MemoryOp[] = [];
  let seq = 1;

  const rows = (table: string): Row[] => {
    const found = tables.get(table);
    if (found) return found;
    const created: Row[] = [];
    tables.set(table, created);
    return created;
  };

  const from = (table: string): SyncQuery => {
    const state = {
      op: 'select' as MemoryOp['kind'],
      columns: '*',
      values: [] as Row[],
      patch: null as Row | null,
      filters: [] as Filter[],
      from: 0,
      to: Number.MAX_SAFE_INTEGER,
      order: null as string | null,
      onConflict: '',
      ignoreDuplicates: false,
    };

    const execute = (): SyncResult => {
      ops.push({ table, kind: state.op });
      const current = rows(table);
      if (state.op === 'insert') return { data: present(insert(current), state.columns), error: null };
      if (state.op === 'upsert') return { data: present(upsert(current), state.columns), error: null };
      const matched = current.filter((row) => matches(row, state.filters));
      if (state.op === 'delete') {
        tables.set(
          table,
          current.filter((row) => !matches(row, state.filters)),
        );
        return { data: present(matched, state.columns), error: null };
      }
      if (state.op === 'update') {
        for (const row of matched) Object.assign(row, state.patch ?? {});
        return { data: present(matched, state.columns), error: null };
      }
      const ordered = state.order ? sortBy(matched, state.order) : matched;
      return { data: present(ordered.slice(state.from, state.to + 1), state.columns), error: null };
    };

    const insert = (current: Row[]): Row[] => {
      const written = state.values.map((row) => {
        const copy = clone(row);
        if (copy.id == null) copy.id = seq++;
        current.push(copy);
        return copy;
      });
      return written;
    };

    const upsert = (current: Row[]): Row[] => {
      const keys = state.onConflict.split(',').map((key) => key.trim()).filter(Boolean);
      const written: Row[] = [];
      for (const row of state.values) {
        const found = current.find((existing) => keys.every((key) => existing[key] === row[key]));
        if (found) {
          if (!state.ignoreDuplicates) Object.assign(found, clone(row));
          written.push(found);
          continue;
        }
        const copy = clone(row);
        if (copy.id == null) copy.id = seq++;
        current.push(copy);
        written.push(copy);
      }
      return written;
    };

    const query: SyncQuery = {
      select(columns) {
        state.columns = columns && columns.length > 0 ? columns : '*';
        return query;
      },
      insert(values) {
        state.op = 'insert';
        state.values = asList(values);
        return query;
      },
      upsert(values, options) {
        state.op = 'upsert';
        state.values = asList(values);
        state.onConflict = options?.onConflict ?? '';
        state.ignoreDuplicates = options?.ignoreDuplicates === true;
        return query;
      },
      update(values) {
        state.op = 'update';
        state.patch = isRow(values) ? values : {};
        return query;
      },
      delete() {
        state.op = 'delete';
        return query;
      },
      eq(column, value) {
        state.filters.push({ kind: 'eq', column, value });
        return query;
      },
      in(column, values) {
        state.filters.push({ kind: 'in', column, value: values });
        return query;
      },
      order(column) {
        state.order = column;
        return query;
      },
      range(start, end) {
        state.from = start;
        state.to = end;
        return query;
      },
      then(onfulfilled, onrejected) {
        return Promise.resolve(execute()).then(onfulfilled, onrejected);
      },
    };
    return query;
  };

  return { from, ops, rows };
}

function matches(row: Row, filters: readonly Filter[]): boolean {
  return filters.every((filter) => {
    const cell = row[filter.column];
    if (filter.kind === 'eq') return cell === filter.value;
    return Array.isArray(filter.value) && filter.value.includes(cell);
  });
}

function sortBy(rows: Row[], column: string): Row[] {
  return [...rows].sort((left, right) => {
    const a = left[column];
    const b = right[column];
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b));
  });
}

function asList(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter(isRow);
  return isRow(value) ? [value] : [];
}

function present(rows: readonly Row[], columns: string): Row[] {
  if (columns === '*') return [...rows];
  const names = columns.split(',').map((name) => name.trim()).filter(Boolean);
  return rows.map((row) => {
    const projected: Row = {};
    for (const name of names) {
      if (name in row) projected[name] = row[name];
    }
    return projected;
  });
}

function clone(row: Row): Row {
  return structuredClone(row);
}

function isRow(value: unknown): value is Row {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
