export function SkeletonBlock({ width = '100%', height = 14, radius = 6, style }) {
  return (
    <div
      className="skeletonBlock"
      style={{ width, height, borderRadius: radius, ...style }}
    >
      <style jsx>{`
        .skeletonBlock {
          background: linear-gradient(90deg, #171b22 25%, #20242d 37%, #171b22 63%);
          background-size: 400% 100%;
          animation: skeletonShine 1.4s ease infinite;
        }
        @keyframes skeletonShine {
          0% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </div>
  );
}

export function SkeletonRunCard() {
  return (
    <div
      style={{
        background: '#14171d',
        border: '1px solid #262b34',
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ flex: 1 }}>
        <SkeletonBlock width="55%" height={13} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="80%" height={11} />
      </div>
      <SkeletonBlock width={16} height={16} radius={4} />
    </div>
  );
}

export function SkeletonRunList({ count = 5 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRunCard key={i} />
      ))}
    </>
  );
}

export function SkeletonDetailRow() {
  return (
    <tr style={{ borderTop: '1px solid #232830' }}>
      <td style={{ padding: '10px 12px' }}>
        <SkeletonBlock width={18} height={11} />
      </td>
      <td style={{ padding: '10px 12px' }}>
        <SkeletonBlock width="70%" height={11} />
      </td>
      <td style={{ padding: '10px 12px' }}>
        <SkeletonBlock width={40} height={11} style={{ marginLeft: 'auto' }} />
      </td>
    </tr>
  );
}

export function SkeletonDetailCard() {
  return (
    <div
      style={{
        background: '#14171d',
        border: '1px solid #262b34',
        borderRadius: 10,
        padding: 14,
        marginBottom: 14,
      }}
    >
      <SkeletonBlock width="45%" height={14} style={{ marginBottom: 8 }} />
      <SkeletonBlock width="75%" height={11} />
    </div>
  );
}
