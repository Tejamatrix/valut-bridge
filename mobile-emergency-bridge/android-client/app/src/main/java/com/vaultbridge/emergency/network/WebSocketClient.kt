package com.vaultbridge.emergency.network

import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class WebSocketClient(
    private val serverUrl: String,
    private val deviceId: String,
    private val deviceName: String,
    private val secretKey: String,
    private val listener: MessageListener
) {
    interface MessageListener {
        fun onConnected(pairingPin: String?)
        fun onDisconnected()
        fun onCommand(action: String, requestId: String, fullMsg: JSONObject)
    }

    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private var isRunning = false

    fun start() {
        isRunning = true
        connect()
    }

    fun stop() {
        isRunning = false
        webSocket?.close(1000, "App stopped")
        webSocket = null
    }

    private fun connect() {
        if (!isRunning) return

        val request = Request.Builder().url(serverUrl).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                Log.d("VaultBridge", "WebSocket connected. Registering device...")
                val regMsg = JSONObject().apply {
                    put("type", "register_device")
                    put("deviceId", deviceId)
                    put("deviceName", deviceName)
                    put("secretKey", secretKey)
                }
                ws.send(regMsg.toString())
            }

            override fun onMessage(ws: WebSocket, text: String) {
                try {
                    val json = JSONObject(text)
                    val type = json.optString("type")

                    if (type == "device_registered") {
                        val pin = json.optString("pairingPin")
                        listener.onConnected(pin)
                    } else if (type == "command") {
                        val action = json.optString("action")
                        val reqId = json.optString("requestId")
                        listener.onCommand(action, reqId, json)
                    }
                } catch (e: Exception) {
                    Log.e("VaultBridge", "Error parsing message: ${e.message}")
                }
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                Log.d("VaultBridge", "WebSocket closed: $reason")
                listener.onDisconnected()
                scheduleReconnect()
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                Log.e("VaultBridge", "WebSocket failure: ${t.message}")
                listener.onDisconnected()
                scheduleReconnect()
            }
        })
    }

    private fun scheduleReconnect() {
        if (!isRunning) return
        Thread {
            try {
                Thread.sleep(4000)
                connect()
            } catch (ignored: InterruptedException) {}
        }.start()
    }

    fun send(json: JSONObject) {
        webSocket?.send(json.toString())
    }
}
