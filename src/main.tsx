import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App';
import { startInstallPromptCapture } from './features/install/installPromptStore';

// O navegador só avisa uma vez que dá para instalar: escuta desde o começo.
startInstallPromptCapture();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
