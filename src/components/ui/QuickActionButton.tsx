import React from 'react';
import { Button, Text } from 'tamagui';

interface QuickActionButtonProps {
  label: string;
  onPress: () => void;
}

export function QuickActionButton({ label, onPress }: QuickActionButtonProps) {
  return (
    <Button onPress={onPress}>
      <Text>{label}</Text>
    </Button>
  );
}
