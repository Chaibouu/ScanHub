import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';

const { width } = Dimensions.get('window');
const SCAN_BOX_SIZE = width * 0.72;

export function ScannerOverlay() {
  return (
    <View style={styles.overlay}>
      <View style={styles.topMask} />

      <View style={styles.centerRow}>
        <View style={styles.sideMask} />

        <View style={styles.scanBox}>
          {/* Top Left Corner */}
          <View style={[styles.corner, styles.cornerTL]} />
          {/* Top Right Corner */}
          <View style={[styles.corner, styles.cornerTR]} />
          {/* Bottom Left Corner */}
          <View style={[styles.corner, styles.cornerBL]} />
          {/* Bottom Right Corner */}
          <View style={[styles.corner, styles.cornerBR]} />

          {/* Aim Line */}
          <View style={styles.laserLine} />
        </View>

        <View style={styles.sideMask} />
      </View>

      <View style={styles.bottomMask}>
        <Text style={styles.instructionText}>
          Positionnez le QR code au centre du cadre
        </Text>
      </View>
    </View>
  );
}

const CORNER_SIZE = 26;
const CORNER_THICKNESS = 4;
const CORNER_COLOR = '#3B82F6';

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  topMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  centerRow: {
    height: SCAN_BOX_SIZE,
    flexDirection: 'row',
  },
  sideMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanBox: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomMask: {
    flex: 1.2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingTop: 28,
  },
  instructionText: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    textAlign: 'center',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: CORNER_COLOR,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 8,
  },
  laserLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#60A5FA',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
});
