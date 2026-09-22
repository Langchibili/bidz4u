// // OkraApp\src\components\PermissionsVideoModal.tsx
// import React, { useEffect, useRef, useState } from 'react';
// import {
//   Modal,
//   View,
//   Text,
//   TouchableOpacity,
//   StyleSheet,
//   Animated,
//   Dimensions,
//   StatusBar,
//   ActivityIndicator,
//   Platform,
// } from 'react-native';
// import { useVideoPlayer, VideoView } from 'expo-video';
// import { useEvent } from 'expo';

// const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// // ─────────────────────────────────────────────────────────────────────────────
// // VIDEO SOURCES (LOCAL BUNDLED ASSETS)
// // ─────────────────────────────────────────────────────────────────────────────
// const VIDEO_MAIN = require('assets/how-to-set-draw-over-permissions-hd.mp4');
// const VIDEO_SAMSUNG = require('assets/sumsung-permissions-video.mp4');
// const VIDEO_IOS = require('assets/how-to-set-background-running-ios.mp4');
// // ─────────────────────────────────────────────────────────────────────────────
// // GLOBAL HANDLER REGISTRATION
// // ─────────────────────────────────────────────────────────────────────────────
// type ShowPromptFn = () => void;
// let _showPromptHandler: ShowPromptFn | null = null;

// export function registerPermissionsVideoHandler(fn: ShowPromptFn): void {
//   _showPromptHandler = fn;
// }

// export function showPermissionsVideoPrompt(): void {
//   _showPromptHandler?.();
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // TOAST
// // ─────────────────────────────────────────────────────────────────────────────
// function BottomToast({
//   visible,
//   onHide,
// }: {
//   visible: boolean;
//   onHide: () => void;
// }) {
//   const slideAnim = useRef(new Animated.Value(120)).current;

//   useEffect(() => {
//     if (visible) {
//       Animated.spring(slideAnim, {
//         toValue: 0,
//         useNativeDriver: true,
//         tension: 60,
//         friction: 10,
//       }).start();
//       const t = setTimeout(() => {
//         Animated.timing(slideAnim, {
//           toValue: 120,
//           duration: 300,
//           useNativeDriver: true,
//         }).start(onHide);
//       }, 5000);
//       return () => clearTimeout(t);
//     }
//   }, [visible]);

//   if (!visible) return null;

//   return (
//     <Animated.View
//       style={[styles.toast, { transform: [{ translateY: slideAnim }] }]}
//     >
//       <Text style={styles.toastText}>
//         💡 You can watch the video again from the Help page — tap the{' '}
//         <Text style={styles.toastBold}>"?" icon</Text> at the top right of your screen.
//       </Text>
//       <TouchableOpacity onPress={onHide} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
//         <Text style={styles.toastClose}>✕</Text>
//       </TouchableOpacity>
//     </Animated.View>
//   );
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // FULL-SCREEN VIDEO PLAYER
// // ─────────────────────────────────────────────────────────────────────────────
// function VideoPlayer({
//   source,
//   title,
//   onClose,
// }: {
//   source: any;
//   title: string;
//   onClose: () => void;
// }) {
//   // Create the player; auto-play on mount
//   const player = useVideoPlayer(source, (p) => {
//     p.loop = false;
//     p.play();
//   });

//   // Reactive playback state
//   const { isPlaying } = useEvent(player, 'playingChange', {
//     isPlaying: player.playing,
//   });

//   // Track status + error (this is the correct way according to Expo docs)
//   const { status, error } = useEvent(player, 'statusChange', {
//     status: player.status,
//   });

//   // Log errors to console (very helpful for debugging)
//   useEffect(() => {
//     if (error) {
//       console.error('🎬 VideoPlayer error:', error);
//     }
//   }, [error]);

//   const isLoading = status === 'loading';

//   // Track progress (0–1)
//   const [progress, setProgress] = useState(0);
//   useEffect(() => {
//     const interval = setInterval(() => {
//       const duration = player.duration;
//       const current = player.currentTime;
//       if (duration && duration > 0) {
//         setProgress(current / duration);
//       }
//     }, 500);
//     return () => clearInterval(interval);
//   }, [player]);

//   const togglePlay = () => {
//     if (isPlaying) {
//       player.pause();
//     } else {
//       player.play();
//     }
//   };

