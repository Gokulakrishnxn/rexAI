import React from 'react';
import { Accordion, Text } from 'tamagui';

interface ExtractedDataPreviewProps {
  fields: Record<string, string>;
  onEdit?: (key: string, value: string) => void;
}

export function ExtractedDataPreview({ fields }: ExtractedDataPreviewProps) {
  return (
    <Accordion type="multiple">
      <Accordion.Item value="extracted">
        <Accordion.Header>
          <Accordion.Trigger>Extracted data</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>
          {Object.entries(fields).map(([k, v]) => (
            <Text key={k}>{k}: {v}</Text>
          ))}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}
