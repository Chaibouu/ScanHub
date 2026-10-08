import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScannerOverlay } from '@/components/scanner/ScannerOverlay';
import { useEventStore } from '@/stores/eventStore';


export default function ScannerScreen() {
  const router = useRouter();
  const { activeEvent } = useEventStore();
  const [torch, setTorch] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const isScanningRef = useRef(false);

  const [permission, requestPermission] = useCameraPermissions();

  const handleBarcodeScanned = (scannedData: { data: string; type?: string }) => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;

    const token = scannedData.data;
    navigateToResult(token);
  };

  const navigateToResult = (token: string) => {
    router.push({
      pathname: '/(protected)/result',
      params: {
        token: token.trim(),
        eventId: activeEvent?.id || '',
      },
    });

    // Reset lock after debounce delay
    setTimeout(() => {
      isScanningRef.current = false;
    }, 1500);
  };

  return (
    <View style={styles.container}>
      {/* Top Floating Controls */}
      <SafeAreaView style={styles.topControlContainer}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.circleButton}
            onPress={() => router.back()}
          >
            <Text style={styles.circleButtonIcon}>✕</Text>
          </TouchableOpacity>

          <View style={styles.eventPill}>
            <Text style={styles.eventPillText} numberOfLines={1}>
              {activeEvent?.name || 'ScanHub'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.circleButton, torch && styles.circleButtonActive]}
            onPress={() => setTorch(!torch)}
          >
            <Text style={styles.circleButtonIcon}>{torch ? '🔦' : '⚡'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Camera View or Fallback Viewfinder */}
      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={handleBarcodeScanned}
        />
      ) : (
        <View style={styles.cameraPlaceholder}>
          <Text style={styles.placeholderTitle}>Mode Viseur Caméra</Text>
          <Text style={styles.placeholderSub}>
            {permission && !permission.granted
              ? 'Permission caméra non accordée.'
              : 'Prêt pour le scan de QR codes.'}
          </Text>
          {permission && !permission.granted && (
            <TouchableOpacity
              style={styles.permissionBtn}
              onPress={requestPermission}
            >
              <Text style={styles.permissionBtnText}>Autoriser la caméra</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Target Crosshairs and Guidelines */}
      <ScannerOverlay />

      {/* Bottom Floating Bar (Simulator / Manual Entry / Quick Test) */}
      <SafeAreaView style={styles.bottomControls}>
        {showManualInput ? (
          <View style={styles.manualInputCard}>
            <TextInput
              style={styles.manualTextInput}
              placeholder="Saisir le code du billet"
              placeholderTextColor="#94A3B8"
              value={manualToken}
              onChangeText={setManualToken}
              autoCapitalize="characters"
              autoFocus
            />
            <TouchableOpacity
              style={styles.validateTokenBtn}
              onPress={() => {
                if (manualToken.trim()) {
                  navigateToResult(manualToken);
                  setManualToken('');
                  setShowManualInput(false);
                }
              }}
            >
              <Text style={styles.validateTokenBtnText}>Vérifier</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeManualBtn}
              onPress={() => setShowManualInput(false)}
            >
              <Text style={styles.closeManualBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.quickTestBar}>
            <TouchableOpacity
              style={styles.manualEntryPill}
              onPress={() => setShowManualInput(true)}
            >
              <Text style={styles.manualEntryPillText}>
                ⌨ Saisie manuelle
              </Text>
            </TouchableOpacity>

            {/* Raccourcis vers les QR du seed — builds de développement uniquement */}
            {__DEV__ && (
            <View style={styles.presetsRow}>
              <TouchableOpacity
                style={[styles.presetTag, { backgroundColor: '#10B981' }]}
                onPress={() => navigateToResult('TICKET_VALIDE_2026')}
              >
                <Text style={styles.presetTagText}>+ Valide</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.presetTag, { backgroundColor: '#F59E0B' }]}
                onPress={() => navigateToResult('TICKET_USED_992')}
              >
                <Text style={styles.presetTagText}>+ Déjà Utilisé</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.presetTag, { backgroundColor: '#8B5CF6' }]}
                onPress={() => navigateToResult('BADGE_VIP_AMB')}
              >
                <Text style={styles.presetTagText}>+ Badge VIP</Text>
              </TouchableOpacity>
            </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  placeholderTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  placeholderSub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  permissionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  topControlContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 36 : 10,
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleButtonActive: {
    backgroundColor: '#EAB308',
  },
  circleButtonIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  eventPill: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: '60%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  eventPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: 'center',
  },
  quickTestBar: {
    alignItems: 'center',
    gap: 12,
  },
  manualEntryPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  manualEntryPillText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  presetTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  manualInputCard: {
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8,
  },
  manualTextInput: {
    flex: 1,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 14,
  },
  validateTokenBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  validateTokenBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  closeManualBtn: {
    padding: 8,
  },
  closeManualBtnText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700',
  },
});
