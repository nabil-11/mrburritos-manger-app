package com.mr_burritos.manager;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createOrdersNotificationChannel();
    }

    private void createOrdersNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;

            // Only create if it doesn't already exist
            if (nm.getNotificationChannel("orders") != null) return;

            NotificationChannel channel = new NotificationChannel(
                "orders",
                "Nouvelles commandes",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Alarme pour chaque nouvelle commande reçue");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 400, 200, 400, 200, 400});
            channel.setShowBadge(true);

            // Use alarm sound so the notification rings loud even in DND
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

            channel.setSound(alarmUri, audioAttributes);
            nm.createNotificationChannel(channel);
        }
    }
}
