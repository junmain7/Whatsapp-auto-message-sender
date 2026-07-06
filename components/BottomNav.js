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
          <span className="iconWrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V21h14V9.5" />
            </svg>
          </span>
          Home
        </Link>

        <Link href="/logs" className={`navItem ${isHistory ? 'active' : ''}`}>
          <span className="iconWrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8v4l3 3" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </span>
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
          justify-content: center;
          gap: 22px;
          background: rgba(20, 23, 29, 0.92);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-top: 1px solid #262b34;
          padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
        }
        .navItem {
          flex: 0 1 140px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 8px 6px;
          border-radius: 14px;
          color: #7c8592;
          text-decoration: none;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
          transition: color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, text-shadow 0.18s ease, transform 0.15s ease;
        }
        .iconWrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.03);
          transition: background 0.18s ease, box-shadow 0.18s ease;
        }
        .navItem svg {
          width: 20px;
          height: 20px;
          transition: filter 0.18s ease;
        }
        .navItem.active {
          color: #25d366;
          background: rgba(37, 211, 102, 0.14);
          box-shadow: 0 0 16px 2px rgba(37, 211, 102, 0.45), inset 0 0 10px rgba(37, 211, 102, 0.12);
          text-shadow: 0 0 10px rgba(37, 211, 102, 0.8);
        }
        .navItem.active .iconWrap {
          background: rgba(37, 211, 102, 0.18);
          box-shadow: 0 0 14px 2px rgba(37, 211, 102, 0.4);
        }
        .navItem.active svg {
          filter: drop-shadow(0 0 5px rgba(37, 211, 102, 0.9));
        }
        .navItem:active {
          transform: scale(0.94);
          background: rgba(255, 255, 255, 0.06);
        }
      `}</style>
    </>
  );
}
