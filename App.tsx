import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import HidMouse, { Button, PairedDevice } from './modules/hid-mouse';
import Touchpad from './src/Touchpad';

const BT_PERMISSIONS = [
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
];

async function requestBluetoothPermissions(): Promise<boolean> {
  // Android 11 and below grant Bluetooth at install time.
  if (Platform.OS !== 'android' || (Platform.Version as number) < 31) return true;
  const result = await PermissionsAndroid.requestMultiple(BT_PERMISSIONS);
  return BT_PERMISSIONS.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
}

export default function App() {
  const [status, setStatus] = useState('Starting…');
  const [host, setHost] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState(2);
  const [devices, setDevices] = useState<PairedDevice[] | null>(null);

  useEffect(() => {
    const subs = [
      HidMouse.addListener('onStatus', (e) => setStatus(e.text)),
      HidMouse.addListener('onHostChanged', (e) => {
        setHost(e.connected ? e.name : null);
        setStatus(
          e.connected ? `Connected to ${e.name}` : 'Not connected. Tap Connect to pick your laptop.'
        );
      }),
    ];

    requestBluetoothPermissions().then((ok) => {
      if (ok) HidMouse.start();
      else setStatus('Bluetooth permission is needed to act as a mouse.');
    });

    return () => {
      subs.forEach((s) => s.remove());
      HidMouse.stop();
    };
  }, []);

  const makeVisible = async () => {
    if (!(await requestBluetoothPermissions())) return;
    HidMouse.makeDiscoverable(120);
    setStatus('Visible for 2 minutes. On your laptop: Bluetooth → Add device → pick this phone.');
  };

  const onConnectPress = () => {
    if (host) return HidMouse.disconnect();
    const list = HidMouse.pairedDevices();
    if (list.length === 0) {
      setStatus('No paired devices yet. Tap "Make visible" and pair from your laptop first.');
      return;
    }
    setDevices(list);
  };

  const changeSpeed = (delta: number) =>
    setSensitivity((s) => Math.min(6, Math.max(0.5, Math.round((s + delta) * 10) / 10)));

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <Text style={styles.status}>{status}</Text>

      <View style={styles.row}>
        <Btn label="Make visible" onPress={makeVisible} />
        <Btn label={host ? 'Disconnect' : 'Connect'} onPress={onConnectPress} />
      </View>

      <View style={[styles.row, styles.speedRow]}>
        <Text style={styles.label}>Speed {sensitivity.toFixed(1)}×</Text>
        <Btn label="−" onPress={() => changeSpeed(-0.5)} small />
        <Btn label="+" onPress={() => changeSpeed(0.5)} small />
      </View>

      <Touchpad sensitivity={sensitivity} />

      {/* Hold-to-press buttons, so you can click-and-drag. */}
      <View style={[styles.row, styles.mouseButtons]}>
        <HoldButton label="Left" button={Button.Left} />
        <HoldButton label="Right" button={Button.Right} />
      </View>

      <Modal
        visible={devices !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDevices(null)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Connect to</Text>
            {devices?.map((d) => (
              <Pressable
                key={d.address}
                style={styles.deviceItem}
                onPress={() => {
                  HidMouse.connect(d.address);
                  setDevices(null);
                }}>
                <Text style={styles.deviceName}>{d.name}</Text>
              </Pressable>
            ))}
            <Btn label="Cancel" onPress={() => setDevices(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Btn({ label, onPress, small }: { label: string; onPress: () => void; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, small && styles.btnSmall, pressed && styles.btnPressed]}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

function HoldButton({ label, button }: { label: string; button: number }) {
  return (
    <Pressable
      onPressIn={() => HidMouse.press(button)}
      onPressOut={() => HidMouse.release(button)}
      style={({ pressed }) => [styles.btn, styles.holdBtn, pressed && styles.btnPressed]}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#18181C',
    padding: 16,
    paddingTop: (RNStatusBar.currentHeight ?? 24) + 12,
  },
  status: { color: '#E6E6EA', fontSize: 15, minHeight: 42 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  speedRow: { alignItems: 'center' },
  label: { color: '#A0A0A8', flex: 1 },
  btn: {
    flex: 1,
    backgroundColor: '#33333B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { flex: 0, width: 56 },
  btnPressed: { backgroundColor: '#4A4A55' },
  btnText: { color: '#F0F0F4', fontSize: 16 },
  mouseButtons: { marginTop: 12, height: 72 },
  holdBtn: { paddingVertical: 0 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: { backgroundColor: '#24242A', borderRadius: 16, padding: 16, gap: 4 },
  sheetTitle: { color: '#F0F0F4', fontSize: 18, marginBottom: 8 },
  deviceItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#33333B' },
  deviceName: { color: '#E6E6EA', fontSize: 16 },
});
