import { Navigate, useLocation } from 'react-router-dom';
import Game from './components/Game/Game';
import { useEffect } from 'react';
import { useCleanup } from '../../hooks/useCleanup';
import type { TPlayerInitData } from '../../types';

function Play() {
  const cleanup = useCleanup();
  const location = useLocation();
  const state = (location.state as { initData: TPlayerInitData[] } & Record<string, unknown>) ?? {};
  const { initData } = state;
  useEffect(() => {
    document.title = 'Play LibreLudo';
    return () => cleanup();
  }, [cleanup]);
  return initData && initData?.length !== 0 ? (
    <Game {...state} />
  ) : (
    <Navigate to="/setup" />
  );
}

export default Play;
