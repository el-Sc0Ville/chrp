import React, { useState, useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDocs, collection } from 'firebase/firestore';

import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import TeamScreen from '../screens/TeamScreen';
import GamedayScreen from '../screens/GamedayScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AnnouncementThreadScreen from '../screens/AnnouncementThreadScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import CreateEventScreen from '../screens/CreateEventScreen';
import SubsScreen from '../screens/SubsScreen';
import NotificationCentreScreen from '../screens/NotificationCentreScreen';
import BlackoutScreen from '../screens/BlackoutScreen';

import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import ProfileSetupScreen from '../screens/onboarding/ProfileSetupScreen';
import JoinOrCreateScreen from '../screens/onboarding/JoinOrCreateScreen';
import JoinTeamScreen from '../screens/onboarding/JoinTeamScreen';
import CreateTeamScreen from '../screens/onboarding/CreateTeamScreen';
import OnboardingCompleteScreen from '../screens/onboarding/OnboardingCompleteScreen';

import { GameResponseProvider } from '../context/GameResponseContext';
import { NotificationProvider } from '../context/NotificationContext';
import { ScoreProvider } from '../context/ScoreContext';
import { UserProvider, useUserContext } from '../context/UserContext';
import { navy, teams, fonts, spacing, type TeamKey } from '../theme';
import { onAuthStateChanged, type User } from '../firebase/auth';
import { db } from '../firebase';
import { registerForPushNotifications } from '../firebase/notifications';

export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  Tabs: undefined;
  Gameday: undefined;
  Profile: undefined;
  AnnouncementThread: { announcementId: string };
  EventDetail: { eventId: string; title: string; isPast?: boolean };
  CreateEvent: { editEventId?: string } | undefined;
  Subs: undefined;
  Notifications: undefined;
  Blackout: undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  ProfileSetup: undefined;
  JoinOrCreate: { displayName: string; jerseyNumber: number };
  JoinTeam: { displayName: string; jerseyNumber: number };
  CreateTeam: { displayName: string; jerseyNumber: number };
  OnboardingComplete: { teamId: string; teamName: string; palette: TeamKey; isManager: boolean };
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const Stack           = createNativeStackNavigator<RootStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const Tab             = createBottomTabNavigator();

// ─── Tab bar icons ─────────────────────────────────────────────────────────────

function CalendarIcon({ active, activeColor = teams.trashdogs[300] }: { active: boolean; activeColor?: string }) {
  const color = active ? activeColor : 'rgba(229,234,242,0.45)';
  return (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
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

function HomeIcon({ active, activeColor = teams.trashdogs[300] }: { active: boolean; activeColor?: string }) {
  const color = active ? activeColor : 'rgba(229,234,242,0.45)';
  const bgColor = active ? activeColor : 'transparent';
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

function TeamIcon({ active, activeColor = teams.trashdogs[300] }: { active: boolean; activeColor?: string }) {
  const color = active ? activeColor : 'rgba(229,234,242,0.45)';
  return (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      {/* Left person head */}
      <View style={{
        width: 9, height: 9, borderRadius: 4.5,
        borderWidth: 1.5, borderColor: color,
        position: 'absolute', top: 1, left: 3,
      }} />
      {/* Right person head */}
      <View style={{
        width: 9, height: 9, borderRadius: 4.5,
        borderWidth: 1.5, borderColor: color,
        position: 'absolute', top: 1, right: 3,
      }} />
      {/* Shared body arc */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 9, borderTopLeftRadius: 6, borderTopRightRadius: 6,
        borderWidth: 1.5, borderColor: color, borderBottomWidth: 0,
      }} />
    </View>
  );
}

// ─── Custom tab bar ────────────────────────────────────────────────────────────

function ChrpTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { activeTeamPalette } = useUserContext();
  const activeTeam = teams[activeTeamPalette];

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
              {route.name === 'Schedule' && <CalendarIcon active={isFocused} activeColor={activeTeam[300]} />}
              {route.name === 'Home'     && <HomeIcon     active={isFocused} activeColor={activeTeam[300]} />}
              {route.name === 'Team'     && <TeamIcon     active={isFocused} activeColor={activeTeam[300]} />}
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

  // ── Loading screen ────────────────────────────────────────────────────────
  loadingScreen: {
    flex: 1,
    backgroundColor: navy[800],
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWordmark: {
    fontFamily: fonts.display,
    fontSize: 32, fontWeight: '700',
    letterSpacing: -0.8, color: '#FFFFFF',
  },
});

// ─── Loading screen ────────────────────────────────────────────────────────────

function LoadingScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.loadingScreen, { paddingTop: insets.top }]}>
      <Text style={styles.loadingWordmark}>Chrp</Text>
      <ActivityIndicator
        color={teams.trashdogs[300]}
        size="small"
        style={{ marginTop: spacing[16] }}
      />
    </View>
  );
}

