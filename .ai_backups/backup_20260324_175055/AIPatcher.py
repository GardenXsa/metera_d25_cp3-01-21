import os
import json
import shutil
import datetime
import difflib
import customtkinter as ctk
from tkinter import messagebox

# Настройки в стиле VS Code
BG_COLOR = "#1e1e1e"
SIDEBAR_COLOR = "#252526"
TEXT_COLOR = "#d4d4d4"
DIFF_ADD_BG = "#234b23" 
DIFF_DEL_BG = "#512020" 
ACCENT_COLOR = "#007acc" 

BACKUP_DIR = ".ai_backups"

class BackupManagerWindow(ctk.CTkToplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.title("Машина Времени (Менеджер Бэкапов)")
        self.geometry("600x400")
        self.configure(fg_color=BG_COLOR)
        self.attributes("-topmost", True)
        
        lbl = ctk.CTkLabel(self, text="История патчей (Вечные бэкапы):", font=("Consolas", 16, "bold"), text_color=ACCENT_COLOR)
        lbl.pack(pady=10)

        self.scroll_frame = ctk.CTkScrollableFrame(self, fg_color=SIDEBAR_COLOR)
        self.scroll_frame.pack(fill="both", expand=True, padx=10, pady=10)

        self.load_backups()

    def load_backups(self):
        if not os.path.exists(BACKUP_DIR):
            ctk.CTkLabel(self.scroll_frame, text="Бэкапов пока нет.", text_color=TEXT_COLOR).pack(pady=20)
            return

        backups = sorted(os.listdir(BACKUP_DIR), reverse=True)
        
        if not backups:
            ctk.CTkLabel(self.scroll_frame, text="Бэкапов пока нет.", text_color=TEXT_COLOR).pack(pady=20)
            return

        for b_dir in backups:
            full_path = os.path.join(BACKUP_DIR, b_dir)
            if not os.path.isdir(full_path): continue

            meta_path = os.path.join(full_path, "patch_meta.json")
            patch_name = "Неизвестный патч"
            timestamp = b_dir.replace("backup_", "")
            
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, 'r', encoding='utf-8') as f:
                        meta = json.load(f)
                        patch_name = meta.get("patch_name", patch_name)
                        timestamp = meta.get("timestamp", timestamp)
                except: pass

            frame = ctk.CTkFrame(self.scroll_frame, fg_color=BG_COLOR, corner_radius=5)
            frame.pack(fill="x", pady=5, padx=5)

            info_text = f"[{timestamp}] {patch_name}"
            lbl_info = ctk.CTkLabel(frame, text=info_text, font=("Consolas", 12), text_color=TEXT_COLOR, anchor="w")
            lbl_info.pack(side="left", padx=10, pady=10, fill="x", expand=True)

            btn_restore = ctk.CTkButton(frame, text="ОТКАТИТЬ СЮДА", fg_color="#c0392b", hover_color="#e74c3c", width=120,
                                        command=lambda p=full_path, n=patch_name: self.restore_backup(p, n))
            btn_restore.pack(side="right", padx=10)

    def restore_backup(self, backup_path, patch_name):
        confirm = messagebox.askyesno("Подтверждение отката", 
            f"Вы уверены, что хотите отменить изменения патча:\n'{patch_name}'?\n\nФайлы будут восстановлены из бэкапа.")
        
        if confirm:
            try:
                restored_count = 0
                for root, dirs, files in os.walk(backup_path):
                    for file in files:
                        if file == "patch_meta.json": continue
                        
                        b_file_path = os.path.join(root, file)
                        rel_path = os.path.relpath(b_file_path, backup_path)
                        target_file = os.path.join(os.getcwd(), rel_path)
                        
                        shutil.copy2(b_file_path, target_file)
                        restored_count += 1
                
                messagebox.showinfo("Откат успешен", f"Восстановлено файлов: {restored_count}.\nПроект возвращен к состоянию до патча '{patch_name}'.")
                self.destroy()
            except Exception as e:
                messagebox.showerror("Ошибка отката", f"Не удалось восстановить файлы:\n{e}")

