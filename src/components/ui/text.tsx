import { forwardRef } from 'react';
import { Text as RNText, type TextProps } from 'react-native';

export const Text = forwardRef<RNText, TextProps>(
    ({ style, ...otherProps }, ref) => {
        return (
            <RNText
                ref={ref}
                style={[style]}
                {...otherProps}
            />
        );
    }
);
