import { useEffect, useId, useRef, useState } from 'react';
import { airport, searchAirports } from '../data/airports';
import type { Airport, Iata } from '../engine/types';

interface Props {
  label: string;
  value?: Iata;
  exclude?: Iata;
  onChange: (iata: Iata) => void;
  placeholder?: string;
}

/** Airport autocomplete: search by IATA code, city or airport name. */
export function AirportField({ label, value, exclude, onChange, placeholder }: Props) {
  const id = useId();
  const selected = airport(value);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const results = open ? searchAirports(query, 6, exclude) : [];

  useEffect(() => setActive(0), [query]);

  const pick = (a: Airport) => {
    onChange(a.iata);
    setOpen(false);
    setQuery('');
    input.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div className="relative">
      <label htmlFor={id} className="label mb-1.5 block">
        {label}
      </label>
      <div className="relative">
        {selected && !open && (
          <span className="text-accent pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-[15px] font-bold">
            {selected.iata}
          </span>
        )}
        <input
          id={id}
          ref={input}
          className={`input ${selected && !open ? 'pl-[4.2rem]' : ''}`}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={results[active] ? `${id}-${results[active].iata}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder ?? 'Code, city or airport'}
          value={open ? query : selected ? `${selected.city} · ${selected.name}` : ''}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {open && results.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={`${label} results`}
          className="bg-surface-sunk border-border absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-[14px] border p-1 shadow-[0_24px_48px_rgba(0,0,0,0.5)]"
        >
          {results.map((a, i) => (
            <li
              key={a.iata}
              id={`${id}-${a.iata}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(a);
              }}
              onMouseMove={() => i !== active && setActive(i)}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-3 py-1.5 ${i === active ? 'bg-surface' : ''}`}
            >
              <span className="text-accent w-10 shrink-0 font-mono text-[15px] font-bold">{a.iata}</span>
              <span className="min-w-0">
                <span className="block truncate text-[15px]">
                  {a.city}, {a.country}
                </span>
                <span className="text-muted block truncate text-[12px]">{a.name}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim().length >= 2 && results.length === 0 && (
        <p className="bg-surface-sunk border-border text-muted absolute z-20 mt-1.5 w-full rounded-[14px] border p-3 text-sm">
          No airport matches “{query.trim()}”.
        </p>
      )}
    </div>
  );
}
