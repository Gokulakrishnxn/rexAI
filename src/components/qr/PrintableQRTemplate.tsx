import React from 'react';
import { View, Text } from 'tamagui';
import { QRDisplay } from './QRDisplay';

interface PrintableQRTemplateProps {
  value: string;
  title?: string;
}

export function PrintableQRTemplate({ value, title = 'Emergency Info' }: PrintableQRTemplateProps) {
  return (
    <View padding="$4" backgroundColor="white" borderRadius="$4">
      <Text fontWeight="bold" fontSize="$5" marginBottom="$3">{title}</Text>
      <QRDisplay value={value} size={240} />
    </View>
  );
}
