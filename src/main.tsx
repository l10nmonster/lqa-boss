import React from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import App from './App'

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/lqa-boss/sw.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope)
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error)
      })
  })
}

// PWA File Handling API
if ('launchQueue' in window && window.launchQueue) {
  console.log("PWA Launch Queue API is available")
  // This will be handled in the App component
}

const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <ChakraProvider value={defaultSystem}>
      <App />
    </ChakraProvider>
  </React.StrictMode>
) 