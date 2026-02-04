import React from 'react';
import { Card, Text } from 'tamagui';

interface AIInsightCardProps {
  title: string;
  message: string;
  variant?: 'info' | 'warning' | 'success';
}

export function AIInsightCard({ title, message, variant = 'info' }: AIInsightCardProps) {
  return (
    <Card padding="$4" borderRadius="$4" backgroundColor="$background" borderLeftWidth={4} borderLeftColor="$blue10">
      <Text fontWeight="bold" fontSize="$4">{title}</Text>
      <Text color="$color" marginTop="$2">{message}</Text>
    </Card>
  );
}
