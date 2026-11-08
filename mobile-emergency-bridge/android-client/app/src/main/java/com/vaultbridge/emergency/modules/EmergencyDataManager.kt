package com.vaultbridge.emergency.modules

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.RingtoneManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import org.json.JSONArray
import org.json.JSONObject

class EmergencyDataManager(private val context: Context) {

    // 1. Get Battery Status
    fun getBatteryStatus(): JSONObject {
        val ifilter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        val batteryStatus: Intent? = context.registerReceiver(null, ifilter)

        val level: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val batteryPct: Float = (level * 100 / scale.toFloat())

        val status: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val isCharging: Boolean = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                status == BatteryManager.BATTERY_STATUS_FULL

        return JSONObject().apply {
            put("level", batteryPct.toInt())
            put("isCharging", isCharging)
            put("health", "Good")
        }
    }

    // 2. Get Network Info
    fun getNetworkInfo(): JSONObject {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val net = cm?.activeNetwork
        val caps = cm?.getNetworkCapabilities(net)

        val type = when {
            caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true -> "Wi-Fi (High Speed)"
            caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true -> "Mobile Cellular (4G/5G)"
            else -> "Disconnected / Unknown"
        }

        return JSONObject().apply {
            put("type", type)
            put("signalStrength", "Strong")
        }
    }

    // 3. Sound Max-Volume Alarm (even if on silent)
    fun playMaxVolumeAlarm(durationSeconds: Int = 15) {
        try {
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM)
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxVol, 0)

            val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

            val ringtone = RingtoneManager.getRingtone(context, alarmUri)
            ringtone.audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            ringtone.play()

            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                if (ringtone.isPlaying) {
                    ringtone.stop()
                }
            }, (durationSeconds * 1000).toLong())
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
