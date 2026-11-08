package com.vaultbridge.emergency.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.vaultbridge.emergency.modules.EmergencyDataManager
import com.vaultbridge.emergency.modules.FileManager
import com.vaultbridge.emergency.network.WebSocketClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject

class EmergencyBridgeService : Service(), WebSocketClient.MessageListener {

    private val serviceScope = CoroutineScope(Dispatchers.IO)
    private lateinit var fileManager: FileManager
    private lateinit var emergencyManager: EmergencyDataManager
    private var webSocketClient: WebSocketClient? = null

    companion object {
        const val CHANNEL_ID = "vault_bridge_emergency_channel"
        const val NOTIFICATION_ID = 1001
        var latestPairingPin: String? = null
        var isConnected: Boolean = false
    }

    override fun onCreate() {
        super.onCreate()
        fileManager = FileManager()
        emergencyManager = EmergencyDataManager(this)
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("Starting VaultBridge Service..."))

        val prefs = getSharedPreferences("vaultbridge_prefs", Context.MODE_PRIVATE)
        val serverUrl = prefs.getString("server_url", "ws://10.0.2.2:4000") ?: "ws://10.0.2.2:4000"
        val deviceId = prefs.getString("device_id", Build.MODEL.replace(" ", "-").lowercase()) ?: "android-phone"
        val deviceName = Build.MANUFACTURER + " " + Build.MODEL
        val secretKey = prefs.getString("secret_key", "emergency123") ?: "emergency123"

        webSocketClient = WebSocketClient(serverUrl, deviceId, deviceName, secretKey, this)
        webSocketClient?.start()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onDestroy() {
        webSocketClient?.stop()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // WebSocket Listeners
    override fun onConnected(pairingPin: String?) {
        isConnected = true
        latestPairingPin = pairingPin
        updateNotification("Connected! Pairing PIN: ${pairingPin ?: "Active"}")
    }

    override fun onDisconnected() {
        isConnected = false
        updateNotification("Reconnecting to emergency relay...")
    }

    override fun onCommand(action: String, requestId: String, fullMsg: JSONObject) {
        serviceScope.launch {
            when (action) {
                "get_status" -> {
                    val statusObj = JSONObject().apply {
                        put("type", "response")
                        put("action", "get_status")
                        put("requestId", requestId)
                        put("data", JSONObject().apply {
                            put("deviceName", Build.MANUFACTURER + " " + Build.MODEL)
                            put("battery", emergencyManager.getBatteryStatus())
                            put("network", emergencyManager.getNetworkInfo())
                            put("storage", fileManager.getStorageStats())
                        })
                    }
                    webSocketClient?.send(statusObj)
                }

                "list_dir" -> {
                    val path = fullMsg.optString("path", "")
                    val res = fileManager.listDirectory(path)
                    res.put("type", "response")
                    res.put("action", "list_dir")
                    res.put("requestId", requestId)
                    webSocketClient?.send(res)
                }

                "search_files" -> {
                    val q = fullMsg.optString("query", "")
                    val ext = fullMsg.optString("extension", "")
                    val list = fileManager.searchFiles(q, ext)
                    val res = JSONObject().apply {
                        put("type", "response")
                        put("action", "search_files")
                        put("requestId", requestId)
                        put("status", "ok")
                        put("results", list)
                    }
                    webSocketClient?.send(res)
                }

                "download_file" -> {
                    val filePath = fullMsg.optString("filePath", "")
                    fileManager.streamFile(
                        filePath = filePath,
                        onStart = { fName, fSize, totalChunks, hash ->
                            webSocketClient?.send(JSONObject().apply {
                                put("type", "download_start")
                                put("requestId", requestId)
                                put("fileName", fName)
                                put("fileSize", fSize)
                                put("totalChunks", totalChunks)
                                put("sha256", hash)
                            })
                        },
                        onChunk = { idx, total, b64 ->
                            webSocketClient?.send(JSONObject().apply {
                                put("type", "download_chunk")
                                put("requestId", requestId)
                                put("chunkIndex", idx)
                                put("totalChunks", total)
                                put("chunkBase64", b64)
                            })
                        },
                        onComplete = { fName, fSize, hash ->
                            webSocketClient?.send(JSONObject().apply {
                                put("type", "download_complete")
                                put("requestId", requestId)
                                put("fileName", fName)
                                put("fileSize", fSize)
                                put("sha256", hash)
                            })
                        },
                        onError = { errMsg ->
                            webSocketClient?.send(JSONObject().apply {
                                put("type", "response")
                                put("action", "download_file")
                                put("requestId", requestId)
                                put("status", "error")
                                put("message", errMsg)
                            })
                        }
                    )
                }

                "get_contacts" -> {
                    val res = JSONObject().apply {
                        put("type", "response")
                        put("action", "get_contacts")
                        put("requestId", requestId)
                        put("status", "ok")
                        put("contacts", org.json.JSONArray())
                    }
                    webSocketClient?.send(res)
                }

                "get_sms" -> {
                    val res = JSONObject().apply {
                        put("type", "response")
                        put("action", "get_sms")
                        put("requestId", requestId)
                        put("status", "ok")
                        put("messages", org.json.JSONArray())
                    }
                    webSocketClient?.send(res)
                }

                "ring_alarm" -> {
                    val dur = fullMsg.optInt("durationSec", 15)
                    emergencyManager.playMaxVolumeAlarm(dur)
                    val res = JSONObject().apply {
                        put("type", "response")
                        put("action", "ring_alarm")
                        put("requestId", requestId)
                        put("status", "ok")
                        put("message", "Siren played at MAX volume for ${dur}s")
                    }
                    webSocketClient?.send(res)
                }
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val chan = NotificationChannel(
                CHANNEL_ID,
                "VaultBridge Emergency Channel",
                NotificationManager.IMPORTANCE_LOW
            )
            chan.description = "Maintains connection for remote emergency file retrieval"
            val mgr = getSystemService(NotificationManager::class.java)
            mgr?.createNotificationChannel(chan)
        }
    }

    private fun buildNotification(text: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("VaultBridge Active")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        val mgr = getSystemService(NotificationManager::class.java)
        mgr?.notify(NOTIFICATION_ID, buildNotification(text))
    }
}
