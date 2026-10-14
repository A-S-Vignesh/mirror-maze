import React, { ComponentProps } from 'react';
import { PixelRatio } from 'react-native';
import { Canvas as NativeCanvas } from '@react-three/fiber/native';
import { AdaptiveResolution } from './AdaptiveResolution';
export { useFrame, useThree } from '@react-three/fiber/native';

// Keep high-density phone renders crisp without paying the full 2x+ pixel fill cost.
export function Canvas(props: ComponentProps<typeof NativeCanvas>) {
  const maxDpr = Math.min(1.5, PixelRatio.get());
  return <NativeCanvas {...props} onCreated={state => {
    state.setDpr(maxDpr);
    props.onCreated?.(state);
  }}>{props.children}<AdaptiveResolution maxDpr={maxDpr} /></NativeCanvas>;
}
