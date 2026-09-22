import React, { useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';

const { width, height } = Dimensions.get('window');

const OkraSkeletonLoader = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;
  const floatAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Shimmer animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Float animations for orbs
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim1, {
          toValue: 1,
          duration: 12000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim1, {
          toValue: 0,
          duration: 12000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim2, {
          toValue: 1,
          duration: 15000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim2, {
          toValue: 0,
          duration: 15000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim3, {
          toValue: 1,
          duration: 18000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim3, {
          toValue: 0,
          duration: 18000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.7],
  });

  const orb1Transform = {
    transform: [
      {
        translateX: floatAnim1.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 30],
        }),
      },
      {
        translateY: floatAnim1.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -30],
        }),
      },
    ],
  };

  const orb2Transform = {
    transform: [
      {
        translateX: floatAnim2.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 30],
        }),
      },
      {
        translateY: floatAnim2.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -30],
        }),
      },
    ],
  };

  const orb3Transform = {
    transform: [
      {
        translateX: floatAnim3.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 30],
        }),
      },
      {
        translateY: floatAnim3.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -30],
        }),
      },
    ],
  };

  const SkeletonBox = ({ style }: { style?: any }) => (
    <Animated.View
      style={[
        styles.skeletonBox,
        { opacity: shimmerOpacity },
        style,
      ]}
    />
  );

  return (
    <View style={styles.container}>
      {/* Background Gradient Orbs */}
      <View style={styles.backgroundWrapper}>
        <Animated.View style={[styles.gradientOrb, styles.orb1, orb1Transform]} />
        <Animated.View style={[styles.gradientOrb, styles.orb2, orb2Transform]} />
        <Animated.View style={[styles.gradientOrb, styles.orb3, orb3Transform]} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Skeleton */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <SkeletonBox style={styles.logoCircle} />
            <View style={styles.brandText}>
              <SkeletonBox style={styles.brandTitle} />
              <SkeletonBox style={styles.brandSubtitle} />
            </View>
          </View>
          <SkeletonBox style={styles.tagline} />
        </View>

        {/* Hero Section Skeleton */}
        <View style={styles.heroSection}>
          <SkeletonBox style={styles.heroTitle} />
          <SkeletonBox style={styles.heroSubtitle} />
        </View>

        {/* Quick Actions Grid Skeleton */}
        <View style={styles.quickActionsGrid}>
          {[...Array(6)].map((_, i) => (
            <SkeletonBox key={`quick-${i}`} style={styles.quickActionBtn} />
          ))}
        </View>

        {/* Service Cards Skeleton */}
        <View style={styles.servicesContainer}>
          {[...Array(4)].map((_, i) => (
            <View key={`service-${i}`} style={styles.serviceCard}>
              <SkeletonBox style={styles.serviceIcon} />
              <SkeletonBox style={styles.serviceName} />
              <SkeletonBox style={styles.serviceDesc1} />
              <SkeletonBox style={styles.serviceDesc2} />
              
              {/* Features */}
              <View style={styles.featuresList}>
                {[...Array(3)].map((_, j) => (
                  <View key={`feature-${i}-${j}`} style={styles.featureRow}>
                    <SkeletonBox style={styles.featureCheck} />
                    <SkeletonBox style={styles.featureText} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Features Section Skeleton */}
        <View style={styles.featuresSection}>
          <SkeletonBox style={styles.featuresSectionTitle} />
          <View style={styles.featuresGrid}>
            {[...Array(4)].map((_, i) => (
              <View key={`feat-${i}`} style={styles.featureItem}>
                <SkeletonBox style={styles.featureIconBox} />
                <SkeletonBox style={styles.featureTitleText} />
                <SkeletonBox style={styles.featureDescLine} />
              </View>
            ))}
          </View>
        </View>

        {/* Stats Section Skeleton */}
        <View style={styles.statsSection}>
          {[...Array(4)].map((_, i) => (
            <View key={`stat-${i}`} style={styles.statItem}>
              <SkeletonBox style={styles.statNumber} />
              <SkeletonBox style={styles.statLabel} />
            </View>
          ))}
        </View>

        {/* Footer Spacer */}
        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  backgroundWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  gradientOrb: {
    position: 'absolute',
    borderRadius: 200,
    opacity: 0.15,
  },
  orb1: {
    width: 400,
    height: 400,
    backgroundColor: '#FFC107',
    top: -150,
    left: -150,
  },
  orb2: {
    width: 350,
    height: 350,
    backgroundColor: '#4CAF50',
    top: height * 0.2,
    right: -100,
  },
  orb3: {
    width: 300,
    height: 300,
    backgroundColor: '#3F51B5',
    bottom: height * 0.1,
    left: width / 2 - 150,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
  },
  skeletonBox: {
    backgroundColor: '#1E2A4A',
    borderRadius: 8,
  },
  
  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  brandText: {
    gap: 8,
  },
  brandTitle: {
    width: 100,
    height: 32,
    borderRadius: 8,
  },
  brandSubtitle: {
    width: 120,
    height: 16,
    borderRadius: 6,
  },
  tagline: {
    width: 220,
    height: 18,
    borderRadius: 6,
  },
  
  // Hero
  heroSection: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  heroTitle: {
    width: Math.min(320, width * 0.8),
    height: 40,
    borderRadius: 10,
  },
  heroSubtitle: {
    width: Math.min(380, width * 0.9),
    height: 20,
    borderRadius: 8,
  },
  
  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 30,
  },
  quickActionBtn: {
    width: (width - 56) / 3, // 3 columns with gaps
    height: 110,
    borderRadius: 20,
  },
  
  // Service Cards
  servicesContainer: {
    gap: 24,
    paddingVertical: 20,
  },
  serviceCard: {
    backgroundColor: 'rgba(15, 22, 41, 0.6)',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: '#2A3A5A',
  },
  serviceIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 20,
  },
  serviceName: {
    width: 160,
    height: 28,
    borderRadius: 8,
    marginBottom: 12,
  },
  serviceDesc1: {
    width: '100%',
    height: 18,
    borderRadius: 6,
    marginBottom: 8,
  },
  serviceDesc2: {
    width: '75%',
    height: 18,
    borderRadius: 6,
    marginBottom: 24,
  },
  featuresList: {
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  featureText: {
    flex: 1,
    height: 16,
    borderRadius: 6,
  },
  
  // Features Section
  featuresSection: {
    paddingVertical: 40,
  },
  featuresSectionTitle: {
    width: 220,
    height: 32,
    borderRadius: 10,
    alignSelf: 'center',
    marginBottom: 40,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 20,
  },
  featureItem: {
    width: (width - 60) / 2,
    backgroundColor: 'rgba(15, 22, 41, 0.6)',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A3A5A',
  },
  featureIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 16,
  },
  featureTitleText: {
    width: 120,
    height: 20,
    borderRadius: 8,
    marginBottom: 12,
  },
  featureDescLine: {
    width: '90%',
    height: 16,
    borderRadius: 6,
  },
  
  // Stats
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    paddingVertical: 40,
    gap: 32,
  },
  statItem: {
    alignItems: 'center',
    gap: 12,
  },
  statNumber: {
    width: 80,
    height: 36,
    borderRadius: 10,
  },
  statLabel: {
    width: 100,
    height: 16,
    borderRadius: 6,
  },
  
  footerSpacer: {
    height: 60,
  },
});

export default OkraSkeletonLoader;