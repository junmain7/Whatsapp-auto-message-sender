import Link from 'next/link';
import { useRouter } from 'next/router';

export default function BottomNav() {
  const router = useRouter();
  const isHome = router.pathname === '/';
  const isHistory = router.pathname === '/logs';

  return (
    <>
      <nav className="bottomNav">
        <Link href="/" className={`navItem ${isHome ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
          </svg>
          <span className="label">Home</span>
        </Link>

        <Link href="/logs" className={`navItem ${isHistory ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8v4l3 3" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          <span className="label">History</span>
        </Link>
      </nav>

      <style jsx>{`
        .bottomNav {
          position: fixed;
          left: 50%;
          transform: translateX(-50%);
          bottom: calc(14px + env(safe-area-inset-bottom));
          z-index: 500;
          display: flex;
          gap: 6px;
          background: #1a1e26;
          border: 1px solid #2a2f39;
          border-radius: 999px;
          padding: 6px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
        }
        .navItem {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 9px 14px;
          border-radius: 999px;
          color: #7c8592;
          text-decoration: none;
          font-size: 12.5px;
          font-weight: 600;
          transition: color 0.18s ease, background 0.18s ease, padding 0.18s ease;
        }
        .navItem svg {
          width: 19px;
          height: 19px;
          flex-shrink: 0;
        }
        .label {
          max-width: 0;
          overflow: hidden;
          white-space: nowrap;
          opacity: 0;
          transition: max-width 0.18s ease, opacity 0.18s ease;
        }
        .navItem.active {
          color: #0b0d11;
          background: #25d366;
        }
        .navItem.active .label {
          max-width: 80px;
          opacity: 1;
        }
        .navItem:not(.active) {
          padding: 9px;
        }
        .navItem:active {
          background: rgba(255, 255, 255, 0.08);
        }
      `}</style>
    </>
  );
}
