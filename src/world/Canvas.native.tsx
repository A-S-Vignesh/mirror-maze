import React, { ComponentProps } from 'react';
import { PixelRatio } from 'react-native';
import { Canvas as NativeCanvas } from '@react-three/fiber/native';
export { useFrame, useThree } from '@react-three/fiber/native';

// Phones can report 3x+ pixel density; cap it so mid-range GPUs keep a smooth frame rate.
export function Canvas(props: ComponentProps<typeof NativeCanvas>) {
  return <NativeCanvas {...props} onCreated={state => {
    state.setDpr(Math.min(2, PixelRatio.get()));
    props.onCreated?.(state);
  }} />;
}
