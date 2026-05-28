import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { navy, teams, fonts, type as T, spacing, radius } from '../theme';

const TEAM = teams.trashdogs;

type EventDetailRouteProp = RouteProp<RootStackParamList, 'EventDetail'>;
type EventDetailNavProp = NativeStackNavigationProp<RootStackParamList, 'EventDetail'>;

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<EventDetailNavProp>();
  const route = useRoute<EventDetailRouteProp>();
  const { title, eventId } = route.params;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          hitSlop={12}
        >
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.backLabel}>Schedule</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.teamPill}>
          <View style={styles.teamDot} />
          <Text style={styles.teamName}>TRASHDOGS</Text>
        </View>
        <Text style={styles.eventTitle}>{title}</Text>
        <Text style={styles.eventId}>Event ID: {eventId}</Text>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>D-01 Event Detail — coming soon</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy[800],
  },
  header: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[12],
    paddingBottom: spacing[8],
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
  },
  backChevron: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    color: TEAM[300],
    marginTop: -2,
  },
  backLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 15,
    color: TEAM[300],
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
  },
  teamPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing[8],
  },
  teamDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: TEAM[300],
  },
  teamName: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: TEAM[300],
  },
  eventTitle: {
    ...T.displayS,
    color: '#FFFFFF',
    marginBottom: spacing[6],
  },
  eventId: {
    ...T.monoS,
    color: navy[400],
    marginBottom: spacing[32],
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: navy[600],
    borderStyle: 'dashed',
    borderRadius: radius.l,
    marginBottom: spacing[40],
  },
  placeholderText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: navy[400],
  },
});
