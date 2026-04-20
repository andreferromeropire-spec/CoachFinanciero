export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal to-teal-hover flex items-center justify-center mb-6 shadow-lg">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-hi mb-2">Sin conexión</h1>
      <p className="text-mid text-base mb-6 max-w-sm">
        Los datos se sincronizarán automáticamente cuando vuelvas a tener internet.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-gradient-to-r from-teal to-teal-hover text-white font-semibold
                   rounded-2xl shadow-md hover:shadow-lg transition-all"
      >
        Reintentar
      </button>
    </div>
  );
}
