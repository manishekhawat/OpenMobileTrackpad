package expo.modules.hidmouse

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothHidDevice
import android.bluetooth.BluetoothHidDeviceAppSdpSettings
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import java.util.concurrent.Executors

/**
 * Makes the phone act as a standard Bluetooth HID mouse.
 * The laptop needs no extra software — it sees a normal mouse.
 */
@SuppressLint("MissingPermission") // permissions are requested in MainActivity before start()
class HidMouse(private val context: Context, private val listener: Listener) {

    interface Listener {
        fun onStatus(text: String)
        fun onHostChanged(host: BluetoothDevice?)
    }

    companion object {
        const val BUTTON_LEFT = 1
        const val BUTTON_RIGHT = 2
        const val BUTTON_MIDDLE = 4
        private const val REPORT_ID = 1

        /** HID report descriptor: 3-button mouse with relative X, Y and wheel. */
        private val DESCRIPTOR = byteArrayOf(
            0x05, 0x01,             // Usage Page (Generic Desktop)
            0x09, 0x02,             // Usage (Mouse)
            0xA1.toByte(), 0x01,    // Collection (Application)
            0x85.toByte(), 0x01,    //   Report ID (1)
            0x09, 0x01,             //   Usage (Pointer)
            0xA1.toByte(), 0x00,    //   Collection (Physical)
            0x05, 0x09,             //     Usage Page (Buttons)
            0x19, 0x01,             //     Usage Minimum (1)
            0x29, 0x03,             //     Usage Maximum (3)
            0x15, 0x00,             //     Logical Minimum (0)
            0x25, 0x01,             //     Logical Maximum (1)
            0x95.toByte(), 0x03,    //     Report Count (3)
            0x75, 0x01,             //     Report Size (1)
            0x81.toByte(), 0x02,    //     Input (Data, Var, Abs) — 3 button bits
            0x95.toByte(), 0x01,    //     Report Count (1)
            0x75, 0x05,             //     Report Size (5)
            0x81.toByte(), 0x03,    //     Input (Const) — 5 padding bits
            0x05, 0x01,             //     Usage Page (Generic Desktop)
            0x09, 0x30,             //     Usage (X)
            0x09, 0x31,             //     Usage (Y)
            0x09, 0x38,             //     Usage (Wheel)
            0x15, 0x81.toByte(),    //     Logical Minimum (-127)
            0x25, 0x7F,             //     Logical Maximum (127)
            0x75, 0x08,             //     Report Size (8)
            0x95.toByte(), 0x03,    //     Report Count (3)
            0x81.toByte(), 0x06,    //     Input (Data, Var, Rel)
            0xC0.toByte(),          //   End Collection
            0xC0.toByte()           // End Collection
        )
    }

    private val adapter: BluetoothAdapter? =
        context.getSystemService(BluetoothManager::class.java)?.adapter
    private val executor = Executors.newSingleThreadExecutor()

    private var hid: BluetoothHidDevice? = null
    @Volatile private var host: BluetoothDevice? = null
    private var buttons = 0
    private var remX = 0f
    private var remY = 0f

    val isConnected: Boolean get() = host != null

    fun start() {
        val a = adapter ?: return listener.onStatus("This phone has no Bluetooth.")
        if (!a.isEnabled) return listener.onStatus("Turn on Bluetooth, then reopen the app.")
        val ok = a.getProfileProxy(context, serviceListener, BluetoothProfile.HID_DEVICE)
        if (!ok) listener.onStatus("This phone doesn't support Bluetooth mouse mode.")
    }

    fun stop() {
        hid?.let { h ->
            host?.let { h.disconnect(it) }
            h.unregisterApp()
            adapter?.closeProfileProxy(BluetoothProfile.HID_DEVICE, h)
        }
        hid = null
        host = null
        executor.shutdown()
    }

    fun pairedDevices(): List<BluetoothDevice> =
        adapter?.bondedDevices?.toList() ?: emptyList()

    fun connect(device: BluetoothDevice) {
        if (hid?.connect(device) != true) listener.onStatus("Couldn't start connecting. Try pairing again.")
    }

    fun disconnect() {
        host?.let { hid?.disconnect(it) }
    }

    // ---- Mouse actions -------------------------------------------------

    /** Move the cursor. Fractions are carried over so slow moves aren't lost. */
    fun move(dx: Float, dy: Float) {
        remX += dx
        remY += dy
        var ix = remX.toInt()
        var iy = remY.toInt()
        remX -= ix
        remY -= iy
        // One report can only move ±127, so split big jumps.
        while (ix != 0 || iy != 0) {
            val sx = ix.coerceIn(-127, 127)
            val sy = iy.coerceIn(-127, 127)
            send(sx, sy, 0)
            ix -= sx
            iy -= sy
        }
    }

    /** Positive = scroll up, negative = scroll down. */
    fun scroll(steps: Int) {
        if (steps != 0) send(0, 0, steps.coerceIn(-127, 127))
    }

    fun press(button: Int) {
        buttons = buttons or button
        send(0, 0, 0)
    }

    fun release(button: Int) {
        buttons = buttons and button.inv()
        send(0, 0, 0)
    }

    fun click(button: Int) {
        press(button)
        release(button)
    }

    private fun send(x: Int, y: Int, wheel: Int) {
        val h = host ?: return
        hid?.sendReport(
            h, REPORT_ID,
            byteArrayOf(buttons.toByte(), x.toByte(), y.toByte(), wheel.toByte())
        )
    }

    // ---- Bluetooth callbacks ------------------------------------------

    private val serviceListener = object : BluetoothProfile.ServiceListener {
        override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
            if (profile != BluetoothProfile.HID_DEVICE) return
            hid = proxy as BluetoothHidDevice
            val sdp = BluetoothHidDeviceAppSdpSettings(
                "OpenMobileTrackpad",
                "Phone used as a Bluetooth mouse",
                "OpenMobileTrackpad",
                BluetoothHidDevice.SUBCLASS1_MOUSE,
                DESCRIPTOR
            )
            val ok = hid?.registerApp(sdp, null, null, executor, hidCallback) ?: false
            if (!ok) listener.onStatus("Couldn't register as a mouse. This phone may not support it.")
        }

        override fun onServiceDisconnected(profile: Int) {
            hid = null
            host = null
            listener.onHostChanged(null)
            listener.onStatus("Bluetooth mouse service stopped.")
        }
    }

    private val hidCallback = object : BluetoothHidDevice.Callback() {
        override fun onAppStatusChanged(pluggedDevice: BluetoothDevice?, registered: Boolean) {
            if (registered) {
                listener.onStatus("Ready. Pair from your laptop, or tap Connect.")
                // Reconnect automatically to the last laptop, if Android remembers one.
                pluggedDevice?.let { hid?.connect(it) }
            } else {
                listener.onStatus("Mouse mode is off.")
            }
        }

        override fun onConnectionStateChanged(device: BluetoothDevice, state: Int) {
            when (state) {
                BluetoothProfile.STATE_CONNECTING ->
                    listener.onStatus("Connecting to ${device.name ?: device.address}…")
                BluetoothProfile.STATE_CONNECTED -> {
                    host = device
                    listener.onHostChanged(device)
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    if (host == device) host = null
                    buttons = 0
                    listener.onHostChanged(null)
                }
            }
        }

        override fun onGetReport(device: BluetoothDevice, type: Byte, id: Byte, bufferSize: Int) {
            // Some hosts ask for the current state once after connecting.
            hid?.replyReport(device, type, REPORT_ID.toByte(), byteArrayOf(0, 0, 0, 0))
        }
    }
}
