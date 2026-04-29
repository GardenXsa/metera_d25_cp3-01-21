import os
import time
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

# --- Конфигурация ---
ALLOWED_ORIGINS = [
    'https://gardenxas.itch.io',
    'https://html-classic.itch.zone',
    'http://127.0.0.1:8080',
    'http://localhost:8080'
]
GEMINI_REQUEST_DELAY = 11.0

# --- Инициализация Flask ---
app = Flask(__name__)
CORS(app, origins=ALLOWED_ORIGINS, methods=['POST', 'OPTIONS'], allow_headers=['Content-Type', 'Authorization'])

# --- Механизм очереди ---
api_lock = threading.Lock()
last_gemini_request_time = 0

def transform_to_openai_format(client_data):
    """Преобразует запрос из формата Gemini в формат OpenAI."""
    messages = []
    for message in client_data.get("contents", []):
        role = "assistant" if message.get("role") == "model" else "user"
        text = message.get("parts", [{}])[0].get("text", "")
        messages.append({"role": role, "content": text})
    return messages

def transform_to_gemini_format(openai_response_json):
    """Преобразует ответ из формата OpenAI в формат Gemini."""
    generated_text = openai_response_json.get("choices", [{}])[0].get("message", {}).get("content", "")
    return {
        "candidates": [{
            "content": {"role": "model", "parts": [{"text": generated_text}]},
            "finishReason": openai_response_json.get("choices", [{}])[0].get("finish_reason", "STOP")
        }]
    }

def handle_openai_compatible(client_data, user_api_key, provider_name, base_url, env_key, extra_headers={}):
    """Универсальный обработчик для OpenAI-совместимых API (OpenRouter, LLMost)."""
    # --- ИСПРАВЛЕНИЕ: Приоритет ключа от клиента ---
    api_key = user_api_key if user_api_key else os.getenv(env_key)
    if not api_key:
        raise ValueError(f"{provider_name} API key is missing. Not found in client request or on server (env var: {env_key}).")

    api_url = f"{base_url}/chat/completions"
    
    openai_messages = transform_to_openai_format(client_data)
    
    payload = {
        "model": client_data.get('modelName', 'default-model'),
        "messages": openai_messages,
        "temperature": client_data.get("generationConfig", {}).get("temperature", 0.7),
        "max_tokens": client_data.get("generationConfig", {}).get("maxOutputTokens", 4096),
        "response_format": {"type": "json_object"}
    }

    if client_data.get("provider", {}).get("prompt_caching"): 
        payload["provider"] = {"prompt_caching": True}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        **extra_headers
    }

    print(f"[Proxy] Forwarding to {provider_name} model: {payload['model']}")
    response = requests.post(api_url, json=payload, headers=headers, timeout=60)
    response.raise_for_status()
    
    return transform_to_gemini_format(response.json())

def handle_gemini_request(client_data, user_api_key):
    """Обработчик для Google Gemini API."""
    global last_gemini_request_time
    
    elapsed_time = time.monotonic() - last_gemini_request_time
    if elapsed_time < GEMINI_REQUEST_DELAY:
        sleep_time = GEMINI_REQUEST_DELAY - elapsed_time
        print(f"[Proxy] Gemini Rate limit: waiting for {sleep_time:.2f} seconds...")
        time.sleep(sleep_time)

    # --- ИСПРАВЛЕНИЕ: Приоритет ключа от клиента ---
    api_key = user_api_key if user_api_key else os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise ValueError("Gemini API key is missing. Not found in client request or on server.")

    model_name = client_data.pop('modelName', 'gemini-1.5-flash-latest')
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

    # Принудительно требуем JSON от Gemini
    if "generationConfig" not in client_data:
        client_data["generationConfig"] = {}
    client_data["generationConfig"]["responseMimeType"] = "application/json"

    print(f"[Proxy] Forwarding to Gemini model: {model_name}")
    response = requests.post(api_url, json=client_data, timeout=45)
    response.raise_for_status()
    
    last_gemini_request_time = time.monotonic()
    return response.json()

@app.route('/api/proxy', methods=['POST'])
def proxy_handler():
    with api_lock:
        try:
            client_data = request.get_json()
            if not client_data:
                return jsonify({"error": {"message": "Invalid JSON body"}}), 400

            # --- ИСПРАВЛЕНИЕ: Надежное извлечение provider ---
            provider = client_data.pop('provider', 'gemini').lower()
            user_api_key = request.headers.get('Authorization', '').replace('Bearer ', '')
            
            print(f"[Proxy] Received request for provider: '{provider}'")

            if provider == 'llmost':
                response_data = handle_openai_compatible(
                    client_data, user_api_key, 
                    provider_name="LLMost", 
                    base_url="https://llmost.ru/api/v1", 
                    env_key='LLMOST_API_KEY'
                )
                return jsonify(response_data)

            elif provider == 'openrouter':
                response_data = handle_openai_compatible(
                    client_data, user_api_key,
                    provider_name="OpenRouter",
                    base_url="https://openrouter.ai/api/v1",
                    env_key='OPENROUTER_API_KEY',
                    extra_headers={
                        "HTTP-Referer": "https://github.com/MrKins/Chronicles-of-Meterea",
                        "X-Title": "Chronicles of Meterea"
                    }
                )
                return jsonify(response_data)

            elif provider == 'deepseek':
                response_data = handle_openai_compatible(
                    client_data, user_api_key, 
                    provider_name="DeepSeek", 
                    base_url="https://api.deepseek.com", 
                    env_key='DEEPSEEK_API_KEY'
                )
                return jsonify(response_data)

            elif provider == 'gemini':
                response_data = handle_gemini_request(client_data, user_api_key)
                return jsonify(response_data)

            else:
                return jsonify({"error": {"message": f"Unsupported provider: {provider}"}}), 400

        except requests.exceptions.HTTPError as e:
            print(f"[Proxy Error] HTTP Error: {e.response.status_code} - {e.response.text}")
            try:
                return jsonify(e.response.json()), e.response.status_code
            except requests.exceptions.JSONDecodeError:
                return jsonify({"error": {"message": e.response.text}}), e.response.status_code
        except Exception as e:
            print(f"[Proxy Error] General Error: {str(e)}")
            return jsonify({"error": {"message": f"Proxy internal error: {str(e)}"}}), 500

if __name__ == '__main__':
    if not os.getenv('GEMINI_API_KEY'):
        print("ПРЕДУПРЕЖДЕНИЕ: Переменная окружения GEMINI_API_KEY не установлена.")
    if not os.getenv('OPENROUTER_API_KEY'):
        print("ПРЕДУПРЕЖДЕНИЕ: Переменная окружения OPENROUTER_API_KEY не установлена.")
    if not os.getenv('LLMOST_API_KEY'):
        print("ПРЕДУПРЕЖДЕНИЕ: Переменная окружения LLMOST_API_KEY не установлена.")
    if not os.getenv('DEEPSEEK_API_KEY'):
        print("ПРЕДУПРЕЖДЕНИЕ: Переменная окружения DEEPSEEK_API_KEY не установлена.")
    app.run(host='0.0.0.0', port=3000, debug=True)