package com.vaultbridge.emergency.modules

import android.os.Environment
import android.os.StatFs
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class FileManager {

    private val rootPath = Environment.getExternalStorageDirectory().absolutePath

    fun listDirectory(requestedPath: String): JSONObject {
        val targetPath = if (requestedPath.isBlank() || requestedPath == "/storage/emulated/0") {
            rootPath
        } else {
            requestedPath
        }

        val dir = File(targetPath)
        val res = JSONObject()

        if (!dir.exists() || !dir.isDirectory) {
            res.put("status", "error")
            res.put("message", "Directory not found: $targetPath")
            return res
        }

        val itemsArray = JSONArray()
        val files = dir.listFiles() ?: arrayOf()
        val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)

        // Sort folders first, then alphabetical
        val sortedList = files.sortedWith(compareBy({ !it.isDirectory }, { it.name.lowercase() }))

        for (file in sortedList) {
            val itemObj = JSONObject().apply {
                put("name", file.name)
                put("path", file.absolutePath)
                put("isDirectory", file.isDirectory)
                put("size", if (file.isDirectory) 0 else file.length())
                put("modified", dateFormat.format(Date(file.lastModified())))
                put("extension", if (file.isDirectory) "" else file.extension.lowercase())
            }
            itemsArray.put(itemObj)
        }

        res.put("status", "ok")
        res.put("currentPath", targetPath)
        res.put("items", itemsArray)
        return res
    }

    fun searchFiles(query: String, extensionFilter: String): JSONArray {
        val results = JSONArray()
        val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        val startDir = File(rootPath)

        val cleanExt = if (extensionFilter.isNotBlank()) {
            if (extensionFilter.startsWith(".")) extensionFilter.substring(1).lowercase()
            else extensionFilter.lowercase()
        } else ""

        fun walk(dir: File) {
            val list = dir.listFiles() ?: return
            for (f in list) {
                if (f.isDirectory) {
                    // Skip hidden directories to save time
                    if (!f.name.startsWith(".")) {
                        walk(f)
                    }
                } else {
                    var match = true
                    if (query.isNotBlank() && !f.name.contains(query, ignoreCase = true)) {
                        match = false
                    }
                    if (cleanExt.isNotBlank() && !f.extension.equals(cleanExt, ignoreCase = true)) {
                        match = false
                    }

                    if (match) {
                        val obj = JSONObject().apply {
                            put("name", f.name)
                            put("path", f.absolutePath)
                            put("size", f.length())
                            put("modified", dateFormat.format(Date(f.lastModified())))
                            put("extension", f.extension.lowercase())
                        }
                        results.put(obj)
                        if (results.length() >= 150) return // Cap to avoid huge payloads
                    }
                }
            }
        }

        walk(startDir)
        return results
    }

    fun streamFile(
        filePath: String,
        chunkSize: Int = 64 * 1024,
        onStart: (fileName: String, fileSize: Long, totalChunks: Int, sha256: String) -> Unit,
        onChunk: (chunkIndex: Int, totalChunks: Int, base64: String) -> Unit,
        onComplete: (fileName: String, fileSize: Long, sha256: String) -> Unit,
        onError: (errorMsg: String) -> Unit
    ) {
        val file = File(filePath)
        if (!file.exists() || !file.isFile) {
            onError("File does not exist or is not readable: $filePath")
            return
        }

        try {
            val totalBytes = file.length()
            val totalChunks = Math.max(1, Math.ceil(totalBytes.toDouble() / chunkSize).toInt())

            // Compute SHA-256 for integrity verification
            val digest = MessageDigest.getInstance("SHA-256")
            val buffer = ByteArray(chunkSize)
            
            // First pass for hash
            FileInputStream(file).use { fis ->
                var read: Int
                while (fis.read(buffer).also { read = it } != -1) {
                    digest.update(buffer, 0, read)
                }
            }
            val hashStr = digest.digest().joinToString("") { "%02x".format(it) }

            // Notify start
            onStart(file.name, totalBytes, totalChunks, hashStr)

            // Second pass for streaming chunks
            FileInputStream(file).use { fis ->
                var chunkIndex = 0
                var bytesRead: Int
                while (fis.read(buffer).also { bytesRead = it } != -1) {
                    val chunkBase64 = Base64.encodeToString(buffer, 0, bytesRead, Base64.NO_WRAP)
                    onChunk(chunkIndex, totalChunks, chunkBase64)
                    chunkIndex++
                }
            }

            // Notify complete
            onComplete(file.name, totalBytes, hashStr)
        } catch (e: Exception) {
            onError(e.message ?: "Streaming error")
        }
    }

    fun getStorageStats(): JSONObject {
        val stat = StatFs(Environment.getExternalStorageDirectory().path)
        val bytesAvailable = stat.blockSizeLong * stat.availableBlocksLong
        val totalBytes = stat.blockSizeLong * stat.blockCountLong

        val totalGb = totalBytes.toDouble() / (1024 * 1024 * 1024)
        val freeGb = bytesAvailable.toDouble() / (1024 * 1024 * 1024)
        val usedGb = totalGb - freeGb
        val pct = (usedGb / totalGb) * 100

        return JSONObject().apply {
            put("totalSpaceGb", Math.round(totalGb * 10.0) / 10.0)
            put("freeSpaceGb", Math.round(freeGb * 10.0) / 10.0)
            put("usedPercentage", Math.round(pct * 10.0) / 10.0)
        }
    }
}
