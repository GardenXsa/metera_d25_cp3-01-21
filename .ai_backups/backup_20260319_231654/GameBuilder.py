import os
import json
import subprocess
import re
import tkinter as tk
from tkinter import filedialog, messagebox
import customtkinter as ctk
from PIL import Image

# Настройка темы
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

class GameBuilderApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Chronicles of Meterea - Builder v1.1")
        self.geometry("600x520")
        self.resizable(False, False)

        self.project_path = os.getcwd()
        self.icon_path = ctk.StringVar(value="")
        self.current_version = self.get_current_version()

        self.setup_ui()

    def get_current_version(self):
        try:
            with open("package.json", "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("version", "1.0.0")
        except:
            return "1.0.0"

    def setup_ui(self):
        self.label_title = ctk.CTkLabel(self, text="BUILDER: METEREA", font=("MedievalSharp", 24, "bold"), text_color="#5dade2")
        self.label_title.pack(pady=20)

        # Инфо-блок про версию
        self.info_label = ctk.CTkLabel(self, text="Формат версии: X.Y.Z (например, 0.0.6)", font=("Arial", 11), text_color="#7f8c8d")
        self.info_label.pack()

        # Поле Версии
        self.version_frame = ctk.CTkFrame(self)
        self.version_frame.pack(pady=5, padx=40, fill="x")
        
        self.label_version = ctk.CTkLabel(self.version_frame, text="Версия игры:", font=("Arial", 14))
        self.label_version.pack(side="left", padx=10, pady=10)
        
        self.entry_version = ctk.CTkEntry(self.version_frame, width=150)
        self.entry_version.insert(0, self.current_version)
        self.entry_version.pack(side="right", padx=10, pady=10)

        # Выбор иконки
        self.icon_frame = ctk.CTkFrame(self)
        self.icon_frame.pack(pady=10, padx=40, fill="x")

        self.btn_browse_icon = ctk.CTkButton(self.icon_frame, text="Выбрать иконку", command=self.browse_icon)
        self.btn_browse_icon.pack(side="left", padx=10, pady=10)

        self.label_icon_path = ctk.CTkLabel(self.icon_frame, textvariable=self.icon_path, font=("Arial", 10), wraplength=250)
        self.label_icon_path.pack(side="right", padx=10, pady=10)

        # Прогресс
        self.status_label = ctk.CTkLabel(self, text="Готов к сборке", text_color="gray")
        self.status_label.pack(pady=(20,0))

        self.progress_bar = ctk.CTkProgressBar(self)
        self.progress_bar.set(0)
        self.progress_bar.pack(pady=10, padx=40, fill="x")

        # Кнопка Сборки
        self.btn_build = ctk.CTkButton(self, text="🚀 НАЧАТЬ СБОРКУ (.EXE)", 
                                       font=("Arial", 16, "bold"), 
                                       height=50, 
                                       fg_color="#2e7d32", 
                                       hover_color="#1b5e20",
                                       command=self.start_build)
        self.btn_build.pack(pady=20, padx=40, fill="x")

    def browse_icon(self):
        file = filedialog.askopenfilename(filetypes=[("Images", "*.png *.jpg *.jpeg *.webp *.bmp *.tga")])
        if file:
            self.icon_path.set(file)

    def is_valid_version(self, version):
        # Регулярка для проверки SemVer (X.Y.Z)
        pattern = r"^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$"
        return re.match(pattern, version) is not None

    def convert_icon(self, source_path):
        target_path = os.path.join(self.project_path, "assets", "icon.ico")
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        img = Image.open(source_path)
        img = img.resize((256, 256), Image.Resampling.LANCZOS)
        img.save(target_path, format='ICO', sizes=[(256, 256)])
        return target_path

    def update_package_json(self, version):
        path = "package.json"
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        data["version"] = version
        if "build" not in data: data["build"] = {}
        data["build"]["win"] = {"target": "nsis", "icon": "assets/icon.ico"}

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def start_build(self):
        version = self.entry_version.get().strip()
        icon = self.icon_path.get()

        if not self.is_valid_version(version):
            messagebox.showerror("Ошибка версии", f"Версия '{version}' недопустима!\n\nИспользуйте формат X.Y.Z (например 0.0.6 или 1.2.0).\nНельзя использовать 4 числа!")
            return

        if not icon and not os.path.exists("assets/icon.ico"):
            messagebox.showerror("Ошибка", "Выберите изображение для иконки!")
            return

        try:
            self.btn_build.configure(state="disabled")
            
            if icon:
                self.status_label.configure(text="📦 Конвертация иконки...", text_color="white")
                self.update()
                self.convert_icon(icon)
            
            self.status_label.configure(text="📝 Обновление package.json...", text_color="white")
            self.progress_bar.set(0.3)
            self.update()
            self.update_package_json(version)

            self.status_label.configure(text="🏗️ Сборка пошла (может занять 2-5 минут)...", text_color="#f1c40f")
            self.progress_bar.set(0.6)
            self.update()

            # Запуск npm run dist
            process = subprocess.Popen("npm run dist", shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            
            for line in process.stdout:
                print(line, end="") # Вывод в консоль для отладки
            
            process.wait()

            if process.returncode == 0:
                self.progress_bar.set(1.0)
                self.status_label.configure(text="✅ ГОТОВО!", text_color="#2ecc71")
                messagebox.showinfo("Успех", "Сборка завершена успешно!")
                os.startfile(os.path.join(self.project_path, "dist"))
            else:
                raise Exception("Electron-builder завершился с ошибкой. Проверь терминал.")

        except Exception as e:
            self.status_label.configure(text="❌ ОШИБКА", text_color="#e74c3c")
            messagebox.showerror("Ошибка билда", str(e))
        finally:
            self.btn_build.configure(state="normal")

if __name__ == "__main__":
    app = GameBuilderApp()
    app.mainloop()