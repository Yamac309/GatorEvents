import { NavLink } from 'react-router-dom';

const NAV = [
  { to: '/',       icon: '≡',  title: 'Feed',         isSvg: false },
  { to: '/map',    icon: 'map', title: 'Map',          isSvg: true },
  { to: '/submit', icon: '+',   title: 'Submit Event', isSvg: false },
];

const ADMIN_NAV = { to: '/admin', icon: '✦', title: 'Admin' };

function NavBtn({ to, icon, title, isSvg }) {
  return (
    <NavLink
      to={to}
      title={title}
      className={({ isActive }) =>
        `w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-colors
        ${isActive
          ? 'bg-white/20 text-white'
          : 'text-white/50 hover:text-white hover:bg-white/10'}`
      }
    >
      {isSvg ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <polygon points="3,6 21,6 21,18 3,18" /><line x1="7" y1="10" x2="17" y2="10" /><line x1="7" y1="14" x2="13" y2="14" />
        </svg>
      ) : (
        <span className="text-lg font-medium">{icon}</span>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-16 min-h-screen bg-uf-blue flex flex-col items-center py-4 gap-2 shrink-0">
      {/* Logo — GE monogram (SVG is precisely centered via text-anchor=middle) */}
      <img src="/favicon.svg" alt="GatorEvents" className="w-10 h-10 mb-3 shrink-0 rounded-xl shadow-sm" />

      {/* Main nav */}
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === '/'}
          title={n.title}
          className={({ isActive }) =>
            `w-11 h-11 rounded-xl flex items-center justify-center transition-colors
            ${isActive
              ? 'bg-white/20 text-white'
              : 'text-white/50 hover:text-white hover:bg-white/10'}`
          }
        >
          {n.to === '/map' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          ) : n.to === '/submit' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="15" y2="18" />
            </svg>
          )}
        </NavLink>
      ))}

      <div className="flex-1" />

      {/* Admin link intentionally hidden from public navigation — admin
          accesses /admin directly by URL. See routes/admin.js for the
          password + rate-limited login flow. */}

      {/* User */}
      <div className="w-8 h-8 rounded-full bg-uf-orange flex items-center justify-center mt-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-4 h-4">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
    </aside>
  );
}
