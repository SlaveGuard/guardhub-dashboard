import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { logger } from './lib/logger'

import { ThemeProvider } from './context/ThemeContext'

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: any) => {
      logger.warning('ReactQuery', 'Query failed', {
        message: error?.response?.data?.message ?? error.message,
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error: any) => {
      logger.error('ReactQuery', 'Mutation failed', {
        message: error?.response?.data?.message ?? error.message,
      });
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
