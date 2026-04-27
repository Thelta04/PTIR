import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css' 
import './login.css' 
import { PorscheDesignSystemProvider } from '@porsche-design-system/components-react'
import App from './App.jsx'
import 'leaflet/dist/leaflet.css'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PorscheDesignSystemProvider>
      <App />
    </PorscheDesignSystemProvider>
  </StrictMode>,
)
