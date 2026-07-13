import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useSearchUsers } from '@/lib/users';
import './UserSearchSelect.css';

/**
 * Search-and-pick a single user by name or email — built for large user bases,
 * where a full dropdown of every user would be unusable. Type to search (matches
 * name or email, server-side), then click a result. Calls onPick(user).
 *
 * @param {'student'|'trainer'} role
 * @param {string[]} excludeIds  users to hide from results (e.g. already-enrolled)
 */
export function UserSearchSelect({ role, excludeIds = [], onPick, placeholder = 'Search by name or email…', disabled }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // Debounce so we don't fire a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isFetching } = useSearchUsers(role, debounced);
  const exclude = useMemo(() => new Set(excludeIds), [excludeIds]);
  const matches = (results ?? []).filter((u) => !exclude.has(u.id));

  // Close the results panel on an outside click.
  useEffect(() => {
    function onDoc(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pick(u) {
    onPick(u);
    setQuery('');
    setDebounced('');
    setOpen(false);
  }

  return (
    <div className="user-search" ref={boxRef}>
      <div className="user-search__field">
        <Search size={15} className="user-search__icon" aria-hidden />
        <input
          className="input user-search__input"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          aria-label={placeholder}
        />
      </div>
      {open && debounced.length >= 1 && (
        <div className="user-search__results" role="listbox">
          {isFetching && matches.length === 0 && <div className="user-search__msg">Searching…</div>}
          {!isFetching && matches.length === 0 && <div className="user-search__msg">No matching users.</div>}
          {matches.map((u) => (
            <button type="button" key={u.id} className="user-search__item" onClick={() => pick(u)}>
              <span className="user-search__name">{u.name}</span>
              <span className="user-search__email">{u.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
