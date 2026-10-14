import { useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useFrame, useThree } from './Canvas';
import type { WorldMode } from './World';

declare global {
  interface Window { __MIRROR_MAZE_PERF__?: boolean }
}

export function PerformanceStats({ mode, chapter, stage }: { mode: WorldMode; chapter: number; stage: string }) {
  const { gl, viewport } = useThree();
  const enabled = __DEV__ && (Platform.OS !== 'web' || (typeof window !== 'undefined' && window.__MIRROR_MAZE_PERF__ === true));
  const renderCpuMs = useRef(0);
  const frame = useRef({ started: performance.now(), last: performance.now(), count: 0, totalMs: 0, maxMs: 0, first: true, longTasks: 0 });

  useLayoutEffect(() => {
    if (!enabled) return;
    const stats = frame.current;
    stats.started = performance.now();
    stats.last = stats.started;
    stats.count = 0;
    stats.totalMs = 0;
    stats.maxMs = 0;
    stats.first = true;
    stats.longTasks = 0;
    console.info('[Mirror Maze perf] scene committed', { mode, chapter, stage });
  }, [enabled, mode, chapter, stage]);

  useLayoutEffect(() => {
    if (!enabled) return;
    const originalRender = gl.render;
    gl.render = (scene, camera) => {
      const started = performance.now();
      try {
        originalRender.call(gl, scene, camera);
      } finally {
        renderCpuMs.current = performance.now() - started;
      }
    };
    return () => { gl.render = originalRender; };
  }, [enabled, gl]);

  useLayoutEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof PerformanceObserver === 'undefined') return;
    const observer = new PerformanceObserver(entries => {
      frame.current.longTasks += entries.getEntries().length;
    });
    try {
      observer.observe({ type: 'longtask', buffered: false });
    } catch (cause) {
      console.warn('[Mirror Maze perf] Long-task instrumentation unavailable', cause);
      return;
    }
    return () => observer.disconnect();
  }, [enabled]);

  useFrame((_, delta) => {
    if (!enabled) return;
    const now = performance.now();
    const stats = frame.current;
    if (stats.first) {
      stats.first = false;
      const sceneReady = { mode, chapter, stage, ms: Math.round(now - stats.started) };
      console.info('[Mirror Maze perf] first frame after scene commit', sceneReady);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mirror-maze-performance', { detail: { type: 'scene-ready', ...sceneReady } }));
      }
    }
    const ms = delta * 1000;
    stats.count++;
    stats.totalMs += ms;
    stats.maxMs = Math.max(stats.maxMs, ms);
    if (now - stats.last < 2000) return;
    const sample = {
      type: 'frame-sample',
      mode, chapter, stage,
      fps: Math.round(stats.count * 1000 / (now - stats.last)),
      avgFrameMs: Math.round(stats.totalMs / stats.count * 10) / 10,
      maxFrameMs: Math.round(stats.maxMs * 10) / 10,
      renderCpuMs: Math.round(renderCpuMs.current * 10) / 10,
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      dpr: viewport.dpr,
      longTasks: stats.longTasks,
    };
    console.info('[Mirror Maze perf]', sample);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mirror-maze-performance', { detail: sample }));
    }
    stats.started = now;
    stats.last = now;
    stats.count = 0;
    stats.totalMs = 0;
    stats.maxMs = 0;
    stats.longTasks = 0;
  }, -1);
  return null;
}
