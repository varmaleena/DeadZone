package com.deadzone.freshcart

import android.app.Application
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory

/** Initialises Firebase and App Check once for the whole app. */
class DeadzoneApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
        if (BuildConfig.DEBUG) {
            // Debug builds print a token to Logcat; register it in Firebase console → App Check.
            // Release builds must install Play Integrity before shipping.
            FirebaseAppCheck.getInstance().installAppCheckProviderFactory(DebugAppCheckProviderFactory.getInstance())
        }
    }
}
