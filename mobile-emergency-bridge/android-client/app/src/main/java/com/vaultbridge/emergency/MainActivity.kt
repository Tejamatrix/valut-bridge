package com.vaultbridge.emergency

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.PowerManager
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import com.vaultbridge.emergency.service.EmergencyBridgeService

class MainActivity : AppCompatActivity() {

    private lateinit var tvPinCode: TextView
    private lateinit var tvStatus: TextView
    private lateinit var etServerUrl: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvPinCode = findViewById(R.id.tvPinCode)
        tvStatus = findViewById(R.id.tvStatus)
        etServerUrl = findViewById(R.id.etServerUrl)

        val prefs = getSharedPreferences("vaultbridge_prefs", Context.MODE_PRIVATE)
        val savedUrl = prefs.getString("server_url", "ws://10.15.73.154:4000")
        etServerUrl.setText(savedUrl)

        findViewById<Button>(R.id.btnStoragePerm).setOnClickListener {
            requestStoragePermission()
        }

        findViewById<Button>(R.id.btnBatteryOpt).setOnClickListener {
            requestIgnoreBatteryOptimization()
        }

        findViewById<Button>(R.id.btnSaveAndRestart).setOnClickListener {
            val url = etServerUrl.text.toString().trim()
            if (url.isNotEmpty()) {
                prefs.edit().putString("server_url", url).apply()
                startBridgeService()
                Toast.makeText(this, "VaultBridge Service Started!", Toast.LENGTH_SHORT).show()
            }
        }

        startBridgeService()
        refreshStatus()
    }

    override fun onResume() {
        super.onResume()
        refreshStatus()
    }

    private fun refreshStatus() {
        if (EmergencyBridgeService.isConnected) {
            tvStatus.text = "Status: Online & Linked to Relay"
            tvStatus.setTextColor(0xFF10B981.toInt())
            tvPinCode.text = "PIN: ${EmergencyBridgeService.latestPairingPin ?: "------"}"
        } else {
            tvStatus.text = "Status: Connecting to relay..."
            tvStatus.setTextColor(0xFFF59E0B.toInt())
            tvPinCode.text = "PIN: Generating..."
        }
    }

    private fun startBridgeService() {
        val intent = Intent(this, EmergencyBridgeService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun requestStoragePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
                intent.data = Uri.parse("package:$packageName")
                startActivity(intent)
            } else {
                Toast.makeText(this, "All Files Access Already Granted", Toast.LENGTH_SHORT).show()
            }
        } else {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE),
                101
            )
        }
    }

    private fun requestIgnoreBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                intent.data = Uri.parse("package:$packageName")
                startActivity(intent)
            } else {
                Toast.makeText(this, "Battery Optimization Already Disabled", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
