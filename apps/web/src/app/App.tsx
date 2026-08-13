import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { DisplayViewport } from '../components/DisplayViewport/DisplayViewport';
import { WeatherAtmosphere } from '../components/WeatherAtmosphere/WeatherAtmosphere';
import { usePageNavigation } from '../hooks/usePageNavigation';
import { displayPages } from './pages';

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  usePageNavigation(displayPages, location.pathname, navigate);

  return (
    <DisplayViewport>
      <div className="weather-shell">
        <WeatherAtmosphere />
        <div className="route-layer"><Routes>
          {displayPages.filter((page) => page.enabled).map((page) => (
            <Route key={page.id} path={page.path} element={<page.component />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes></div>
      </div>
    </DisplayViewport>
  );
}
