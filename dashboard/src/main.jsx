import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MainConsole from './MainConsole.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MainConsole />
  </StrictMode>,
)
