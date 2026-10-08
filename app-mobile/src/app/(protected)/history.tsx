import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { RESULT_THEMES } from '@/utils/constants';
import { formatTime } from '@/utils/formatters';
import { eventApi, ScanHistoryItem } from '@/api/eventApi';
import { ApiError } from '@/api/client';
import { useEventStore } from '@/stores/eventStore';

export default function HistoryScreen() {
  const { activeEvent } = useEventStore();
  const [filter, setFilter] = useState<'ALL' | 'VALID' | 'REJECTED'>('ALL');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const eventId = activeEvent?.id;

  useEffect(() => {
    let cancelled = false;

    eventApi
      .recentScans(eventId)
      .then((scans) => {
        if (cancelled) return;
        setItems(scans);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError && err.isNetworkError
            ? 'Historique indisponible hors-ligne.'
            : (err as Error)?.message || 'Impossible de charger l’historique.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, reloadKey]);

  const refresh = () => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  const filteredList = items.filter((item) => {
    if (filter === 'VALID' && item.result !== 'VALID') return false;
    if (filter === 'REJECTED' && item.result === 'VALID') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.holderName.toLowerCase().includes(q) ||
        item.qrType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par nom ou type..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, filter === 'ALL' && styles.tabActive]}
          onPress={() => setFilter('ALL')}
        >
          <Text style={[styles.tabText, filter === 'ALL' && styles.tabTextActive]}>
            Tous ({items.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, filter === 'VALID' && styles.tabActive]}
          onPress={() => setFilter('VALID')}
        >
          <Text
            style={[styles.tabText, filter === 'VALID' && styles.tabTextActive]}
          >
            Valides
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, filter === 'REJECTED' && styles.tabActive]}
          onPress={() => setFilter('REJECTED')}
        >
          <Text
            style={[
              styles.tabText,
              filter === 'REJECTED' && styles.tabTextActive,
            ]}
          >
            Refusés
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={filteredList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={refresh}
        renderItem={({ item }) => {
          const theme = RESULT_THEMES[item.result] || RESULT_THEMES.INVALID;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardLeft}>
                  <Text style={styles.holderName}>{item.holderName}</Text>
                  <Text style={styles.tokenText}>{item.event}</Text>
                </View>

                <View
                  style={[
                    styles.resultBadge,
                    { backgroundColor: theme.badgeBg },
                  ]}
                >
                  <Text
                    style={[styles.resultBadgeText, { color: theme.textColor }]}
                  >
                    {item.result}
                  </Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.typeText}>Type: {item.qrType}</Text>
                <View style={styles.footerRight}>
                  {item.offline && (
                    <View style={styles.offlineTag}>
                      <Text style={styles.offlineTagText}>Hors-Ligne</Text>
                    </View>
                  )}
                  <Text style={styles.timeText}>
                    {formatTime(item.scannedAt)}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {loading ? 'Chargement…' : error || 'Aucun scan trouvé.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  searchBox: {
    padding: 16,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  tabActive: {
    backgroundColor: '#2563EB',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardLeft: {
    flex: 1,
  },
  holderName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  tokenText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  resultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  resultBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  typeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  offlineTagText: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
});
