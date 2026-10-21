package com.smarttv.launcher.data.api

import com.smarttv.launcher.data.model.*
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import java.util.concurrent.TimeUnit

interface TVApiService {

    @POST("/api/tvs/pair-request")
    suspend fun requestPairing(@Body body: PairRequest): PairResponse

    @POST("/api/tvs/ping")
    suspend fun ping(@Body body: PingRequest): Map<String, Any>

    @GET("/api/tvs/config/{device_id}")
    suspend fun getTVConfig(@Path("device_id") deviceId: String): TVConfigResponse

    @GET("/api/tvs")
    suspend fun listTVs(): List<TVListItem>

    @POST("/api/tvs/bind-device")
    suspend fun bindDevice(@Body body: BindDeviceRequest): BindDeviceResponse

    companion object {
        // IP padrão do servidor na rede local (configurável pelo app)
        private const val DEFAULT_BASE_URL = "http://192.168.168.27/"

        fun create(baseUrl: String = DEFAULT_BASE_URL): TVApiService {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }

            val client = OkHttpClient.Builder()
                .addInterceptor(logging)
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .build()

            return Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(TVApiService::class.java)
        }
    }
}
