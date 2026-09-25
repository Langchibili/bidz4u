package expo.modules.drawover

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import org.json.JSONObject

class FloatingBubbleService : Service() {
    private var windowManager: WindowManager? = null
    private var floatingView: View? = null
    private val handler = Handler(Looper.getMainLooper())
    private var pendingBadgeCount = 0

    companion object {
        private const val CHANNEL_ID = "floating_bubble_channel"
        private const val NOTIFICATION_ID = 1001
        private const val ACTION_START = "ACTION_START"
        private const val ACTION_STOP = "ACTION_STOP"
        private const val ACTION_UPDATE_BADGE = "ACTION_UPDATE_BADGE"
        private const val ACTION_SHOW_RIPPLE = "ACTION_SHOW_RIPPLE"
        private const val ACTION_SHOW_RIDE_CARD = "ACTION_SHOW_RIDE_CARD"
        private const val ACTION_APP_FOREGROUND = "ACTION_APP_FOREGROUND"
        private const val ACTION_APP_BACKGROUND = "ACTION_APP_BACKGROUND"
        private const val EXTRA_BADGE_COUNT = "EXTRA_BADGE_COUNT"
        private const val EXTRA_RIDE_JSON = "EXTRA_RIDE_JSON"
        private var instance: FloatingBubbleService? = null

        fun isRunning(): Boolean = instance != null

        fun start(context: Context) {
            dispatch(context, ACTION_START)
        }

        fun stop(context: Context) {
            context.startService(command(context, ACTION_STOP))
        }

        fun updateBadge(context: Context, count: Int) {
            context.startService(command(context, ACTION_UPDATE_BADGE).putExtra(EXTRA_BADGE_COUNT, count))
        }

        fun showRipple(context: Context) {
            context.startService(command(context, ACTION_SHOW_RIPPLE))
        }

        fun showRideCard(context: Context, rideJson: String) {
            dispatch(context, ACTION_SHOW_RIDE_CARD, EXTRA_RIDE_JSON to rideJson)
        }

        fun notifyAppForeground(context: Context) {
            context.startService(command(context, ACTION_APP_FOREGROUND))
        }

        fun notifyAppBackground(context: Context) {
            dispatch(context, ACTION_APP_BACKGROUND)
        }

        private fun command(context: Context, action: String): Intent =
            Intent(context, FloatingBubbleService::class.java).setAction(action)

        private fun dispatch(context: Context, action: String, vararg extras: Pair<String, String>) {
            val intent = command(context, action)
            extras.forEach { (key, value) -> intent.putExtra(key, value) }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForeground(NOTIFICATION_ID, createNotification())
        }

        when (intent?.action) {
            ACTION_START -> showRideCard(null)
            ACTION_STOP -> {
                hideCard()
                stopSelf()
            }
            ACTION_UPDATE_BADGE -> {
                pendingBadgeCount = intent.getIntExtra(EXTRA_BADGE_COUNT, 0)
                if (floatingView != null) showRideCard(null)
            }
            ACTION_SHOW_RIPPLE -> floatingView?.animate()?.alpha(1f)?.setDuration(200)?.start()
            ACTION_SHOW_RIDE_CARD -> showRideCard(intent.getStringExtra(EXTRA_RIDE_JSON))
            ACTION_APP_FOREGROUND -> floatingView?.visibility = View.GONE
            ACTION_APP_BACKGROUND -> floatingView?.visibility = View.VISIBLE
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        hideCard()
        instance = null
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Floating Bubble",
                NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName) ?: Intent()
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, flags)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("You are online")
            .setContentText("Tap to open Bidz4u")
            .setSmallIcon(applicationInfo.icon)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }

    private fun showRideCard(rideJson: String?) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) return
        hideCard()

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(16), dp(18), dp(16))
            background = rounded(Color.WHITE, dp(18))
            elevation = dp(8).toFloat()
        }

        val json = rideJson?.let { runCatching { JSONObject(it) }.getOrNull() }
        val type = if (json?.optString("type") == "delivery_request") "Delivery" else "Ride"
        val code = json?.optString("rideCode").orEmpty()
        val title = TextView(this).apply {
            text = if (code.isBlank()) "New $type request" else "New $type request: $code"
            textSize = 18f
            setTextColor(Color.rgb(35, 35, 35))
        }
        card.addView(title, LinearLayout.LayoutParams(-1, -2))

        if (pendingBadgeCount > 0) {
            val badge = TextView(this).apply {
                text = "Notifications: $pendingBadgeCount"
                textSize = 13f
                setTextColor(Color.DKGRAY)
            }
            card.addView(badge, LinearLayout.LayoutParams(-1, -2))
        }

        card.setOnClickListener { hideCard() }
        val typeFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }
        val params = WindowManager.LayoutParams(
            resources.displayMetrics.widthPixels - dp(20),
            WindowManager.LayoutParams.WRAP_CONTENT,
            typeFlag,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.CENTER }

        windowManager?.addView(card, params)
        floatingView = card
        handler.postDelayed({ floatingView?.animate()?.alpha(0.35f)?.setDuration(500)?.start() }, 60_000L)
    }

    private fun hideCard() {
        floatingView?.let { view ->
            runCatching { windowManager?.removeView(view) }
        }
        floatingView = null
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun rounded(color: Int, radius: Int): GradientDrawable =
        GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            setColor(color)
            cornerRadius = radius.toFloat()
        }
}
