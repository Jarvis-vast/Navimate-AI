# ProGuard rules for NaviMate Android
-keep class com.google.android.libraries.navigation.** { *; }
-keep class com.google.android.libraries.mapsplatform.turnbyturn.** { *; }
-keep class androidx.car.app.** { *; }
-keep class com.navimate.ai.model.** { *; }
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
