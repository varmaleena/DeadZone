package com.deadzone.freshcart

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.Bundle
import android.text.InputType
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import com.deadzone.field.DeadzoneField
import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.InferenceMode
import com.google.firebase.ai.type.OnDeviceConfig
import com.google.firebase.ai.type.PublicPreviewAPI
import com.google.firebase.ai.type.content
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Demo screen: pairs with a workspace and arms the Deadzone Field SDK. Also offers a
 * self-test that runs one on-device verdict on a synthetic screenshot.
 * Firebase and App Check are initialised once in [DeadzoneApp].
 */
@OptIn(PublicPreviewAPI::class)
class MainActivity : Activity() {
    private var field: DeadzoneField? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 64, 32, 32)
        }
        val status = TextView(this).apply {
            text = "Deadzone field demo\nPair with the workspace ID and code from the console, then turn on airplane mode."
        }
        val workspace = EditText(this).apply { hint = "Workspace ID" }
        val code = EditText(this).apply {
            hint = "8-character pairing code"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
        }
        val pair = Button(this).apply { text = "Pair and arm field capture" }
        val selfTest = Button(this).apply { text = "Self-test: judge a sample screen on device" }
        listOf(status, workspace, code, pair, selfTest).forEach(layout::addView)
        setContentView(layout)

        pair.setOnClickListener {
            scope.launch {
                pair.isEnabled = false
                try {
                    val id = workspace.text.toString().trim()
                    DeadzoneField.pair(id, code.text.toString())
                    code.text.clear()
                    field?.stop()
                    field = DeadzoneField(applicationContext, id) { message -> status.text = message }.also {
                        it.bind(this@MainActivity, "home")
                        it.start()
                    }
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: Exception) {
                    status.text = "Pairing failed: ${error.message}"
                } finally {
                    pair.isEnabled = true
                }
            }
        }

        selfTest.setOnClickListener {
            selfTest.isEnabled = false
            scope.launch {
                try {
                    val model = Firebase.ai(backend = GenerativeBackend.googleAI()).generativeModel(
                        modelName = DeadzoneField.CLOUD_MODEL,
                        onDeviceConfig = OnDeviceConfig(mode = InferenceMode.ONLY_ON_DEVICE),
                    )
                    val bitmap = Bitmap.createBitmap(640, 360, Bitmap.Config.ARGB_8888)
                    Canvas(bitmap).apply {
                        drawColor(Color.WHITE)
                        drawText("FreshCart: TypeError: Failed to fetch", 20f, 180f, Paint().apply {
                            color = Color.BLACK
                            textSize = 26f
                        })
                    }
                    status.text = "Judging on device…"
                    val response = model.generateContent(
                        content { image(bitmap); text(DeadzoneField.verdictPrompt("self-test", "TypeError: Failed to fetch")) },
                    )
                    val verdict = DeadzoneField.parseVerdict(response.text ?: error("Empty model response"))
                    status.text = "ON DEVICE\n$verdict"
                    bitmap.recycle()
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: Exception) {
                    status.text = "PENDING (on-device model unavailable)\n${error.message}"
                } finally {
                    selfTest.isEnabled = true
                }
            }
        }
    }

    override fun onDestroy() {
        field?.stop()
        scope.cancel()
        super.onDestroy()
    }
}
