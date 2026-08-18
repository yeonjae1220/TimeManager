package com.mungji.timemanager;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 타이머 실행중 표시 — 지속 알림 + Chronometer.
 *
 * <p>Foreground Service 를 쓰지 않는다(TM-ADR-011). {@code setUsesChronometer(true)} 는
 * <b>알림의 기능</b>이라 서비스와 무관하고, 게시된 알림은 앱 프로세스가 죽어도 재부팅
 * 전까지 살아서 계속 흐른다. 이 앱은 경과시간이 델타 재계산이라 백그라운드에서 셀 것도
 * 0이므로, FGS 가 제공하는 "프로세스를 살려둔다"에 얻을 것이 없다. FGS 를 빼면 Play 콘솔
 * {@code specialUse} 정당화 서류와 Android 14+ 백그라운드 시작 제한이 둘 다 사라진다.
 *
 * <p>이 클래스는 <b>표시만 하는 멍청한 렌더러</b>다. 문구·시각 계산은 전부 웹(TS)에서 끝내
 * 넘긴다 — 원격 로드 하이브리드라 웹은 매일 배포되지만 이 바이너리는 몇 주에 한 번 나가서,
 * 여기에 문구를 박으면 앱 업데이트 없이는 못 고친다.
 */
@CapacitorPlugin(name = "TimerNotification")
public class TimerNotificationPlugin extends Plugin {

    /**
     * 리마인더 알림(LocalNotifications: 90001·90003·90006·90012)과 겹치지 않는 고정 id.
     * 동시에 실행되는 세션은 최대 1개(로컬 타이머 슬롯이 단일)라 고정값으로 충분하다.
     */
    private static final int NOTIFICATION_ID = 90100;

    /**
     * 리마인더와 <b>다른 채널</b>을 쓴다. 같은 채널에 두면 사용자가 "3시간 되었습니다"를
     * 끄려고 채널을 끌 때 실행중 표시까지 함께 죽는다.
     */
    private static final String CHANNEL_ID = "timer-ongoing";

    @PluginMethod
    public void show(PluginCall call) {
        String title = call.getString("title");
        String text = call.getString("text");
        Long whenMs = readWhenMs(call);

        // whenMs 가 없으면 Chronometer 가 1970년부터 세서 말이 안 되는 숫자가 뜬다.
        // 조용히 0 으로 폴백하지 않고 거절한다 — 잘못된 표시가 표시 없음보다 나쁘다.
        if (whenMs == null) {
            call.reject("whenMs must be a number");
            return;
        }

        Context context = getContext();
        ensureChannel(context);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_timer)
                .setContentTitle(title == null ? "" : title)
                .setContentText(text == null ? "" : text)
                // 이 셋이 "OS 가 스스로 세는 시계"의 전부다. 앱이 갱신을 보내지 않아도 흐른다.
                .setWhen(whenMs)
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setOngoing(true)
                // 갱신(같은 id 재게시) 때마다 소리·진동이 나지 않도록. 채널이 LOW 라
                // 이미 조용하지만, 채널 설정은 사용자가 바꿀 수 있으므로 여기서도 막는다.
                .setSilent(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(launchIntent(context));

        boolean shown = postSilentlyIfAllowed(context, builder);

        // 게시 여부를 반드시 돌려준다. 권한이 없으면 시스템이 조용히 버리는데 호출은
        // 성공하므로, 이 값이 없으면 웹은 "떴다"고 믿고 재수렴을 멈춘다 — 나중에 권한을
        // 허용한 사용자가 다음 상태 변화 전까지 알림을 못 보는 창이 생긴다.
        JSObject result = new JSObject();
        result.put("shown", shown);
        call.resolve(result);
    }

    /**
     * {@code PluginCall.getLong} 은 값이 {@code instanceof Long} 일 때만 돌려주고
     * <b>변환하지 않는다</b>. 브리지의 org.json 파서는 int 범위를 넘는 정수만 Long 으로
     * 만들고 나머지는 Integer·Double 이라, getLong 에 기대면 값의 크기와 소수점 유무에
     * 따라 조용히 null 이 된다. Number 로 받아 직접 좁힌다.
     */
    private Long readWhenMs(PluginCall call) {
        Object raw = call.getData().opt("whenMs");
        return raw instanceof Number ? ((Number) raw).longValue() : null;
    }

    /**
     * 사용자에게 실제로 보일 때만 게시하고, 보일지를 돌려준다.
     *
     * <p>앱 전체 알림이 꺼져 있거나 이 채널만 꺼져 있으면 게시해도 시스템이 버린다.
     * 둘을 모두 확인해야 "안 보인다"를 정확히 보고할 수 있다.
     */
    private boolean postSilentlyIfAllowed(Context context, NotificationCompat.Builder builder) {
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        if (!manager.areNotificationsEnabled()) return false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = manager.getNotificationChannel(CHANNEL_ID);
            if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE) {
                return false;
            }
        }

        try {
            manager.notify(NOTIFICATION_ID, builder.build());
            return true;
        } catch (SecurityException e) {
            // 커스텀 사운드 URI 등 우리가 권한을 못 가진 리소스를 참조할 때 나는 예외다.
            // 알림 권한 미허용은 예외가 아니라 조용한 폐기라서 위 areNotificationsEnabled
            // 검사가 담당한다. 여기서 죽으면 타이머 조작까지 깨지므로 잡아서 보고만 한다.
            return false;
        }
    }

    @PluginMethod
    public void hide(PluginCall call) {
        // 떠 있지 않아도 안전하다. 멱등이라 정지 경로가 몇 번 불려도 문제없다.
        NotificationManagerCompat.from(getContext()).cancel(NOTIFICATION_ID);
        call.resolve();
    }

    /** 채널은 만들어져 있으면 재생성해도 무해하다(기존 설정 유지). */
    private void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.timer_ongoing_channel_name),
                // LOW: 상태표시줄에 조용히 머문다. DEFAULT 이상이면 시작할 때마다 소리가 난다.
                NotificationManager.IMPORTANCE_LOW);
        channel.setDescription(context.getString(R.string.timer_ongoing_channel_description));
        channel.setShowBadge(false);
        channel.enableVibration(false);
        channel.setSound(null, null);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    /**
     * 알림을 탭하면 앱으로 돌아온다. MainActivity 가 {@code launchMode="singleTask"} 라
     * 새 인스턴스가 뜨지 않고 기존 화면이 앞으로 나온다.
     *
     * <p>API 31+ 는 PendingIntent 에 mutability 를 명시하지 않으면 예외를 던진다.
     */
    private PendingIntent launchIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        return PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
