package expo.modules.chrpwidget

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Same JS API as the iOS module (ios/ChrpWidgetModule.swift); see src/widget.ts.
class ChrpWidgetModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  override fun definition() = ModuleDefinition {
    Name("ChrpWidget")

    Function("getDeviceKey") {
      WidgetStore.deviceKey(context)
    }

    Function("setConfig") { json: String ->
      WidgetStore.setConfig(context, json)
      ChrpWidgetProvider.refreshAll(context)
    }

    Function("clear") {
      WidgetStore.clear(context)
      ChrpWidgetProvider.refreshAll(context)
    }

    Function("reload") {
      ChrpWidgetProvider.refreshAll(context)
    }
  }
}
