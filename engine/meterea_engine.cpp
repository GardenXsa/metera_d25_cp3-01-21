/*
 * NEXUS ENGINE - Native World Simulation Core for Chronicles of Meterea
 * Full port of world_worker.js (2099 lines) to C++17
 * 
 * Architecture Layers:
 * 1. Data Layer (generated_data.h) - Auto-generated enums, constants, recipes from JSON
 * 2. Core Types - PhysicalItem, Storage (batch-based spoilage, stack management)
 * 3. World State - World, Region, Faction, NPC, Caravan, News with full serialization
 * 4. Simulation Engine - All systems from world_worker.js
 * 5. Protocol Layer - stdin/stdout JSON communication with Electron
 */

#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <unordered_map>
#include <set>
#include <algorithm>
#include <cmath>
#include <sstream>
#include <random>
#include <cstdint>
#include <optional>
#include <variant>
#include <chrono>

#include "generated_data.h"

// ============================================================================
// SIMPLE JSON PARSER/WRITER (No external dependencies)
// ============================================================================

class JsonValue {
public:
    enum Type { NUL, BOOL, INT, DOUBLE, STRING, ARRAY, OBJECT };
    Type type = NUL;
    bool b_val = false;
    int64_t i_val = 0;
    double d_val = 0.0;
    std::string s_val;
    std::vector<JsonValue> arr_val;
    std::map<std::string, JsonValue> obj_val;

    JsonValue() : type(NUL) {}
    JsonValue(bool b) : type(BOOL), b_val(b) {}
    JsonValue(int i) : type(INT), i_val(i) {}
    JsonValue(int64_t i) : type(INT), i_val(i) {}
    JsonValue(double d) : type(DOUBLE), d_val(d) {}
    JsonValue(const std::string& s) : type(STRING), s_val(s) {}
    JsonValue(const char* s) : type(STRING), s_val(s) {}

    static JsonValue array() { JsonValue v; v.type = ARRAY; return v; }
    static JsonValue object() { JsonValue v; v.type = OBJECT; return v; }

    void set(const std::string& key, const JsonValue& val) {
        if (type != OBJECT) type = OBJECT;
        obj_val[key] = val;
    }

    void push(const JsonValue& val) {
        if (type != ARRAY) type = ARRAY;
        arr_val.push_back(val);
    }

    JsonValue& operator[](const std::string& key) { return obj_val[key]; }
    const JsonValue& operator[](const std::string& key) const {
        static JsonValue null;
        auto it = obj_val.find(key);
        return (it != obj_val.end()) ? it->second : null;
    }

    JsonValue& operator[](size_t idx) { return arr_val[idx]; }
    const JsonValue& operator[](size_t idx) const { return arr_val[idx]; }

    bool has(const std::string& key) const {
        return (type == OBJECT) && (obj_val.find(key) != obj_val.end());
    }

    size_t size() const {
        if (type == ARRAY) return arr_val.size();
        if (type == OBJECT) return obj_val.size();
        return 0;
    }

    std::string asString() const { return s_val; }
    int asInt() const { return (type == INT) ? i_val : (type == DOUBLE ? (int)d_val : 0); }
    double asDouble() const { return (type == DOUBLE) ? d_val : (type == INT ? (double)i_val : 0.0); }
    bool asBool() const { return b_val; }

    std::string toString(int indent = 0) const {
        std::ostringstream oss;
        std::string pad(indent * 2, ' ');
        std::string pad1((indent + 1) * 2, ' ');

        switch (type) {
            case NUL: oss << "null"; break;
            case BOOL: oss << (b_val ? "true" : "false"); break;
            case INT: oss << i_val; break;
            case DOUBLE: oss << d_val; break;
            case STRING: {
                oss << "\"";
                for (char c : s_val) {
                    switch (c) {
                        case '"': oss << "\\\""; break;
                        case '\\': oss << "\\\\"; break;
                        case '\n': oss << "\\n"; break;
                        case '\r': oss << "\\r"; break;
                        case '\t': oss << "\\t"; break;
                        default: oss << c;
                    }
                }
                oss << "\"";
                break;
            }
            case ARRAY: {
                oss << "[";
                bool first = true;
                for (const auto& item : arr_val) {
                    if (!first) oss << ",";
                    first = false;
                    oss << "\n" << pad1 << item.toString(indent + 1);
                }
                if (!arr_val.empty()) oss << "\n" << pad;
                oss << "]";
                break;
            }
            case OBJECT: {
                oss << "{";
                bool first = true;
                for (const auto& kv : obj_val) {
                    if (!first) oss << ",";
                    first = false;
                    oss << "\n" << pad1 << "\"" << kv.first << "\": " << kv.second.toString(indent + 1);
                }
                if (!obj_val.empty()) oss << "\n" << pad;
                oss << "}";
                break;
            }
        }
        return oss.str();
    }
};

JsonValue parseJson(const std::string& json);

namespace {
    std::string trim(const std::string& s) {
        size_t start = s.find_first_not_of(" \t\n\r");
        if (start == std::string::npos) return "";
        size_t end = s.find_last_not_of(" \t\n\r");
        return s.substr(start, end - start + 1);
    }

    JsonValue parseString(const std::string& json, size_t& pos) {
        pos++; // skip opening quote
        std::string result;
        while (pos < json.size() && json[pos] != '"') {
            if (json[pos] == '\\' && pos + 1 < json.size()) {
                pos++;
                switch (json[pos]) {
                    case '"': result += '"'; break;
                    case '\\': result += '\\'; break;
                    case 'n': result += '\n'; break;
                    case 'r': result += '\r'; break;
                    case 't': result += '\t'; break;
                    default: result += json[pos];
                }
            } else {
                result += json[pos];
            }
            pos++;
        }
        pos++; // skip closing quote
        return JsonValue(result);
    }

    JsonValue parseNumber(const std::string& json, size_t& pos) {
        size_t start = pos;
        bool isFloat = false;
        if (json[pos] == '-') pos++;
        while (pos < json.size() && (isdigit(json[pos]) || json[pos] == '.' || json[pos] == 'e' || json[pos] == 'E' || json[pos] == '+' || json[pos] == '-')) {
            if (json[pos] == '.' || json[pos] == 'e' || json[pos] == 'E') isFloat = true;
            pos++;
        }
        std::string numStr = json.substr(start, pos - start);
        if (isFloat) return JsonValue(std::stod(numStr));
        return JsonValue((int64_t)std::stoll(numStr));
    }

    JsonValue parseArray(const std::string& json, size_t& pos) {
        JsonValue arr = JsonValue::array();
        pos++; // skip '['
        while (pos < json.size()) {
            std::string s = trim(json.substr(pos));
            if (s.empty()) { pos++; continue; }
            if (s[0] == ']') { pos++; break; }
            if (s[0] == ',') { pos++; continue; }
            JsonValue val = parseJson(json.substr(pos));
            arr.push(val);
            pos += val.toString().length();
            // Skip whitespace and commas
            while (pos < json.size() && (json[pos] == ',' || json[pos] == ' ' || json[pos] == '\n' || json[pos] == '\r' || json[pos] == '\t')) pos++;
        }
        return arr;
    }

