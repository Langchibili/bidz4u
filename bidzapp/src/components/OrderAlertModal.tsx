import React, { useState, useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Vibration, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface OrderAlertData {
    orderId: string | number; orderNumber?: string; tableNumber?: string | number;
    items?: { name: string; quantity: number; price: number }[];
    total?: number; subtotal?: number; notes?: string;
}

interface Props {
    open: boolean;
    order: OrderAlertData | null;
    onAccept: (orderId: string | number) => void;
    onDismiss: (orderId: string | number) => void;
}

export const OrderAlertModal: React.FC<Props> = ({ open, order, onAccept, onDismiss }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        if (open && order) Vibration.vibrate([200, 100, 200, 100, 200]);
        return () => Vibration.cancel();
    }, [open, order]);

    useEffect(() => {
        if (open && order) {
            pulseLoop.current = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.04, duration: 500, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
                ])
            );
            pulseLoop.current.start();
        } else { pulseLoop.current?.stop(); pulseAnim.setValue(1); }
        return () => pulseLoop.current?.stop();
    }, [open, order?.orderId]);

    const handleAccept = () => { Vibration.cancel(); if (order) onAccept(order.orderId); };
    const handleDismiss = () => { Vibration.cancel(); if (order) onDismiss(order.orderId); };

    return (
        <Modal visible={open} transparent animationType="slide" onRequestClose={handleDismiss}>
            {order ? (
                <View style={styles.overlay}>
                    <Animated.View style={[styles.card, { transform: [{ scale: pulseAnim }] }]}>
                        <LinearGradient colors={['#1258C7', '#0D3E9C']} style={styles.header}>
                            <Text style={styles.headerIcon}>🍽️</Text>
                            <Text style={styles.headerTitle}>New Order!</Text>
                            <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn}>
                                <Text style={styles.closeIcon}>✕</Text>
                            </TouchableOpacity>
                        </LinearGradient>

                        <View style={styles.tableRow}>
                            <Text style={styles.tableLabel}>TABLE</Text>
                            <Text style={styles.tableNumber}>{order.tableNumber ?? '-'}</Text>
                            {order.orderNumber && <Text style={styles.orderNumber}>#{order.orderNumber}</Text>}
                        </View>

                        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                            {(order.items || []).map((it, i) => (
                                <View key={i} style={styles.itemRow}>
                                    <Text style={styles.itemQty}>{it.quantity}×</Text>
                                    <Text style={styles.itemName}>{it.name}</Text>
                                    <Text style={styles.itemPrice}>K{(it.price * it.quantity).toFixed(2)}</Text>
                                </View>
                            ))}
                            {order.notes ? <Text style={styles.notes}>Note: {order.notes}</Text> : null}
                        </ScrollView>

                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Total</Text>
                            <Text style={styles.totalValue}>K{(order.total ?? 0).toFixed(2)}</Text>
                        </View>

                        <View style={styles.buttonRow}>
                            <TouchableOpacity style={[styles.button, styles.dismissBtn]} onPress={handleDismiss}>
                                <Text style={styles.dismissText}>Dismiss</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.button, styles.acceptBtn]} onPress={handleAccept}>
                                <Text style={styles.acceptText}>Accept Order</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            ) : null}
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    card: { width: width - 32, maxWidth: 420, maxHeight: height - 120, backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 16 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
    headerIcon: { fontSize: 22, marginRight: 8 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
    closeBtn: { position: 'absolute', right: 16, top: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    closeIcon: { fontSize: 18, color: '#fff', fontWeight: '600' },
    tableRow: { flexDirection: 'row', alignItems: 'baseline', padding: 16, gap: 8 },
    tableLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.5 },
    tableNumber: { fontSize: 22, fontWeight: '800', color: '#1258C7' },
    orderNumber: { fontSize: 13, color: '#94a3b8', marginLeft: 'auto' },
    scroll: { maxHeight: 260 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 8 },
    itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    itemQty: { width: 32, fontWeight: '700', color: '#1258C7' },
    itemName: { flex: 1, color: '#1e293b', fontWeight: '500' },
    itemPrice: { color: '#64748b', fontWeight: '600' },
    notes: { fontSize: 13, color: '#92400E', backgroundColor: '#FFFBEB', padding: 10, borderRadius: 10, marginTop: 10 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    totalLabel: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
    totalValue: { fontSize: 18, fontWeight: '800', color: '#1258C7' },
    buttonRow: { flexDirection: 'row', padding: 16, gap: 12 },
    button: { flex: 1, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    dismissBtn: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#e2e8f0' },
    dismissText: { color: '#64748b', fontWeight: '700', fontSize: 15 },
    acceptBtn: { backgroundColor: '#1258C7' },
    acceptText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default OrderAlertModal;