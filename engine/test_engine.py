#!/usr/bin/env python3
import subprocess
import json

def run_command(cmd_data):
    proc = subprocess.Popen(
        ['./meterea_engine'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    stdout, stderr = proc.communicate(input=json.dumps(cmd_data) + '\n')
    if stderr:
        print(f"STDERR: {stderr}")
    return json.loads(stdout.strip())

print("🧪 Тест 1: init команда")
result = run_command({"command": "init"})
assert result["status"] == "ok", f"Ожидался 'ok', получено: {result}"
print(f"   ✅ init: {result['message']}")

print("\n🧪 Тест 2: buildWorld команда")
result = run_command({"command": "buildWorld", "player_id": 1})
assert result["status"] == "ok", f"Ожидался 'ok', получено: {result}"
assert "world" in result, "Отсутствует поле 'world'"
world = result["world"]
assert world["tick"] == 0, f"Ожидался tick=0, получено: {world['tick']}"
assert len(world["regions"]) > 0, "Нет регионов в мире"
print(f"   ✅ buildWorld: tick={world['tick']}, регионов={len(world['regions'])}")

print("\n🧪 Тест 3: simulateTicks команда (передача состояния)")
world_json = json.dumps(world)
result = run_command({
    "command": "simulateTicks",
    "world": world,
    "ticks": 5
})
assert result["status"] == "ok", f"Ожидался 'ok', получено: {result}"
assert result["tick"] == 5, f"Ожидался tick=5, получено: {result['tick']}"
assert "world" in result, "Отсутствует поле 'world' в ответе"
new_world = result["world"]
assert new_world["tick"] == 5, f"Мир не обновился: tick={new_world['tick']}"
print(f"   ✅ simulateTicks: tick={result['tick']}, news_count={result['news_count']}")

print("\n🧪 Тест 4: непрерывная симуляция (сохранение состояния)")
# Передаём мир из предыдущего шага дальше
result2 = run_command({
    "command": "simulateTicks",
    "world": new_world,
    "ticks": 10
})
assert result2["tick"] == 15, f"Ожидался tick=15, получено: {result2['tick']}"
print(f"   ✅ Непрерывная симуляция: tick={result2['tick']}")

print("\n🧪 Тест 5: проверка структуры мира")
w = result2["world"]
assert "era" in w, "Отсутствует era"
assert "regions" in w, "Отсутствуют regions"
assert "factions" in w, "Отсутствуют factions"
assert "npcs" in w, "Отсутствуют npcs"
assert "news" in w, "Отсутствуют news"
region = w["regions"][0]
assert "id" in region, "У региона нет id"
assert "name" in region, "У региона нет name"
assert "facilities" in region, "У региона нет facilities"
print(f"   ✅ Структура мира корректна")

print("\n" + "="*50)
print("✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ!")
print("="*50)