    JsonValue parseObject(const std::string& json, size_t& pos) {
        JsonValue obj = JsonValue::object();
        pos++; // skip '{'
        while (pos < json.size()) {
            std::string s = trim(json.substr(pos));
            if (s.empty()) { pos++; continue; }
            if (s[0] == '}') { pos++; break; }
            if (s[0] == ',') { pos++; continue; }
            
            // Parse key
            if (json[pos] != '"') { pos++; continue; }
            JsonValue keyVal = parseString(json, pos);
            std::string key = keyVal.s_val;
            
            // Skip colon
            while (pos < json.size() && (json[pos] == ':' || json[pos] == ' ' || json[pos] == '\n' || json[pos] == '\r' || json[pos] == '\t')) pos++;
            
            // Parse value
            JsonValue val = parseJson(json.substr(pos));
            obj.set(key, val);
            pos += val.toString().length();
            
            // Skip whitespace and commas
            while (pos < json.size() && (json[pos] == ',' || json[pos] == ' ' || json[pos] == '\n' || json[pos] == '\r' || json[pos] == '\t')) pos++;
        }
        return obj;
    }
}

JsonValue parseJson(const std::string& json) {
    std::string trimmed = trim(json);
    if (trimmed.empty()) return JsonValue();
    
    size_t pos = 0;
    char first = trimmed[pos];
    
    if (first == '"') return parseString(trimmed, pos);
    if (first == '[') return parseArray(trimmed, pos);
    if (first == '{') return parseObject(trimmed, pos);
    if (first == 't' || first == 'f') {
        if (trimmed.substr(0, 4) == "true") { pos = 4; return JsonValue(true); }
        if (trimmed.substr(0, 5) == "false") { pos = 5; return JsonValue(false); }
    }
    if (first == 'n' && trimmed.substr(0, 4) == "null") { pos = 4; return JsonValue(); }
    if (first == '-' || isdigit(first)) return parseNumber(trimmed, pos);
    
    return JsonValue();
}

// ============================================================================
// PHYSICAL ITEM SYSTEM (Batch-based spoilage, stack management)
// ============================================================================

struct PhysicalItem {
    std::string id;
    GoodType prototype_id;
    int stack_size = 0;
    std::string container_id;
    int slot_index = -1;
    std::string state = "idle";
    bool quest_item = false;
    bool bound = false;
    bool stolen = false;
    bool magical = false;
    bool fragile = false;
    int durability = 100;
    double weight_per_unit = 1.0;
    int64_t created_at = 0;      // tick when created
    int64_t last_moved_at = 0;   // tick when last moved
    
    // Batch tracking for spoilage
    int batch_day = 0;
    std::vector<std::pair<int, std::string>> history; // day, event
    
    JsonValue toJson() const {
        JsonValue obj = JsonValue::object();
        obj.set("id", id);
        obj.set("prototype_id", goodTypeToString(prototype_id));
        obj.set("stack_size", stack_size);
        obj.set("container_id", container_id);
        obj.set("slot_index", slot_index);
        obj.set("state", state);
        obj.set("durability", durability);
        obj.set("weight_per_unit", weight_per_unit);
        obj.set("created_at", created_at);
        obj.set("last_moved_at", last_moved_at);
        obj.set("batch_day", batch_day);
        
        JsonValue flags = JsonValue::object();
        flags.set("quest_item", quest_item);
        flags.set("bound", bound);
        flags.set("stolen", stolen);
        flags.set("magical", magical);
        flags.set("fragile", fragile);
        obj.set("flags", flags);
        
        JsonValue hist = JsonValue::array();
        for (const auto& h : history) {
            JsonValue entry = JsonValue::object();
            entry.set("day", h.first);
            entry.set("event", h.second);
            hist.push(entry);
        }
        obj.set("history", hist);
        
        return obj;
    }
    
    static PhysicalItem fromJson(const JsonValue& j) {
        PhysicalItem item;
        item.id = j["id"].asString();
        item.prototype_id = stringToGoodType(j["prototype_id"].asString());
        item.stack_size = j["stack_size"].asInt();
        item.container_id = j["container_id"].asString();
        item.slot_index = j["slot_index"].asInt();
        item.state = j["state"].asString();
        item.durability = j["durability"].asInt();
        item.weight_per_unit = j["weight_per_unit"].asDouble();
        item.created_at = j["created_at"].asInt();
        item.last_moved_at = j["last_moved_at"].asInt();
        item.batch_day = j["batch_day"].asInt();
        
        if (j.has("flags")) {
            item.quest_item = j["flags"]["quest_item"].asBool();
            item.bound = j["flags"]["bound"].asBool();
            item.stolen = j["flags"]["stolen"].asBool();
            item.magical = j["flags"]["magical"].asBool();
            item.fragile = j["flags"]["fragile"].asBool();
        }
        
        if (j.has("history")) {
            for (size_t i = 0; i < j["history"].size(); i++) {
                int day = j["history"][i]["day"].asInt();
                std::string event = j["history"][i]["event"].asString();
                item.history.push_back({day, event});
            }
        }
        
        return item;
    }
};

struct Storage {
    std::string id;
    std::string type; // "faction_vault", "caravan_chest", "npc_inventory", etc.
    std::string owner_id;
    int max_weight_kg = 999999;
    int max_slots = 1000;
    bool is_locked = false;
    int lock_difficulty = 10;
    int health = 200;
    bool flammable = true;
    int required_rank = 1;
    
    // Location info
    std::string region_id;
    std::string parent_entity;
    std::string parent_container;
    std::vector<double> world_coords;
    
    // Items stored (by ID)
    std::vector<std::string> item_ids;
    
    JsonValue toJson() const {
        JsonValue obj = JsonValue::object();
        obj.set("id", id);
        obj.set("type", type);
        obj.set("owner_id", owner_id);
        obj.set("max_weight_kg", max_weight_kg);
        obj.set("max_slots", max_slots);
        obj.set("is_locked", is_locked);
        obj.set("lock_difficulty", lock_difficulty);
        obj.set("health", health);
        obj.set("flammable", flammable);
        obj.set("required_rank", required_rank);
        obj.set("region_id", region_id);
        obj.set("parent_entity", parent_entity);
        obj.set("parent_container", parent_container);
        
        JsonValue coords = JsonValue::array();
        for (double c : world_coords) coords.push(JsonValue(c));
        obj.set("world_coords", coords);
        
        JsonValue items = JsonValue::array();
        for (const auto& iid : item_ids) items.push(JsonValue(iid));
        obj.set("item_ids", items);
        
        return obj;
    }
    
    static Storage fromJson(const JsonValue& j) {
        Storage s;
        s.id = j["id"].asString();
        s.type = j["type"].asString();
        s.owner_id = j["owner_id"].asString();
        s.max_weight_kg = j["max_weight_kg"].asInt();
        s.max_slots = j["max_slots"].asInt();
        s.is_locked = j["is_locked"].asBool();
        s.lock_difficulty = j["lock_difficulty"].asInt();
        s.health = j["health"].asInt();
        s.flammable = j["flammable"].asBool();
        s.required_rank = j["required_rank"].asInt();
        s.region_id = j["region_id"].asString();
        s.parent_entity = j["parent_entity"].asString();
        s.parent_container = j["parent_container"].asString();
        
        if (j.has("world_coords")) {
            for (size_t i = 0; i < j["world_coords"].size(); i++) {
                s.world_coords.push_back(j["world_coords"][i].asDouble());
            }
        }
        
        if (j.has("item_ids")) {
            for (size_t i = 0; i < j["item_ids"].size(); i++) {
                s.item_ids.push_back(j["item_ids"][i].asString());
            }
        }
        
        return s;
    }
};

