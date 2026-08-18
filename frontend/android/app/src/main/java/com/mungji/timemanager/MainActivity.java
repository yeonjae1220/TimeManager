package com.mungji.timemanager;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ⚠️ registerPlugin 은 super.onCreate 보다 **먼저** 호출해야 한다. 브리지는
        //    super.onCreate 안에서 만들어지고, 그 시점에 등록돼 있지 않은 플러그인은
        //    웹에서 "not implemented" 로 떨어진다.
        registerPlugin(TimerNotificationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
