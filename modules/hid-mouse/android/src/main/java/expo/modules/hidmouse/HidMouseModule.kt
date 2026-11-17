package expo.modules.hidmouse

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.Intent
import android.os.Bundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Exposes HidMouse (phone-as-Bluetooth-mouse) to JavaScript. */
@SuppressLint("MissingPermission") // JS requests Bluetooth permissions before calling start()
class HidMouseModule : Module() {

  private var mouse: HidMouse? = null

  private val listener = object : HidMouse.Listener {
    override fun onStatus(text: String) {
      sendEvent("onStatus", Bundle().apply { putString("text", text) })
    }

    override fun onHostChanged(host: BluetoothDevice?) {
      sendEvent("onHostChanged", Bundle().apply {
        putBoolean("connected", host != null)
        putString("name", host?.let { it.name ?: it.address })
        putString("address", host?.address)
      })
    }
  }

  override fun definition() = ModuleDefinition {
    Name("HidMouse")

    Events("onStatus", "onHostChanged")

    Function("start") {
      if (mouse == null) {
        val context = appContext.reactContext ?: throw IllegalStateException("No Android context")
        mouse = HidMouse(context.applicationContext, listener).also { it.start() }
      }
    }

    Function("stop") {
      mouse?.stop()
      mouse = null
    }

    Function("isConnected") { mouse?.isConnected ?: false }

    Function("pairedDevices") {
      (mouse?.pairedDevices() ?: emptyList()).map {
        mapOf("name" to (it.name ?: it.address), "address" to it.address)
      }
    }

    Function("connect") { address: String ->
      val m = mouse ?: return@Function
      m.pairedDevices().firstOrNull { it.address == address }?.let { m.connect(it) }
    }

    Function("disconnect") { mouse?.disconnect() }

    Function("makeDiscoverable") { seconds: Int ->
      val activity = appContext.currentActivity ?: return@Function
      activity.startActivity(
        Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE)
          .putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, seconds)
      )
    }

    // Mouse actions — called on every touch move, kept synchronous and tiny.
    Function("move") { dx: Double, dy: Double -> mouse?.move(dx.toFloat(), dy.toFloat()) }
    Function("scroll") { steps: Int -> mouse?.scroll(steps) }
    Function("press") { button: Int -> mouse?.press(button) }
    Function("release") { button: Int -> mouse?.release(button) }
    Function("click") { button: Int -> mouse?.click(button) }

    OnDestroy {
      mouse?.stop()
      mouse = null
    }
  }
}