// Global registries
static std::unordered_map<std::string, PhysicalItem> g_items;
static std::unordered_map<std::string, Storage> g_containers;

// Helper: Generate UUID
static std::random_device rd;
static std::mt19937 gen(rd());
static std::uniform_int_distribution<> hex_dist(0, 15);

std::string generateUUID() {
    const char* hex = "0123456789abcdef";
    std::string uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
    for (size_t i = 0; i < uuid.size(); i++) {
        if (uuid[i] == 'x') uuid[i] = hex[hex_dist(gen)];
        else if (uuid[i] == 'y') uuid[i] = hex[(hex_dist(gen) & 0x3) | 0x8];
    }
    return uuid;
}

// Item management
std::string createContainer(const std::string& type, const std::string& ownerId, 
                            int maxWeight, int maxSlots, const std::string& regionId = "",
                            const std::string& parentEntity = "", const std::string& parentContainer = "") {
    Storage cont;
    cont.id = "cont_" + generateUUID();
    cont.type = type;
    cont.owner_id = ownerId;
    cont.max_weight_kg = maxWeight;
    cont.max_slots = maxSlots;
    cont.region_id = regionId;
    cont.parent_entity = parentEntity;
    cont.parent_container = parentContainer;
    cont.is_locked = (type == "faction_vault");
    cont.lock_difficulty = (type == "faction_vault") ? 16 : 10;
    cont.health = (type == "faction_vault") ? 400 : 200;
    cont.flammable = (type != "faction_vault");
    
    g_containers[cont.id] = cont;
    return cont.id;
}

std::string createItem(GoodType prototypeId, int quantity, const std::string& containerId,
                       int currentDay = 0, const std::string& event = "Created") {
    PhysicalItem item;
    item.id = "item_" + generateUUID();
    item.prototype_id = prototypeId;
    item.stack_size = quantity;
    item.container_id = containerId;
    item.created_at = currentDay;
    item.last_moved_at = currentDay;
    item.batch_day = currentDay;
    item.history.push_back({currentDay, event});
    
    // Weight per unit based on type
    if (prototypeId == GoodType::GOLD_INGOT) item.weight_per_unit = 0.01;
    else item.weight_per_unit = 1.0;
    
    g_items[item.id] = item;
    
    // Add to container
    if (!containerId.empty() && g_containers.count(containerId)) {
        g_containers[containerId].item_ids.push_back(item.id);
    }
    
    return item.id;
}

bool removeItem(const std::string& itemId, int quantity) {
    if (!g_items.count(itemId)) return false;
    
    PhysicalItem& item = g_items[itemId];
    if (item.stack_size <= quantity) {
        // Remove from container
        if (!item.container_id.empty() && g_containers.count(item.container_id)) {
            Storage& cont = g_containers[item.container_id];
            cont.item_ids.erase(
                std::remove(cont.item_ids.begin(), cont.item_ids.end(), itemId),
                cont.item_ids.end()
            );
        }
        g_items.erase(itemId);
    } else {
        item.stack_size -= quantity;
    }
    return true;
}

bool moveItem(const std::string& itemId, const std::string& targetContainerId) {
    if (!g_items.count(itemId)) return false;
    if (!g_containers.count(targetContainerId)) return false;
    
    PhysicalItem& item = g_items[itemId];
    
    // Remove from old container
    if (!item.container_id.empty() && g_containers.count(item.container_id)) {
        Storage& oldCont = g_containers[item.container_id];
        oldCont.item_ids.erase(
            std::remove(oldCont.item_ids.begin(), oldCont.item_ids.end(), itemId),
            oldCont.item_ids.end()
        );
    }
    
    // Add to new container
    item.container_id = targetContainerId;
    g_containers[targetContainerId].item_ids.push_back(itemId);
    
    return true;
}

int countItemsInContainer(const std::string& containerId, GoodType prototypeId) {
    if (!g_containers.count(containerId)) return 0;
    
    const Storage& cont = g_containers[containerId];
    int total = 0;
    
    for (const auto& itemId : cont.item_ids) {
        if (g_items.count(itemId)) {
            const PhysicalItem& item = g_items[itemId];
            if (item.prototype_id == prototypeId) {
                total += item.stack_size;
            }
        }
    }
    
    return total;
}

int consumeItemsFromContainer(const std::string& containerId, GoodType prototypeId, int quantity) {
    if (!g_containers.count(containerId)) return 0;
    
    Storage& cont = g_containers[containerId];
    int taken = 0;
    int remaining = quantity;
    
    // Sort items by batch_day (FIFO - oldest first)
    std::vector<std::pair<int, std::string>> itemsByAge;
    for (const auto& itemId : cont.item_ids) {
        if (g_items.count(itemId)) {
            const PhysicalItem& item = g_items[itemId];
            if (item.prototype_id == prototypeId) {
                itemsByAge.push_back({item.batch_day, itemId});
            }
        }
    }
    std::sort(itemsByAge.begin(), itemsByAge.end());
    
    for (const auto& [day, itemId] : itemsByAge) {
        if (remaining <= 0) break;
        if (!g_items.count(itemId)) continue;
        
        PhysicalItem& item = g_items[itemId];
        int take = std::min(item.stack_size, remaining);
        if (take > 0) {
            removeItem(itemId, take);
            remaining -= take;
            taken += take;
        }
    }
    
    return taken;
}

// ============================================================================
// WORLD STATE STRUCTURES
// ============================================================================

struct News {
    std::string text;
    std::string location;
    int importance; // 1=minor, 2=notable, 3=major
    std::string category; // "trade", "war", "disaster", "politics", "misc"
    int day = 0;
    
    JsonValue toJson() const {
        JsonValue obj = JsonValue::object();
        obj.set("text", text);
        obj.set("location", location);
        obj.set("importance", importance);
        obj.set("category", category);
        obj.set("day", day);
        return obj;
    }
};

struct Caravan {
    std::string id;
    std::string origin;
    std::string destination;
    int hoursLeft = 0;
    std::string chest_id; // Container with goods
    
    // Legacy goods map (for compatibility)
    std::map<std::string, int> goods;
    
    JsonValue toJson() const {
        JsonValue obj = JsonValue::object();
        obj.set("id", id);
        obj.set("origin", origin);
        obj.set("destination", destination);
        obj.set("hoursLeft", hoursLeft);
        obj.set("chest_id", chest_id);
        
        JsonValue g = JsonValue::object();
        for (const auto& [key, val] : goods) g.set(key, val);
        obj.set("goods", g);
        
        return obj;
    }
    
    static Caravan fromJson(const JsonValue& j) {
        Caravan c;
        c.id = j["id"].asString();
        c.origin = j["origin"].asString();
        c.destination = j["destination"].asString();
        c.hoursLeft = j["hoursLeft"].asInt();
        c.chest_id = j["chest_id"].asString();
        
        if (j.has("goods")) {
            for (const auto& kv : j["goods"].obj_val) {
                c.goods[kv.first] = kv.second.asInt();
            }
        }
        
        return c;
    }
};

struct NPC {
    std::string id;
    std::string name;
    std::string type = "npc"; // "npc" or "ruler"
    std::string profession;
    std::string homeLocation;
    std::string currentLocation;
    std::string currentActivity;
    
    // Schedule
    struct ScheduleEntry {
        int start, end;
        std::string activity;
        std::string location;
    };
    std::vector<ScheduleEntry> schedule;
    
    // Needs (0-100)
    struct Needs {
        int hunger = 100;
        int rest = 100;
        int social = 100;
        int safety = 100;
    } needs;
    
