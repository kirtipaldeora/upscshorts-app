import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import './index.css'
import App from './App'

// Register all solid FA icons globally
library.add(fas)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
