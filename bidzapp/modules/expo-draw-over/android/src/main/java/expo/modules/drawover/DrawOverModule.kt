package expo.modules.drawover

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DrawOverModule : Module() {
    override fun definition() = ModuleDefinition {

        Name("DrawOverNativeModule")
        Function("checkPermission") {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(appContext.reactContext)
            } else {
                true
            }
        }

        Function("requestPermission") {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (!Settings.canDrawOverlays(appContext.reactContext)) {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:${appContext.reactContext?.packageName}")
                    )
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    appContext.reactContext?.startActivity(intent)
                    false
                } else {
                    true
                }
            } else {
                true
            }
        }

        // ===== FLOATING BUBBLE CONTROLS =====
        
        Function("startFloatingBubble") {
            FloatingBubbleService.start(appContext.reactContext!!)
            true
        }
        
        Function("stopFloatingBubble") {
            FloatingBubbleService.stop(appContext.reactContext!!)
            true
        }
        
        Function("isFloatingBubbleShowing") {
            FloatingBubbleService.isRunning()
        }
        
        Function("updateBubbleBadge") { count: Int ->
            FloatingBubbleService.updateBadge(appContext.reactContext!!, count)
            true
        }
        
        Function("showBubbleRipple") {
            FloatingBubbleService.showRipple(appContext.reactContext!!)
            true
        }
        AsyncFunction("showRideCard") { json: String ->
            FloatingBubbleService.showRideCard(appContext.reactContext!!, json)
            true
        }
        Function("notifyAppForeground") {
            FloatingBubbleService.notifyAppForeground(appContext.reactContext!!)
            true
        }

        Function("notifyAppBackground") {
            FloatingBubbleService.notifyAppBackground(appContext.reactContext!!)
            true
        }

        // ===== LEGACY OVERLAY (for ride request popups) =====
        
        AsyncFunction("showOverlay") { data: Map<String, Any?> ->
            // Your existing overlay code here
            // ... (keep the existing implementation)
        }

        AsyncFunction("hideOverlay") {
            // Your existing hide code
        }

        Function("isOverlayShowing") {
            false // or your existing implementation
        }
    }
}