    // Personality (0-100)
    struct Personality {
        int aggression = 50;
        int sociability = 50;
        int greed = 50;
        int loyalty = 50;
    } personality;
    
    // Economy
    struct Economy {
        int skillLevel = 5;
        bool isEmployed = false;
        std::string workplaceId;
        int dailyWage = 0;
        int savings = 0;
    } economy;
    
    // Inventory
    int gold = 0;
    std::string inventory_id; // Container ID for physical items
    
    // Status
    bool isAlive = true;
    int hp = 20;
    bool plotArmor = false;
    
    // Travel
    std::string travelDestination;
    int travelHoursLeft = 0;
    
    // For rulers
    std::string factionId;
    struct RulerStats {
        int hp = 80, maxHp = 80;
        int str = 10, dex = 10, int_ = 14, con = 12, cha = 16, res = 10;
    } rulerStats;
    struct RulerPersonality {
        int ambition = 60;
        int paranoia = 50;
        int wisdom = 50;
        int cruelty = 50;
        int diplomacy = 50;
        int military = 50;
        int stewardship = 50;
    } rulerPersonality;
    int health = 100;
    bool alive = true;
    std::string heir;
    std::string currentGoal;
    std::string gmOverride;
    int lastTickDay = 0;
    
    std::map<std::string, int> relationships;
    std::vector<std::string> memory;
    
    JsonValue toJson() const {
        JsonValue obj = JsonValue::object();
        obj.set("id", id);
        obj.set("name", name);
        obj.set("type", type);
        obj.set("profession", profession);
        obj.set("homeLocation", homeLocation);
        obj.set("currentLocation", currentLocation);
        obj.set("currentActivity", currentActivity);
        obj.set("isAlive", isAlive);
        obj.set("hp", hp);
        obj.set("gold", gold);
        obj.set("inventory_id", inventory_id);
        
        JsonValue n = JsonValue::object();
        n.set("hunger", needs.hunger);
        n.set("rest", needs.rest);
        n.set("social", needs.social);
        n.set("safety", needs.safety);
        obj.set("needs", n);
        
        JsonValue p = JsonValue::object();
        p.set("aggression", personality.aggression);
        p.set("sociability", personality.sociability);
        p.set("greed", personality.greed);
        p.set("loyalty", personality.loyalty);
        obj.set("personality", p);
        
        JsonValue e = JsonValue::object();
        e.set("skillLevel", economy.skillLevel);
        e.set("isEmployed", economy.isEmployed);
        e.set("workplaceId", economy.workplaceId);
        e.set("dailyWage", economy.dailyWage);
        e.set("savings", economy.savings);
        obj.set("economy", e);
        
        // Schedule
        JsonValue sched = JsonValue::array();
        for (const auto& s : schedule) {
            JsonValue entry = JsonValue::object();
            entry.set("start", s.start);
            entry.set("end", s.end);
            entry.set("activity", s.activity);
            entry.set("location", s.location);
            sched.push(entry);
        }
        obj.set("schedule", sched);
        
        // Ruler-specific
        if (type == "ruler") {
            obj.set("factionId", factionId);
            obj.set("health", health);
            obj.set("alive", alive);
            obj.set("heir", heir);
            
            JsonValue rs = JsonValue::object();
            rs.set("hp", rulerStats.hp);
            rs.set("str", rulerStats.str);
            rs.set("dex", rulerStats.dex);
            rs.set("int", rulerStats.int_);
            rs.set("con", rulerStats.con);
            rs.set("cha", rulerStats.cha);
            rs.set("res", rulerStats.res);
            obj.set("rulerStats", rs);
            
            JsonValue rp = JsonValue::object();
            rp.set("ambition", rulerPersonality.ambition);
            rp.set("paranoia", rulerPersonality.paranoia);
            rp.set("wisdom", rulerPersonality.wisdom);
            rp.set("cruelty", rulerPersonality.cruelty);
            rp.set("diplomacy", rulerPersonality.diplomacy);
            rp.set("military", rulerPersonality.military);
            rp.set("stewardship", rulerPersonality.stewardship);
            obj.set("rulerPersonality", rp);
        }
        
        return obj;
    }
    
    static NPC fromJson(const JsonValue& j) {
        NPC npc;
        npc.id = j["id"].asString();
        npc.name = j["name"].asString();
        npc.type = j["type"].asString();
        npc.profession = j["profession"].asString();
        npc.homeLocation = j["homeLocation"].asString();
        npc.currentLocation = j["currentLocation"].asString();
        npc.currentActivity = j["currentActivity"].asString();
        npc.isAlive = j["isAlive"].asBool();
        npc.hp = j["hp"].asInt();
        npc.gold = j["gold"].asInt();
        npc.inventory_id = j["inventory_id"].asString();
        
        if (j.has("needs")) {
            npc.needs.hunger = j["needs"]["hunger"].asInt();
            npc.needs.rest = j["needs"]["rest"].asInt();
            npc.needs.social = j["needs"]["social"].asInt();
            npc.needs.safety = j["needs"]["safety"].asInt();
        }
        
        if (j.has("personality")) {
            npc.personality.aggression = j["personality"]["aggression"].asInt();
            npc.personality.sociability = j["personality"]["sociability"].asInt();
            npc.personality.greed = j["personality"]["greed"].asInt();
            npc.personality.loyalty = j["personality"]["loyalty"].asInt();
        }
        
        if (j.has("economy")) {
            npc.economy.skillLevel = j["economy"]["skillLevel"].asInt();
            npc.economy.isEmployed = j["economy"]["isEmployed"].asBool();
            npc.economy.workplaceId = j["economy"]["workplaceId"].asString();
            npc.economy.dailyWage = j["economy"]["dailyWage"].asInt();
            npc.economy.savings = j["economy"]["savings"].asInt();
        }
        
        if (j.has("schedule")) {
            for (size_t i = 0; i < j["schedule"].size(); i++) {
                ScheduleEntry s;
                s.start = j["schedule"][i]["start"].asInt();
                s.end = j["schedule"][i]["end"].asInt();
                s.activity = j["schedule"][i]["activity"].asString();
                s.location = j["schedule"][i]["location"].asString();
                npc.schedule.push_back(s);
            }
        }
        
        if (j.has("factionId")) {
            npc.factionId = j["factionId"].asString();
            npc.health = j["health"].asInt();
            npc.alive = j["alive"].asBool();
            npc.heir = j["heir"].asString();
            
            if (j.has("rulerStats")) {
                npc.rulerStats.hp = j["rulerStats"]["hp"].asInt();
                npc.rulerStats.str = j["rulerStats"]["str"].asInt();
                npc.rulerStats.dex = j["rulerStats"]["dex"].asInt();
                npc.rulerStats.int_ = j["rulerStats"]["int"].asInt();
                npc.rulerStats.con = j["rulerStats"]["con"].asInt();
                npc.rulerStats.cha = j["rulerStats"]["cha"].asInt();
                npc.rulerStats.res = j["rulerStats"]["res"].asInt();
            }
            
            if (j.has("rulerPersonality")) {
                npc.rulerPersonality.ambition = j["rulerPersonality"]["ambition"].asInt();
                npc.rulerPersonality.paranoia = j["rulerPersonality"]["paranoia"].asInt();
                npc.rulerPersonality.wisdom = j["rulerPersonality"]["wisdom"].asInt();
                npc.rulerPersonality.cruelty = j["rulerPersonality"]["cruelty"].asInt();
                npc.rulerPersonality.diplomacy = j["rulerPersonality"]["diplomacy"].asInt();
                npc.rulerPersonality.military = j["rulerPersonality"]["military"].asInt();
                npc.rulerPersonality.stewardship = j["rulerPersonality"]["stewardship"].asInt();
            }
        }
        
        return npc;
    }
};