// ─── Navigators ───────────────────────────────────────────────────────────────

function TabsNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <ChrpTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Schedule" component={ScheduleScreen} />
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Team"     component={TeamScreen} />
    </Tab.Navigator>
  );
}

function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="Welcome"            component={WelcomeScreen} />
      <OnboardingStack.Screen name="ProfileSetup"       component={ProfileSetupScreen} />
      <OnboardingStack.Screen name="JoinOrCreate"       component={JoinOrCreateScreen} />
      <OnboardingStack.Screen name="JoinTeam"           component={JoinTeamScreen} />
      <OnboardingStack.Screen name="CreateTeam"         component={CreateTeamScreen} />
      <OnboardingStack.Screen name="OnboardingComplete" component={OnboardingCompleteScreen} />
    </OnboardingStack.Navigator>
  );
}

function AppStack() {
  const {
    user: mockUser,
    needsOnboarding, setNeedsOnboarding,
    setMockUser, setActiveTeamId, setActiveTeamPalette,
  } = useUserContext();
  // undefined = resolving Firebase auth, null = signed out, User = signed in
  const [firebaseUser, setFirebaseUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    return onAuthStateChanged(async (u) => {
      setFirebaseUser(u);
      if (u && !u.isAnonymous) {
        // Real Firebase user (magic link, etc.) — populate UserContext immediately
        // so user.uid and user.displayName are available in all screens
        setMockUser(u, false); // isManager defaults false; updated below once teams load
        console.log('Auth state: user found, checking onboarding...', u.uid);
        const snap = await getDocs(collection(db, 'users', u.uid, 'teams'));
        console.log('Onboarding check — /users/{uid}/teams docs:', snap.size, 'needsOnboarding:', snap.empty);
        setNeedsOnboarding(snap.empty);
        if (!snap.empty) {
          // Returning user — restore their active team and manager status
          const isManagerRole = snap.docs.some(d => d.data().role === 'manager');
          const firstTeam     = snap.docs[0].data();
          setMockUser(u, isManagerRole);
          setActiveTeamId(firstTeam.teamId as string);
          setActiveTeamPalette(firstTeam.palette as TeamKey);
          // Register / refresh push token for this user+team
          registerForPushNotifications(u.uid, firstTeam.teamId as string).catch(console.error);
        }
      } else if (!u) {
        setMockUser(null, false);
        setNeedsOnboarding(false);
      }
      // u.isAnonymous = dev bypass — AuthScreen's setMockUser handles context
    });
  }, []);

  const resolvedUser = mockUser ?? firebaseUser;
  if (resolvedUser === undefined) return <LoadingScreen />;

  // Still waiting on Firestore onboarding check for a real (non-anonymous) Firebase user.
  // Cannot use !mockUser here — setMockUser is called for real users too (to populate uid),
  // so mockUser is non-null for both dev bypass AND real users.
  const isRealFirebaseUser = firebaseUser !== null && firebaseUser?.isAnonymous === false;
  if (resolvedUser && isRealFirebaseUser && needsOnboarding === undefined) return <LoadingScreen />;

  // Dev-bypass (anonymous) users skip onboarding; real users show it when no team found
  const showOnboarding = isRealFirebaseUser && needsOnboarding === true;

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {resolvedUser && showOnboarding && (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        )}
        {resolvedUser && !showOnboarding && (
          <>
            <Stack.Screen name="Tabs"               component={TabsNavigator} />
            <Stack.Screen name="Gameday"            component={GamedayScreen} />
            <Stack.Screen name="Profile"            component={ProfileScreen} />
            <Stack.Screen name="AnnouncementThread" component={AnnouncementThreadScreen} />
            <Stack.Screen name="EventDetail"        component={EventDetailScreen} />
            <Stack.Screen name="CreateEvent"        component={CreateEventScreen} />
            <Stack.Screen name="Subs"               component={SubsScreen} />
            <Stack.Screen name="Notifications"      component={NotificationCentreScreen} />
            <Stack.Screen name="Blackout"           component={BlackoutScreen} />
          </>
        )}
        {!resolvedUser && (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function AppNavigator() {
  return (
    <UserProvider>
    <GameResponseProvider>
    <NotificationProvider>
    <ScoreProvider>
      <AppStack />
    </ScoreProvider>
    </NotificationProvider>
    </GameResponseProvider>
    </UserProvider>
  );
}
