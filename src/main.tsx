import React from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { LocalEditorPage } from './pages/LocalEditorPage'
import { GCSEditorPage } from './pages/GCSEditorPage'

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

const router = createBrowserRouter([
  {
    path: "/lqa-boss",
    element: <LocalEditorPage />,
  },
  {
    path: "/lqa-boss/gcs/:bucket/:prefix/:filename",
    element: <GCSEditorPage />,
  },
  {
    path: "/lqa-boss/gcs/:bucket/:prefix",
    element: <GCSEditorPage />,
  },
  {
    path: "/",
    element: <LocalEditorPage />,
  },
], {
  basename: "/"
})

const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <ChakraProvider value={defaultSystem}>
      <RouterProvider router={router} />
    </ChakraProvider>
  </React.StrictMode>
) 