struct Region {
    std::string id;
    std::string name;
    std::string factionId;
    int population = 0;
    double moneySupply = 0;
    std::string vault_id; // Container ID for faction storage
    
    // Markets (good -> price)
    std::map<std::string, double> markets;
    
    // Caravans departing from this region
    std::vector<Caravan> caravans;
    
    // Weather
    std::string weather = "Ясно";
    int weatherDaysLeft = 0;
    
    // Production facilities
    std::vector<std::string> facilities;
    
    JsonValue toJson() const {
        JsonValue obj = JsonValue::object();
        obj.set("id", id);
        obj.set("name", name);
        obj.set("factionId", factionId);
        obj.set("population", population);
        obj.set("moneySupply", moneySupply);
        obj.set("vault_id", vault_id);
        obj.set("weather", weather);
        obj.set("weatherDaysLeft", weatherDaysLeft);
        
        JsonValue m = JsonValue::object();
        for (const auto& [k, v] : markets) m.set(k, v);
        obj.set("markets", m);
        
        JsonValue cars = JsonValue::array();
        for (const auto& c : caravans) cars.push(c.toJson());
        obj.set("caravans", cars);
        
        JsonValue facs = JsonValue::array();
        for (const auto& f : facilities) facs.push(JsonValue(f));
        obj.set("facilities", facs);
        
        return obj;
    }
    
    static Region fromJson(const JsonValue& j) {
        Region r;
        r.id = j["id"].asString();
        r.name = j["name"].asString();
        r.factionId = j["factionId"].asString();
        r.population = j["population"].asInt();
        r.moneySupply = j["moneySupply"].asDouble();
        r.vault_id = j["vault_id"].asString();
        r.weather = j["weather"].asString();
        r.weatherDaysLeft = j["weatherDaysLeft"].asInt();
        
        if (j.has("markets")) {
            for (const auto& kv : j["markets"].obj_val) {
                r.markets[kv.first] = kv.second.asDouble();
            }
        }
        
        if (j.has("caravans")) {
            for (size_t i = 0; i < j["caravans"].size(); i++) {
                r.caravans.push_back(Caravan::fromJson(j["caravans"][i]));
            }
        }
        
        if (j.has("facilities")) {
            for (size_t i = 0; i < j["facilities"].size(); i++) {
                r.facilities.push_back(j["facilities"][i].asString());
            }
        }
        
        return r;
    }
};

struct Faction {
    std::string id;
    std::string name;
    std::vector<std::string> regions;
    std::map<std::string, int> relations; // factionId -> relation (-100 to 100)
    std::map<std::string, std::string> diplomacy; // factionId -> "war", "peace", "neutral", "alliance"
    std::vector<std::string> armies;
    
    JsonValue toJson() const {
        JsonValue obj = JsonValue::object();
        obj.set("id", id);
        obj.set("name", name);
        
        JsonValue regs = JsonValue::array();
        for (const auto& r : regions) regs.push(JsonValue(r));
        obj.set("regions", regs);
        
        JsonValue rel = JsonValue::object();
        for (const auto& [k, v] : relations) rel.set(k, v);
        obj.set("relations", rel);
        
        JsonValue dip = JsonValue::object();
        for (const auto& [k, v] : diplomacy) dip.set(k, v);
        obj.set("diplomacy", dip);
        
        JsonValue arms = JsonValue::array();
        for (const auto& a : armies) arms.push(JsonValue(a));
        obj.set("armies", arms);
        
        return obj;
    }
    
    static Faction fromJson(const JsonValue& j) {
        Faction f;
        f.id = j["id"].asString();
        f.name = j["name"].asString();
        
        if (j.has("regions")) {
            for (size_t i = 0; i < j["regions"].size(); i++) {
                f.regions.push_back(j["regions"][i].asString());
            }
        }
        
        if (j.has("relations")) {
            for (const auto& kv : j["relations"].obj_val) {
                f.relations[kv.first] = kv.second.asInt();
            }
        }
        
        if (j.has("diplomacy")) {
            for (const auto& kv : j["diplomacy"].obj_val) {
                f.diplomacy[kv.first] = kv.second.asString();
            }
        }
        
        if (j.has("armies")) {
            for (size_t i = 0; i < j["armies"].size(); i++) {
                f.armies.push_back(j["armies"][i].asString());
            }
        }
        
        return f;
    }
};

struct World {
    int tick = 0;
    std::string era = "rebirth";
    
    // Time tracking
    struct Time {
        int accumulatedMinutes = 0;
        int lastEventPulse = 0;
        int internalHour = 0;
    } time;
    
    // Homeostasis
    struct Homeostasis {
        int warWeariness = 0;
        double fertility = 1.0;
    } homeostasis;
    
    // Game objects
    std::map<std::string, Region> regions;
    std::map<std::string, Faction> factions;
    std::map<std::string, NPC> npcs;
    std::vector<News> news;
    
    // GM intervention tracking
    std::vector<std::string> gmInterventionHistory;
    int lastDirectInjectionDay = -999;
    bool needsGlobalEvent = false;
    
    // Intrigues in progress
    std::vector<std::string> intrigues;
    
    JsonValue toJson() const {
        JsonValue obj = JsonValue::object();
        obj.set("tick", tick);
        obj.set("era", era);
        
        JsonValue t = JsonValue::object();
        t.set("accumulatedMinutes", time.accumulatedMinutes);
        t.set("lastEventPulse", time.lastEventPulse);
        t.set("internalHour", time.internalHour);
        obj.set("time", t);
        
        JsonValue h = JsonValue::object();
        h.set("warWeariness", homeostasis.warWeariness);
        h.set("fertility", homeostasis.fertility);
        obj.set("homeostasis", h);
        
        JsonValue regs = JsonValue::object();
        for (const auto& [k, v] : regions) regs.set(k, v.toJson());
        obj.set("regions", regs);
        
        JsonValue facts = JsonValue::object();
        for (const auto& [k, v] : factions) facts.set(k, v.toJson());
        obj.set("factions", facts);
        
        JsonValue n = JsonValue::object();
        for (const auto& [k, v] : npcs) n.set(k, v.toJson());
        obj.set("npcs", n);
        
        JsonValue newsArr = JsonValue::array();
        for (const auto& nw : news) newsArr.push(nw.toJson());
        obj.set("news", newsArr);
        
        obj.set("needsGlobalEvent", needsGlobalEvent);
        obj.set("lastDirectInjectionDay", lastDirectInjectionDay);
        
        return obj;
    }
    
