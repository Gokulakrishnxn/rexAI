import React, { useEffect } from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { View } from '@/components/ui/view';
import Animated, {
    useAnimatedProps,
    useSharedValue,
    withRepeat,
    withTiming,
    Easing,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface HeaderWaveProps {
    height?: number;
}

export function HeaderWave({ height = 200 }: HeaderWaveProps) {
    const waveOffset = useSharedValue(0);

    useEffect(() => {
        waveOffset.value = withRepeat(
            withTiming(1, {
                duration: 5000,
                easing: Easing.inOut(Easing.sin),
            }),
            -1,
            true
        );
    }, [waveOffset]);

    const animatedProps = useAnimatedProps(() => {
        const bend = 10 * Math.sin(waveOffset.value * Math.PI * 2);
        const d = `M0,160L48,176C96,192,192,224,288,224C384,224,480,192,576,${165.3 + bend}C672,${139 - bend},768,117,864,128C960,139,1056,181,1152,197.3C1248,213,1344,203,1392,197.3L1440,192L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z`;
        return { d };
    });

    return (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height, overflow: 'hidden' }}>
            <Svg
                height="100%"
                width="100%"
                viewBox="0 0 1440 320"
                preserveAspectRatio="none"
                style={{ position: 'absolute', bottom: 0 }}
            >
                <Defs>
                    <LinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <Stop offset="0%" stopColor="#003B7D" stopOpacity="1" />
                        <Stop offset="100%" stopColor="#007AFF" stopOpacity="1" />
                    </LinearGradient>
                </Defs>
                <AnimatedPath
                    fill="url(#grad)"
                    animatedProps={animatedProps}
                />
            </Svg>
        </View>
    );
}
