interface ProgressBarProps {
  progress: number; // 0-100
  isActive: boolean;
}

export const ProgressBar = ({ progress, isActive }: ProgressBarProps) => {
  if (!isActive) return null;

  return (
    <div style={{
      width: '100%',
      marginTop: '8px',
      padding: '0',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px',
        fontSize: '12px',
        color: '#666',
      }}>
        <span>Parsing...</span>
        <span>{progress}%</span>
      </div>
      <div style={{
        width: '100%',
        height: '4px',
        backgroundColor: '#e9e9e7',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div
          style={{
            height: '100%',
            backgroundColor: '#37352f',
            borderRadius: '2px',
            width: `${progress}%`,
            transition: 'width 0.1s ease',
          }}
        />
      </div>
    </div>
  );
}; 