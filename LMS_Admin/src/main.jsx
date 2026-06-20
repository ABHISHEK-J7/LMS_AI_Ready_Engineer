import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './theme/ThemeProvider';
import { ToastProvider, ConfirmProvider } from './components/ui';
import { apiErrorMessage } from './lib/api';
import { emitErrorToast } from './lib/toastBus';
import './styles/global.css';
import './styles/admin-theme.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
    // Default safety net: any mutation that doesn't handle its own error still
    // surfaces a toast, so admin actions never fail silently.
    mutations: { onError: (err) => emitErrorToast(apiErrorMessage(err)) },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
