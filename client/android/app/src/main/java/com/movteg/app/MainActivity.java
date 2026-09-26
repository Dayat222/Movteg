package com.movteg.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSIONS_REQUEST_CODE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Request Android OS runtime permissions (Audio & Camera) if not yet granted
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                new String[]{
                    Manifest.permission.RECORD_AUDIO,
                    Manifest.permission.MODIFY_AUDIO_SETTINGS,
                    Manifest.permission.CAMERA
                },
                PERMISSIONS_REQUEST_CODE
            );
        }

        // 2. Configure WebView to allow WebRTC audio autoplay and video playback
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setAllowUniversalAccessFromFileURLs(true);
            settings.setAllowFileAccessFromFileURLs(true);
        }

        // 3. Handle cold start deep link intent
        handleDeepLinkIntent(getIntent());
    }

    @Override
    public void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLinkIntent(intent);
    }

    private void handleDeepLinkIntent(android.content.Intent intent) {
        if (intent == null || intent.getData() == null) return;
        android.net.Uri data = intent.getData();
        String scheme = data.getScheme();
        String targetUrl = null;

        if ("movteg".equalsIgnoreCase(scheme)) {
            String query = data.getQuery();
            targetUrl = "https://movteg.vercel.app/" + (query != null && !query.isEmpty() ? "?" + query : "");
        } else if (data.toString().startsWith("https://movteg.vercel.app") || data.toString().startsWith("http://movteg.vercel.app")) {
            targetUrl = data.toString();
        }

        if (targetUrl != null) {
            final String finalUrl = targetUrl;
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.post(() -> webView.loadUrl(finalUrl));
            }
        }
    }
}
