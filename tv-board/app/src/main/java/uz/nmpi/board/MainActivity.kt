package uz.nmpi.board

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Context
import android.os.Bundle
import android.text.InputType
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity

/**
 * NMPI Tablo — Android TV kiosk.
 *
 * A full-screen WebView that loads the queue board (/tablo). Why an app instead
 * of the TV's built-in browser: Smart-TV browsers have a flaky Web Audio stack,
 * so the synthesised chime plays but the decoded mp3 voice clips stay silent.
 * Android's WebView (Chromium) decodes them fine, AND we can switch off the
 * autoplay gesture requirement so the voice plays with no remote interaction:
 *
 *     settings.mediaPlaybackRequiresUserGesture = false
 *
 * The board URL defaults to the on-site box; press MENU (or 0) on the remote to
 * change it if the box IP differs.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private val prefs by lazy { getSharedPreferences("tablo", Context.MODE_PRIVATE) }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        web = WebView(this)
        setContentView(web)

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true            // board uses localStorage (mute, hall)
            mediaPlaybackRequiresUserGesture = false  // ← autoplay chime + voice
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
        }
        web.webChromeClient = WebChromeClient()
        web.webViewClient = object : WebViewClient() {
            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError,
            ) {
                // At boot the box may not be up yet — keep retrying the main page.
                if (request.isForMainFrame) {
                    view.postDelayed({ view.reload() }, 5000)
                }
            }
        }

        hideSystemUi()
        loadBoard()
    }

    private fun loadBoard() {
        val url = prefs.getString("url", DEFAULT_URL).orEmpty()
        if (url.isBlank()) promptUrl() else web.loadUrl(url)
    }

    /** Editable board URL — persisted, so the IP survives reboots. */
    private fun promptUrl() {
        val input = EditText(this).apply {
            inputType = InputType.TYPE_TEXT_VARIATION_URI
            setText(prefs.getString("url", DEFAULT_URL))
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.set_url_title)
            .setView(input)
            .setPositiveButton("OK") { _, _ ->
                val u = input.text.toString().trim()
                prefs.edit().putString("url", u).apply()
                web.loadUrl(u)
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        // MENU or "0" on the remote → change the board URL.
        if (keyCode == KeyEvent.KEYCODE_MENU || keyCode == KeyEvent.KEYCODE_0) {
            promptUrl()
            return true
        }
        if (keyCode == KeyEvent.KEYCODE_BACK && web.canGoBack()) {
            web.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    @Suppress("DEPRECATION")
    private fun hideSystemUi() {
        web.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onPause() {
        web.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }

    companion object {
        // On-site box (BOX_HOST in deploy/.env.local). Change on the TV via MENU/0.
        private const val DEFAULT_URL = "http://192.168.0.127/tablo"
    }
}
