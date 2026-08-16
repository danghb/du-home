import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DisplayViewport } from '../components/DisplayViewport/DisplayViewport';
import { StatusDemoPage } from './StatusDemoPage';
import '../styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DisplayViewport>
      <StatusDemoPage />
    </DisplayViewport>
  </StrictMode>,
);
