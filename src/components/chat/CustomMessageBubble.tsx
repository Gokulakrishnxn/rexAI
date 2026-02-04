import React from 'react';
import { View, Text } from 'tamagui';

interface CustomMessageBubbleProps {
  text: string;
  isUser: boolean;
}

export function CustomMessageBubble({ text, isUser }: CustomMessageBubbleProps) {
  return (
    <View
      alignSelf={isUser ? 'flex-end' : 'flex-start'}
      backgroundColor={isUser ? '$blue10' : '$gray4'}
      padding="$3"
      borderRadius="$4"
      maxWidth="80%"
    >
      <Text color={isUser ? 'white' : '$color'}>{text}</Text>
    </View>
  );
}
