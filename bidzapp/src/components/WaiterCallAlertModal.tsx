import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Vibration, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface WaiterCallData { callId: string | number; tableNumber?: string | number; message?: string; }

interface Props {
    open: boolean;
    call: WaiterCallData | null;
    onAcknowledge: (callId: string | number) => void;
    onDismiss: (callId: string | number) => void;
}

export const WaiterCallAlertModal: React.FC<Props> = ({ open, call, onAcknowledge, onDismiss }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (open && call) Vibration.vibrate([150, 100, 150]);
        return () => Vibration.cancel();
    }, [open, call]);

    useEffect(() => {
        let loop: Animated.CompositeAnimation | null = null;
        if (open && call) {
            loop = Animated.loop(Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.06, duration: 450, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
            ]));
            loop.start();
        } else pulseAnim.setValue(1);
        return () => loop?.stop();
    }, [open, call?.callId]);

    const handleAck = () => { Vibration.cancel(); if (call) onAcknowledge(call.callId); };
    const handleDismiss = () => { Vibration.cancel(); if (call) onDismiss(call.callId); };

    return (
        <Modal visible={open} transparent animationType="fade" onRequestClose={handleDismiss}>
            {call ? (
                <View style={styles.overlay}>
                    <Animated.View style={[styles.card, { transform: [{ scale: pulseAnim }] }]}>
                        <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.iconCircle}>
                            <Text style={styles.icon}>🔔</Text>
                        </LinearGradient>
                        <Text style={styles.title}>Waiter Needed</Text>
                        <Text style={styles.subtitle}>Table {call.tableNumber ?? '-'}</Text>
                        {call.message ? <Text style={styles.message}>{call.message}</Text> : null}
                        <View style={styles.buttonRow}>
                            <TouchableOpacity style={[styles.button, styles.dismissBtn]} onPress={handleDismiss}>
                                <Text style={styles.dismissText}>Dismiss</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, styles.ackBtn]} onPress={handleAck}>
                                <Text style={styles.ackText}>Acknowledge</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            ) : null}
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    card: { width: width - 48, maxWidth: 360, backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 14 },
    iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    icon: { fontSize: 30 },
    title: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
    subtitle: { fontSize: 16, fontWeight: '700', color: '#D97706', marginTop: 4 },
    message: { fontSize: 14, color: '#64748b', marginTop: 8, textAlign: 'center' },
    buttonRow: { flexDirection: 'row', gap: 12, marginTop: 20, width: '100%' },
    button: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    dismissBtn: { backgroundColor: '#f1f5f9' },
    dismissText: { color: '#64748b', fontWeight: '700' },
    ackBtn: { backgroundColor: '#F59E0B' },
    ackText: { color: '#fff', fontWeight: '700' },
});

export default WaiterCallAlertModal;