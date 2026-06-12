import './ui.css';

export function Spinner({ size = 20 }) {
  return <span className="spinner" style={{ width: size, height: size }} />;
}

export function FullPageSpinner() {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '60vh',
      }}
    >
      <Spinner size={32} />
    </div>
  );
}