//   return (
//     <View style={styles.playerContainer}>
//       <StatusBar hidden />

//       {/* Video */}
//       <VideoView
//         player={player}
//         style={styles.video}
//         contentFit="contain"
//         nativeControls={false}
//       />

//       {/* Loading spinner */}
//       {isLoading && (
//         <View style={styles.loadingOverlay}>
//           <ActivityIndicator size="large" color="#fff" />
//         </View>
//       )}

//       {/* Controls overlay */}
//       <View style={styles.controlsOverlay}>
//         {/* Top bar */}
//         <View style={styles.controlsTop}>
//           <Text style={styles.videoTitle} numberOfLines={1}>{title}</Text>
//           <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
//             <Text style={styles.closeBtnText}>✕ Close</Text>
//           </TouchableOpacity>
//         </View>

//         {/* Centre play/pause */}
//         <TouchableOpacity onPress={togglePlay} style={styles.playPauseBtn} activeOpacity={0.7}>
//           <Text style={styles.playPauseIcon}>{isPlaying ? '⏸' : '▶'}</Text>
//         </TouchableOpacity>

//         {/* Progress bar */}
//         <View style={styles.progressContainer}>
//           <View style={styles.progressTrack}>
//             <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
//           </View>
//         </View>
//       </View>
//     </View>
//   );
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // MAIN COMPONENT
// // ─────────────────────────────────────────────────────────────────────────────
// export default function PermissionsVideoModal({
//   frontendBaseUrl = '', // kept for backward compatibility (no longer used)
// }: {
//   frontendBaseUrl?: string;
// }) {
//   const [showPrompt, setShowPrompt] = useState(false);
//   const [activeVideo, setActiveVideo] = useState<{
//     source: any;
//     title: string;
//   } | null>(null);
//   const [showToast, setShowToast] = useState(false);

//   const slideAnim = useRef(new Animated.Value(400)).current;

//   useEffect(() => {
//     registerPermissionsVideoHandler(() => setShowPrompt(true));
//   }, []);

//   useEffect(() => {
//     if (showPrompt) {
//       Animated.spring(slideAnim, {
//         toValue: 0,
//         useNativeDriver: true,
//         tension: 55,
//         friction: 9,
//       }).start();
//     } else {
//       slideAnim.setValue(400);
//     }
//   }, [showPrompt]);

//   const openVideo = (source: any, title: string) => {
//     setShowPrompt(false);
//     setActiveVideo({ source, title });
//   };

//   const closePlayer = () => {
//     setActiveVideo(null);
//     setShowToast(true);
//   };

//   const dismissPrompt = () => {
//     Animated.timing(slideAnim, {
//       toValue: 400,
//       duration: 250,
//       useNativeDriver: true,
//     }).start(() => setShowPrompt(false));
//   };

//   return (
//     <>
//       {/* ── Prompt sheet ── */}
//       <Modal
//         visible={showPrompt}
//         transparent
//         animationType="fade"
//         statusBarTranslucent
//         onRequestClose={dismissPrompt}
//       >
//         <View style={styles.overlay}>
//           <Animated.View
//             style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
//           >
//             <View style={styles.handle} />

//             <View style={styles.iconCircle}>
//               <Text style={styles.iconEmoji}>🎬</Text>
//             </View>

//             <Text style={styles.promptTitle}>Watch Setup Video?</Text>

//             {/* ── iOS: different subtitle and single video button ── */}
//             {Platform.OS === 'ios' ? (
//               <>
//                 <Text style={styles.promptSubtitle}>
//                   See a short guide showing exactly how to set the app to run
//                   properly in the background so Okra Rides keeps working when
//                   you're not actively using it.
//                 </Text>

//                 <TouchableOpacity
//                   style={styles.videoBtnPrimary}
//                   onPress={() =>
//                     openVideo(VIDEO_IOS, 'How to Set the App to Run Properly in the Background')
//                   }
//                   activeOpacity={0.85}
//                 >
//                   <Text style={styles.videoBtnIcon}>▶</Text>
//                   <View style={{ flex: 1 }}>
//                     <Text style={styles.videoBtnLabel}>Watch Setup Video</Text>
//                     <Text style={styles.videoBtnSub}>How to enable background running</Text>
//                   </View>
//                 </TouchableOpacity>
//               </>
//             ) : (
//               /* ── Android: original subtitle and two video buttons ── */
//               <>
//                 <Text style={styles.promptSubtitle}>
//                   See a short guide showing exactly how to enable the required permissions
//                   for Okra Rides to work properly.
//                 </Text>

