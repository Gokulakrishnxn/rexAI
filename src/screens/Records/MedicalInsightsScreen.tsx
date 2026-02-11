import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Animated,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, XStack, YStack } from 'tamagui';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Heart,
  Droplet,
  FileText,
  Stethoscope,
  Calendar,
  ChevronRight,
  Pill,
  Salad,
  Dumbbell,
  CalendarClock,
  Shield,
  Target,
  Bot,
  MessageCircle,
  Plus,
  Check,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Line, G, Text as SvgText } from 'react-native-svg';
import { analyzeDocumentFull, StructuredInsight, confirmMedicationPlan } from '../../services/api/backendApi';
import { supabase } from '../../services/supabase';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type NavigationProp = NativeStackNavigationProp<any>;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RouteParams {
  documentId: string;
  documentTitle: string;
  extractedText?: string;
}

// Analysis steps for loading UI
type AnalysisStep = 'fetching' | 'extracting' | 'validating' | 'analyzing' | 'generating' | 'complete' | 'error';

export function MedicalInsightsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { documentId, documentTitle, extractedText } = route.params as RouteParams;

  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(true);
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('fetching');
  const [insight, setInsight] = useState<StructuredInsight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetricTab, setSelectedMetricTab] = useState('Health Score');
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  
  // Accordion state for Safety Q&A
  const [expandedQA, setExpandedQA] = useState<number | null>(null);
  
  // Track which medications have been added
  const [addedMedications, setAddedMedications] = useState<Set<string>>(new Set());
  const [savingMedication, setSavingMedication] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start pulse animation for loading
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();

    fetchAndAnalyze();

    return () => pulse.stop();
  }, []);

  const getStepLabel = (step: AnalysisStep): string => {
    switch (step) {
      case 'fetching': return 'Retrieving document...';
      case 'extracting': return 'Extracting text content...';
      case 'validating': return 'Validating medical data...';
      case 'analyzing': return 'Analyzing with AI...';
      case 'generating': return 'Generating insights...';
      case 'complete': return 'Complete!';
      case 'error': return 'Analysis failed';
      default: return 'Processing...';
    }
  };

  const fetchAndAnalyze = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      setAnalyzing(true);
      setError(null);
      setAnalysisStep('fetching');

      console.log('[MedicalInsights] Starting full analysis for documentId:', documentId);

      if (!documentId) {
        setError('No document ID provided. Please go back and try again.');
        setAnalysisStep('error');
        setLoading(false);
        setAnalyzing(false);
        return;
      }

      // Step 1: Fetching document
      setAnalysisStep('fetching');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 2: Analyzing with AI (backend handles everything)
      setAnalysisStep('analyzing');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 3: Generating insights
      setAnalysisStep('generating');
      
      // Call the full agentic analysis pipeline
      const result = await analyzeDocumentFull(documentId, forceRefresh);

      console.log('[MedicalInsights] Analysis result:', {
        success: result.success,
        cached: result.cached,
        error: result.error
      });

      if (result.success && result.insight) {
        setAnalysisStep('complete');
        setInsight(result.insight);
        animateIn();
      } else {
        setError(result.error || 'AI analysis failed. Please try again later.');
        setAnalysisStep('error');
        setLoading(false);
        setAnalyzing(false);
      }
    } catch (err: any) {
      console.error('[Insights] Error:', err);
      setError(err.message || 'An unexpected error occurred during analysis.');
      setAnalysisStep('error');
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const animateIn = () => {
    setLoading(false);
    setAnalyzing(false);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  // Toggle accordion for Safety Q&A
  const toggleAccordion = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedQA(expandedQA === index ? null : index);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Add medication to user's medication list
  const handleAddMedication = async (medication: string) => {
    if (addedMedications.has(medication) || savingMedication) return;
    
    setSavingMedication(medication);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Parse medication name and dosage from the insight format "DrugName (ActiveIngredient)"
      const drugName = medication.split('(')[0].trim();
      const match = medication.match(/(\d+\s*mg|\d+\s*ml|\d+\s*mcg)/i);
      const dosage = match ? match[1] : '';
      
      const medicationData = [{
        drug_name: drugName,
        dosage: dosage || 'As prescribed',
        frequency_text: 'As directed',
        duration_days: 30,
        instructions: 'Follow your doctor\'s instructions',
        confidence: 1,
        normalized_name: drugName.toLowerCase().trim(),
        form: 'tablet',
        recommended_times: ['09:00'],
      }];

      const result = await confirmMedicationPlan(medicationData);
      
      if (result.success) {
        setAddedMedications(prev => new Set([...prev, medication]));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Added!', `${drugName} has been added to your medication reminders.`);
      } else {
        Alert.alert('Error', result.error || 'Failed to add medication.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add medication.');
    } finally {
      setSavingMedication(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return '#34C759';
      case 'abnormal': return '#FF9500';
      case 'critical': return '#FF3B30';
      default: return '#007AFF';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return { bg: '#FFF3CD', text: '#856404', icon: '#FF9500' };
      case 'medium': return { bg: '#FFF3CD', text: '#856404', icon: '#FF9500' };
      case 'low': return { bg: '#D4EDDA', text: '#155724', icon: '#34C759' };
      default: return { bg: '#E3F2FD', text: '#1565C0', icon: '#007AFF' };
    }
  };

  const getPriorityIcon = (category?: string) => {
    switch (category) {
      case 'diet': return Salad;
      case 'exercise': return Dumbbell;
      case 'medication': return Pill;
      case 'followup': return CalendarClock;
      default: return Target;
    }
  };

  const renderTrendChart = () => {
    // Find the trend matching the selected tab, or use the first one
    const trends = insight?.charts?.trends || [];
    let selectedTrend = trends.find(t => t.label === selectedMetricTab);
    if (!selectedTrend && trends.length > 0) {
      selectedTrend = trends[0];
    }
    
    // Generate fallback data if no trends exist
    const fallbackData = [
      { date: '2025-11-10', value: 105 },
      { date: '2025-12-10', value: 98 },
      { date: '2026-01-10', value: 95 },
      { date: '2026-02-10', value: 92 },
    ];
    
    const data = selectedTrend?.data || fallbackData;
    const chartWidth = SCREEN_WIDTH - 80;
    const chartHeight = 140;
    const padding = 30;

    const values = data.map(d => d.value);
    const minVal = Math.min(...values) * 0.9;
    const maxVal = Math.max(...values) * 1.1;

    const points = data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * (chartWidth - padding * 2);
      const y = chartHeight - padding - ((d.value - minVal) / (maxVal - minVal)) * (chartHeight - padding * 2);
      return { x, y, value: d.value, date: d.date };
    });

    const pathD = points.reduce((acc, p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      return `${acc} L ${p.x} ${p.y}`;
    }, '');

    const handlePointPress = (index: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedPoint(selectedPoint === index ? null : index);
    };

    return (
      <View style={styles.chartContainer}>
        {/* Selected point tooltip */}
        {selectedPoint !== null && points[selectedPoint] && (
          <View style={[styles.tooltip, { left: points[selectedPoint].x - 40, top: points[selectedPoint].y - 45 }]}>
            <Text fontSize={12} fontWeight="600" color="#FFF">{points[selectedPoint].value} mg/dL</Text>
            <Text fontSize={10} color="rgba(255,255,255,0.8)">
              {new Date(points[selectedPoint].date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </Text>
          </View>
        )}

        <Svg width={chartWidth} height={chartHeight}>
          {/* Grid lines */}
          <Line x1={padding} y1={padding - 10} x2={padding} y2={chartHeight - padding} stroke="#E5E5EA" strokeWidth={1} />
          <Line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#E5E5EA" strokeWidth={1} />
          
          {/* Horizontal guide lines */}
          <Line x1={padding} y1={(chartHeight - padding * 2) * 0.25 + padding - 10} x2={chartWidth - padding} y2={(chartHeight - padding * 2) * 0.25 + padding - 10} stroke="#F0F0F0" strokeWidth={1} />
          <Line x1={padding} y1={(chartHeight - padding * 2) * 0.5 + padding - 10} x2={chartWidth - padding} y2={(chartHeight - padding * 2) * 0.5 + padding - 10} stroke="#F0F0F0" strokeWidth={1} />
          <Line x1={padding} y1={(chartHeight - padding * 2) * 0.75 + padding - 10} x2={chartWidth - padding} y2={(chartHeight - padding * 2) * 0.75 + padding - 10} stroke="#F0F0F0" strokeWidth={1} />
          
          {/* Target line */}
          <Line 
            x1={padding} 
            y1={chartHeight - padding - ((100 - minVal) / (maxVal - minVal)) * (chartHeight - padding * 2)} 
            x2={chartWidth - padding} 
            y2={chartHeight - padding - ((100 - minVal) / (maxVal - minVal)) * (chartHeight - padding * 2)} 
            stroke="#34C759" 
            strokeDasharray="6,4" 
            strokeWidth={1.5} 
          />
          
          {/* Trend line */}
          <Path d={pathD} stroke="#007AFF" strokeWidth={2.5} fill="none" />
          
          {/* Data points - base circles */}
          {points.map((p, i) => (
            <Circle 
              key={`base-${i}`} 
              cx={p.x} 
              cy={p.y} 
              r={selectedPoint === i ? 8 : 5} 
              fill={selectedPoint === i ? '#007AFF' : '#FFF'}
              stroke="#007AFF"
              strokeWidth={2}
            />
          ))}
        </Svg>

        {/* Touch targets for data points */}
        {points.map((p, i) => (
          <Pressable
            key={`touch-${i}`}
            onPress={() => handlePointPress(i)}
            style={[styles.touchTarget, { left: p.x - 20, top: p.y - 20 }]}
          />
        ))}
        
        {/* Labels */}
        <XStack justifyContent="space-between" px="$2" mt="$2">
          <Text fontSize={11} color="#8E8E93">Oldest</Text>
          <Text fontSize={11} color="#8E8E93">-2 mo</Text>
          <Text fontSize={11} color="#8E8E93">-1 mo</Text>
          <Text fontSize={11} color="#007AFF" fontWeight="600">Latest</Text>
        </XStack>
        
        {/* Y-axis labels */}
        <View style={styles.yAxisLabels}>
          <Text fontSize={10} color="#8E8E93">High</Text>
          <Text fontSize={10} color="#34C759" fontWeight="500">Target</Text>
          <Text fontSize={10} color="#8E8E93">Low</Text>
        </View>
      </View>
    );
  };

  const renderMetricCard = (vital: any) => {
    const isAboveRange = vital.value > vital.max;
    const isBelowRange = vital.value < vital.min;
    const statusColor = isAboveRange ? '#FF9500' : isBelowRange ? '#FF3B30' : '#34C759';
    const statusText = isAboveRange ? 'Above Target' : isBelowRange ? 'Below Target' : 'Normal';
    const statusBg = isAboveRange ? '#FFF4E5' : isBelowRange ? '#FFE5E5' : '#E8FAF0';

    return (
      <View style={styles.metricCard} key={vital.label}>
        <Text fontSize={13} color="#8E8E93" mb="$1">{vital.label}</Text>
        <Text fontSize={24} fontWeight="700" color="#000">{vital.value} <Text fontSize={14} color="#8E8E93">{vital.unit}</Text></Text>
        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
          <Text fontSize={11} color={statusColor} fontWeight="600">{statusText}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View style={[styles.loadingIcon, analysisStep === 'error' && { backgroundColor: '#FFEBEE' }]}>
              {analysisStep === 'error' ? (
                <AlertTriangle size={40} color="#FF3B30" />
              ) : (
                <Sparkles size={40} color="#007AFF" />
              )}
            </View>
          </Animated.View>
          <Text fontSize={18} fontWeight="600" color="#000" mt="$4">
            {analysisStep === 'error' ? 'Analysis Failed' : 'Analyzing Document...'}
          </Text>
          <Text fontSize={14} color="#8E8E93" mt="$2" textAlign="center" px="$6">
            {analysisStep === 'error' 
              ? error || 'Unable to analyze this document.'
              : getStepLabel(analysisStep)
            }
          </Text>
          {analysisStep !== 'error' ? (
            <View style={styles.loadingSteps}>
              <LoadingStep 
                label="Retrieving document" 
                completed={['extracting', 'validating', 'analyzing', 'generating', 'complete'].includes(analysisStep)} 
                active={analysisStep === 'fetching'} 
              />
              <LoadingStep 
                label="Analyzing with AI" 
                completed={['generating', 'complete'].includes(analysisStep)} 
                active={['validating', 'analyzing'].includes(analysisStep)} 
              />
              <LoadingStep 
                label="Generating insights" 
                completed={analysisStep === 'complete'} 
                active={analysisStep === 'generating'} 
              />
            </View>
          ) : (
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchAndAnalyze()}>
              <Text color="#FFF" fontWeight="600">Retry Analysis</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (!insight) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <AlertTriangle size={48} color="#FF3B30" />
          <Text fontSize={18} fontWeight="600" color="#000" mt="$4">Analysis Failed</Text>
          <Text fontSize={14} color="#8E8E93" mt="$2" textAlign="center" px="$6">
            {error || 'Unable to analyze this document. Please try again.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchAndAnalyze()}>
            <Text color="#FFF" fontWeight="600">Retry Analysis</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButtonAlt} onPress={handleBack}>
            <Text color="#007AFF" fontWeight="600">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ChevronLeft size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text fontSize={17} fontWeight="600" color="#000">Medical Insights</Text>
          <Text fontSize={12} color="#8E8E93">Auto-generated</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <Animated.ScrollView 
        style={[styles.scrollView, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Analysis Summary Card */}
        <View style={styles.summaryCard}>
          <XStack alignItems="center" justifyContent="space-between" mb="$3">
            <XStack alignItems="center" gap="$2">
              <View style={styles.aiIcon}>
                <Sparkles size={20} color="#007AFF" />
              </View>
              <YStack>
                <Text fontSize={15} fontWeight="600" color="#000">Analysis Summary</Text>
                <Text fontSize={12} color="#8E8E93">Generated today</Text>
              </YStack>
            </XStack>
            <View style={styles.trendBadge}>
              <TrendingUp size={14} color="#34C759" />
              <Text fontSize={12} fontWeight="600" color="#34C759" ml="$1">STABLE TREND</Text>
            </View>
          </XStack>

          <Text fontSize={20} fontWeight="700" color="#000" lineHeight={26}>
            {insight.overview?.split('.')[0] || 'Analysis complete'}.
          </Text>
          
          <Text fontSize={14} color="#666" mt="$2" lineHeight={20}>
            {insight.overview?.split('.').slice(1).join('.').trim() || 'Review the findings below.'}
          </Text>

          {/* Key Findings Bullets */}
          <YStack mt="$4" gap="$3">
            {insight.keyFindings?.slice(0, 3).map((finding, idx) => (
              <XStack key={idx} alignItems="flex-start" gap="$2">
                <View style={[styles.bullet, { backgroundColor: getStatusColor(finding.status) }]} />
                <YStack flex={1}>
                  <Text fontSize={14} fontWeight="600" color="#000">{finding.category}:</Text>
                  <Text fontSize={14} color="#666" lineHeight={20}>{finding.finding}</Text>
                </YStack>
              </XStack>
            ))}
          </YStack>
        </View>

        {/* Risk & Alerts */}
        {insight.conditions && insight.conditions.length > 0 && (
          <View style={styles.section}>
            <Text fontSize={16} fontWeight="600" color="#000" mb="$3">Risk & Alerts</Text>
            <YStack gap="$2">
              {insight.conditions.map((condition, idx) => {
                const colors = getSeverityColor(condition.severity);
                return (
                  <View key={idx} style={[styles.alertCard, { backgroundColor: colors.bg }]}>
                    <XStack alignItems="flex-start" gap="$3">
                      <AlertTriangle size={20} color={colors.icon} />
                      <YStack flex={1}>
                        <Text fontSize={14} fontWeight="600" color={colors.text}>{condition.name}</Text>
                        <Text fontSize={13} color={colors.text} mt="$1" lineHeight={18}>{condition.notes}</Text>
                      </YStack>
                    </XStack>
                  </View>
                );
              })}
            </YStack>
          </View>
        )}

        {/* Key Metrics */}
        {insight.charts?.vitals && insight.charts.vitals.length > 0 && (
          <View style={styles.section}>
            <XStack justifyContent="space-between" alignItems="center" mb="$3">
              <XStack alignItems="center" gap="$2">
                <Activity size={18} color="#000" />
                <Text fontSize={16} fontWeight="600" color="#000">Key Metrics</Text>
              </XStack>
              <TouchableOpacity>
                <Text fontSize={14} color="#007AFF" fontWeight="500">View All</Text>
              </TouchableOpacity>
            </XStack>
            <View style={styles.metricsGrid}>
              {insight.charts.vitals.slice(0, 4).map((vital, idx) => renderMetricCard(vital))}
            </View>
          </View>
        )}

        {/* Improvement Trends - Always show chart */}
        <View style={styles.section}>
          <Text fontSize={16} fontWeight="600" color="#000" mb="$1">Improvement Trends</Text>
          <Text fontSize={13} color="#8E8E93" mb="$3">Last 4 reports · Normalized by range</Text>
          
          {/* Metric tabs - use dynamic labels from trends data */}
          {insight?.charts?.trends && insight.charts.trends.length > 0 && (
            <XStack gap="$2" mb="$3">
              {insight.charts.trends.map((trend, idx) => (
                <TouchableOpacity 
                  key={idx}
                  style={[styles.metricTab, selectedMetricTab === trend.label && styles.metricTabActive]}
                  onPress={() => setSelectedMetricTab(trend.label)}
                >
                  <Text 
                    fontSize={13} 
                    fontWeight="500" 
                    color={selectedMetricTab === trend.label ? '#007AFF' : '#8E8E93'}
                  >
                    {trend.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </XStack>
          )}

          {renderTrendChart()}
        </View>

        {/* Safety Q&A Section - Accordion Style */}
        {insight.safetyInsights && insight.safetyInsights.length > 0 && (
          <View style={styles.section}>
            <XStack alignItems="center" gap="$2" mb="$3">
              <Shield size={18} color="#000" />
              <Text fontSize={16} fontWeight="600" color="#000">Safety Q&A</Text>
            </XStack>
            <YStack gap="$2">
              {insight.safetyInsights.map((qa, idx) => {
                const isExpanded = expandedQA === idx;
                return (
                  <TouchableOpacity 
                    key={idx} 
                    activeOpacity={0.8}
                    onPress={() => toggleAccordion(idx)}
                  >
                    <LinearGradient
                      colors={['#F0F7FF', '#E8F4FD', '#F5FAFF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.accordionCard}
                    >
                      <XStack alignItems="center" justifyContent="space-between">
                        <XStack alignItems="center" gap="$2" flex={1}>
                          <Shield size={16} color="#4A90D9" />
                          <Text fontSize={14} fontWeight="600" color="#1A3A5C" flex={1} numberOfLines={isExpanded ? undefined : 1}>
                            {qa.question}
                          </Text>
                        </XStack>
                        {isExpanded ? (
                          <ChevronUp size={18} color="#4A90D9" />
                        ) : (
                          <ChevronDown size={18} color="#4A90D9" />
                        )}
                      </XStack>
                      {isExpanded && (
                        <Text fontSize={13} color="#4A5568" lineHeight={20} mt="$3">
                          {qa.answer}
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </YStack>
          </View>
        )}

        {/* Food Recommendations Section - Horizontal Slider */}
        {insight.foodRecommendations && insight.foodRecommendations.length > 0 && (
          <View style={styles.sectionNoHorizontalPadding}>
            <XStack alignItems="center" gap="$2" mb="$3" px="$4">
              <Salad size={18} color="#000" />
              <Text fontSize={16} fontWeight="600" color="#000">Food Recommendations</Text>
            </XStack>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollContent}
              decelerationRate="fast"
              snapToInterval={SCREEN_WIDTH * 0.75 + 12}
            >
              {insight.foodRecommendations.map((rec, idx) => (
                <View key={idx} style={styles.foodCardHorizontal}>
                  <XStack justifyContent="space-between" alignItems="center" mb="$2">
                    <Text fontSize={14} fontWeight="600" color="#000">{rec.category}</Text>
                    <View style={[styles.scoreBadge, { backgroundColor: rec.score >= 70 ? '#E8FAF0' : rec.score >= 40 ? '#FFF4E5' : '#FFE5E5' }]}>
                      <Text fontSize={12} fontWeight="600" color={rec.score >= 70 ? '#34C759' : rec.score >= 40 ? '#FF9500' : '#FF3B30'}>
                        {rec.score}%
                      </Text>
                    </View>
                  </XStack>
                  <Text fontSize={13} color="#666" mb="$2" numberOfLines={6}>{rec.benefit}</Text>
                  <XStack flexWrap="wrap" gap="$1">
                    {rec.foods.slice(0, 4).map((food, foodIdx) => (
                      <View key={foodIdx} style={styles.foodTag}>
                        <Text fontSize={12} color="#4A5568">{food}</Text>
                      </View>
                    ))}
                  </XStack>
                  {rec.nutrition && (
                    <XStack mt="$2" gap="$3" flexWrap="wrap">
                      {(rec.nutrition.protein ?? 0) > 0 && (
                        <XStack alignItems="center" gap="$1">
                          <Dumbbell size={12} color="#666" />
                          <Text fontSize={11} color="#666">{rec.nutrition.protein}g protein</Text>
                        </XStack>
                      )}
                      {(rec.nutrition.fiber ?? 0) > 0 && (
                        <Text fontSize={11} color="#666">🌾 {rec.nutrition.fiber}g fiber</Text>
                      )}
                      {(rec.nutrition.calories ?? 0) > 0 && (
                        <Text fontSize={11} color="#666">🔥 {rec.nutrition.calories} cal</Text>
                      )}
                    </XStack>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Medication Insights Section */}
        {insight.medicationInsights && insight.medicationInsights.length > 0 && (
          <View style={styles.section}>
            <XStack alignItems="center" gap="$2" mb="$3">
              <Pill size={18} color="#000" />
              <Text fontSize={16} fontWeight="600" color="#000">Medication Insights</Text>
            </XStack>
            <YStack gap="$3">
              {insight.medicationInsights.map((med, idx) => {
                const isAdded = addedMedications.has(med.medication);
                const isSaving = savingMedication === med.medication;
                return (
                  <View key={idx} style={styles.medicationCard}>
                    <XStack justifyContent="space-between" alignItems="flex-start" mb="$2">
                      <Text fontSize={15} fontWeight="600" color="#000" flex={1}>{med.medication}</Text>
                      <TouchableOpacity
                        style={[
                          styles.addMedButton,
                          isAdded && styles.addMedButtonAdded,
                          isSaving && styles.addMedButtonSaving
                        ]}
                        onPress={() => handleAddMedication(med.medication)}
                        disabled={isAdded || isSaving}
                      >
                        {isSaving ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : isAdded ? (
                          <>
                            <Check size={14} color="#FFF" />
                            <Text fontSize={11} fontWeight="600" color="#FFF">Added</Text>
                          </>
                        ) : (
                          <>
                            <Plus size={14} color="#007AFF" />
                            <Text fontSize={11} fontWeight="600" color="#007AFF">Add to List</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </XStack>
                    <YStack gap="$2">
                      <View>
                        <Text fontSize={12} fontWeight="600" color="#2C5282" mb="$1">Why Prescribed:</Text>
                        <Text fontSize={13} color="#4A5568" lineHeight={18}>{med.whyPrescribed}</Text>
                      </View>
                      <View>
                        <Text fontSize={12} fontWeight="600" color="#38A169" mb="$1">Treatment Goal:</Text>
                        <Text fontSize={13} color="#4A5568" lineHeight={18}>{med.treatmentGoal}</Text>
                      </View>
                      {med.sideEffects && med.sideEffects.length > 0 && (
                        <View>
                          <Text fontSize={12} fontWeight="600" color="#E53E3E" mb="$1">Side Effects:</Text>
                          <XStack flexWrap="wrap" gap="$1">
                            {med.sideEffects.slice(0, 3).map((se, seIdx) => (
                              <View key={seIdx} style={styles.sideEffectTag}>
                                <Text fontSize={11} color="#E53E3E">{se}</Text>
                              </View>
                            ))}
                          </XStack>
                        </View>
                      )}
                    </YStack>
                  </View>
                );
              })}
            </YStack>
          </View>
        )}

        {/* Diagnosed Conditions (Inferred from Medications) */}
        {insight.diagnosedConditions && insight.diagnosedConditions.length > 0 && (
          <View style={styles.section}>
            <XStack alignItems="center" gap="$2" mb="$3">
              <Target size={18} color="#000" />
              <Text fontSize={16} fontWeight="600" color="#000">Inferred Conditions</Text>
            </XStack>
            <YStack gap="$3">
              {insight.diagnosedConditions.map((cond, idx) => {
                const confColors = {
                  high: { bg: '#E8FAF0', text: '#34C759' },
                  medium: { bg: '#FFF4E5', text: '#FF9500' },
                  low: { bg: '#F0F0F0', text: '#666' }
                };
                const colors = confColors[cond.confidence] || confColors.medium;
                return (
                  <View key={idx} style={[styles.conditionCard, { backgroundColor: colors.bg }]}>
                    <XStack justifyContent="space-between" alignItems="center" mb="$2">
                      <Text fontSize={14} fontWeight="600" color="#000">{cond.condition}</Text>
                      <View style={styles.confidenceBadge}>
                        <Text fontSize={10} fontWeight="600" color={colors.text}>{cond.confidence.toUpperCase()}</Text>
                      </View>
                    </XStack>
                    <Text fontSize={13} color="#4A5568" lineHeight={18} mb="$2">{cond.description}</Text>
                    <Text fontSize={11} color="#666">Inferred from: {cond.inferredFrom.join(', ')}</Text>
                  </View>
                );
              })}
            </YStack>
          </View>
        )}

        {/* Doctor's Assessment */}
        <View style={styles.section}>
          <XStack alignItems="center" gap="$2" mb="$3">
            <Stethoscope size={18} color="#000" />
            <Text fontSize={16} fontWeight="600" color="#000">Doctor's Assessment</Text>
          </XStack>
          <LinearGradient
            colors={['#F0F7FF', '#E8F4FD', '#F5FAFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.assessmentCard}
          >
            {insight?.doctorAssessment ? (
              <YStack gap="$3">
                <Text fontSize={14} color="#1A3A5C" fontStyle="italic" lineHeight={22}>
                  "{insight.doctorAssessment.greeting}"
                </Text>
                <YStack gap="$2">
                  <Text fontSize={13} fontWeight="600" color="#2C5282">Diagnosis:</Text>
                  <Text fontSize={13} color="#4A5568" lineHeight={20}>
                    {insight.doctorAssessment.diagnosis}
                  </Text>
                </YStack>
                <YStack gap="$2">
                  <Text fontSize={13} fontWeight="600" color="#2C5282">Treatment Plan:</Text>
                  <Text fontSize={13} color="#4A5568" lineHeight={20}>
                    {insight.doctorAssessment.treatmentPlan}
                  </Text>
                </YStack>
                {insight.doctorAssessment.advice?.length > 0 && (
                  <YStack gap="$1">
                    <Text fontSize={13} fontWeight="600" color="#2C5282">Advice:</Text>
                    {insight.doctorAssessment.advice.map((a, i) => (
                      <XStack key={i} alignItems="flex-start" gap="$2">
                        <Text fontSize={12} color="#38A169">•</Text>
                        <Text fontSize={13} color="#4A5568" lineHeight={20} flex={1}>{a}</Text>
                      </XStack>
                    ))}
                  </YStack>
                )}
                {insight.doctorAssessment.warnings?.length > 0 && (
                  <YStack gap="$1" backgroundColor="rgba(245,101,101,0.1)" p="$2" borderRadius="$2">
                    <XStack alignItems="center" gap="$1">
                      <AlertTriangle size={14} color="#E53E3E" />
                      <Text fontSize={13} fontWeight="600" color="#E53E3E">Warnings:</Text>
                    </XStack>
                    {insight.doctorAssessment.warnings.map((w, i) => (
                      <Text key={i} fontSize={13} color="#E53E3E" lineHeight={20}>• {w}</Text>
                    ))}
                  </YStack>
                )}
                <Text fontSize={12} color="#718096" mt="$2">
                  📅 {insight.doctorAssessment.followUp}
                </Text>
              </YStack>
            ) : (
              <Text fontSize={14} color="#1A3A5C" fontStyle="italic" lineHeight={22}>
                "{insight?.overview || 'Analysis in progress...'}"
              </Text>
            )}
          </LinearGradient>
        </View>

        {/* Chat with AI CTA */}
        <View style={styles.actionCard}>
          {/* <View style={styles.aiChatIcon}>
            <Bot size={28} color="#FFF" />
          </View> */}
          <Text fontSize={18} fontWeight="700" color="#FFF" mt="$3">Have Questions?</Text>
          <Text fontSize={14} color="rgba(255,255,255,0.9)" mt="$2" lineHeight={20} textAlign="center">
            Chat with our AI to understand your results better and get personalized advice.
          </Text>
          <TouchableOpacity 
            style={styles.chatButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              navigation.navigate('CoachTab', {
                screen: 'CoachChat',
                params: { documentId, documentTitle }
              });
            }}
          >
            <MessageCircle size={16} color="#1A73E8" />
            <Text fontSize={14} fontWeight="600" color="#1A73E8">Chat Now</Text>
          </TouchableOpacity>
        </View>

        {/* Document Info Footer */}
        <View style={styles.documentFooter}>
          <View style={styles.documentIcon}>
            <FileText size={24} color="#007AFF" />
          </View>
          <YStack flex={1}>
            <Text fontSize={14} fontWeight="600" color="#000" numberOfLines={1}>
              {documentTitle || 'Medical Document'}
            </Text>
            <Text fontSize={12} color="#8E8E93">Processed by AI · 3 pages</Text>
          </YStack>
          <TouchableOpacity>
            <Text fontSize={14} color="#007AFF" fontWeight="500">View</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// Loading step component
function LoadingStep({ label, completed, active }: { label: string; completed: boolean; active?: boolean }) {
  return (
    <XStack alignItems="center" gap="$2" opacity={completed || active ? 1 : 0.4}>
      {completed ? (
        <View style={styles.stepComplete}>
          <Shield size={14} color="#FFF" />
        </View>
      ) : active ? (
        <ActivityIndicator size="small" color="#007AFF" />
      ) : (
        <View style={styles.stepPending} />
      )}
      <Text fontSize={14} color={completed ? '#34C759' : active ? '#007AFF' : '#8E8E93'}>
        {label}
      </Text>
    </XStack>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingSteps: {
    marginTop: 40,
    gap: 16,
  },
  stepComplete: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepPending: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E5EA',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonAlt: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8FAF0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  alertCard: {
    borderRadius: 12,
    padding: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  metricTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  metricTabActive: {
    backgroundColor: '#E3F2FD',
  },
  chartContainer: {
    position: 'relative',
    marginTop: 8,
    marginLeft: 20,
  },
  yAxisLabels: {
    position: 'absolute',
    left: -20,
    top: 10,
    bottom: 40,
    justifyContent: 'space-between',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 10,
  },
  touchTarget: {
    position: 'absolute',
    width: 40,
    height: 40,
  },
  assessmentCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  actionCard: {
    backgroundColor: '#1A73E8',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    flexDirection: 'column',
    alignItems: 'center',
    shadowColor: '#1A73E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  aiChatIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatButton: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 50,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  planButton: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  documentFooter: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Safety Q&A styles
  qaCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  // Food recommendation styles
  foodCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  foodTag: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  // Medication styles
  medicationCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sideEffectTag: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  // Condition styles
  conditionCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  confidenceBadge: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  // Accordion styles for Safety Q&A
  accordionCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  // Section without horizontal padding (for horizontal scroll)
  sectionNoHorizontalPadding: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingVertical: 20,
    marginBottom: 16,
  },
  // Horizontal scroll content
  horizontalScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  // Food card for horizontal scroll
  foodCardHorizontal: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    width: SCREEN_WIDTH * 0.75,
    marginRight: 4,
  },
  // Add to medication list button
  addMedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#FFF',
  },
  addMedButtonAdded: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  addMedButtonSaving: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    paddingHorizontal: 16,
  },
});
