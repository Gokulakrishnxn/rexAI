import { Image as ExpoImage, type ImageProps } from 'expo-image';
import { forwardRef } from 'react';

export const Image = forwardRef<ExpoImage, ImageProps>(
    ({ style, ...props }, ref) => {
        return (
            <ExpoImage
                ref={ref}
                style={[style]}
                {...props}
            />
        );
    }
);