class AIPatcherPro(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("AI Patcher Pro - Smart AST Edition")
        self.geometry("1200x800")
        self.configure(fg_color=BG_COLOR)
        
        self.parsed_operations = []
        self.memory_files = {} 
        self.current_patch_name = "Без имени"

        self.setup_ui()

    def setup_ui(self):
        self.sidebar = ctk.CTkFrame(self, width=350, fg_color=SIDEBAR_COLOR, corner_radius=0)
        self.sidebar.pack(side="left", fill="y")

        lbl_title = ctk.CTkLabel(self.sidebar, text="AI PATCHER", font=("Consolas", 20, "bold"), text_color=ACCENT_COLOR)
        lbl_title.pack(pady=15, padx=10)

        lbl_inst = ctk.CTkLabel(self.sidebar, text="1. Вставь JSON от нейросети:", font=("Consolas", 12), text_color=TEXT_COLOR)
        lbl_inst.pack(anchor="w", padx=10)

        btn_frame = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        btn_frame.pack(fill="x", padx=10, pady=(5, 0))
        
        self.btn_paste = ctk.CTkButton(btn_frame, text="📋 Вставить", width=150, fg_color="#8e44ad", hover_color="#9b59b6", command=self.paste_json)
        self.btn_paste.pack(side="left", padx=(0, 5))
        
        self.btn_clear = ctk.CTkButton(btn_frame, text="🗑 Очистить", width=150, fg_color="#c0392b", hover_color="#e74c3c", command=self.clear_json)
        self.btn_clear.pack(side="right", padx=(5, 0))

        self.txt_json = ctk.CTkTextbox(self.sidebar, height=250, fg_color=BG_COLOR, text_color=TEXT_COLOR, font=("Consolas", 11))
        self.txt_json.pack(padx=10, pady=5, fill="x")

        self.btn_analyze = ctk.CTkButton(self.sidebar, text="🔍 Анализировать код", fg_color=ACCENT_COLOR, hover_color="#005999", command=self.analyze_json)
        self.btn_analyze.pack(pady=10, padx=10, fill="x")

        self.lbl_status = ctk.CTkLabel(self.sidebar, text="Статус: Ожидание", font=("Consolas", 12), text_color="#f1c40f")
        self.lbl_status.pack(pady=5)

        self.btn_apply = ctk.CTkButton(self.sidebar, text="✓ ПРИМЕНИТЬ ИЗМЕНЕНИЯ", fg_color="#27ae60", hover_color="#2ecc71", state="disabled", command=self.apply_patch)
        self.btn_apply.pack(pady=10, padx=10, fill="x", side="bottom")

        self.btn_history = ctk.CTkButton(self.sidebar, text="🗄️ МЕНЕДЖЕР БЭКАПОВ", fg_color="#8e44ad", hover_color="#9b59b6", command=self.open_backup_manager)
        self.btn_history.pack(pady=5, padx=10, fill="x", side="bottom")

        self.main_area = ctk.CTkFrame(self, fg_color=BG_COLOR, corner_radius=0)
        self.main_area.pack(side="right", fill="both", expand=True)

        lbl_diff = ctk.CTkLabel(self.main_area, text="Визуальное сравнение кода (Diff):", font=("Consolas", 14, "bold"), text_color=TEXT_COLOR)
        lbl_diff.pack(anchor="w", padx=10, pady=10)

        self.txt_diff = ctk.CTkTextbox(self.main_area, fg_color=BG_COLOR, text_color=TEXT_COLOR, font=("Consolas", 13), wrap="none")
        self.txt_diff.pack(padx=10, pady=5, fill="both", expand=True)
        
        self.txt_diff.tag_config("add", background=DIFF_ADD_BG, foreground="#ffffff")
        self.txt_diff.tag_config("del", background=DIFF_DEL_BG, foreground="#ffffff")
        self.txt_diff.tag_config("info", foreground=ACCENT_COLOR)
        self.txt_diff.tag_config("error", foreground="#e74c3c")

    def paste_json(self):
        try:
            text = self.clipboard_get()
            self.txt_json.delete("1.0", "end")
            self.txt_json.insert("end", text)
        except Exception:
            messagebox.showwarning("Ошибка", "Буфер обмена пуст или недоступен.")

    def clear_json(self):
        self.txt_json.delete("1.0", "end")
        self.txt_diff.configure(state="normal")
        self.txt_diff.delete("1.0", "end")
        self.txt_diff.configure(state="disabled")
        self.btn_apply.configure(state="disabled")
        self.lbl_status.configure(text="Статус: Ожидание", text_color="#f1c40f")

    def log_diff(self, text, tag=None):
        self.txt_diff.configure(state="normal")
        if tag:
            self.txt_diff.insert("end", text + "\n", tag)
        else:
            self.txt_diff.insert("end", text + "\n")
        self.txt_diff.configure(state="disabled")

    def open_backup_manager(self):
        BackupManagerWindow(self)

    def extract_brace_block(self, content, start_marker):
        """Умный алгоритм: находит начало функции и математически вычисляет ее конец по скобкам {}"""
        start_idx = content.find(start_marker)
        if start_idx == -1:
            return -1, -1
        
        brace_start = content.find('{', start_idx)
        if brace_start == -1:
            return -1, -1
            
        brace_count = 1
        i = brace_start + 1
        in_string = False
        string_char = ''
        is_escaped = False
        
        while i < len(content) and brace_count > 0:
            char = content[i]
            
            if in_string:
                if is_escaped:
                    is_escaped = False
                elif char == '\\':
                    is_escaped = True
                elif char == string_char:
                    in_string = False
            else:
                if char in ['"', "'", '`']:
                    in_string = True
                    string_char = char
                elif char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    
            i += 1
            
        if brace_count == 0:
            return start_idx, i # Возвращаем индекс начала маркера и индекс сразу после закрывающей '}'
        return -1, -1

    def analyze_json(self):
        self.txt_diff.configure(state="normal")
        self.txt_diff.delete("1.0", "end")
        self.txt_diff.configure(state="disabled")
        self.btn_apply.configure(state="disabled")
        self.memory_files = {}
        self.parsed_operations = []

        raw_json = self.txt_json.get("1.0", "end").strip()
        if not raw_json:
            self.lbl_status.configure(text="Ошибка: Пустой JSON", text_color="#e74c3c")
            return

        try:
            if "```json" in raw_json:
                raw_json = raw_json.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_json:
                raw_json = raw_json.split("```")[1].split("```")[0].strip()
            patch_data = json.loads(raw_json)
        except Exception as e:
            self.log_diff(f"ОШИБКА ПАРСИНГА JSON:\n{e}", "error")
            self.lbl_status.configure(text="Ошибка JSON", text_color="#e74c3c")
            return

        self.current_patch_name = patch_data.get("patch_name", "Без имени")
        operations = patch_data.get("operations", [])
        has_errors = False

        self.log_diff(f"=== Анализ патча: {self.current_patch_name} ===\n", "info")

        for op in operations:
            action = op.get("action")
            path = op.get("path")
            abs_path = os.path.abspath(path)

            self.log_diff(f"Файл: {path} | Действие: {action}", "info")

            if action == "create_file":
                content = op.get("content", "")
                self.memory_files[abs_path] = content
                self.log_diff(f"+ Создание нового файла", "add")
                self.parsed_operations.append(op)
                continue

            if not os.path.exists(abs_path):
                self.log_diff(f"ОШИБКА: Файл не найден в проекте!", "error")
                has_errors = True
                continue

            # Если файл уже редактировался в этом патче, берем его из памяти, иначе с диска
            original_content = self.memory_files.get(abs_path)
            if original_content is None:
                with open(abs_path, 'r', encoding='utf-8') as f:
                    original_content = f.read()

            new_content = original_content
            search = op.get("search", "")
            content_to_insert = op.get("content", "")

            if action == "replace":
                if search not in original_content:
                    self.log_diff(f"ОШИБКА: Искомый текст не найден!", "error")
                    has_errors = True
                    continue
                new_content = original_content.replace(search, content_to_insert)

            elif action == "insert_after":
                if search not in original_content:
                    self.log_diff(f"ОШИБКА: Якорь (search) не найден!", "error")
                    has_errors = True
                    continue
                new_content = original_content.replace(search, search + "\n" + content_to_insert)

            # --- НОВЫЕ УМНЫЕ КОМАНДЫ ---
            elif action in ["replace_js_block", "delete_js_block"]:
                start_marker = op.get("start_marker", "")
                start_idx, end_idx = self.extract_brace_block(original_content, start_marker)
                
                if start_idx == -1 or end_idx == -1:
                    self.log_diff(f"ОШИБКА: Не удалось найти функцию по маркеру: {start_marker}", "error")
                    has_errors = True
                    continue
                
                if action == "delete_js_block":
                    new_content = original_content[:start_idx] + original_content[end_idx:]
                else: # replace_js_block
                    new_content = original_content[:start_idx] + content_to_insert + "\n" + original_content[end_idx:]

            orig_lines = original_content.splitlines()
            new_lines = new_content.splitlines()
            
            diff = list(difflib.unified_diff(orig_lines, new_lines, lineterm='', n=3))
            
            if not diff:
                self.log_diff("Изменений нет (текст идентичен).", "info")
            else:
                for line in diff[2:]:
                    if line.startswith('+'):
                        self.log_diff(line, "add")
                    elif line.startswith('-'):
                        self.log_diff(line, "del")
                    else:
                        self.log_diff(line)

            self.memory_files[abs_path] = new_content
            self.parsed_operations.append(op)
            self.log_diff("-" * 50)

        if has_errors:
            self.lbl_status.configure(text="Найдены ошибки!", text_color="#e74c3c")
            self.log_diff("\nВНИМАНИЕ: Патч содержит ошибки (якоря не найдены). Применять небезопасно. Скажи нейросети обновить код.", "error")
        else:
            self.lbl_status.configure(text="Готово к применению", text_color="#2ecc71")
            self.btn_apply.configure(state="normal")

    def apply_patch(self):
        if not self.memory_files: return

        timestamp_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        folder_timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = os.path.join(BACKUP_DIR, f"backup_{folder_timestamp}")
        os.makedirs(backup_dir, exist_ok=True)

        meta_path = os.path.join(backup_dir, "patch_meta.json")
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump({
                "timestamp": timestamp_str,
                "patch_name": self.current_patch_name
            }, f, ensure_ascii=False, indent=2)

        try:
            for abs_path, new_content in self.memory_files.items():
                if os.path.exists(abs_path):
                    rel_path = os.path.relpath(abs_path, start=os.getcwd())
                    b_path = os.path.join(backup_dir, rel_path)
                    os.makedirs(os.path.dirname(b_path), exist_ok=True)
                    shutil.copy2(abs_path, b_path)

                os.makedirs(os.path.dirname(abs_path), exist_ok=True)
                with open(abs_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)

            self.lbl_status.configure(text="Патч успешно применен!", text_color="#2ecc71")
            self.btn_apply.configure(state="disabled")
            messagebox.showinfo("Успех", f"Код обновлен!\nБэкап '{self.current_patch_name}' сохранен навечно.")
            self.txt_json.delete("1.0", "end")
            self.txt_diff.configure(state="normal")
            self.txt_diff.delete("1.0", "end")
            self.txt_diff.configure(state="disabled")

        except Exception as e:
            messagebox.showerror("Критическая ошибка", f"Ошибка при записи файлов:\n{e}")

if __name__ == "__main__":
    app = AIPatcherPro()
    app.mainloop()