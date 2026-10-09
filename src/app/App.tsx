import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './session';
import type { GameService } from '../types';

const Landing = lazy(() => import('../pages/Landing'));
const Home = lazy(() => import('../pages/Home'));
const AcademyTracks = lazy(() => import('../pages/AcademyTracks'));
const AcademySession = lazy(() => import('../pages/AcademySession'));
const Battle = lazy(() => import('../pages/Battle'));
const Daily = lazy(() => import('../pages/Daily'));
const Progress = lazy(() => import('../pages/Progress'));
const NotFound = lazy(() => import('../pages/NotFound'));

export const ROUTES = {
  landing: '/',
  home: '/home',
  academy: '/academy',
  academyTrack: (track: string, count?: number) => `/academy/${track}${count ? `?count=${count}` : ''}`,
  battle: '/battle',
  daily: '/daily',
  progress: '/progress',
} as const;

function PageFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-navy-900 text-white" role="status">
      Loading…
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/home" element={<Home />} />
        <Route path="/academy" element={<AcademyTracks />} />
        <Route path="/academy/:track" element={<AcademySession />} />
        <Route path="/battle" element={<Battle />} />
        <Route path="/daily" element={<Daily />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default function App({ service }: { service?: GameService }) {
  return (
    <SessionProvider service={service}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SessionProvider>
  );
}
