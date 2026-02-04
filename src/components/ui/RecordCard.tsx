import React from 'react';
import { Card, Text } from 'tamagui';

interface RecordCardProps {
  title: string;
  date: string;
  type: string;
  onPress?: () => void;
}

export function RecordCard({ title, date, type, onPress }: RecordCardProps) {
  return (
    <Card padding="$4" borderRadius="$4" backgroundColor="$background" borderWidth={1} borderColor="$borderColor" onPress={onPress}>
      <Text fontWeight="600">{title}</Text>
      <Text color="$color" fontSize="$2">{date} · {type}</Text>
    </Card>
  );
}
