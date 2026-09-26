package com.atlas.financialos;

import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;

import javax.net.ssl.HttpsURLConnection;

public class HybridActivity extends MainActivity {
    private static final int VOICE_REQUEST = 1103;
    private WebView atlasWebView;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        try {
            Field field = MainActivity.class.getDeclaredField("webView");
            field.setAccessible(true);
            atlasWebView = (WebView) field.get(this);
            if (atlasWebView != null) {
                atlasWebView.addJavascriptInterface(new HybridNativeBridge(), "AtlasNative");
            }
        } catch (Exception ex) {
            Toast.makeText(this, "Atlas native bridge unavailable: " + ex.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void callHybridJs(String js) {
        if (atlasWebView == null) return;
        runOnUiThread(() -> atlasWebView.evaluateJavascript(js, null));
    }

    private class HybridNativeBridge {
        @JavascriptInterface
        public void startVoice() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault());
                    intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak to Atlas");
                    startActivityForResult(intent, VOICE_REQUEST);
                } catch (Exception ex) {
                    callHybridJs("window.onNativeVoice && window.onNativeVoice(false," + JSONObject.quote("Voice recognition is not available on this device.") + ");");
                }
            });
        }

        @JavascriptInterface
        public void cloudAsk(String endpoint, String payloadJson) {
            new Thread(() -> {
                HttpsURLConnection connection = null;
                try {
                    if (endpoint == null || !endpoint.toLowerCase(Locale.ROOT).startsWith("https://")) {
                        throw new IllegalArgumentException("Atlas Cloud requires an HTTPS endpoint.");
                    }
                    URL url = new URL(endpoint);
                    connection = (HttpsURLConnection) url.openConnection();
                    connection.setRequestMethod("POST");
                    connection.setConnectTimeout(12000);
                    connection.setReadTimeout(30000);
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    connection.setRequestProperty("Accept", "application/json, text/plain");
                    connection.setRequestProperty("X-Atlas-Client", "android-test-v0.5");
                    byte[] body = String.valueOf(payloadJson == null ? "{}" : payloadJson).getBytes(StandardCharsets.UTF_8);
                    connection.setFixedLengthStreamingMode(body.length);
                    try (OutputStream out = connection.getOutputStream()) {
                        out.write(body);
                        out.flush();
                    }
                    int code = connection.getResponseCode();
                    InputStream stream = code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream();
                    String response = readAll(stream);
                    if (code < 200 || code >= 300) throw new IllegalStateException("HTTP " + code + (response.isEmpty() ? "" : ": " + response));
                    callHybridJs("window.onNativeCloudAnswer && window.onNativeCloudAnswer(true," + JSONObject.quote(response) + ");");
                } catch (Exception ex) {
                    callHybridJs("window.onNativeCloudAnswer && window.onNativeCloudAnswer(false," + JSONObject.quote(ex.getMessage()) + ");");
                } finally {
                    if (connection != null) connection.disconnect();
                }
            }).start();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == VOICE_REQUEST) {
            if (resultCode == RESULT_OK && data != null) {
                ArrayList<String> results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                String heard = results != null && !results.isEmpty() ? results.get(0) : "";
                callHybridJs("window.onNativeVoice && window.onNativeVoice(true," + JSONObject.quote(heard) + ");");
            } else {
                callHybridJs("window.onNativeVoice && window.onNativeVoice(false," + JSONObject.quote("Voice input was cancelled.") + ");");
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    private String readAll(InputStream stream) throws Exception {
        if (stream == null) return "";
        StringBuilder out = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (out.length() > 0) out.append('\n');
                out.append(line);
                if (out.length() > 200000) break;
            }
        }
        return out.toString();
    }
}
