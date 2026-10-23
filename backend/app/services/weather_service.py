import asyncio
import json
import logging
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger("WeatherService")

PRESET_CITIES: Dict[str, Dict[str, Any]] = {
    "salvador": {"name": "Salvador", "state": "BA", "lat": -12.9777, "lon": -38.5016, "tz": "America/Bahia"},
    "trancoso": {"name": "Trancoso", "state": "BA", "lat": -16.5911, "lon": -39.0984, "tz": "America/Bahia"},
    "porto seguro": {"name": "Porto Seguro", "state": "BA", "lat": -16.4498, "lon": -39.0647, "tz": "America/Bahia"},
    "ilhéus": {"name": "Ilhéus", "state": "BA", "lat": -14.7889, "lon": -39.0494, "tz": "America/Bahia"},
    "ilheus": {"name": "Ilhéus", "state": "BA", "lat": -14.7889, "lon": -39.0494, "tz": "America/Bahia"},
    "praia do forte": {"name": "Praia do Forte", "state": "BA", "lat": -12.5762, "lon": -38.0069, "tz": "America/Bahia"},
    "itacaré": {"name": "Itacaré", "state": "BA", "lat": -14.2778, "lon": -38.9961, "tz": "America/Bahia"},
    "itacare": {"name": "Itacaré", "state": "BA", "lat": -14.2778, "lon": -38.9961, "tz": "America/Bahia"},
    "morro de são paulo": {"name": "Morro de São Paulo", "state": "BA", "lat": -13.3802, "lon": -38.9157, "tz": "America/Bahia"},
    "morro de sao paulo": {"name": "Morro de São Paulo", "state": "BA", "lat": -13.3802, "lon": -38.9157, "tz": "America/Bahia"},
    "são paulo": {"name": "São Paulo", "state": "SP", "lat": -23.5505, "lon": -46.6333, "tz": "America/Sao_Paulo"},
    "sao paulo": {"name": "São Paulo", "state": "SP", "lat": -23.5505, "lon": -46.6333, "tz": "America/Sao_Paulo"},
    "rio de janeiro": {"name": "Rio de Janeiro", "state": "RJ", "lat": -22.9068, "lon": -43.1729, "tz": "America/Sao_Paulo"},
    "angra dos reis": {"name": "Angra dos Reis", "state": "RJ", "lat": -23.0067, "lon": -44.3181, "tz": "America/Sao_Paulo"},
    "belo horizonte": {"name": "Belo Horizonte", "state": "MG", "lat": -19.9167, "lon": -43.9345, "tz": "America/Sao_Paulo"},
    "brasília": {"name": "Brasília", "state": "DF", "lat": -15.7975, "lon": -47.8919, "tz": "America/Sao_Paulo"},
    "brasilia": {"name": "Brasília", "state": "DF", "lat": -15.7975, "lon": -47.8919, "tz": "America/Sao_Paulo"},
    "curitiba": {"name": "Curitiba", "state": "PR", "lat": -25.4284, "lon": -49.2733, "tz": "America/Sao_Paulo"},
    "florianópolis": {"name": "Florianópolis", "state": "SC", "lat": -27.5954, "lon": -48.5480, "tz": "America/Sao_Paulo"},
    "florianopolis": {"name": "Florianópolis", "state": "SC", "lat": -27.5954, "lon": -48.5480, "tz": "America/Sao_Paulo"},
    "fortaleza": {"name": "Fortaleza", "state": "CE", "lat": -3.7172, "lon": -38.5433, "tz": "America/Fortaleza"},
    "recife": {"name": "Recife", "state": "PE", "lat": -8.0476, "lon": -34.8770, "tz": "America/Recife"},
    "natal": {"name": "Natal", "state": "RN", "lat": -5.7945, "lon": -35.2110, "tz": "America/Fortaleza"},
    "gramado": {"name": "Gramado", "state": "RS", "lat": -29.3788, "lon": -50.8739, "tz": "America/Sao_Paulo"}
}

