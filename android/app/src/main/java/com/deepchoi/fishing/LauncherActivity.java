package com.deepchoi.fishing;

import android.view.WindowManager;
import androidx.browser.trusted.TrustedWebActivityDisplayMode;

/**
 * 전체 화면(immersive)으로 열되, 카메라 구멍(노치) 영역까지 화면을 확장한다.
 * 라이브러리 기본 LauncherActivity는 노치 설정을 기본값(0)으로 고정해서, 가로 화면에서는
 * 노치 쪽에 시스템 배경(하얀 띠)이 남는다. 웹 쪽은 viewport-fit=cover + safe-area로 HUD를 비켜 둔다.
 */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    @Override
    protected TrustedWebActivityDisplayMode getDisplayMode() {
        return new TrustedWebActivityDisplayMode.ImmersiveMode(false, WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES);
    }
}
