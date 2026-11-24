package com.cloup.app; // <-- change to your appId

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register BEFORE super.onCreate
        registerPlugin(AppScannerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
