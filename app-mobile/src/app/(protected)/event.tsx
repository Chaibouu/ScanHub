import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEventStore } from '@/stores/eventStore';
import { formatDate } from '@/utils/formatters';

export default function EventScreen() {
  const router = useRouter();
  const { events, activeEvent, setActiveEvent, loadEvents, isLoading, error } = useEventStore();

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleSelect = (event: (typeof events)[0]) => {
    setActiveEvent(event);
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Sélectionner le Contexte Actif</Text>
      <Text style={styles.headerSub}>
        Tous les contrôles QR seront rattachés à l’événement sélectionné.
      </Text>

      {isLoading && events.length === 0 && <ActivityIndicator color="#2563EB" />}
      {error && <Text style={{ color: '#B91C1C', marginBottom: 12 }}>{error}</Text>}
      {!isLoading && !error && events.length === 0 && (
        <Text style={{ color: '#64748B' }}>Aucun événement disponible.</Text>
      )}

      <View style={styles.list}>
        {events.map((evt) => {
          const isSelected = activeEvent?.id === evt.id;
          return (
            <TouchableOpacity
              key={evt.id}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => handleSelect(evt)}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.statusPill,
                    evt.status === 'ACTIVE'
                      ? styles.statusPillActive
                      : styles.statusPillClosed,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      evt.status === 'ACTIVE'
                        ? styles.textActive
                        : styles.textClosed,
                    ]}
                  >
                    {evt.status}
                  </Text>
                </View>

                {isSelected && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>✓ ACTIF</Text>
                  </View>
                )}
              </View>

              <Text style={styles.eventName}>{evt.name}</Text>
              {(evt.location || evt.organization?.name) && (
                <Text style={styles.eventLocation}>
                  📍 {evt.location || evt.organization?.name}
                </Text>
              )}
              <Text style={styles.eventDates}>
                📅 Début : {formatDate(evt.startsAt)}
              </Text>

              {evt.stats && (
                <View style={styles.statsSummary}>
                  <Text style={styles.statsText}>
                    {evt.stats.totalScanned} contrôlés sur {evt.stats.totalTickets} billets
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 20,
  },
  list: {
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  cardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#F8FAFC',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillActive: {
    backgroundColor: '#DCFCE7',
  },
  statusPillClosed: {
    backgroundColor: '#F1F5F9',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textActive: {
    color: '#16A34A',
  },
  textClosed: {
    color: '#64748B',
  },
  selectedBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  eventName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 4,
  },
  eventDates: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  statsSummary: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  statsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
});
