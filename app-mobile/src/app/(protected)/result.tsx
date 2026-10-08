import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { qrApi } from '@/api/qrApi';
import { QRConsumeResult, QRVerificationResult, ScanResultCode } from '@/types/qr';
import { ApiError } from '@/api/client';
import { RESULT_THEMES } from '@/utils/constants';
import { formatTime, truncateToken, generateUUID } from '@/utils/formatters';
import { hapticFeedback } from '@/lib/haptics';

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; eventId?: string }>();
  const token = params.token || '';
  const eventId = params.eventId || '';

  // Clé d'idempotence stable pour toute la durée de l'écran
  const [clientId] = useState(() => generateUUID());
  const [loading, setLoading] = useState(true);
  const [consuming, setConsuming] = useState(false);
  const [result, setResult] = useState<QRVerificationResult | QRConsumeResult | null>(null);
  const [consumeError, setConsumeError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function verify() {
      if (!token) return;
      setLoading(true);
      try {
        const res = await qrApi.verify({ token, eventId });
        if (isMounted) {
          setResult(res);
          setLoading(false);

          // Haptic Feedback
          if (res.valid) {
            hapticFeedback.success();
          } else if (res.code === 'ALREADY_USED') {
            hapticFeedback.warning();
          } else {
            hapticFeedback.error();
          }
        }
      } catch (err) {
        if (isMounted) {
          setResult({
            valid: false,
            code: 'INVALID',
            status: 'BLOCKED',
            reusable: false,
            message:
              err instanceof ApiError
                ? `Vérification impossible : ${err.message}`
                : 'Erreur lors de la communication de vérification.',
            verifiedAt: new Date().toISOString(),
          });
          setLoading(false);
          hapticFeedback.error();
        }
      }
    }
    verify();
    return () => {
      isMounted = false;
    };
  }, [token, eventId]);

  const handleConsume = async () => {
    if (!result || consuming) return;
    setConsuming(true);
    setConsumeError(null);

    try {
      // Même clientId en cas de nouvel essai : le serveur ne compte le passage qu'une fois
      const consumedRes = await qrApi.consume({
        token,
        eventId: eventId || undefined,
        clientId,
      });
      setResult(consumedRes);
      if (consumedRes.consumed) {
        hapticFeedback.success();
      } else {
        hapticFeedback.error();
      }
    } catch (err) {
      // L'entrée n'est PAS enregistrée : on le dit clairement à l'agent
      setConsumeError(
        err instanceof ApiError
          ? `Entrée non enregistrée : ${err.message}`
          : 'Entrée non enregistrée. Réessayez.'
      );
      hapticFeedback.error();
    } finally {
      setConsuming(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Vérification en cours...</Text>
        <Text style={styles.tokenTrunc}>{truncateToken(token)}</Text>
      </View>
    );
  }

  const code: ScanResultCode = result?.code || 'INVALID';
  const theme = RESULT_THEMES[code] || RESULT_THEMES.INVALID;
  const alreadyConsumed = Boolean(result && 'consumed' in result && result.consumed);
  // Tout pass valide donne lieu à un passage enregistré (billet consommé ou badge tracé)
  const isConsumableTicket = Boolean(result?.valid) && !alreadyConsumed;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Result Header Hero Card */}
        <View
          style={[
            styles.heroCard,
            { backgroundColor: theme.bgColor, borderColor: theme.borderColor },
          ]}
        >
          <View
            style={[styles.statusBadge, { backgroundColor: theme.badgeBg }]}
          >
            <Text style={[styles.statusBadgeText, { color: theme.textColor }]}>
              {code}
            </Text>
          </View>

          <Text style={[styles.heroTitle, { color: theme.textColor }]}>
            {theme.title}
          </Text>
          <Text style={[styles.heroSubtitle, { color: theme.textColor }]}>
            {result?.message || theme.subtitle}
          </Text>

          <Text style={styles.verifiedTime}>
            Contrôlé à {formatTime(result?.verifiedAt)}
          </Text>
        </View>

        {/* Identity & Holder Information */}
        {result?.holder && (
          <View style={styles.infoCard}>
            <Text style={styles.cardSectionLabel}>TITULAIRE DU PASS</Text>
            <Text style={styles.holderName}>{result.holder.name}</Text>
            {result.holder.role && (
              <Text style={styles.holderRole}>{result.holder.role}</Text>
            )}
            {result.holder.company && (
              <Text style={styles.holderCompany}>{result.holder.company}</Text>
            )}
          </View>
        )}

        {/* Technical QR Meta Information */}
        <View style={styles.infoCard}>
          <Text style={styles.cardSectionLabel}>DÉTAILS DU TITRE</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Type de document :</Text>
            <Text style={styles.metaVal}>{result?.qr?.type || 'INCONNU'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Source plateforme :</Text>
            <Text style={styles.metaVal}>
              {result?.qr?.source || '—'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Mode d’accès :</Text>
            <Text style={styles.metaVal}>
              {result?.reusable ? 'Réutilisable (Badge)' : 'Usage Unique (Ticket)'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Identifiant jeton :</Text>
            <Text style={styles.metaVal}>{truncateToken(token)}</Text>
          </View>
        </View>

        {/* Consumable Ticket Validation Button */}
        {consumeError && (
          <View style={styles.infoCard}>
            <Text style={{ color: '#B91C1C', fontWeight: '600' }}>{consumeError}</Text>
          </View>
        )}

        {isConsumableTicket && (
          <TouchableOpacity
            style={[styles.consumeButton, consuming && styles.buttonDisabled]}
            onPress={handleConsume}
            disabled={consuming}
          >
            {consuming ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.consumeButtonText}>
                {result?.reusable
                  ? '✓ Enregistrer le Passage'
                  : '✓ Valider l’Entrée du Participant'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.nextScanButton}
          onPress={() => router.replace('/(protected)/scanner')}
        >
          <Text style={styles.nextScanButtonText}>Scanner le suivant ➔</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.replace('/(protected)')}
        >
          <Text style={styles.closeButtonText}>Retour à l’accueil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  tokenTrunc: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748B',
  },
  scroll: {
    padding: 20,
    paddingBottom: 120,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 2,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.9,
    marginBottom: 12,
    lineHeight: 20,
  },
  verifiedTime: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  cardSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  holderName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  holderRole: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
    marginBottom: 2,
  },
  holderCompany: {
    fontSize: 13,
    color: '#64748B',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  metaKey: {
    fontSize: 13,
    color: '#64748B',
  },
  metaVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  consumeButton: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  consumeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    gap: 10,
  },
  nextScanButton: {
    flex: 1.4,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextScanButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  closeButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
});
