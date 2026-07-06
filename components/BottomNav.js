import Link from 'next/link';
import { useRouter } from 'next/router';

export default function BottomNav({ onConsoleClick }) {
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
          Home
        </Link>

        <button
          type="button"
          className="navItem"
          onClick={onConsoleClick}
          style={{ background: 'transparent', border: 'none' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M7 8h10M7 12h10M7 16h6" />
          </svg>
          Console
        </button>

        <Link href="/logs" className={`navItem ${isHistory ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8v4l3 3" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          History
        </Link>
      </nav>

      <style jsx>{`
        .bottomNav {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 500;
          display: flex;
          background: rgba(20, 23, 29, 0.92);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-top: 1px solid #262b34;
          padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
        }
        .navItem {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 7px 4px;
          border-radius: 12px;
          color: #7c8592;
          text-decoration: none;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.01em;
          transition: color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, text-shadow 0.15s ease;
        }
        .navItem svg {
          width: 21px;
          height: 21px;
          transition: filter 0.15s ease;
        }
        .navItem.active {
          color: #25d366;
          background: rgba(37, 211, 102, 0.14);
          box-shadow: 0 0 16px 2px rgba(37, 211, 102, 0.45), inset 0 0 10px rgba(37, 211, 102, 0.12);
          text-shadow: 0 0 10px rgba(37, 211, 102, 0.8);
        }
        .navItem.active svg {
          filter: drop-shadow(0 0 5px rgba(37, 211, 102, 0.9));
        }
        .navItem:active {
          background: rgba(255, 255, 255, 0.06);
        }
      `}</style>
    </>
  );
}