//                 <TouchableOpacity
//                   style={styles.videoBtnPrimary}
//                   onPress={() =>
//                     openVideo(VIDEO_MAIN, 'How to Set Display Over Apps Permission')
//                   }
//                   activeOpacity={0.85}
//                 >
//                   <Text style={styles.videoBtnIcon}>▶</Text>
//                   <View style={{ flex: 1 }}>
//                     <Text style={styles.videoBtnLabel}>Watch Setup Video</Text>
//                     <Text style={styles.videoBtnSub}>How to enable "Display over apps"</Text>
//                   </View>
//                 </TouchableOpacity>

//                 <TouchableOpacity
//                   style={styles.videoBtnSecondary}
//                   onPress={() =>
//                     openVideo(VIDEO_SAMSUNG, 'Samsung: How to Set Permissions')
//                   }
//                   activeOpacity={0.85}
//                 >
//                   <Text style={styles.videoBtnIconAlt}>▶</Text>
//                   <View style={{ flex: 1 }}>
//                     <Text style={styles.videoBtnLabelAlt}>
//                       Watch this if you can't find "Display over apps"
//                     </Text>
//                     <Text style={styles.videoBtnSubAlt}>For Samsung devices</Text>
//                   </View>
//                 </TouchableOpacity>
//               </>
//             )}

//             <TouchableOpacity onPress={dismissPrompt} style={styles.skipBtn}>
//               <Text style={styles.skipText}>Skip for now</Text>
//             </TouchableOpacity>
//           </Animated.View>
//         </View>
//       </Modal>

//       {/* ── Full-screen video player ── */}
//       <Modal
//         visible={!!activeVideo}
//         transparent={false}
//         animationType="slide"
//         statusBarTranslucent
//         supportedOrientations={['portrait']}
//         onRequestClose={closePlayer}
//       >
//         {activeVideo && (
//           <VideoPlayer
//             source={activeVideo.source}
//             title={activeVideo.title}
//             onClose={closePlayer}
//           />
//         )}
//       </Modal>

//       {/* ── Bottom toast ── */}
//       <BottomToast visible={showToast} onHide={() => setShowToast(false)} />
//     </>
//   );
// }

// // ─────────────────────────────────────────────────────────────────────────────
// const styles = StyleSheet.create({
//   overlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.6)',
//     justifyContent: 'flex-end',
//   },
//   sheet: {
//     backgroundColor: '#fff',
//     borderTopLeftRadius: 28,
//     borderTopRightRadius: 28,
//     paddingHorizontal: 24,
//     paddingTop: 12,
//     paddingBottom: 40,
//     alignItems: 'center',
//   },
//   handle: {
//     width: 40,
//     height: 4,
//     borderRadius: 2,
//     backgroundColor: '#ddd',
//     marginBottom: 20,
//   },
//   iconCircle: {
//     width: 64,
//     height: 64,
//     borderRadius: 32,
//     backgroundColor: '#f0f4ff',
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginBottom: 14,
//   },
//   iconEmoji: { fontSize: 30 },
//   promptTitle: {
//     fontSize: 20,
//     fontWeight: '800',
//     color: '#1a1a1a',
//     marginBottom: 8,
//     textAlign: 'center',
//   },
//   promptSubtitle: {
//     fontSize: 14,
//     color: '#555',
//     lineHeight: 22,
//     textAlign: 'center',
//     marginBottom: 24,
//     paddingHorizontal: 8,
//   },
//   videoBtnPrimary: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 14,
//     width: '100%',
//     backgroundColor: '#667eea',
//     borderRadius: 16,
//     padding: 16,
//     marginBottom: 12,
//   },
//   videoBtnIcon: { fontSize: 20, color: '#fff' },
//   videoBtnLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
//   videoBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
//   videoBtnSecondary: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 14,
//     width: '100%',
//     backgroundColor: '#f4f4f8',
//     borderRadius: 16,
//     padding: 16,
//     marginBottom: 20,
//     borderWidth: 1,
//     borderColor: '#e0e0e0',
//   },
//   videoBtnIconAlt: { fontSize: 20, color: '#667eea' },
//   videoBtnLabelAlt: { fontSize: 14, fontWeight: '700', color: '#333' },
//   videoBtnSubAlt: { fontSize: 12, color: '#888', marginTop: 2 },
//   skipBtn: { paddingVertical: 8, paddingHorizontal: 24 },
//   skipText: { fontSize: 14, color: 'red', fontWeight: '600' },

