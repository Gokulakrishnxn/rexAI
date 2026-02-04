import React from 'react';
import { YStack, type YStackProps } from 'tamagui';

interface ResponsiveContainerProps extends YStackProps {
    children: React.ReactNode;
    maxWidth?: number;
}

/**
 * A container that ensures content is centered and width-capped on larger screens.
 * Expert-level responsive layout helper @Apple.
 */
export function ResponsiveContainer({
    children,
    maxWidth = 800,
    ...props
}: ResponsiveContainerProps) {
    return (
        <YStack
            alignSelf="center"
            width="100%"
            maxWidth={maxWidth}
            flex={1}
            {...props}
        >
            {children}
        </YStack>
    );
}
