export default function TerminalPanel({
  title = 'send.log',
  logs = [],
  stats,
  running = false,
  emptyText = 'Waiting for a run to start…',
  panelRef,
  logEndRef,
}) {
  const showProgress = stats && stats.total > 0;

  return (
    <div className="termWrap" ref={panelRef}>
      <div className="termTitlebar">
        <div className="termDots">
          <span />
          <span />
          <span />
        </div>
        <div className="termTitle">{title}</div>
      </div>

      {showProgress && (
        <>
          <div className="termStatsRow">
            <span>{stats.sent + stats.failed}/{stats.total} processed</span>
            <span className="ok">{stats.sent} ok</span>
            <span className="err">{stats.failed} failed</span>
          </div>
          <div className="termProgressTrack">
            <div
              className="termProgressFill"
              style={{
                width: `${((stats.sent + stats.failed) / Math.max(stats.total, 1)) * 100}%`,
              }}
            />
          </div>
        </>
      )}

      <div className="termBody">
        {logs.length === 0 && (
          <div className="termLine plain">
            <span className="termText">{emptyText}</span>
          </div>
        )}
        {logs.map((l, i) => (
          <div key={i} className={`termLine ${l.cls || 'plain'}`}>
            <span className="termTime">[{l.time || '--:--:--'}]</span>
            <span className="termText">{l.text}</span>
          </div>
        ))}
        {running && (
          <div className="termCursorRow">
            <span>$</span>
            <span className="termCursor" />
          </div>
        )}
        <div ref={logEndRef} />
      </div>

      <style jsx>{`
        .termWrap {
          background: #0a0c10;
          border: 1px solid #232830;
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 12px 40px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.02);
          margin-bottom: 12px;
        }
        .termTitlebar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: #14171d;
          border-bottom: 1px solid #232830;
        }
        .termDots {
          display: flex;
          gap: 6px;
        }
        .termDots span {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
        }
        .termDots span:nth-child(1) { background: #ff5f57; }
        .termDots span:nth-child(2) { background: #febc2e; }
        .termDots span:nth-child(3) { background: #28c840; }
        .termTitle {
          flex: 1;
          text-align: center;
          font-size: 12px;
          color: #8b93a1;
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
          letter-spacing: 0.02em;
        }
        .termStatsRow {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #6b7280;
          font-family: monospace;
          padding: 10px 16px 0;
        }
        .termStatsRow .ok { color: #3ddc84; }
        .termStatsRow .err { color: #ff6b6b; }
        .termProgressTrack {
          height: 4px;
          background: #1c2028;
          border-radius: 2px;
          overflow: hidden;
          margin: 6px 16px 12px;
        }
        .termProgressFill {
          height: 100%;
          background: linear-gradient(90deg, #1a9c4a, #25d366);
          transition: width 0.25s ease;
        }
        .termBody {
          background: #0a0c10;
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
          font-size: 12.5px;
          line-height: 1.75;
          padding: 14px 16px;
          overflow-y: auto;
          max-height: 46vh;
          flex: 1;
        }
        .termLine {
          display: flex;
          gap: 8px;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .termTime {
          color: #4d5560;
          flex-shrink: 0;
        }
        .termLine.ok .termText { color: #3ddc84; }
        .termLine.err .termText { color: #ff6b6b; }
        .termLine.plain .termText { color: #9aa4b2; }
        .termCursorRow {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 2px;
          color: #3ddc84;
        }
        .termCursor {
          width: 7px;
          height: 14px;
          background: #3ddc84;
          animation: termBlink 1s steps(1) infinite;
        }
        @keyframes termBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
