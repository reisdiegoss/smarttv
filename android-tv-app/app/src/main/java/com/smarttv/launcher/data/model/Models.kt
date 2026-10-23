package com.smarttv.launcher.data.model

import com.google.gson.annotations.SerializedName

data class TVConfigResponse(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("name") val name: String,
    @SerializedName("room_group") val roomGroup: String,
    @SerializedName("is_paired") val isPaired: Boolean,
    @SerializedName("layout") val layout: LayoutData?,
    @SerializedName("hdmi") val hdmi: HdmiConfig,
    @SerializedName("shortcuts") val shortcuts: List<ShortcutItem>,
    @SerializedName("playlist") val playlist: PlaylistData?,
    @SerializedName("custom_settings") val customSettings: Map<String, Any>?
)

data class HdmiConfig(
    @SerializedName("enabled") val enabled: Boolean = true,
    @SerializedName("input_id") val inputId: String,
    @SerializedName("label") val label: String,
    @SerializedName("action") val action: String
)

data class ShortcutItem(
    @SerializedName("id") val id: Int,
    @SerializedName("name") val name: String,
    @SerializedName("package_name") val packageName: String,
    @SerializedName("icon_name") val iconName: String,
    @SerializedName("is_hdmi") val isHdmi: Boolean,
    @SerializedName("is_system_app") val isSystemApp: Boolean
)

data class PlaylistData(
    @SerializedName("id") val id: Int,
    @SerializedName("name") val name: String,
    @SerializedName("loop_playback") val loopPlayback: Boolean,
    @SerializedName("items") val items: List<PlaylistItemData>
)

data class PlaylistItemData(
    @SerializedName("media_id") val mediaId: Int,
    @SerializedName("title") val title: String,
    @SerializedName("stream_url") val streamUrl: String,
    @SerializedName("file_size") val fileSize: Long,
    @SerializedName("duration") val duration: Double,
    @SerializedName("order_index") val orderIndex: Int
)

data class LayoutData(
    @SerializedName("id") val id: Int,
    @SerializedName("name") val name: String,
    @SerializedName("code") val code: String,
    @SerializedName("config") val config: Map<String, Any>?
)

data class PairRequest(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("pairing_code") val pairingCode: String,
    @SerializedName("ip_address") val ipAddress: String?,
    @SerializedName("app_version") val appVersion: String = "1.0.0"
)

data class PairResponse(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("pairing_code") val pairingCode: String,
    @SerializedName("is_paired") val isPaired: Boolean,
    @SerializedName("name") val name: String
)

data class PingRequest(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("ip_address") val ipAddress: String?,
    @SerializedName("app_version") val appVersion: String = "1.0.0",
    @SerializedName("cleanup_completed") val cleanupCompleted: Boolean? = null
)

data class TVListItem(
    @SerializedName("id") val id: Int,
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("name") val name: String,
    @SerializedName("room_group") val roomGroup: String? = null,
    @SerializedName("is_paired") val isPaired: Boolean? = true
)

data class BindDeviceRequest(
    @SerializedName("tv_id") val tvId: Int,
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("ip_address") val ipAddress: String?,
    @SerializedName("app_version") val appVersion: String = "1.0.1"
)

data class BindDeviceResponse(
    @SerializedName("status") val status: String,
    @SerializedName("message") val message: String,
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("tv_id") val tvId: Int
)

data class QuickUpdateRequest(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("hdmi_input_id") val hdmiInputId: String? = null,
    @SerializedName("hdmi_label") val hdmiLabel: String? = null,
    @SerializedName("selected_shortcuts") val selectedShortcuts: List<Int>? = null
)
