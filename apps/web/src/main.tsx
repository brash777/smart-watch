import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque';
import './i18n';
import './styles/index.css';
import { App } from './app/app';

const root = document.getElementById('root');
if (root === null) throw new Error('index.html has no #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
