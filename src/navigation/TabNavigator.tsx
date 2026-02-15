import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Home, FileText, Sparkles, User, TrendingUp } from 'lucide-react-native';
import { HomeStack } from './stacks/HomeStack';
import { RecordsStack } from './stacks/RecordsStack';
import { CoachStack } from './stacks/CoachStack';
import { ProfileStack } from './stacks/ProfileStack';

export type TabParamList = {
  HomeTab: undefined;
  RecordsTab: undefined;
  InsightsTab: undefined;
  CoachTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }): BottomTabNavigationOptions => ({
        headerShown: false,
        // tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 10,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          height: 85,
          paddingBottom: 0,
          paddingTop: 0,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
        },
        tabBarIconStyle: {
          marginTop: 8,
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <Home color={color} size={focused ? 26 : 22} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="RecordsTab"
        component={RecordsStack}
        options={{
          title: 'Records',
          tabBarIcon: ({ focused, color }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <FileText color={color} size={focused ? 26 : 22} />
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="CoachTab"
        component={CoachStack}
        options={{
          title: 'RexAI',
          tabBarIcon: ({ focused, color }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <Sparkles color={color} size={focused ? 26 : 22} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="InsightsTab"
        component={require('./stacks/InsightsStack').InsightsStack}
        options={{
          title: 'Insights',
          tabBarIcon: ({ focused, color }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <TrendingUp color={color} size={focused ? 26 : 22} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
              <User color={color} size={focused ? 26 : 22} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 60,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginTop: 12,
  },
  activeIconContainer: {
    backgroundColor: '#E8F1FF',
  },
});
