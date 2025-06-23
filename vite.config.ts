import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/lqa-boss/',
  plugins: [react()],
  server: {
    port: 3000
  },
  optimizeDeps: {
    include: [
      '@lexical/react/LexicalComposer',
      '@lexical/react/LexicalPlainTextPlugin',
      '@lexical/react/LexicalContentEditable',
      '@lexical/react/LexicalHistoryPlugin',
      '@lexical/react/LexicalOnChangePlugin',
      '@lexical/react/LexicalComposerContext',
      '@lexical/react/LexicalErrorBoundary',
      'lexical'
    ]
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'chakra-vendor': ['@chakra-ui/react', '@emotion/react', '@emotion/styled'],
          'lexical-vendor': ['lexical'],
          'utils': ['jszip', 'react-icons']
        }
      }
    }
  }
}) 