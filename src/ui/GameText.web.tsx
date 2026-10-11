import React from 'react';
import { Text, TextStyle, View } from 'react-native';
import { fonts, GameTextProps } from './fonts';
export { fonts } from './fonts';
export type { GameTextProps } from './fonts';

// Browsers support real text strokes; paint-order keeps the stroke behind the fill.
export function GameText({ children, size = 20, color = '#fff', stroke = '#16306b', strokeWidth = 3, depth = 0,
  font = 'display', style, containerStyle, numberOfLines, align = 'center' }: GameTextProps) {
  const web = {
    WebkitTextStroke: strokeWidth > 0 ? `${strokeWidth * 2}px ${stroke}` : undefined,
    paintOrder: 'stroke fill',
    filter: depth > 0 ? `drop-shadow(0px ${depth}px 0px ${stroke})` : undefined,
  } as unknown as TextStyle;
  return <View style={containerStyle}>
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts[font], fontSize: size, lineHeight: size * 1.18,
      textAlign: align, color, paddingHorizontal: strokeWidth }, web, style]}>{children}</Text>
  </View>;
}