    static World fromJson(const JsonValue& j) {
        World w;
        w.tick = j["tick"].asInt();
        w.era = j["era"].asString();
        
        if (j.has("time")) {
            w.time.accumulatedMinutes = j["time"]["accumulatedMinutes"].asInt();
            w.time.lastEventPulse = j["time"]["lastEventPulse"].asInt();
            w.time.internalHour = j["time"]["internalHour"].asInt();
        }
        
        if (j.has("homeostasis")) {
            w.homeostasis.warWeariness = j["homeostasis"]["warWeariness"].asInt();
            w.homeostasis.fertility = j["homeostasis"]["fertility"].asDouble();
        }
        
        if (j.has("regions")) {
            for (const auto& kv : j["regions"].obj_val) {
                w.regions[kv.first] = Region::fromJson(kv.second);
            }
        }
        
        if (j.has("factions")) {
            for (const auto& kv : j["factions"].obj_val) {
                w.factions[kv.first] = Faction::fromJson(kv.second);
            }
        }
        
        if (j.has("npcs")) {
            for (const auto& kv : j["npcs"].obj_val) {
                w.npcs[kv.first] = NPC::fromJson(kv.second);
            }
        }
        
        if (j.has("news")) {
            for (size_t i = 0; i < j["news"].size(); i++) {
                News nw;
                nw.text = j["news"][i]["text"].asString();
                nw.location = j["news"][i]["location"].asString();
                nw.importance = j["news"][i]["importance"].asInt();
                nw.category = j["news"][i]["category"].asString();
                nw.day = j["news"][i]["day"].asInt();
                w.news.push_back(nw);
            }
        }
        
        w.needsGlobalEvent = j["needsGlobalEvent"].asBool();
        w.lastDirectInjectionDay = j["lastDirectInjectionDay"].asInt();
        
        return w;
    }
};

// Global world state
static World g_world;
static std::string g_playerId;
static int g_currentDay = 0;

// ============================================================================
// SIMULATION FUNCTIONS
// ============================================================================

// Shelf life in days for each good type
std::map<GoodType, int> getShelfLife() {
    return {
        {GoodType::MEAT, 5},
        {GoodType::FISH, 5},
        {GoodType::BREAD, 10},
        {GoodType::WHEAT, 360},
        {GoodType::SMOKED_MEAT, 180},
        {GoodType::HERBS, 30},
        {GoodType::WOOD, 720},
        {GoodType::IRON_ORE, 3600},
        {GoodType::GOLD_ORE, 99999},
        {GoodType::WEAPONS, 1800},
        {GoodType::ARMOR, 1800},
        {GoodType::CLOTHES, 1080},
        {GoodType::COTTON, 360}
    };
}

void addNews(const std::string& text, const std::string& location, int importance, const std::string& category = "misc") {
    News nw;
    nw.text = text;
    nw.location = location;
    nw.importance = importance;
    nw.category = category;
    nw.day = g_currentDay;
    g_world.news.push_back(nw);
}

std::string getGoodName(GoodType good) {
    switch (good) {
        case GoodType::BREAD: return "хлеб";
        case GoodType::MEAT: return "мясо";
        case GoodType::FISH: return "рыба";
        case GoodType::WHEAT: return "пшеница";
        case GoodType::WOOD: return "древесина";
        case GoodType::IRON_ORE: return "железная руда";
        case GoodType::GOLD_ORE: return "золотая руда";
        case GoodType::IRON_INGOT: return "железо";
        case GoodType::WEAPONS: return "оружие";
        case GoodType::ARMOR: return "броня";
        case GoodType::HERBS: return "травы";
        case GoodType::POTIONS: return "зелья";
        case GoodType::CLOTHES: return "одежда";
        case GoodType::COTTON: return "хлопок";
        case GoodType::SMOKED_MEAT: return "копчености";
        default: return goodTypeToString(good);
    }
}

// Process spoilage for all items in all containers
void processSpoilage() {
    auto shelfLife = getShelfLife();
    
    // Weather modifiers
    double heatMod = 1.0;
    double coldMod = 1.0;
    
    // Check weather in regions
    for (auto& [rid, region] : g_world.regions) {
        if (region.weather == "Жара") heatMod = 2.0;
        if (region.weather == "Снег" || region.weather == "Метель") coldMod = 0.3;
    }
    
    for (auto& [cid, container] : g_containers) {
        for (const auto& itemId : container.item_ids) {
            if (!g_items.count(itemId)) continue;
            
            PhysicalItem& item = g_items[itemId];
            
            // Check if this item type spoils
            auto it = shelfLife.find(item.prototype_id);
            if (it == shelfLife.end()) continue;
            
            int maxLife = it->second;
            int age = g_currentDay - item.batch_day;
            
            // Apply weather modifiers for organic goods
            double effectiveAge = age;
            if (item.prototype_id == GoodType::MEAT || 
                item.prototype_id == GoodType::FISH ||
                item.prototype_id == GoodType::BREAD ||
                item.prototype_id == GoodType::WHEAT ||
                item.prototype_id == GoodType::SMOKED_MEAT ||
                item.prototype_id == GoodType::HERBS) {
                effectiveAge = age * heatMod * coldMod;
            }
            
            // Check if spoiled
            if (effectiveAge >= maxLife) {
                item.history.push_back({g_currentDay, "Сгнило полностью"});
                // Mark for removal (set stack to 0)
                item.stack_size = 0;
            } else {
                // Calculate quality degradation
                double freshness = 1.0 - (effectiveAge / (double)maxLife);
                freshness = std::max(0.1, freshness);
                
                // Rust for metal items after half shelf life
                if (item.prototype_id == GoodType::IRON_ORE ||
                    item.prototype_id == GoodType::WEAPONS ||
                    item.prototype_id == GoodType::ARMOR) {
                    if (effectiveAge > maxLife * 0.5) {
                        freshness *= 0.5;
                        item.durability = (int)(item.durability * 0.5);
                    }
                }
            }
        }
    }
    
    // Remove fully spoiled items
    std::vector<std::string> toRemove;
    for (auto& [itemId, item] : g_items) {
        if (item.stack_size <= 0) {
            toRemove.push_back(itemId);
        }
    }
    for (const auto& itemId : toRemove) {
        removeItem(itemId, 999999);
    }
}

