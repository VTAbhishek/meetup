import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './auth.jsx'
import { LanguageProvider } from './i18n.jsx'
import { LocationProvider } from './location.jsx'
import { applyCountryFont } from './fonts'
import './index.css'

// Apply the saved country's font before the app paints (avoids a flash).
applyCountryFont(localStorage.getItem('country') || 'us')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <LanguageProvider>
        <LocationProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LocationProvider>
      </LanguageProvider>
    </HashRouter>
  </React.StrictMode>
)