//   // ── Video player ──
//   playerContainer: {
//     flex: 1,
//     backgroundColor: '#000',
//     position: 'relative',
//   },
//   video: {
//     width: SCREEN_W,
//     height: SCREEN_H,
//   },
//   loadingOverlay: {
//     ...StyleSheet.absoluteFillObject,
//     alignItems: 'center',
//     justifyContent: 'center',
//     backgroundColor: 'rgba(0,0,0,0.5)',
//   },
//   controlsOverlay: {
//     ...StyleSheet.absoluteFillObject,
//     justifyContent: 'space-between',
//     paddingTop: Platform.OS === 'ios' ? 54 : 40,
//     paddingBottom: 32,
//     paddingHorizontal: 20,
//   },
//   controlsTop: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//   },
//   videoTitle: {
//     flex: 1,
//     fontSize: 15,
//     fontWeight: '700',
//     color: '#fff',
//     textShadowColor: 'rgba(0,0,0,0.8)',
//     textShadowOffset: { width: 0, height: 1 },
//     textShadowRadius: 4,
//     marginRight: 12,
//   },
//   closeBtn: {
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     borderRadius: 20,
//     paddingHorizontal: 14,
//     paddingVertical: 8,
//   },
//   closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
//   playPauseBtn: {
//     alignSelf: 'center',
//     width: 72,
//     height: 72,
//     borderRadius: 36,
//     backgroundColor: 'rgba(0,0,0,0.45)',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   playPauseIcon: { fontSize: 28, color: '#fff' },
//   progressContainer: { paddingHorizontal: 4 },
//   progressTrack: {
//     height: 4,
//     backgroundColor: 'rgba(255,255,255,0.3)',
//     borderRadius: 2,
//     overflow: 'hidden',
//   },
//   progressFill: {
//     height: '100%',
//     backgroundColor: '#667eea',
//     borderRadius: 2,
//   },

//   // ── Toast ──
//   toast: {
//     position: 'absolute',
//     bottom: 24,
//     left: 16,
//     right: 16,
//     backgroundColor: '#1a1a2e',
//     borderRadius: 16,
//     paddingVertical: 14,
//     paddingHorizontal: 16,
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 10,
//     shadowColor: '#000',
//     shadowOpacity: 0.3,
//     shadowRadius: 12,
//     elevation: 8,
//     zIndex: 9999,
//   },
//   toastText: { flex: 1, fontSize: 13, color: '#fff', lineHeight: 19 },
//   toastBold: { fontWeight: '800', color: '#a78bfa' },
//   toastClose: { color: '#aaa', fontSize: 16, paddingLeft: 4 },
// });
// OkraApp\src\components\PermissionsVideoModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Platform,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO SOURCES (LOCAL BUNDLED ASSETS)
// ─────────────────────────────────────────────────────────────────────────────
const VIDEO_MAIN = require('assets/how-to-set-draw-over-permissions-hd.mp4');
const VIDEO_SAMSUNG = require('assets/sumsung-permissions-video.mp4');
const VIDEO_IOS = require('assets/how-to-set-background-running-ios.mp4');

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL HANDLER REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────
type ShowPromptFn = () => void;
let _showPromptHandler: ShowPromptFn | null = null;

export function registerPermissionsVideoHandler(fn: ShowPromptFn): void {
  _showPromptHandler = fn;
}

export function showPermissionsVideoPrompt(): void {
  _showPromptHandler?.();
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────
function BottomToast({
  visible,
  onHide,
}: {
  visible: boolean;
  onHide: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(120)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }).start();
      const t = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: 120,
          duration: 300,
          useNativeDriver: true,
        }).start(onHide);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.toast, { transform: [{ translateY: slideAnim }] }]}
    >
      <Text style={styles.toastText}>
        💡 You can watch the video again from the Help page — tap the{' '}
        <Text style={styles.toastBold}>"?" icon</Text> at the top right of your screen.
      </Text>
      <TouchableOpacity onPress={onHide} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.toastClose}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL-SCREEN VIDEO PLAYER