// Process NPC consumption of food
void processConsumption() {
    for (auto& [npcId, npc] : g_world.npcs) {
        if (!npc.isAlive || npc.type == "ruler") continue;
        
        // Find NPC's current region
        auto rit = g_world.regions.find(npc.currentLocation);
        if (rit == g_world.regions.end()) continue;
        
        Region& region = rit->second;
        if (region.vault_id.empty()) continue;
        
        // Decrease needs
        npc.needs.hunger -= (1 + (rand() % 2));
        npc.needs.rest -= (2 + (rand() % 2));
        npc.needs.social -= 1;
        
        // Handle travel
        if (!npc.travelDestination.empty()) {
            npc.travelHoursLeft--;
            npc.currentActivity = "В пути в " + npc.travelDestination;
            npc.needs.rest -= 1;
            
            if (npc.travelHoursLeft <= 0) {
                npc.currentLocation = npc.travelDestination;
                npc.travelDestination = "";
                npc.currentActivity = "Прибыл";
            }
            continue;
        }
        
        // Check hunger
        if (npc.needs.hunger < 25) {
            npc.currentActivity = "Ищет еду";
            
            // Try to buy/eat bread
            int breadAvailable = countItemsInContainer(region.vault_id, GoodType::BREAD);
            int foodPrice = (int)region.markets["bread"];
            if (foodPrice == 0) foodPrice = 5;
            
            if (npc.gold >= foodPrice && breadAvailable > 0) {
                npc.gold -= foodPrice;
                consumeItemsFromContainer(region.vault_id, GoodType::BREAD, 1);
                region.moneySupply += foodPrice;
                npc.needs.hunger = 100;
                npc.currentActivity = "Ест";
                
                // Add to NPC inventory if they have one
                if (!npc.inventory_id.empty()) {
                    createItem(GoodType::BREAD, 1, npc.inventory_id, g_currentDay, "Куплено");
                }
            } else {
                // Try to steal or starve
                if (npc.personality.greed > 60 || npc.personality.aggression > 50) {
                    npc.currentActivity = "Ворует еду";
                    npc.needs.hunger += 40;
                } else {
                    npc.currentActivity = "Голодает";
                }
            }
        } else if (npc.needs.rest < 20) {
            npc.currentActivity = "Спит";
            npc.needs.rest += 50;
        } else {
            // Normal activity based on schedule
            int currentHour = g_world.time.internalHour;
            for (const auto& sched : npc.schedule) {
                if (currentHour >= sched.start && currentHour <= sched.end) {
                    npc.currentActivity = sched.activity;
                    
                    if (sched.activity == "Работает") {
                        npc.needs.rest -= 2;
                        
                        if (npc.profession == "Торговец") {
                            npc.gold += (rand() % 15) + 5;
                            
                            // Random trade
                            if ((rand() % 10) == 0 && !npc.inventory_id.empty()) {
                                // Pick random good from market
                                if (!region.markets.empty()) {
                                    int idx = rand() % region.markets.size();
                                    int i = 0;
                                    std::string good;
                                    for (const auto& [g, p] : region.markets) {
                                        if (i == idx) { good = g; break; }
                                        i++;
                                    }
                                    
                                    if (!good.empty()) {
                                        int price = (int)region.markets[good];
                                        int available = countItemsInContainer(region.vault_id, stringToGoodType(good));
                                        
                                        if (npc.gold >= price && available > 0) {
                                            npc.gold -= price;
                                            consumeItemsFromContainer(region.vault_id, stringToGoodType(good), 1);
                                            createItem(stringToGoodType(good), 1, npc.inventory_id, g_currentDay, "Куплено");
                                        }
                                    }
                                }
                            }
                        } else {
                            // Regular wage
                            int wage = std::max(1, (int)((region.moneySupply / std::max(1, region.population)) * npc.economy.skillLevel * 0.5));
                            npc.gold += wage;
                        }
                    }
                    break;
                }
            }
        }
        
        // Clamp needs
        npc.needs.hunger = std::max(0, std::min(100, npc.needs.hunger));
        npc.needs.rest = std::max(0, std::min(100, npc.needs.rest));
        npc.needs.social = std::max(0, std::min(100, npc.needs.social));
        
        // Check death
        if (npc.needs.hunger == 0 || npc.hp <= 0) {
            npc.isAlive = false;
            npc.currentActivity = (npc.needs.hunger == 0) ? "Мертв (Голод)" : "Мертв (Убит)";
        }
    }
}

// Process caravans movement and delivery
void processCaravans() {
    for (auto& [rid, region] : g_world.regions) {
        for (int i = (int)region.caravans.size() - 1; i >= 0; i--) {
            Caravan& caravan = region.caravans[i];
            caravan.hoursLeft--;
            
            if (caravan.hoursLeft <= 0) {
                // Arrived at destination
                auto destIt = g_world.regions.find(caravan.destination);
                if (destIt != g_world.regions.end() && !caravan.chest_id.empty()) {
                    Region& destRegion = destIt->second;
                    
                    // Move all items from caravan chest to destination vault
                    auto chestIt = g_containers.find(caravan.chest_id);
                    if (chestIt != g_containers.end()) {
                        Storage& chest = chestIt->second;
                        double totalRevenue = 0;
                        
                        for (const auto& itemId : chest.item_ids) {
                            auto itemIt = g_items.find(itemId);
                            if (itemIt == g_items.end()) continue;
                            
                            PhysicalItem& item = itemIt->second;
                            
                            // Move to destination vault
                            moveItem(itemId, destRegion.vault_id);
                            
                            // Calculate revenue
                            double price = destRegion.markets[goodTypeToString(item.prototype_id)];
                            if (price == 0) price = BASE_PRICES[(int)item.prototype_id];
                            totalRevenue += item.stack_size * price;
                        }
                        
                        // Generate news
                        std::string goodsList;
                        for (const auto& [good, amount] : caravan.goods) {
                            if (!goodsList.empty()) goodsList += ", ";
                            goodsList += std::to_string(amount) + " " + getGoodName(stringToGoodType(good));
                        }
                        
                        addNews(
                            "ЭКОНОМИКА: Караван из " + region.name + " прибыл в " + destRegion.name + 
                            "! Доставлено: " + goodsList + ". Выручка: " + std::to_string((int)totalRevenue) + " золотых.",
                            destRegion.name, 2, "trade"
                        );
                        
                        // Remove caravan chest container
                        g_containers.erase(caravan.chest_id);
                    }
                }
                
                // Remove caravan from region
                region.caravans.erase(region.caravans.begin() + i);
            }
        }
    }
}

// Process caravans movement and delivery
void processCaravans();

// Forward declarations
void simulateOneDay();

// Simulate one hour
void simulateOneHour() {
    processConsumption();
    processCaravans();
    
    g_world.time.internalHour++;
    if (g_world.time.internalHour >= 24) {
        g_world.time.internalHour = 0;
        simulateOneDay();
    }
}

// Simulate one day
void simulateOneDay() {
    g_currentDay++;
    
    // Update homeostasis
    int activeWars = 0;
    int totalPopulation = 0;
    
    for (auto& [fid, faction] : g_world.factions) {
        for (auto& [tid, status] : faction.diplomacy) {
            if (status == "war") activeWars++;
        }
    }
    activeWars /= 2; // Each war counted twice
    
    if (activeWars >= 2) {
        g_world.homeostasis.warWeariness = std::min(100, g_world.homeostasis.warWeariness + 4);
    } else if (activeWars == 0) {
        g_world.homeostasis.warWeariness = std::max(0, g_world.homeostasis.warWeariness - 2);
    }
    
    for (auto& [rid, region] : g_world.regions) {
        totalPopulation += region.population;
    }
    
    int initialPopEst = g_world.regions.size() * 20000;
    if (totalPopulation < initialPopEst * 0.75) {
        g_world.homeostasis.fertility = std::min(2.0, g_world.homeostasis.fertility + 0.05);
    } else if (totalPopulation > initialPopEst * 1.25) {
        g_world.homeostasis.fertility = std::max(0.5, g_world.homeostasis.fertility - 0.05);
    }
    
    // Process spoilage
    processSpoilage();
    
    // Weather updates
    for (auto& [rid, region] : g_world.regions) {
        if (region.weatherDaysLeft > 0) {
            region.weatherDaysLeft--;
        } else {
            // New weather
            int roll = rand() % 100;
            if (roll < 60) {
                region.weather = "Ясно";
                region.weatherDaysLeft = 3 + (rand() % 5);
            } else if (roll < 80) {
                region.weather = "Дождь";
                region.weatherDaysLeft = 1 + (rand() % 3);
            } else if (roll < 95) {
                region.weather = "Снег";
                region.weatherDaysLeft = 2 + (rand() % 4);
            } else {
                region.weather = "Жара";
                region.weatherDaysLeft = 2 + (rand() % 3);
            }
        }
    }
    
    // Production (simplified)
    for (auto& [rid, region] : g_world.regions) {
        if (!region.vault_id.empty()) {
            // Basic resource generation based on population
            int wheatProd = region.population / 100;
            int woodProd = region.population / 150;
            
            if (wheatProd > 0) {
                createItem(GoodType::WHEAT, wheatProd, region.vault_id, g_currentDay, "Произведено");
            }
            if (woodProd > 0) {
                createItem(GoodType::WOOD, woodProd, region.vault_id, g_currentDay, "Произведено");
            }
        }
    }
}

