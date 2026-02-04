import React from 'react';
import QRCode from 'react-native-qrcode-svg';
import { View } from 'tamagui';

interface QRDisplayProps {
  value: string;
  size?: number;
}

export function QRDisplay({ value, size = 200 }: QRDisplayProps) {
  return (
    <View alignItems="center" justifyContent="center">
      <QRCode value={value} size={size} />
    </View>
  );
}
