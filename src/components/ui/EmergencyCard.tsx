import React from 'react';
import { Card, Text, XStack } from 'tamagui';

interface EmergencyCardProps {
  name: string;
  bloodType?: string;
  allergies?: string[];
}

export function EmergencyCard({ name, bloodType, allergies }: EmergencyCardProps) {
  return (
    <Card padding="$4" borderRadius="$4" backgroundColor="$background" borderWidth={1} borderColor="$borderColor">
      <Text fontWeight="bold" fontSize="$5">{name}</Text>
      {bloodType && <Text color="$color">{bloodType}</Text>}
      {allergies?.length ? (
        <XStack marginTop="$2" flexWrap="wrap" gap="$1">
          {allergies.map((a) => (
            <Card key={a} backgroundColor="$red9" padding="$1" borderRadius="$2">
              <Text color="white" fontSize="$1">{a}</Text>
            </Card>
          ))}
        </XStack>
      ) : null}
    </Card>
  );
}
