import React from 'react';
import { Card, Text, Checkbox } from 'tamagui';

interface MedicationCardProps {
  name: string;
  dosage: string;
  checked?: boolean;
  onToggle?: () => void;
}

export function MedicationCard({ name, dosage, checked, onToggle }: MedicationCardProps) {
  return (
    <Card padding="$4" borderRadius="$4" backgroundColor="$background" borderWidth={1} borderColor="$borderColor">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <Text fontWeight="600">{name}</Text>
      <Text color="$color">{dosage}</Text>
    </Card>
  );
}
