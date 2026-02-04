import React from 'react';
import { Sheet, Text } from 'tamagui';

interface UploadSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

export function UploadSheet({ open, onOpenChange, children }: UploadSheetProps) {
  return (
    <Sheet modal open={open} onOpenChange={onOpenChange}>
      <Sheet.Handle />
      <Sheet.Frame padding="$4">
        <Text fontWeight="bold">Add record</Text>
        {children}
      </Sheet.Frame>
    </Sheet>
  );
}
