import React, { Component, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GameText } from '../ui/GameText';
import { ToyButton } from '../ui/Toy';

export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error('3D rendering failed', error); }
  render() {
    if (this.state.failed) return <View style={s.error}>
      <GameText size={18} font="bold">The temple could not appear. This game needs 3D graphics support.</GameText>
      <ToyButton title="Try again" label="Retry renderer" tint="blue" height={50} fontSize={18} onPress={() => this.setState({ failed: false })} />
    </View>;
    return this.props.children;
  }
}
const s = StyleSheet.create({ error: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, gap: 18 } });
