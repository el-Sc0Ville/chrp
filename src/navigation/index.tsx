import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/HomeScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import RosterScreen from '../screens/RosterScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import CreateEventScreen from '../screens/CreateEventScreen';
import { navy, teams, fonts } from '../theme';

export type RootStackParamList = {
  Tabs: undefined;
  EventDetail: { eventId: string; title: string };
  CreateEvent: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// ─── Tab bar icons ─────────────────────────────────────────────────────────────

function CalendarIcon({ active }: { active: boolean }) {
  const color = active ? teams.trashdogs[300] : 'rgba(229,234,242,0.45)';
  return (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      {/* Calendar outline */}
      <View style={{
        width: 18, height: 16, borderRadius: 2.5,
        borderWidth: 1.5, borderColor: color,
        alignItems: 'center',
      }}>
        <View style={{ position: 'absolute', top: 4, left: 0, right: 0, height: 1.5, backgroundColor: color }} />
      </View>
      <View style={{ position: 'absolute', top: 1, left: 7, width: 1.5, height: 4, borderRadius: 1, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: 1, right: 7, width: 1.5, height: 4, borderRadius: 1, backgroundColor: color }} />
    </View>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  const color = active ? teams.trashdogs[300] : 'rgba(229,234,242,0.45)';
  const bgColor = active ? teams.trashdogs[300] : 'transparent';
  const textColor = active ? navy[800] : color;
  return (
    <View style={{
      width: 24, height: 24, borderRadius: 6,
      backgroundColor: bgColor,
      borderWidth: active ? 0 : 1.5,
      borderColor: color,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{
        fontFamily: fonts.display,
        fontSize: 13, fontWeight: '700',
        color: textColor,
        letterSpacing: -0.5,
      }}>C</Text>
    </View>
  );
}

function RosterIcon({ active }: { active: boolean }) {
  const color = active ? teams.trashdogs[300] : 'rgba(229,234,242,0.45)';
  return (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 11, height: 11, borderRadius: 5.5,
        borderWidth: 1.5, borderColor: color,
        position: 'absolute', top: 1, left: 2,
      }} />
      <View style={{
        width: 11, height: 11, borderRadius: 5.5,
        borderWidth: 1.5, borderColor: color,
        position: 'absolute', top: 1, right: 2,
      }} />
      <View style={{
        position: 'absolute', bottom: 1, left: 0, right: 0,
        height: 8, borderTopLeftRadius: 6, borderTopRightRadius: 6,
        borderWidth: 1.5, borderColor: color, borderBottomWidth: 0,
      }} />
    </View>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  const color = active ? teams.trashdogs[300] : 'rgba(229,234,242,0.45)';
  return (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 10, height: 10, borderRadius: 5,
        borderWidth: 1.5, borderColor: color,
        position: 'absolute', top: 1,
      }} />
      <View style={{
        position: 'absolute', bottom: 0, left: 1, right: 1,
        height: 8, borderTopLeftRadius: 7, borderTopRightRadius: 7,
        borderWidth: 1.5, borderColor: color, borderBottomWidth: 0,
      }} />
    </View>
  );
}

// ─── Custom tab bar ────────────────────────────────────────────────────────────

function ChrpTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const activeTeam = teams.trashdogs;

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel ?? options.title ?? route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const iconColor = isFocused ? activeTeam[300] : 'rgba(229,234,242,0.45)';
        const labelColor = isFocused ? activeTeam[300] : 'rgba(229,234,242,0.45)';
        const iconBg = isFocused
          ? `rgba(${hexToRgb(activeTeam[500])}, 0.22)`
          : 'transparent';

        return (
          <View
            key={route.key}
            style={styles.tabItem}
            accessible
            accessibilityRole="button"
            accessibilityLabel={String(label)}
            accessibilityState={{ selected: isFocused }}
            onStartShouldSetResponder={() => true}
            onResponderGrant={onPress}
          >
            <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
              {route.name === 'Schedule' && <CalendarIcon active={isFocused} />}
              {route.name === 'Home' && <HomeIcon active={isFocused} />}
              {route.name === 'Roster' && <RosterIcon active={isFocused} />}
              {route.name === 'Profile' && <ProfileIcon active={isFocused} />}
            </View>
            <Text style={[styles.tabLabel, { color: labelColor, fontWeight: isFocused ? '600' : '500' }]}>
              {String(label)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(8,10,18,0.92)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 52,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: fonts.ui,
    fontSize: 10.5,
    letterSpacing: 0.3,
  },
});

// ─── Navigators ───────────────────────────────────────────────────────────────

function TabsNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <ChrpTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Schedule" component={ScheduleScreen} />
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Roster" component={RosterScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={TabsNavigator} />
        <Stack.Screen name="EventDetail" component={EventDetailScreen} />
        <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
