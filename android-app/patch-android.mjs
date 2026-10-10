// Ajusta o projeto Android gerado pelo Capacitor: câmera, sensores, tela cheia na horizontal e tela sempre acesa.
import fs from 'fs';

const manifest = 'android/app/src/main/AndroidManifest.xml';
let m = fs.readFileSync(manifest, 'utf8');
const perms = [
  '<uses-permission android:name="android.permission.CAMERA" />',
  '<uses-permission android:name="android.permission.WAKE_LOCK" />',
  '<uses-feature android:name="android.hardware.camera" android:required="false" />',
  '<uses-feature android:name="android.hardware.sensor.gyroscope" android:required="false" />',
];
for (const p of perms) if (!m.includes(p)) m = m.replace('</manifest>', `    ${p}\n</manifest>`);
// óculos VR: sempre na horizontal (gira sozinho entre os dois lados)
m = m.replace(/<activity(\s)/, '<activity android:screenOrientation="sensorLandscape"$1');
fs.writeFileSync(manifest, m);

// tela cheia, sem barra de status
const styles = 'android/app/src/main/res/values/styles.xml';
let s = fs.readFileSync(styles, 'utf8');
s = s.replace(/(<style name="AppTheme\.NoActionBar"[^>]*>)/, '$1\n        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>');
fs.writeFileSync(styles, s);

// tela sempre acesa e modo imersivo (esconde a barra de navegação)
const javaDir = 'android/app/src/main/java/com/bluenav/play';
const main = `${javaDir}/MainActivity.java`;
fs.writeFileSync(main, `package com.bluenav.play;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    // vídeos do YouTube podem começar sem toque na tela (o "clique" é feito pela mão/olhar no VR)
    getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) {
      getWindow().getDecorView().setSystemUiVisibility(
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }
  }
}
`);
console.log('Projeto Android ajustado.');
