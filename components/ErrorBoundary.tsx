import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Componente alternativo a mostrar. Si no se pasa, se usa el fallback por defecto. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — Captura errores de renderizado de React.
 *
 * Envuelve el árbol de componentes para que un crash aislado no tire
 * toda la aplicación. Muestra un UI de recuperación con el mensaje de error
 * y un botón para recargar.
 *
 * Uso:
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // En producción, aquí se enviaría a un servicio como Sentry o LogRocket.
    console.error('[OmniTrace] Error no capturado:', error, info.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            fontFamily: "'Inter', system-ui, sans-serif",
            color: '#f1f5f9',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          {/* Ícono de error */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.15)',
              border: '2px solid rgba(239,68,68,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem',
              fontSize: '2rem',
            }}
          >
            ⚠️
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Algo salió mal
          </h1>
          <p style={{ color: '#94a3b8', maxWidth: 420, marginBottom: '2rem', lineHeight: 1.6 }}>
            Se produjo un error inesperado en la aplicación. El equipo ha sido notificado.
            Puedes intentar recargar la página.
          </p>

          {/* Detalle del error (solo en desarrollo) */}
          {import.meta.env.DEV && this.state.error && (
            <details
              style={{
                background: 'rgba(15,23,42,0.8)',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '1rem 1.5rem',
                marginBottom: '2rem',
                maxWidth: 600,
                textAlign: 'left',
                fontSize: '0.75rem',
                color: '#f87171',
                fontFamily: 'monospace',
              }}
            >
              <summary style={{ cursor: 'pointer', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Ver detalle del error
              </summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}

          <button
            onClick={this.handleReload}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '0.75rem 2rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Recargar aplicación
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