class WeatherService:
    """
    Serviço de Previsão do Tempo em Tempo Real por Município via Open-Meteo API.
    Oferece suporte nativo para os principais destinos de hotelaria (Salvador, Trancoso, etc.)
    e geocodificação dinâmica para qualquer município brasileiro.
    Cache em memória de 15 minutos para cada cidade.
    """
    def __init__(self):
        self._cache: Dict[str, Tuple[datetime, Dict[str, Any]]] = {}
        self._cache_ttl_seconds: int = 900  # 15 minutos
        self._geo_cache: Dict[str, Tuple[float, float, str]] = {}

    def _map_wmo_code_to_condition(self, code: int, is_day: int) -> Tuple[str, str]:
        """
        Retorna (id_condição, rótulo_legível).
        id_condição: 'sunny', 'partly_cloudy', 'cloudy', 'rain', 'clear_night'
        """
        if code == 0:
            if is_day == 1:
                return "sunny", "Ensolarado"
            return "clear_night", "Noite Limpa"
        elif code in (1, 2):
            if is_day == 1:
                return "partly_cloudy", "Parcialmente Nublado"
            return "clear_night", "Céu Limpo"
        elif code in (3, 45, 48):
            return "cloudy", "Nublado"
        elif code in (51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99):
            return "rain", "Chuvoso"
        else:
            if is_day == 1:
                return "sunny", "Ensolarado"
            return "clear_night", "Céu Limpo"

    def _resolve_coordinates(self, city_name: str) -> Tuple[float, float, str, str]:
        """
        Retorna (lat, lon, tz, displayName).
        """
        clean = (city_name or "").strip().lower()
        if clean in PRESET_CITIES:
            p = PRESET_CITIES[clean]
            return p["lat"], p["lon"], p["tz"], p["name"]

        if clean in self._geo_cache:
            lat, lon, disp = self._geo_cache[clean]
            return lat, lon, "America/Sao_Paulo", disp

        # Tentar geocoding na API Open-Meteo
        try:
            encoded = urllib.parse.quote(city_name.strip())
            url = f"https://geocoding-api.open-meteo.com/v1/search?name={encoded}&count=1&language=pt&format=json"
            req = urllib.request.Request(url, headers={"User-Agent": "SmartTV-Hotel-Manager/1.0"})
            with urllib.request.urlopen(req, timeout=3.5) as resp:
                geo_data = json.loads(resp.read().decode("utf-8"))
                results = geo_data.get("results")
                if results and len(results) > 0:
                    r0 = results[0]
                    lat = float(r0["latitude"])
                    lon = float(r0["longitude"])
                    disp = r0.get("name", city_name)
                    self._geo_cache[clean] = (lat, lon, disp)
                    return lat, lon, r0.get("timezone", "America/Sao_Paulo"), disp
        except Exception as e:
            logger.warning(f"Falha ao geocodificar '{city_name}': {e}")

        # Fallback padrão: Salvador-BA
        return -12.9777, -38.5016, "America/Bahia", city_name or "Salvador"

    def _sync_fetch_weather(self, lat: float, lon: float, tz: str) -> Dict[str, Any]:
        tz_enc = urllib.parse.quote(tz)
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,relative_humidity_2m,weather_code,is_day"
            f"&timezone={tz_enc}"
        )
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "SmartTV-Hotel-Manager/1.0", "Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=4.0) as resp:
            return json.loads(resp.read().decode("utf-8"))

    async def get_city_weather(self, city_name: str = "Salvador", force_refresh: bool = False) -> Dict[str, Any]:
        """
        Retorna previsão do tempo em tempo real para qualquer município.
        """
        clean_key = (city_name or "salvador").strip().lower()
        now = datetime.utcnow()

        if not force_refresh and clean_key in self._cache:
            ts, cached = self._cache[clean_key]
            if (now - ts).total_seconds() < self._cache_ttl_seconds:
                return cached

        lat, lon, tz, display_name = self._resolve_coordinates(city_name)

        try:
            data = await asyncio.to_thread(self._sync_fetch_weather, lat, lon, tz)
            current = data.get("current", {})
            temp_raw = current.get("temperature_2m", 28.0)
            temp_int = round(temp_raw)
            w_code = current.get("weather_code", 0)
            is_day = current.get("is_day", 1)
            humidity = current.get("relative_humidity_2m", 65)

            condition, cond_label = self._map_wmo_code_to_condition(w_code, is_day)

            weather_result = {
                "city": display_name,
                "temperature": f"{temp_int}°C",
                "temp_value": temp_int,
                "condition": condition,
                "condition_label": cond_label,
                "humidity": humidity,
                "weather_code": w_code,
                "is_day": bool(is_day),
                "latitude": lat,
                "longitude": lon,
                "updated_at": now.isoformat(),
                "source": f"Open-Meteo Realtime API ({display_name})"
            }

            self._cache[clean_key] = (now, weather_result)
            logger.info(f"Clima atualizado para {display_name}: {temp_int}°C ({condition})")
            return weather_result

        except Exception as e:
            logger.warning(f"Erro ao buscar previsão do tempo para '{city_name}': {e}")

        # Se falhou mas temos cache antigo para a cidade
        if clean_key in self._cache:
            return self._cache[clean_key][1]

        # Fallback seguro
        return {
            "city": display_name or city_name or "Salvador",
            "temperature": "28°C",
            "temp_value": 28,
            "condition": "sunny",
            "condition_label": "Ensolarado",
            "humidity": 65,
            "weather_code": 0,
            "is_day": True,
            "latitude": lat,
            "longitude": lon,
            "updated_at": now.isoformat(),
            "source": f"Fallback ({display_name})"
        }

    async def get_salvador_weather(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Atalho de compatibilidade para Salvador-BA"""
        return await self.get_city_weather("Salvador", force_refresh)

weather_service = WeatherService()
