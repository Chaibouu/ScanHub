import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSyncStore } from '@/stores/syncStore';
import { useEventStore } from '@/stores/eventStore';
import { useSync } from '@/hooks/useSync';
import { formatTime } from '@/utils/formatters';

export default function SyncScreen() {
  const { isOnline, setOnline, pendingScans, lastSyncedAt } = useSyncStore();
  const { activeEvent } = useEventStore();
  const { triggerPushSync, triggerPullSync, isSyncing } = useSync();

  const [downloading, setDownloading] = useState(false);

  const handlePushSync = async () => {
    if (pendingScans.length === 0) {
      Alert.alert('Info', 'Aucun scan en attente de synchronisation.');
      return;
    }

    try {
      const summary = await triggerPushSync();
      const lines = [`${summary.accepted} scan(s) synchronisé(s).`];
      if (summary.conflicts > 0) {
        lines.push(`${summary.conflicts} refusé(s) par le serveur (billet déjà utilisé, révoqué…).`);
      }
      if (summary.failed > 0) {
        lines.push(`${summary.failed} en échec, à renvoyer.`);
      }
      Alert.alert(summary.conflicts + summary.failed > 0 ? 'Synchronisation partielle' : 'Succès', lines.join('\n'));
    } catch {
      Alert.alert('Erreur', 'Impossible de joindre le serveur. Nouvelle tentative dès reconnexion.');
    }
  };

  const handlePullQRs = async () => {
    if (!activeEvent) {
      Alert.alert('Info', 'Sélectionnez d’abord un événement.');
      return;
    }
    setDownloading(true);
    try {
      const count = await triggerPullSync(activeEvent.id);
      Alert.alert(
        'Téléchargement Terminé',
        `Base de données locale mise à jour : ${count || 0} QR codes pré-chargés pour le contrôle hors-ligne.`
      );
    } catch {
      Alert.alert('Erreur', 'Impossible de télécharger la base hors-ligne. Vérifiez votre connexion.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Network Status Card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>CONNECTIVITÉ RÉSEAU</Text>
        <View style={styles.networkRow}>
          <View style={styles.networkLeft}>
            <View
              style={[
                styles.dot,
                isOnline ? styles.dotOnline : styles.dotOffline,
              ]}
            />
            <Text style={styles.networkStatusText}>
              {isOnline ? 'Connecté à Internet' : 'Mode Déconnecté (Hors-Ligne)'}
            </Text>
          </View>

          {/* Simulateur de coupure réseau — builds de développement uniquement */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => setOnline(!isOnline)}
            >
              <Text style={styles.toggleBtnText}>
                {isOnline ? 'Simuler Offline' : 'Passer Online'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.lastSyncText}>
          Dernière synchronisation :{' '}
          {lastSyncedAt ? formatTime(lastSyncedAt) : 'Aucune'}
        </Text>
      </View>

      {/* Pending Scans Queue */}
      <View style={styles.card}>
        <View style={styles.queueHeader}>
          <Text style={styles.cardLabel}>FILE D’ATTENTE LOCALE</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {pendingScans.length} en attente
            </Text>
          </View>
        </View>

        <Text style={styles.queueDesc}>
          Chaque contrôle effectué sans réseau est sécurisé localement avec un
          identifiant unique (UUID) pour garantir l’idempotence et prévenir tout doublon.
        </Text>

        <TouchableOpacity
          style={[
            styles.syncButton,
            (isSyncing || pendingScans.length === 0) && styles.btnDisabled,
          ]}
          onPress={handlePushSync}
          disabled={isSyncing || pendingScans.length === 0}
        >
          {isSyncing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.syncButtonText}>
              Envoyer les Scans au Serveur ({pendingScans.length})
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Pre-load Offline Database */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>PRÉ-CHARGEMENT HORS-LIGNE</Text>
        <Text style={styles.queueDesc}>
          Téléchargez la liste des participants et billets autorisés pour
          continuer à scanner même en cas de coupure réseau complète.
        </Text>

        <TouchableOpacity
          style={[styles.downloadButton, downloading && styles.btnDisabled]}
          onPress={handlePullQRs}
          disabled={downloading}
        >
          {downloading ? (
            <ActivityIndicator color="#0F172A" />
          ) : (
            <Text style={styles.downloadButtonText}>
              📥 Télécharger les QR de l’événement
            </Text>
          )}
        </TouchableOpacity>
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
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  networkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  networkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotOnline: {
    backgroundColor: '#16A34A',
  },
  dotOffline: {
    backgroundColor: '#D97706',
  },
  networkStatusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  toggleBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  lastSyncText: {
    fontSize: 12,
    color: '#64748B',
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  countBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  queueDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 16,
  },
  syncButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  downloadButton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  downloadButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
