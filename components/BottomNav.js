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
          background: rgba(20, 23, 29, 0.96);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-top: 1px solid #262b34;
          padding: 4px 0 calc(4px + env(safe-area-inset-bottom));
        }
        .navItem {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          padding: 5px 0;
          margin: 0 6px;
          border-radius: 10px;
          color: #7c8592;
          text-decoration: none;
          font-size: 10.5px;
          font-weight: 500;
          transition: color 0.15s ease, background 0.15s ease;
        }
        .navItem svg {
          width: 20px;
          height: 20px;
        }
        .navItem.active {
          color: #25d366;
          background: rgba(37, 211, 102, 0.1);
        }
        .navItem:active {
          background: rgba(255, 255, 255, 0.06);
        }
      `}</style>
    </>
  );
}
