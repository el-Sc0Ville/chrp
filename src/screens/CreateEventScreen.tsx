// B-04 · Create Event (manager-only form)

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable, Switch,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  addDoc, collection, serverTimestamp, Timestamp,
  getDocs, doc, writeBatch, getDoc, updateDoc,
} from 'firebase/firestore';
import type { Member, Event as FirestoreEvent } from '../firebase/schema';
import type { RootStackParamList } from '../navigation';
import { navy, teams, status, fonts, type as T, spacing, radius } from '../theme';
import { db } from '../firebase';
import { useUserContext } from '../context/UserContext';

const TEAM = teams.trashdogs;

type CreateEventNavProp   = NativeStackNavigationProp<RootStackParamList>;
type CreateEventRouteProp = RouteProp<RootStackParamList, 'CreateEvent'>;
type EventType = 'game' | 'practice' | 'social';

const EVENT_TYPES: { id: EventType; label: string }[] = [
  { id: 'game',     label: 'Game'     },
  { id: 'practice', label: 'Practice' },
  { id: 'social',   label: 'Social'   },
];

// Default event time: tomorrow at 7:00 PM
const DEFAULT_DATE = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
})();

const DEFAULT_TIME = (() => {
  const d = new Date();
  d.setHours(19, 0, 0, 0);
  return d;
})();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(d: Date): string {
  const days   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function formatTime(d: Date): string {
  const h    = d.getHours();
  const m    = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh   = h % 12 || 12;
  const mm   = m.toString().padStart(2, '0');
  return `${hh}:${mm} ${ampm}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreateEventScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<CreateEventNavProp>();
  const route      = useRoute<CreateEventRouteProp>();
  const editEventId = route.params?.editEventId;
  const { user, activeTeamId }   = useUserContext();

  // Form state
  const [eventType,   setEventType]   = useState<EventType>('game');
  const [eventName,   setEventName]   = useState('');
  const [date,        setDate]        = useState(DEFAULT_DATE);
  const [time,        setTime]        = useState(DEFAULT_TIME);
  const [venue,       setVenue]       = useState('');
  const [notes,       setNotes]       = useState('');
  const [recurring,   setRecurring]   = useState(false);
  const [saving,      setSaving]      = useState(false);

  // Load existing event when editing
  useEffect(() => {
    if (!editEventId) return;
    getDoc(doc(db, 'teams', activeTeamId, 'events', editEventId)).then(snap => {
      if (!snap.exists()) return;
      const e = snap.data() as FirestoreEvent;
      if (e.type === 'game' || e.type === 'practice' || e.type === 'social') setEventType(e.type);
      setEventName(e.title ?? '');
      setVenue(e.venue ?? '');
      setNotes(e.notes ?? '');
      setRecurring(e.recurring ?? false);
      const start = e.startsAt.toDate();
      setDate(start);
      setTime(start);
    }).catch(err => console.error('[CreateEvent] load failed:', err));
  }, [editEventId, activeTeamId]);

  // Picker visibility
  const [showDate,    setShowDate]    = useState(false);
  const [showTime,    setShowTime]    = useState(false);

  const isFormValid = eventName.trim().length > 0;

  const handleSave = async () => {
    if (!isFormValid || saving) return;
    setSaving(true);
    try {
      const start = new Date(
        date.getFullYear(), date.getMonth(), date.getDate(),
        time.getHours(), time.getMinutes(), 0, 0,
      );
      const end        = new Date(start.getTime() + 90 * 60 * 1000);
      const notesValue = notes.trim();
      const fields = {
        type:      eventType,
        title:     eventName.trim(),
        venue:     venue.trim(),
        ...(notesValue ? { notes: notesValue } : {}),
        startsAt:  Timestamp.fromDate(start),
        endsAt:    Timestamp.fromDate(end),
        recurring,
      };

      if (editEventId) {
        await updateDoc(doc(db, 'teams', activeTeamId, 'events', editEventId), fields);
      } else {
        const eventRef = await addDoc(collection(db, 'teams', activeTeamId, 'events'), {
          ...fields,
          createdBy: user?.uid ?? 'anon',
          createdAt: serverTimestamp(),
        });

        // Auto-in: batch-write responses for members with autoIn enabled
        // TODO Phase 2b: move this logic to a Firebase Cloud Function trigger on event creation
        const eventDateStr = toYMD(start);
        const membersSnap  = await getDocs(collection(db, 'teams', activeTeamId, 'members'));
        const batch        = writeBatch(db);
        for (const memberDoc of membersSnap.docs) {
          const member = memberDoc.data() as Member;
          if (!member.autoIn || member.role === 'spare') continue;
          const blackoutsSnap = await getDocs(
            collection(db, 'teams', activeTeamId, 'members', memberDoc.id, 'blackouts'),
          );
          const blackedOut = blackoutsSnap.docs.some(bd =>
            ((bd.data().dates as string[]) ?? []).includes(eventDateStr),
          );
          batch.set(
            doc(db, 'teams', activeTeamId, 'events', eventRef.id, 'responses', memberDoc.id),
            {
              userId:       memberDoc.id,
              displayName:  member.displayName,
              response:     blackedOut ? 'out' : 'in',
              respondedAt:  serverTimestamp(),
              setByManager: false,
            },
          );
        }
        await batch.commit();
      }

      navigation.goBack();
    } catch (err) {
      console.error('[CreateEvent] write failed:', err);
      setSaving(false);
    }
  };

  function onDateChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowDate(false);
    if (event.type === 'set' && selected) setDate(selected);
  }

  function onTimeChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowTime(false);
    if (event.type === 'set' && selected) setTime(selected);
  }

  function toggleDate() {
    setShowDate(v => !v);
    setShowTime(false);
  }

  function toggleTime() {
    setShowTime(v => !v);
    setShowDate(false);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Nav header ──────────────────────────────────────────────────── */}
      <View style={styles.navHeader}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.navSide, pressed && { opacity: 0.6 }]}
          hitSlop={12}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>

        <Text style={styles.navTitle}>{editEventId ? 'Edit event' : 'New event'}</Text>

        <Pressable
          onPress={handleSave}
          style={[styles.navSide, styles.navSideRight]}
          hitSlop={12}
        >
          <Text style={[styles.saveText, (!isFormValid || saving) && styles.saveTextDisabled]}>
            {saving ? 'Saving…' : editEventId ? 'Save changes' : 'Save & notify'}
          </Text>
        </Pressable>
      </View>

      {/* ── Form ────────────────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* Event type segmented control */}
          <SectionLabel>Event type</SectionLabel>
          <SegmentedControl value={eventType} onChange={setEventType} />

          {/* Main fields card */}
          <SectionLabel topSpacing>Details</SectionLabel>
          <View style={styles.card}>
            {/* Event name */}
            <View style={styles.textFieldRow}>
              <Text style={styles.fieldLabel}>EVENT NAME</Text>
              <TextInput
                style={styles.fieldInput}
                value={eventName}
                onChangeText={setEventName}
                placeholder="e.g. vs. Ice Sharks"
                placeholderTextColor={navy[400]}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

            <View style={styles.cardDivider} />

            {/* Date row */}
            <Pressable
              onPress={toggleDate}
              style={({ pressed }) => [styles.pickerRow, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.fieldLabel}>DATE</Text>
              <View style={styles.pickerRowRight}>
                <Text style={styles.pickerValue}>{formatDate(date)}</Text>
                <Text style={[styles.pickerChevron, showDate && styles.pickerChevronOpen]}>›</Text>
              </View>
            </Pressable>

            {showDate && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={onDateChange}
                  minimumDate={new Date()}
                  accentColor={TEAM[300]}
                  themeVariant="dark"
                  style={styles.iosPicker}
                />
                {Platform.OS === 'ios' && (
                  <Pressable
                    onPress={() => setShowDate(false)}
                    style={({ pressed }) => [styles.pickerDone, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </Pressable>
                )}
              </View>
            )}

            <View style={styles.cardDivider} />

            {/* Time row */}
            <Pressable
              onPress={toggleTime}
              style={({ pressed }) => [styles.pickerRow, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.fieldLabel}>TIME</Text>
              <View style={styles.pickerRowRight}>
                <Text style={styles.pickerValue}>{formatTime(time)}</Text>
                <Text style={[styles.pickerChevron, showTime && styles.pickerChevronOpen]}>›</Text>
              </View>
            </Pressable>

            {showTime && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={time}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onTimeChange}
                  accentColor={TEAM[300]}
                  themeVariant="dark"
                  style={styles.iosPicker}
                />
                {Platform.OS === 'ios' && (
                  <Pressable
                    onPress={() => setShowTime(false)}
                    style={({ pressed }) => [styles.pickerDone, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </Pressable>
                )}
              </View>
            )}

            <View style={styles.cardDivider} />

            {/* Venue */}
            {/* TODO Phase 2: replace with Google Places Autocomplete for precise GPS coordinates */}
            <View style={styles.textFieldRow}>
              <Text style={styles.fieldLabel}>VENUE</Text>
              <View style={styles.venueInputRow}>
                <VenuePinIcon />
                <TextInput
                  style={[styles.fieldInput, { flex: 1 }]}
                  value={venue}
                  onChangeText={setVenue}
                  placeholder="Arena name or address"
                  placeholderTextColor={navy[400]}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>
          </View>

          {/* Notes card */}
          <SectionLabel topSpacing>Notes <Text style={styles.optionalTag}>(optional)</Text></SectionLabel>
          <View style={[styles.card, styles.notesCard]}>
            <Text style={styles.fieldLabel}>NOTES</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything the team should know?"
              placeholderTextColor={navy[400]}
              multiline
              blurOnSubmit={false}
              numberOfLines={4}
              textAlignVertical="top"
              returnKeyType="default"
            />
          </View>

          {/* Recurring toggle */}
          <SectionLabel topSpacing>Options</SectionLabel>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleRowLeft}>
                <Text style={styles.toggleRowTitle}>Recurring event</Text>
                <Text style={styles.toggleRowSub}>Repeat this event each week</Text>
              </View>
              <Switch
                value={recurring}
                onValueChange={setRecurring}
                trackColor={{ false: navy[600], true: TEAM[500] }}
                thumbColor={recurring ? '#FFFFFF' : navy[300]}
                ios_backgroundColor={navy[600]}
              />
            </View>
          </View>

          {/* Save button + info row */}
          <View style={styles.saveSection}>
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [
                styles.saveBtn,
                (!isFormValid || saving) && styles.saveBtnDisabled,
                pressed && isFormValid && !saving && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.saveBtnText, (!isFormValid || saving) && styles.saveBtnTextDisabled]}>
                {saving ? 'Saving…' : editEventId ? 'Save changes' : 'Save & notify team'}
              </Text>
            </Pressable>
            <Text style={styles.infoText}>
              All players will be notified when you save
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Venue pin icon ───────────────────────────────────────────────────────────

function VenuePinIcon() {
  return (
    <View style={{ width: 12, height: 15, alignItems: 'center', marginTop: 2, flexShrink: 0 }}>
      <View style={{
        width: 10, height: 10, borderRadius: 5,
        borderWidth: 1.5, borderColor: navy[400],
      }} />
      <View style={{ width: 1.5, height: 5, backgroundColor: navy[400], marginTop: -1 }} />
    </View>
  );
}

// ─── Segmented control ────────────────────────────────────────────────────────

function SegmentedControl({
  value, onChange,
}: {
  value: EventType;
  onChange: (v: EventType) => void;
}) {
  return (
    <View style={styles.segmented}>
      {EVENT_TYPES.map(opt => {
        const isActive = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[styles.segment, isActive && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children, topSpacing }: { children: React.ReactNode; topSpacing?: boolean }) {
  return (
    <Text style={[styles.sectionLabel, topSpacing && styles.sectionLabelTopSpacing]}>
      {children}
    </Text>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: navy[800],
  },

  // ── Nav header ───────────────────────────────────────────────────────────
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingTop: spacing[10],
    paddingBottom: spacing[12],
    borderBottomWidth: 0.5,
    borderBottomColor: navy[700],
  },
  navSide: {
    minWidth: 80,
    alignItems: 'flex-start',
  },
  navSideRight: {
    alignItems: 'flex-end',
    minWidth: 100,
  },
  cancelText: {
    fontFamily: fonts.uiMedium,
    fontSize: 16,
    color: navy[300],
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  saveText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: TEAM[300],
  },
  saveTextDisabled: {
    color: navy[500],
  },

  // ── Scroll ───────────────────────────────────────────────────────────────
  scroll: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[20],
    paddingBottom: spacing[40],
  },

  // ── Section label ────────────────────────────────────────────────────────
  sectionLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    color: navy[400],
    textTransform: 'uppercase',
    marginBottom: spacing[8],
  },
  sectionLabelTopSpacing: {
    marginTop: spacing[24],
  },
  optionalTag: {
    fontFamily: fonts.ui,
    fontSize: 11,
    letterSpacing: 0,
    textTransform: 'none',
    color: navy[500],
  },

  // ── Segmented control ────────────────────────────────────────────────────
  segmented: {
    flexDirection: 'row',
    backgroundColor: navy[700],
    borderRadius: radius.m,
    borderWidth: 0.5,
    borderColor: navy[600],
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.s,
  },
  segmentActive: {
    backgroundColor: TEAM[500],
    shadowColor: TEAM[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  segmentText: {
    fontFamily: fonts.uiMedium,
    fontSize: 14,
    color: navy[300],
  },
  segmentTextActive: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 14,
    color: TEAM.on,
  },

  // ── Field card ───────────────────────────────────────────────────────────
  card: {
    backgroundColor: navy[700],
    borderRadius: radius.l,
    borderWidth: 0.5,
    borderColor: navy[600],
    overflow: 'hidden',
  },
  cardDivider: {
    height: 0.5,
    backgroundColor: navy[600],
    marginLeft: spacing[16],
  },

  // ── Venue input row (pin icon + text input) ──────────────────────────────
  venueInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
  },

  // ── Text field row ───────────────────────────────────────────────────────
  textFieldRow: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[12],
    paddingBottom: spacing[12],
  },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: navy[400],
    marginBottom: spacing[4],
  },
  fieldInput: {
    fontFamily: fonts.ui,
    fontSize: 16,
    color: navy[50],
    padding: 0,
    minHeight: 22,
  },

  // ── Picker row ───────────────────────────────────────────────────────────
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
  pickerRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  pickerValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    letterSpacing: 0.3,
    color: navy[100],
  },
  pickerChevron: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 22,
    color: navy[400],
    transform: [{ rotate: '90deg' }],
  },
  pickerChevronOpen: {
    transform: [{ rotate: '270deg' }],
  },
  pickerContainer: {
    borderTopWidth: 0.5,
    borderTopColor: navy[600],
    backgroundColor: navy[700],
  },
  iosPicker: {
    height: Platform.OS === 'ios' ? undefined : 0,
  },
  pickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
  },
  pickerDoneText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 15,
    color: TEAM[300],
  },

  // ── Notes card ───────────────────────────────────────────────────────────
  notesCard: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[12],
    paddingBottom: spacing[12],
  },
  notesInput: {
    fontFamily: fonts.ui,
    fontSize: 15,
    color: navy[50],
    minHeight: 88,
    padding: 0,
    marginTop: spacing[4],
  },

  // ── Recurring toggle row ─────────────────────────────────────────────────
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
  toggleRowLeft: {
    flex: 1,
    gap: 2,
  },
  toggleRowTitle: {
    fontFamily: fonts.uiMedium,
    fontSize: 15,
    color: navy[100],
  },
  toggleRowSub: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: navy[400],
  },

  // ── Save section ─────────────────────────────────────────────────────────
  saveSection: {
    marginTop: spacing[32],
    gap: spacing[12],
    alignItems: 'center',
  },
  saveBtn: {
    width: '100%',
    height: 54,
    borderRadius: radius.l,
    backgroundColor: TEAM[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TEAM[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 12,
    elevation: 4,
  },
  saveBtnDisabled: {
    backgroundColor: navy[700],
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    fontFamily: fonts.uiSemiBold,
    fontSize: 16,
    color: TEAM.on,
  },
  saveBtnTextDisabled: {
    color: navy[400],
  },
  infoText: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: navy[400],
    textAlign: 'center',
  },
});
