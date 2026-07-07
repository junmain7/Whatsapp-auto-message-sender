export default function TopBar({ title, subtitle }) {
  return (
    <div className="topBar">
      <h1>{title}</h1>
      {subtitle && <p className="sub">{subtitle}</p>}

      <style jsx>{`
        .topBar {
          flex-shrink: 0;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 400;
          padding: 14px 16px;
          background: rgba(11, 13, 17, 0.98);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid #262b34;
        }
        h1 {
          font-size: 19px;
          font-weight: 600;
          margin: 0 0 3px;
          letter-spacing: -0.01em;
          max-width: 560px;
          margin-left: auto;
          margin-right: auto;
          color: #e8e9ec;
        }
        .sub {
          color: #7c8592;
          font-size: 12.5px;
          margin: 0;
          max-width: 560px;
          margin-left: auto;
          margin-right: auto;
        }
      `}</style>
    </div>
  );
}
