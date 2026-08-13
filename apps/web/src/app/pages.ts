import type { ComponentType } from 'react';
import { HomePage } from '../pages/home/HomePage';
import { PhotosPage } from '../pages/photos/PhotosPage';
import { StatusPage } from '../pages/status/StatusPage';
import { WeatherPage } from '../pages/weather/WeatherPage';

export interface DisplayPageDefinition {
  id: string;
  path: string;
  title: string;
  order: number;
  enabled: boolean;
  component: ComponentType;
}

export const displayPages: DisplayPageDefinition[] = [
  { id: 'home', path: '/', title: '首页', order: 0, enabled: true, component: HomePage },
  { id: 'weather', path: '/weather', title: '天气', order: 1, enabled: true, component: WeatherPage },
  { id: 'status', path: '/status', title: '家庭状态', order: 2, enabled: true, component: StatusPage },
  { id: 'photos', path: '/photos', title: '家庭相册', order: 3, enabled: true, component: PhotosPage },
];
