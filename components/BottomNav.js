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
          Home
        </Link>

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
          background: rgba(19, 22, 28, 0.98);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-top: 1px solid #22262e;
          padding: 6px 10px calc(6px + env(safe-area-inset-bottom));
        }
        .navItem {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 8px 0 6px;
          color: #6b7280;
          text-decoration: none;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.01em;
          transition: color 0.2s ease;
        }
        .navItem svg {
          width: 22px;
          height: 22px;
          transition: transform 0.2s ease, filter 0.2s ease;
        }
        .navItem.active {
          color: #25d366;
        }
        .navItem.active svg {
          transform: translateY(-1px);
          filter: drop-shadow(0 0 6px rgba(37, 211, 102, 0.5));
        }
        .navItem:active svg {
          transform: scale(0.9);
        }
      `}</style>
    </>
  );
}
