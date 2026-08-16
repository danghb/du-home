import { useCallback } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { DisplayViewport } from '../components/DisplayViewport/DisplayViewport';
import { WeatherAtmosphere } from '../components/WeatherAtmosphere/WeatherAtmosphere';
import { usePageNavigation } from '../hooks/usePageNavigation';
import { usePageDataScheduler } from '../hooks/usePageDataScheduler';
import { useApiData } from '../hooks/useApiData';
import { api } from '../services/api';
import { displayPages } from './pages';

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const loadConfig = useCallback(() => api.config(), []);
  const configState = useApiData(loadConfig, { cacheKey: 'display-config' });
  const enabledPages = displayPages.filter((page) => page.enabled);
  const currentPageId = enabledPages.find((page) => page.path === location.pathname)?.id ?? enabledPages[0]?.id ?? 'home';
  usePageDataScheduler(currentPageId, enabledPages);
  const pageRotation = configState.status === 'ready'
    ? configState.data.data.pageRotation
    : { enabled: false, durationsSeconds: {} };
  usePageNavigation(displayPages, location.pathname, location.search, navigate, pageRotation);
  const nativeViewTransitions = typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === 'function';

  return (
    <DisplayViewport>
      <div className="weather-shell">
        <WeatherAtmosphere />
        <div className={`route-layer ${nativeViewTransitions ? 'native-view-transition' : ''}`} key={location.pathname}><Routes>
          {enabledPages.map((page) => (
            <Route key={page.id} path={page.path} element={<page.component />} />
          ))}
          <Route path="*" element={<Navigate to={{ pathname: '/', search: location.search }} replace />} />
        </Routes></div>
      </div>
    </DisplayViewport>
  );
}
