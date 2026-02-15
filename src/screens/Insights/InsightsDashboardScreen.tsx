import React, { useState, useCallback } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, XStack, YStack, Card, Button } from 'tamagui';
import {
    TrendingUp,
    ChevronRight,
    Sparkles,
    Activity,
    Calendar,
    FileText,
    PlusCircle,
    Scan,
    Heart,
    AlertTriangle,
    Shield
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { getInsightsHistory } from '../../services/api/backendApi';
import { useAuthStore } from '../../store/useAuthStore';
import type { InsightsStackParamList } from '../../navigation/stacks/InsightsStack';

type NavigationProp = NativeStackNavigationProp<InsightsStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function InsightsDashboardScreen() {
    const navigation = useNavigation<NavigationProp>();
    const { user: profile } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [insights, setInsights] = useState<any[]>([]);

    const fetchHistory = useCallback(async () => {
        try {
            const response = await getInsightsHistory(10);
            if (response.success && response.insights) {
                setInsights(response.insights);
            }
        } catch (error) {
            console.error('[Insights] Fetch error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchHistory();
        }, [fetchHistory])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchHistory();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleScan = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled && result.assets[0].uri) {
            const asset = result.assets[0];

            // Navigate to the combined processing stack
            (navigation as any).navigate('RecordsTab', {
                screen: 'DocumentProcessing',
                params: {
                    fileUri: asset.uri,
                    fileName: asset.fileName || 'Scanned Record.jpg',
                    mimeType: asset.mimeType || 'image/jpeg',
                    userId: profile?.id,
                    targetScreen: 'MedicalInsights'
                }
            });
        }
    };

    const getInsightIcon = (type: string) => {
        switch (type) {
            case 'medication': return <Heart size={20} color="#007AFF" />;
            case 'safety': return <Shield size={20} color="#34C759" />;
            case 'trend': return <TrendingUp size={20} color="#AF52DE" />;
            default: return <Sparkles size={20} color="#FF9500" />;
        }
    };

    const renderInsightCard = (insight: any) => {
        const title = insight.title || insight.documents?.file_name || 'Health Insight';
        const summary = insight.ai_summary || 'Analysis complete. View details for deep clinical insights.';
        const type = insight.insight_type || 'full_analysis';

        return (
            <TouchableOpacity
                key={insight.id}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('MedicalInsights', {
                        documentId: insight.document_id,
                        documentTitle: title
                    });
                }}
            >
                <Card
                    padding="$4"
                    borderRadius="$5"
                    backgroundColor="white"
                    marginBottom="$3"
                    borderWidth={1}
                    borderColor="#E5E5EA"
                    pressStyle={{ scale: 0.98 }}
                >
                    <YStack gap="$2">
                        <XStack justifyContent="space-between" alignItems="center">
                            <XStack gap="$3" alignItems="center" flex={1}>
                                <YStack
                                    width={40}
                                    height={40}
                                    borderRadius={20}
                                    backgroundColor="#F2F7FF"
                                    alignItems="center"
                                    justifyContent="center"
                                >
                                    {getInsightIcon(type)}
                                </YStack>
                                <YStack flex={1}>
                                    <Text fontSize={16} fontWeight="700" color="#1C1C1E" numberOfLines={1}>
                                        {title}
                                    </Text>
                                    <XStack gap="$2" alignItems="center">
                                        <Calendar size={12} color="#8E8E93" />
                                        <Text fontSize={12} color="#8E8E93">
                                            {new Date(insight.created_at).toLocaleDateString()}
                                        </Text>
                                    </XStack>
                                </YStack>
                            </XStack>
                            <ChevronRight size={20} color="#C7C7CC" />
                        </XStack>

                        {summary && (
                            <Text fontSize={13} color="#4A5568" numberOfLines={2} marginTop="$1" lineHeight={18}>
                                {summary}
                            </Text>
                        )}

                        <XStack marginTop="$1" gap="$2">
                            <View style={[styles.typeBadge, { backgroundColor: type === 'alert' ? '#FFF0F0' : '#F2F7FF' }]}>
                                <Text fontSize={10} fontWeight="700" color={type === 'alert' ? '#FF3B30' : '#007AFF'} textTransform="uppercase">
                                    {type.replace('_', ' ')}
                                </Text>
                            </View>
                        </XStack>
                    </YStack>
                </Card>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header */}
                <YStack paddingHorizontal="$4" paddingTop="$4" paddingBottom="$4">
                    <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
                        <YStack>
                            <Text fontSize={28} fontWeight="800" color="#1C1C1E">
                                Health Insights
                            </Text>
                            <Text fontSize={15} color="#8E8E93" marginTop="$1">
                                Your AI-powered medical analysis
                            </Text>
                        </YStack>
                        <YStack
                            width={48}
                            height={48}
                            borderRadius={24}
                            backgroundColor="#F2F7FF"
                            alignItems="center"
                            justifyContent="center"
                        >
                            <TrendingUp size={24} color="#007AFF" />
                        </YStack>
                    </XStack>
                </YStack>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />
                    }
                >
                    {/* Action Card: Scan New Prescription */}
                    <YStack paddingHorizontal="$4" marginBottom="$6">
                        <TouchableOpacity activeOpacity={0.9} onPress={handleScan}>
                            <LinearGradient
                                colors={['#007AFF', '#005BB5']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.scanCard}
                            >
                                <XStack gap="$4" alignItems="center">
                                    <YStack
                                        width={56}
                                        height={56}
                                        borderRadius={16}
                                        backgroundColor="rgba(255,255,255,0.2)"
                                        alignItems="center"
                                        justifyContent="center"
                                    >
                                        <Scan size={28} color="white" />
                                    </YStack>
                                    <YStack flex={1}>
                                        <Text fontSize={18} fontWeight="700" color="white">
                                            Scan New Record
                                        </Text>
                                        <Text fontSize={13} color="rgba(255,255,255,0.8)" marginTop="$1">
                                            Start a detailed AI analysis for new prescriptions or lab reports
                                        </Text>
                                    </YStack>
                                    <YStack
                                        width={32}
                                        height={32}
                                        borderRadius={16}
                                        backgroundColor="rgba(255,255,255,0.2)"
                                        alignItems="center"
                                        justifyContent="center"
                                    >
                                        <PlusCircle size={20} color="white" />
                                    </YStack>
                                </XStack>
                            </LinearGradient>
                        </TouchableOpacity>
                    </YStack>

                    {/* History Section */}
                    <YStack paddingHorizontal="$4">
                        <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
                            <Text fontSize={18} fontWeight="700" color="#1C1C1E">
                                Insight History
                            </Text>
                            {insights.length > 0 && (
                                <View style={styles.countBadge}>
                                    <Text fontSize={12} fontWeight="600" color="#007AFF">
                                        {insights.length} Total
                                    </Text>
                                </View>
                            )}
                        </XStack>

                        {loading ? (
                            <YStack paddingVertical="$10" alignItems="center">
                                <ActivityIndicator size="small" color="#007AFF" />
                                <Text fontSize={14} color="#8E8E93" marginTop="$3">Loading your history...</Text>
                            </YStack>
                        ) : insights.length > 0 ? (
                            insights.map(renderInsightCard)
                        ) : (
                            <YStack
                                paddingVertical="$10"
                                paddingHorizontal="$6"
                                backgroundColor="white"
                                borderRadius={20}
                                alignItems="center"
                                borderWidth={1}
                                borderColor="#F0F0F0"
                                borderStyle="dashed"
                            >
                                <View style={styles.emptyIconContainer}>
                                    <Sparkles size={40} color="#C7C7CC" />
                                </View>
                                <Text fontSize={18} fontWeight="700" color="#1C1C1E" marginTop="$4">
                                    No Insights Yet
                                </Text>
                                <Text fontSize={14} color="#8E8E93" textAlign="center" marginTop="$2" lineHeight={20}>
                                    Upload a medical document or scan a prescription to see personalized AI insights here.
                                </Text>
                                <Button
                                    marginTop="$6"
                                    backgroundColor="#E8F1FF"
                                    onPress={handleScan}
                                    pressStyle={{ opacity: 0.7 }}
                                >
                                    <Text color="#007AFF" fontWeight="600">Scan First Document</Text>
                                </Button>
                            </YStack>
                        )}
                    </YStack>

                    {/* AI Tips Section */}
                    <YStack paddingHorizontal="$4" marginTop="$6">
                        <XStack gap="$2" alignItems="center" marginBottom="$3">
                            <Sparkles size={18} color="#007AFF" />
                            <Text fontSize={18} fontWeight="700" color="#1C1C1E">Deep Health Analysis</Text>
                        </XStack>
                        <Card padding="$4" borderRadius="$5" backgroundColor="#F8F9FF" borderWidth={1} borderColor="#E0E7FF">
                            <YStack gap="$3">
                                <XStack gap="$3" alignItems="flex-start">
                                    <View style={{ marginTop: 2 }}>
                                        <Activity size={18} color="#007AFF" />
                                    </View>
                                    <Text fontSize={14} color="#4A5568" lineHeight={20} flex={1}>
                                        RexAI cross-references your medications with known conditions to identify potential safety risks.
                                    </Text>
                                </XStack>
                                <XStack gap="$3" alignItems="flex-start">
                                    <View style={{ marginTop: 2 }}>
                                        <TrendingUp size={18} color="#007AFF" />
                                    </View>
                                    <Text fontSize={14} color="#4A5568" lineHeight={20} flex={1}>
                                        Analyzing your lab reports over time helps rexAI track trends in your health metrics.
                                    </Text>
                                </XStack>
                            </YStack>
                        </Card>
                    </YStack>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scanCard: {
        padding: 20,
        borderRadius: 24,
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 8,
    },
    countBadge: {
        backgroundColor: '#F2F7FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F8F9FA',
        alignItems: 'center',
        justifyContent: 'center',
    },
    typeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
});
