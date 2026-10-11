import React, { ComponentProps, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Canvas as WebCanvas } from '@react-three/fiber';
import { GameText } from '../ui/GameText';
import { ToyButton } from '../ui/Toy';
export { useFrame, useThree } from '@react-three/fiber';

export function Canvas(props: ComponentProps<typeof WebCanvas>) {
  const [lost,setLost]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const cleanup=useRef<()=>void>(()=>{});
  useEffect(()=>()=>cleanup.current(),[]);
  if(lost) return <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:24,gap:15}}>
    <GameText size={18} font="bold">Graphics were interrupted. Your puzzle is safe!</GameText>
    <ToyButton title="Restore graphics" tint="blue" height={50} fontSize={18} onPress={()=>{cleanup.current();setAttempt(n=>n+1);setLost(false);}}/>
  </View>;
  return <WebCanvas key={attempt} dpr={[1, 1.75]} {...props} onCreated={state=>{
    const canvas=state.gl.domElement;
    const onLost=(event:Event)=>{event.preventDefault();console.warn('WebGL context lost; graphics recovery is available.');setLost(true);};
    cleanup.current();
    canvas.addEventListener('webglcontextlost',onLost);
    cleanup.current=()=>canvas.removeEventListener('webglcontextlost',onLost);
    props.onCreated?.(state);
  }}/>;
}