// ─────────────────────────────────────────────────────────────────────────────
function VideoPlayer({
  source,
  title,
  onClose,
}: {
  source: any;
  title: string;
  onClose: () => void;
}) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.play();
  });

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });

  const { status, error } = useEvent(player, 'statusChange', {
    status: player.status,
  });

  useEffect(() => {
    if (error) {
      console.error('🎬 VideoPlayer error:', error);
    }
  }, [error]);

  const isLoading = status === 'loading';

  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      const duration = player.duration;
      const current = player.currentTime;
      if (duration && duration > 0) {
        setProgress(current / duration);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [player]);

  const togglePlay = () => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  return (
    <View style={styles.playerContainer}>
      <StatusBar hidden />

      {/* Video */}
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
      />

      {/* Loading spinner */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {/* Controls overlay */}
      <View style={styles.controlsOverlay}>
        {/* Top bar */}
        <View style={styles.controlsTop}>
          <Text style={styles.videoTitle} numberOfLines={1}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕ Close</Text>
          </TouchableOpacity>
        </View>

        {/* Centre play/pause */}
        <TouchableOpacity onPress={togglePlay} style={styles.playPauseBtn} activeOpacity={0.7}>
          <Text style={styles.playPauseIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        </TouchableOpacity>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={['#FFD54F', '#FFC107']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function PermissionsVideoModal({
  frontendBaseUrl = '',
}: {
  frontendBaseUrl?: string;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  // overlayMounted stays true during close animation so sheet isn't cut off
  const [overlayMounted, setOverlayMounted] = useState(false);
  const [activeVideo, setActiveVideo] = useState<{
    source: any;
    title: string;
  } | null>(null);
  const [showToast, setShowToast] = useState(false);

  const panY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // ── Open / close helpers ─────────────────────────────────────────────────
  const open = () => {
    setOverlayMounted(true);
    panY.setValue(SCREEN_H);
    Animated.parallel([
      Animated.spring(panY, { toValue: 0, useNativeDriver: true, tension: 55, friction: 9 }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const close = (onDone?: () => void) => {
    Animated.parallel([
      Animated.timing(panY, { toValue: SCREEN_H, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setOverlayMounted(false);
      setShowPrompt(false);
      onDone?.();
    });
  };

  // ── Swipe-to-dismiss — no Modal means PanResponder works perfectly ────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),

      onPanResponderGrant: () => {
        panY.stopAnimation();
        panY.extractOffset();
      },

      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) panY.setValue(gs.dy);
      },

      onPanResponderRelease: (_, gs) => {
        panY.flattenOffset();
        if (gs.dy > 80 || gs.vy > 0.4) {
          close();
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
        }
      },

      onPanResponderTerminate: () => {
        panY.flattenOffset();
        Animated.spring(panY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
      },
    })
  ).current;

  useEffect(() => {
    registerPermissionsVideoHandler(() => setShowPrompt(true));
  }, []);

  useEffect(() => {
    if (showPrompt) open();
  }, [showPrompt]);

  const openVideo = (source: any, title: string) => {
    close(() => setActiveVideo({ source, title }));
  };

  const dismissPrompt = () => close();

  const closePlayer = () => {
    setActiveVideo(null);
    setShowToast(true);
  };

  return (
    <>
      {/* ── Prompt sheet — plain absolute overlay, NOT a Modal ── */}
      {overlayMounted && (
        <View style={styles.overlayRoot} pointerEvents="box-none">
          {/* Dimmed backdrop */}
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
            <TouchableOpacity style={{ flex: 1 }} onPress={dismissPrompt} activeOpacity={1} />
          </Animated.View>

          {/* Draggable sheet */}
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY: panY }] }]}
            {...panResponder.panHandlers}
          >
            {/* Handle bar — amber gradient */}
            <View style={styles.handleContainer}>
              <LinearGradient
                colors={['#FFD54F', '#FFC107', '#FFB300']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.handle}
              />
            </View>

            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>🎬</Text>
            </View>

            <Text style={styles.promptTitle}>Watch Setup Video?</Text>

            {/* ── iOS ── */}
            {Platform.OS === 'ios' ? (
              <>
                <Text style={styles.promptSubtitle}>
                  See a short guide showing exactly how to set the app to run
                  properly in the background so Okra Rides keeps working when
                  you're not actively using it.
                </Text>
                <TouchableOpacity
                  style={styles.videoBtnPrimaryWrapper}
                  onPress={() => openVideo(VIDEO_IOS, 'How to Set the App to Run Properly in the Background')}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#FFD54F', '#FFC107', '#FFB300']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.videoBtnGradient}
                  >
                    <Text style={styles.videoBtnIcon}>▶</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.videoBtnLabel}>Watch Setup Video</Text>
                      <Text style={styles.videoBtnSub}>How to enable background running</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              /* ── Android ── */
              <>
                <Text style={styles.promptSubtitle}>
                  See a short guide showing exactly how to enable the required permissions
                  for Okra Rides to work properly.
                </Text>
                <TouchableOpacity
                  style={styles.videoBtnPrimaryWrapper}
                  onPress={() => openVideo(VIDEO_MAIN, 'How to Set Display Over Apps Permission')}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#FFD54F', '#FFC107', '#FFB300']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.videoBtnGradient}
                  >
                    <Text style={styles.videoBtnIcon}>▶</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.videoBtnLabel}>Watch Setup Video</Text>
                      <Text style={styles.videoBtnSub}>How to enable "Display over apps"</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.videoBtnSecondaryWrapper}
                  onPress={() => openVideo(VIDEO_SAMSUNG, 'Samsung: How to Set Permissions')}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#FFF8E1', '#FFF3CD']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.videoBtnGradient, styles.videoBtnGradientSecondary]}
                  >
                    <Text style={styles.videoBtnIconAlt}>▶</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.videoBtnLabelAlt}>
                        Watch this if you can't find "Display over apps"
                      </Text>
                      <Text style={styles.videoBtnSubAlt}>For Samsung devices</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={dismissPrompt} style={styles.skipBtn} activeOpacity={0.7}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* ── Full-screen video player ── */}
      <Modal
        visible={!!activeVideo}
        transparent={false}
        animationType="slide"
        statusBarTranslucent
        supportedOrientations={['portrait']}
        onRequestClose={closePlayer}
      >
        {activeVideo && (
          <VideoPlayer
            source={activeVideo.source}
            title={activeVideo.title}
            onClose={closePlayer}
          />
        )}
      </Modal>

      {/* ── Bottom toast ── */}
      <BottomToast visible={showToast} onHide={() => setShowToast(false)} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // ── Handle bar ──
  handleContainer: {
    width: 56,
    marginBottom: 20,
    borderRadius: 3,
    overflow: 'hidden',
  },
  handle: {
    width: '100%',
    height: 6,
    borderRadius: 3,
  },

  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF8E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconEmoji: { fontSize: 30 },
  promptTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  promptSubtitle: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },

  // ── Video buttons — wrapper + gradient fill ──
  videoBtnPrimaryWrapper: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    // Amber shadow
    shadowColor: '#FFC107',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
  },
  videoBtnSecondaryWrapper: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#FFC107',
  },
  videoBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  videoBtnGradientSecondary: {
    // no extra override needed; colors prop handles it
  },
  videoBtnIcon: { fontSize: 20, color: '#1a1a1a' },
  videoBtnLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  videoBtnSub: { fontSize: 12, color: 'rgba(0,0,0,0.55)', marginTop: 2 },
  videoBtnIconAlt: { fontSize: 20, color: '#996600' },
  videoBtnLabelAlt: { fontSize: 14, fontWeight: '700', color: '#333' },
  videoBtnSubAlt: { fontSize: 12, color: '#888', marginTop: 2 },

  // ── Skip button — large pill ──
  skipBtn: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: '#FF3B30',
    backgroundColor: 'rgba(255,59,48,0.06)',
    alignItems: 'center',
    marginTop: 4,
  },
  skipText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FF3B30',
    letterSpacing: 0.3,
  },

  // ── Video player ──
  playerContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  video: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  controlsTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  videoTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginRight: 12,
  },
  closeBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  playPauseBtn: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseIcon: { fontSize: 28, color: '#fff' },
  progressContainer: { paddingHorizontal: 4 },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // ── Toast ──
  toast: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
  },
  toastText: { flex: 1, fontSize: 13, color: '#fff', lineHeight: 19 },
  toastBold: { fontWeight: '800', color: '#FFC107' },
  toastClose: { color: '#aaa', fontSize: 16, paddingLeft: 4 },
});