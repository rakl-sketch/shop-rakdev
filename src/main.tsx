import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Providers } from './app/Providers';
import './styles/global.css';

type ErrorBoundaryState = { hasError: boolean };

class AppErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Shop rakDEV] React gagal merender aplikasi:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <main role="alert" style={{ padding: '2rem', maxWidth: 640, margin: '10vh auto', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Aplikasi mengalami kendala.</h1>
        <p>Muat ulang halaman. Jika masalah berlanjut, periksa konfigurasi aplikasi.</p>
      </main>;
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <Providers><App/></Providers>
    </AppErrorBoundary>
  </React.StrictMode>,
);
