import { useEffect } from 'react';
import {
    useSharedValue,
    useAnimatedStyle,
    withDelay,
    withTiming,
    Easing,
} from 'react-native-reanimated';

export function useEntranceAnimation(index: number = 0, delayStep: number = 100) {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(20);

    useEffect(() => {
        const totalDelay = index * delayStep;

        opacity.value = withDelay(
            totalDelay,
            withTiming(1, {
                duration: 600,
                easing: Easing.out(Easing.quad),
            })
        );

        translateY.value = withDelay(
            totalDelay,
            withTiming(0, {
                duration: 600,
                easing: Easing.out(Easing.quad),
            })
        );
    }, [index, delayStep]);

    return useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));
}
