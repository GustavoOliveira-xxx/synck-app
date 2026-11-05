#!/usr/bin/env bash
set -euo pipefail
pkg=com.gustavooliveira.agendacompartilhada
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell pm grant "$pkg" android.permission.POST_NOTIFICATIONS
adb shell appops set "$pkg" SCHEDULE_EXACT_ALARM allow
adb shell locksettings set-pin 2468
adb shell settings put secure lock_screen_lock_after_timeout 0
adb shell am start -W -n "$pkg/.MainActivity"
for n in {1..25}; do
  adb shell uiautomator dump /sdcard/probe.xml >/dev/null 2>&1 || true
  if adb shell cat /sdcard/probe.xml | grep -q 'Alarme preparado'; then break; fi
  sleep 1
done
adb shell cat /sdcard/probe.xml | grep 'Alarme preparado' >/dev/null
adb shell input keyevent KEYCODE_HOME
adb shell input keyevent KEYCODE_SLEEP
sleep 3
adb shell am kill "$pkg"
sleep 2
if adb shell pidof "$pkg" >/dev/null; then
  adb root
  adb wait-for-device
  adb shell "kill -9 $(pidof $pkg)"
fi
if adb shell pidof "$pkg" >/dev/null; then echo 'Processo ainda ativo'; exit 1; fi
adb shell dumpsys power | grep -E 'mWakefulness=(Asleep|Dozing)' >/dev/null
adb shell dumpsys window policy | grep -Ei 'showing=true|mShowingLockscreen=true' >/dev/null
echo 'Alarme agendado; processo encerrado e tela bloqueada.'
for n in {1..70}; do
  adb shell dumpsys notification --noredact > /tmp/synck-probe-notifications.txt
  if grep -E 'android.title=.*SynCKLockProbe' /tmp/synck-probe-notifications.txt; then
    echo 'O Android publicou a notificação após o encerramento do processo.'; exit 0
  fi
  sleep 2
done
echo 'O Android não publicou o alerta dentro da janela do teste.'
exit 1