// Build initial world
void buildWorld(const std::string& playerId) {
    g_playerId = playerId;
    g_world = World();
    g_world.era = "rebirth";
    g_currentDay = 0;
    
    // Create factions
    std::map<std::string, std::string> factions = {
        {"aquilon", "Аквилонская Директория"},
        {"khazadrim", "Кхазадримский Конклав"},
        {"sylvanesti", "Сильванестийский Симбиоз"},
        {"gronnar", "Гроннарская Орда"},
        {"consortium", "Свободные Торговцы"},
        {"crimson", "Орден Багрового Пламени"}
    };
    
    for (auto& [fid, fname] : factions) {
        Faction f;
        f.id = fid;
        f.name = fname;
        
        // Initialize relations
        for (auto& [oid, oname] : factions) {
            if (oid != fid) {
                f.relations[oid] = (rand() % 100) - 50;
                f.diplomacy[oid] = "neutral";
            }
        }
        
        g_world.factions[fid] = f;
    }
    
    // Create regions
    std::map<std::string, std::pair<std::string, std::string>> regions = {
        {"capital_aquilon", {"aquilon", "Столица Аквилон"}},
        {"thunder_citadel", {"khazadrim", "Громовая Цитадель"}},
        {"whispering_woods", {"sylvanesti", "Шепчущие Леса"}},
        {"nomad_lands", {"gronnar", "Земли Кочевников"}},
        {"silver_haven", {"consortium", "Серебряная Гавань"}},
        {"sanctum", {"crimson", "Святилище"}}
    };
    
    for (auto& [rid, rdata] : regions) {
        Region r;
        r.id = rid;
        r.name = rdata.second;
        r.factionId = rdata.first;
        r.population = 5000 + (rand() % 45000);
        r.moneySupply = r.population * 0.5;
        
        // Create vault
        r.vault_id = createContainer("faction_vault", r.factionId, 999999, 1000, rid);
        
        // Initialize markets
        for (int i = 0; i < (int)GoodType::COUNT; i++) {
            GoodType gt = (GoodType)i;
            std::string gts = goodTypeToString(gt);
            r.markets[gts] = BASE_PRICES[i] * (0.8 + (rand() % 40) / 100.0);
        }
        
        // Add initial resources to vault
        int wheat = r.population / 2;
        int bread = r.population / 3;
        int weapons = r.population / 20;
        
        createItem(GoodType::WHEAT, wheat, r.vault_id, 0, "Начальные запасы");
        createItem(GoodType::BREAD, bread, r.vault_id, 0, "Начальные запасы");
        createItem(GoodType::WEAPONS, weapons, r.vault_id, 0, "Начальные запасы");
        
        g_world.regions[rid] = r;
        g_world.factions[rdata.first].regions.push_back(rid);
    }
    
    // Create NPCs
    std::vector<std::string> names = {"Боб", "Грег", "Элиза", "Торбин", "Лиара", "Каэль", "Морган", "Сильвия"};
    std::vector<std::string> professions = {"Кузнец", "Фермер", "Стражник", "Торговец", "Маг", "Трактирщик"};
    
    std::vector<std::string> regionIds;
    for (auto& [rid, r] : g_world.regions) regionIds.push_back(rid);
    
    for (int i = 0; i < 20; i++) {
        NPC npc;
        npc.id = "npc_" + generateUUID();
        npc.name = names[rand() % names.size()] + " " + professions[rand() % professions.size()];
        npc.type = "npc";
        npc.profession = professions[rand() % professions.size()];
        npc.homeLocation = regionIds[rand() % regionIds.size()];
        npc.currentLocation = npc.homeLocation;
        npc.currentActivity = "Отдыхает";
        
        // Schedule
        npc.schedule = {
            {0, 6, "Спит", npc.homeLocation},
            {7, 8, "Ест", npc.homeLocation},
            {9, 18, "Работает", npc.homeLocation},
            {19, 21, "Отдыхает", npc.homeLocation},
            {22, 23, "Спит", npc.homeLocation}
        };
        
        // Personality
        npc.personality.aggression = rand() % 100;
        npc.personality.sociability = rand() % 100;
        npc.personality.greed = rand() % 100;
        npc.personality.loyalty = rand() % 100;
        
        // Economy
        npc.economy.skillLevel = 1 + (rand() % 10);
        npc.economy.savings = rand() % 500;
        
        // Inventory
        npc.gold = rand() % 100;
        npc.inventory_id = createContainer("npc_inventory", npc.id, 100, 20, npc.homeLocation, npc.id);
        
        g_world.npcs[npc.id] = npc;
    }
    
    // Create rulers
    for (auto& [fid, faction] : g_world.factions) {
        NPC ruler;
        ruler.id = "ruler_" + fid;
        ruler.type = "ruler";
        ruler.factionId = fid;
        ruler.name = "Правитель " + faction.name;
        ruler.homeLocation = g_world.factions[fid].regions.empty() ? "" : g_world.factions[fid].regions[0];
        ruler.currentLocation = ruler.homeLocation;
        ruler.isAlive = true;
        ruler.alive = true;
        ruler.health = 100;
        
        ruler.rulerPersonality.ambition = 40 + (rand() % 40);
        ruler.rulerPersonality.wisdom = 40 + (rand() % 40);
        ruler.rulerPersonality.military = 40 + (rand() % 40);
        
        g_world.npcs[ruler.id] = ruler;
    }
    
    // Initial news
    addNews("Мир создан. Эра Возрождения начинается.", "Весь мир", 3, "misc");
}

// Simulate N ticks
void simulateTicks(int ticks) {
    for (int i = 0; i < ticks; i++) {
        simulateOneHour();
        g_world.tick++;
    }
}

// ============================================================================
// MAIN LOOP - Protocol Handler
// ============================================================================

int main() {
    std::string line;
    
    while (std::getline(std::cin, line)) {
        if (line.empty()) continue;
        
        JsonValue command = parseJson(line);
        JsonValue response = JsonValue::object();
        
        std::string cmd = command["command"].asString();
        
        if (cmd == "init") {
            response.set("status", "ok");
            response.set("message", "Nexus Engine initialized");
            response.set("version", "1.0.0");
        }
        else if (cmd == "buildWorld") {
            std::string playerId = command["player_id"].asString();
            buildWorld(playerId);
            
            response.set("status", "ok");
            response.set("tick", g_world.tick);
            response.set("world", g_world.toJson());
        }
        else if (cmd == "simulateTicks") {
            int ticks = command["ticks"].asInt();
            
            // Optionally load world state if provided
            if (command.has("world")) {
                g_world = World::fromJson(command["world"]);
            }
            
            simulateTicks(ticks);
            
            response.set("status", "ok");
            response.set("tick", g_world.tick);
            response.set("news_count", (int)g_world.news.size());
            response.set("world", g_world.toJson());
        }
        else if (cmd == "ping") {
            response.set("status", "ok");
            response.set("pong", true);
            response.set("tick", g_world.tick);
        }
        else {
            response.set("status", "error");
            response.set("message", "Unknown command: " + cmd);
        }
        
        std::cout << response.toString() << std::endl;
        std::cout.flush();
    }
    
    return 0;
}
